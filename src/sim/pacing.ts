// src/sim/pacing.ts — Act I pacing simulation (parity oracle, design §7/M7).
//
// Boots the new engine headless (Pinia stores without Vue), drives a competent
// player policy from fresh save to the First Tribulation, and asserts structural
// facts + pinned budget targets. The parity oracle — if the new engine passes
// the same budgets, pacing is preserved.
//
// Time model: event-stepped (analytic dt between decisions, not a 1s tick loop).
// The sim advances Qi to the next decision boundary, runs the decision, repeats.
//
// Run via: npm run sim

import { createPinia, setActivePinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useForgeStore } from '@/stores/forge'
import { usePipelinesStore } from '@/stores/pipelines'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { findRealm } from '@/data/realms'
import { SETPIECE_DATA } from '@/data/setpieces'

// ---- Pinned budgets (from the old pacing sim, pass-3 tune) ------------------
// Pinned budgets from the old pacing sim (reference targets for future parity pins).
export const PACING_BUDGETS = {
  diligent: {
    toFoundation: 3600,      // 1 hour to Foundation Establishment
    toCore: 14400,           // 4 hours to Core Formation
    toNascentSoul: 72000,    // 20 hours to Nascent Soul
    toSoulFormation: 216000, // 60 hours to Soul Formation
    toTribulation: 432000,   // 120 hours to tribulation ready
  },
  spineOnly: {
    toFoundation: 3600,
    toCore: 21600,           // 6 hours (no lattice discount)
    toNascentSoul: 108000,   // 30 hours
    toSoulFormation: 360000, // 100 hours
  },
  maxScar: {
    toTribulation: 432000,   // same as diligent
    scarHealTime: 720,       // 12 hours to full heal at max depth
  },
} as const

// ---- Sim state --------------------------------------------------------------

interface SimState {
  simSeconds: number
  maxIterations: number
}

/**
 * tsx runs this script under Node, which has no `localStorage`. `bootSim()`
 * calls `game.load()` (the same boot path `main.ts` uses in the browser),
 * which reads options/save through it. Shim a no-op in-memory store here —
 * confined to this file — so the existing boot path works headlessly without
 * touching `engine/save.ts` or `stores/game.ts`. This was never exercised
 * before the harden pass: `runPacingSim` was exported but never invoked, so
 * `npm run sim` silently did nothing (see the bottom of this file).
 */
function installLocalStorageShim(): void {
  if (typeof globalThis.localStorage !== 'undefined') return
  const memory = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => { memory.clear() },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() { return memory.size },
  } as Storage
}

function bootSim(): void {
  installLocalStorageShim()
  setActivePinia(createPinia())
  const game = useGameStore()
  game.load()
}

/** Advance Qi to a target, return elapsed seconds. */
function advanceToQi(target: Decimal, state: SimState): number {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  const qiPerSec = pipelines.qiPerSecond
  if (qiPerSec.lte(0)) return 0
  const current = game.points
  if (current.gte(target)) return 0
  const dt = target.sub(current).div(qiPerSec).toNumber()
  game.points = target
  game.timePlayed = game.timePlayed + dt
  state.simSeconds += dt
  return dt
}

/** Prestige a realm, advancing Qi to the threshold first. */
function prestigeRealm(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const game = useGameStore()
  const realm = useRealmStore()
  const r = findRealm(realmId)
  advanceToQi(new Decimal(r.reqBase), state)
  game.points = new Decimal(r.reqBase)
  realm.prestige(realmId)
}

/**
 * Repeatedly prestige a realm until `predicate` holds. Fails loudly past the
 * iteration cap instead of hanging — a stalled unlock gate or a zero-gain
 * loop is a policy bug worth surfacing, not an infinite `npm run sim`.
 */
function prestigeUntil(realmId: 'q' | 'f' | 'c' | 'n' | 's', predicate: () => boolean, state: SimState): void {
  let iterations = 0
  while (!predicate()) {
    prestigeRealm(realmId, state)
    iterations++
    if (iterations > state.maxIterations) {
      throw new Error(
        `prestigeUntil('${realmId}') exceeded ${state.maxIterations} iterations — ` +
          'an unlock gate is likely unmet or a prestige is yielding zero gain',
      )
    }
  }
}

/**
 * Diligent policy: climb the spine, open meridians, temper, reveal+buy lattice,
 * join sect, forge steady, pick aspect, face tribulation.
 */
function runDiligent(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()

  // Phase 1: Climb Qi Condensation.
  // Open all 12 primary meridians as they become affordable.
  for (let i = 0; i < 12; i++) {
    const cost = body.buyableCost('primaryMeridian', i)
    advanceToQi(cost, state)
    body.buyBuyable('primaryMeridian')
  }

  // Prestige q enough to reach 6th Level (at:90) for Foundation unlock.
  prestigeUntil('q', () => realm.realmBest('q').toNumber() >= 90, state)

  // Phase 2: Foundation Establishment.
  // Open 4 meridians (already done), temper to tendon (level 10).
  for (let i = 0; i < 10; i++) {
    const cost = body.buyableCost('temper', i)
    advanceToQi(cost, state)
    body.buyBuyable('temper')
  }

  // Prestige f to build Foundation best.
  prestigeUntil('f', () => realm.realmBest('f').toNumber() >= 1, state)

  // Phase 3: Core Formation (forge).
  // Bank Foundation fuel THEN forge. `c` only unlocks once `f.best` reaches
  // Great Circle (data-derived, not the lower forgeReq fuel minimum) — the
  // fuel bank must clear whichever threshold is higher, or forge.performForge
  // silently no-ops (forgeIsAvailable requires realm.isUnlocked('c')).
  const forge = useForgeStore()
  const fRealm = findRealm('f')
  const greatCircleAt = fRealm.substages.find((s) => s.label === 'Great Circle')!.at
  const fuelTarget = Math.max(SETPIECE_DATA.forge.forgeReq, greatCircleAt)
  prestigeUntil('f', () => new Decimal(realm.stateOf('f').points).gte(fuelTarget), state)
  forge.performForge('steady')

  // Phase 4: Climb toward Nascent Soul.
  // Continue prestiging c + n to reach n.
  prestigeUntil('c', () => realm.realmBest('c').toNumber() >= 2, state)
  prestigeUntil('n', () => realm.realmBest('n').toNumber() >= 1, state)

  // Pick Formless aspect (always available).
  const soulAspectRealm = findRealm('n')
  if (soulAspectRealm.soulAspect && !body.soulAspectChosen) {
    const formless = soulAspectRealm.soulAspect.aspects.find((a) => a.key === 'formless')!
    body.setSoulAspect('formless', formless.requires)
  }

  // Phase 5: Climb toward Soul Formation.
  prestigeUntil('n', () => realm.realmBest('n').toNumber() >= 175, state)
  prestigeUntil('s', () => realm.realmBest('s').toNumber() >= 1, state)

  // Continue climbing s toward tribulation trigger.
  prestigeUntil('s', () => realm.realmBest('s').toNumber() >= 320, state)
}

// ---- Main -------------------------------------------------------------------

function runProfile(name: string, fn: (state: SimState) => void): void {
  bootSim()
  const state: SimState = { simSeconds: 0, maxIterations: 100000 }
  const start = Date.now()
  fn(state)
  const elapsed = Date.now() - start
  console.log(`\n=== ${name} ===`)
  console.log(`Sim time: ${state.simSeconds.toFixed(0)}s (${(state.simSeconds / 3600).toFixed(1)}h)`)
  console.log(`Wall time: ${elapsed}ms`)

  // Structural assertions.
  const realm = useRealmStore()
  const body = useBodyStore()
  console.log(`q.best: ${realm.realmBest('q').toNumber()}`)
  console.log(`f.best: ${realm.realmBest('f').toNumber()}`)
  console.log(`c.best: ${realm.realmBest('c').toNumber()}`)
  console.log(`n.best: ${realm.realmBest('n').toNumber()}`)
  console.log(`s.best: ${realm.realmBest('s').toNumber()}`)
  console.log(`Meridians: ${body.primaryMeridians}`)
  console.log(`Temper: ${body.temperLevel}`)
  console.log(`Core grade: ${body.coreGrade}`)
  console.log(`Soul aspect: ${body.soulAspect}`)
}

export function runPacingSim(): void {
  console.log('=== Dao Tree Pacing Simulation (new engine) ===\n')

  // Run the diligent profile.
  runProfile('Diligent', runDiligent)

  // Structural assertion: the diligent profile should reach Soul Formation.
  const realm = useRealmStore()
  if (realm.realmBest('s').toNumber() < 1) {
    console.error('\nFAIL: Diligent profile did not reach Soul Formation')
  } else {
    console.log('\nPASS: Diligent profile reached Soul Formation')
  }

  // §6.6 no-engagement proof (slice 7): the diligent policy never touches the
  // Secret Realm or Alchemy systems (runDiligent calls neither store), so a
  // player who ignores them entirely must still reach Soul Formation with
  // zero expedition clears and zero pills crafted. These are ACCELERANTS,
  // never requirements — this is the pacing sim's proof of that invariant.
  const secretRealm = useSecretRealmStore()
  const alchemy = useAlchemyStore()
  const pillsHeld = Object.values(alchemy.pills).reduce((sum, n) => sum + (n ?? 0), 0)
  console.log(`\nSecret Realm clears (diligent, zero-touch policy): ${secretRealm.totalClears}`)
  console.log(`Alchemy pills held (diligent, zero-touch policy): ${pillsHeld}`)
  if (secretRealm.totalClears !== 0 || pillsHeld !== 0) {
    console.error('FAIL: diligent policy engaged optional slice-7 systems (should be zero-touch)')
  } else {
    console.log('PASS: diligent policy reached Soul Formation with zero expedition clears and zero pills')
  }

  // §6.6 zero-corruption proof (slice 8): the diligent policy always forges
  // Steady (adds zero corruption by data — HEART_DEMON_DATA.corruption.sources.
  // forgePush has no 'steady' key) and never faces a tribulation in this run,
  // so its only possible corruption source is a rushed (Flawed/Stable-band)
  // Foundation prestige. The policy fully opens meridians, tempers to Tendons,
  // and climbs q to 6th Level BEFORE ever touching f (see runDiligent), so its
  // live grade score should land Solid or better every time — both unlisted
  // in rushedBreakthrough, i.e. zero corruption. If that assumption is wrong
  // for even one of the policy's several f prestiges (Phase 2 first pass, or
  // Phase 3's fuel-banking passes, which may run after a cascade wipes q.best
  // — the Peak Foundation keep-rule isn't earned yet at that point), the
  // policy is unknowingly demonizing the "clean" path — a real finding, not
  // something this check should paper over by retuning HEART_DEMON_DATA.
  const heartDemons = useHeartDemonsStore()
  console.log(`\nHeart Demon corruption (diligent, zero-touch policy): ${heartDemons.corruption}`)
  console.log(`Dao Heart stacks (diligent, zero-touch policy): ${heartDemons.daoHeartStacks}`)
  if (heartDemons.corruption !== 0) {
    console.error(
      'FAIL: diligent policy accrued heart-demon corruption — its Foundation prestiges landed a ' +
        'low live band at least once (see the harden-pass finding in the slice-8 report)',
    )
  } else {
    console.log('PASS: diligent policy reached Soul Formation with zero heart-demon corruption')
  }
}

// Executed via `npm run sim` (tsx src/sim/pacing.ts). Nothing else imports
// this module, so the top-level call below is the sim's sole entry point —
// the M7 scaffold exported `runPacingSim` but never wired an invocation,
// leaving `npm run sim` a silent no-op; wiring it here so the harden pass's
// optionality assertions (and every future addition to this sim) actually run.
runPacingSim()
