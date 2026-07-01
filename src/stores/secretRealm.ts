// src/stores/secretRealm.ts — Secret Realm expeditions (slice 7, design §6.4).
//
// SKELETON: the public API below is the pinned contract (wired into main.ts,
// test-setup.ts, App.vue, and consumed by the alchemy economy). The expedition
// logic is implemented by the slice-7 realm agent; every getter currently
// returns its identity/default so the game plays unchanged until then.
//
// Contract notes for the implementer:
//   - Expedition run-state (`expedition`) is LOCALLY scoped: it resets on
//     enter() and only on enter() — never via engine/doReset.ts (design §6.4
//     "nothing outside the expedition resets"; the layer is 'life' in
//     TREE_DATA only so the registry stays total).
//   - Rewards resolve through OTHER stores' public APIs: materials via
//     alchemy.addMaterial(), Insight surges via dao.insight, the first-clear
//     Glimpse via dao.grantNodeTier(). No reward math outside
//     SECRET_REALM_DATA.
//   - Rotation + cooldowns key on game.timePlayed (deterministic, save-safe).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SecretRealmSiteKey } from '@/engine/types'
import { SECRET_REALM_DATA } from '@/data/secret-realm'

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
  const expedition = ref<ExpeditionState>(freshExpedition())
  const clears = ref<Partial<Record<SecretRealmSiteKey, number>>>({})
  const cooldownUntil = ref<Partial<Record<SecretRealmSiteKey, number>>>({})

  /** System revealed (SECRET_REALM_DATA.reveal against live state). */
  const revealed = computed<boolean>(() => false) // TODO(slice-7 realm agent)

  /** The rotation's currently-active site key (null before reveal). */
  const activeSiteKey = computed<SecretRealmSiteKey | null>(() => null) // TODO(slice-7 realm agent)

  /** Total completed runs across all sites (meets() clause input). */
  const totalClears = computed<number>(() =>
    SECRET_REALM_DATA.sites.reduce((sum, s) => sum + (clears.value[s.key] ?? 0), 0),
  )

  function isRevealed(): boolean {
    return revealed.value
  }

  /** Whether a site can be entered right now (active in rotation, unlocked, off cooldown, no run). */
  function canEnter(_siteKey: SecretRealmSiteKey): boolean {
    return false // TODO(slice-7 realm agent)
  }

  /** Begin an expedition: the ONLY place expedition sub-state resets. */
  function enter(_siteKey: SecretRealmSiteKey): boolean {
    return false // TODO(slice-7 realm agent)
  }

  /** Current essence/sec for the active run (0 when idle). */
  function essenceRate(): number {
    return 0 // TODO(slice-7 realm agent)
  }

  function update(_diff: number): void {
    // TODO(slice-7 realm agent): accrue essence; resolve at durationSeconds.
  }

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
    totalClears,
    isRevealed,
    canEnter,
    enter,
    essenceRate,
    update,
    save,
    load,
    fresh,
  }
})
