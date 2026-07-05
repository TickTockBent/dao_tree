// src/stores/secretRealm.ts — Secret Realm expeditions (slice 7, design §6.4).
//
// SKELETON contract kept intact: the public API + save slice shape below are
// pinned (wired into main.ts, test-setup.ts, App.vue, and read by
// engine/state.ts via totalClears). This file implements the expedition side
// so the wired hooks go live.
//
// Contract notes honored:
//   - Expedition run-state (`expedition`) is LOCALLY scoped: it resets on
//     enter() and ONLY on enter() — never via engine/doReset.ts. No other
//     store's state is touched on entry (design §6.4 "nothing outside the
//     expedition resets").
//   - Rewards resolve through OTHER stores' public APIs: materials via
//     alchemy.addMaterial(), Insight surges via dao.addInsight(), the
//     first-clear Glimpse via dao.grantGlimpse(). No reward math lives outside
//     SECRET_REALM_DATA.
//   - Rotation + cooldowns key on game.timePlayed (deterministic, save-safe).
//   - No RNG anywhere (v1 is deterministic by design).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { SECRET_REALM_DATA, findSecretRealmSite } from '@/data/secret-realm'
import { useGameStore } from './game'
import { usePipelinesStore } from './pipelines'
import { useDaoStore } from './dao'
import { useAlchemyStore } from './alchemy'
// Slice 10 (D36): first-clearing a site is an encounter first (realmEra-
// qualified). Readerless karma write, deferred lookup keeps it cycle-free.
import { recordSiteEncounter } from '@/engine/karmaEvents'
import type { SecretRealmSiteKey } from '@/engine/types'
import type { SecretRealmSite } from '@/data/secret-realm'

export interface ExpeditionState {
  active: boolean
  siteKey: SecretRealmSiteKey | null
  /** Seconds elapsed in the current run. */
  elapsed: number
  /** Essence gathered this run (converts to rewards on resolve). */
  essence: number
}

export interface SecretRealmSlice {
  expedition: ExpeditionState
  /** Completed runs per site (first-clear bonuses key off 0 → 1). */
  clears: Partial<Record<SecretRealmSiteKey, number>>
  /** timePlayed threshold before each site can be entered again. */
  cooldownUntil: Partial<Record<SecretRealmSiteKey, number>>
}

export function freshExpedition(): ExpeditionState {
  return { active: false, siteKey: null, elapsed: 0, essence: 0 }
}

export function freshSecretRealmSlice(): SecretRealmSlice {
  return { expedition: freshExpedition(), clears: {}, cooldownUntil: {} }
}

export const useSecretRealmStore = defineStore('secretRealm', () => {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  const dao = useDaoStore()
  const alchemy = useAlchemyStore()

  const expedition = ref<ExpeditionState>(freshExpedition())
  const clears = ref<Partial<Record<SecretRealmSiteKey, number>>>({})
  const cooldownUntil = ref<Partial<Record<SecretRealmSiteKey, number>>>({})

  // In-memory reveal latch. The slice shape is pinned (no `revealed` field), so
  // this is derived, not persisted — but the reveal gate is `coreForged`, which
  // is monotonic within a life, so it re-latches on the first post-load tick.
  const revealedLatch = ref(false)

  // ---- Reveal -------------------------------------------------------------

  function isRevealGateMet(): boolean {
    return meets(SECRET_REALM_DATA.reveal, buildGameState())
  }

  /** System revealed (latched or gate met — never flickers off on regress). */
  const revealed = computed<boolean>(() => revealedLatch.value || isRevealGateMet())

  function isRevealed(): boolean {
    return revealed.value
  }

  // ---- Site availability + rotation ---------------------------------------

  /** True if a site's unlock gate is met (live meets() eval). */
  function siteIsUnlocked(siteKey: SecretRealmSiteKey): boolean {
    return meets(findSecretRealmSite(siteKey).unlock, buildGameState())
  }

  /** Sites whose unlock gate is currently met, in data order (rotation ring). */
  const unlockedSites = computed<readonly SecretRealmSite[]>(() => {
    const state = buildGameState()
    return SECRET_REALM_DATA.sites.filter((site) => meets(site.unlock, state))
  })

  /** The rotation's currently-active site key (null before reveal / no sites). */
  const activeSiteKey = computed<SecretRealmSiteKey | null>(() => {
    if (!revealed.value) return null
    const ring = unlockedSites.value
    if (ring.length === 0) return null
    const window = Math.floor(game.timePlayed / SECRET_REALM_DATA.rotation.periodSeconds)
    const index = ((window % ring.length) + ring.length) % ring.length
    return ring[index]!.key
  })

  /** Seconds of timePlayed until the rotation advances to the next site. */
  const secondsUntilRotation = computed<number>(() => {
    const period = SECRET_REALM_DATA.rotation.periodSeconds
    return period - (game.timePlayed % period)
  })

  // ---- Clears + cooldown reads --------------------------------------------

  /** Total completed runs across all sites (meets() clause input). */
  const totalClears = computed<number>(() =>
    SECRET_REALM_DATA.sites.reduce((sum, s) => sum + (clears.value[s.key] ?? 0), 0),
  )

  function clearsOf(siteKey: SecretRealmSiteKey): number {
    return clears.value[siteKey] ?? 0
  }

  /** Seconds of timePlayed remaining on a site's cooldown (0 if ready). */
  function cooldownRemaining(siteKey: SecretRealmSiteKey): number {
    const until = cooldownUntil.value[siteKey] ?? 0
    return Math.max(0, until - game.timePlayed)
  }

  // ---- Entry gate ---------------------------------------------------------

  /** Whether a site can be entered right now (active in rotation, unlocked, off cooldown, no run). */
  function canEnter(siteKey: SecretRealmSiteKey): boolean {
    if (!revealed.value) return false
    if (expedition.value.active) return false
    if (siteKey !== activeSiteKey.value) return false
    if (!meets(findSecretRealmSite(siteKey).unlock, buildGameState())) return false
    return cooldownRemaining(siteKey) <= 0
  }

  /** Begin an expedition: the ONLY place expedition sub-state resets. */
  function enter(siteKey: SecretRealmSiteKey): boolean {
    if (!canEnter(siteKey)) return false
    expedition.value = { active: true, siteKey, elapsed: 0, essence: 0 }
    return true
  }

  // ---- Essence model ------------------------------------------------------

  /** Current essence/sec for the active run (0 when idle). */
  function essenceRate(): number {
    const run = expedition.value
    if (!run.active || run.siteKey === null) return 0
    const site = findSecretRealmSite(run.siteKey)
    const base = SECRET_REALM_DATA.essenceBase
    const mod = site.modifier
    switch (mod.essenceModel) {
      case 'qiRate': {
        // Sub-linear coupling: log10(1 + Qi/sec) stays small for any Decimal.
        const coupling = pipelines.qiPerSecond.add(1).log10().toNumber()
        return base * (1 + coupling) * mod.rateMult
      }
      case 'insightRate': {
        const insightPerSec = pipelines.insightPerSecond.toNumber()
        const scale = mod.insightScale ?? 0
        return base * (1 + insightPerSec * scale) * mod.rateMult
      }
      case 'fixed':
        return base * mod.rateMult
    }
  }

  // ---- Resolution ---------------------------------------------------------

  function resolveExpedition(site: SecretRealmSite): void {
    const essence = expedition.value.essence
    const rewards = site.rewards

    // Materials → the alchemy profession economy.
    alchemy.addMaterial(rewards.material, essence * rewards.materialPerEssence)
    // Insight surge → the Dao lattice currency.
    dao.addInsight(new Decimal(essence * rewards.insightPerEssence))
    // First clear (0 → 1) may grant a free Glimpse of the vault's buried node.
    if (clearsOf(site.key) === 0) {
      // Slice 10 (D36): the site's first clear rings its encounter karma first.
      recordSiteEncounter(site.key)
      if (rewards.firstClearGlimpseNode) dao.grantGlimpse(rewards.firstClearGlimpseNode)
    }

    clears.value = { ...clears.value, [site.key]: clearsOf(site.key) + 1 }
    cooldownUntil.value = { ...cooldownUntil.value, [site.key]: game.timePlayed + site.cooldownSeconds }
    expedition.value = freshExpedition()
  }

  // ---- Update hook --------------------------------------------------------

  function update(diff: number): void {
    // Latch reveal the first tick the gate is met.
    if (!revealedLatch.value && isRevealGateMet()) revealedLatch.value = true

    const run = expedition.value
    if (!run.active || run.siteKey === null) return
    const site = findSecretRealmSite(run.siteKey)

    // Accrue essence, capped at exactly durationSeconds worth: only the partial
    // dt up to the boundary counts, so totals are tick-size-independent.
    const remainingToBoundary = Math.max(0, site.durationSeconds - run.elapsed)
    const effectiveDt = Math.min(diff, remainingToBoundary)
    if (effectiveDt > 0) {
      run.essence += essenceRate() * effectiveDt
    }
    run.elapsed += diff

    if (run.elapsed >= site.durationSeconds) resolveExpedition(site)
  }

  // ---- Save slice ---------------------------------------------------------

  function save(): Record<string, unknown> {
    return {
      expedition: { ...expedition.value },
      clears: { ...clears.value },
      cooldownUntil: { ...cooldownUntil.value },
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshSecretRealmSlice()) as Partial<SecretRealmSlice>
    expedition.value = { ...freshExpedition(), ...(s.expedition ?? {}) }
    clears.value = { ...(s.clears ?? {}) }
    cooldownUntil.value = { ...(s.cooldownUntil ?? {}) }
    // Reset the derived reveal latch (the alchemy.load idiom); the monotone
    // coreForged gate re-latches on the first post-load evaluation.
    revealedLatch.value = false
  }
  function fresh(): Record<string, unknown> {
    return freshSecretRealmSlice() as unknown as Record<string, unknown>
  }

  return {
    expedition,
    clears,
    cooldownUntil,
    revealed,
    activeSiteKey,
    secondsUntilRotation,
    unlockedSites,
    totalClears,
    isRevealed,
    isRevealGateMet,
    siteIsUnlocked,
    clearsOf,
    cooldownRemaining,
    canEnter,
    enter,
    essenceRate,
    update,
    save,
    load,
    fresh,
  }
})
