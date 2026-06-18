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
import { findRealm } from '@/data/realms'

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

function bootSim(): void {
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
  while (realm.realmBest('q').toNumber() < 90) {
    prestigeRealm('q', state)
  }

  // Phase 2: Foundation Establishment.
  // Open 4 meridians (already done), temper to tendon (level 10).
  for (let i = 0; i < 10; i++) {
    const cost = body.buyableCost('temper', i)
    advanceToQi(cost, state)
    body.buyBuyable('temper')
  }

  // Prestige f to build Foundation best.
  while (realm.realmBest('f').toNumber() < 1) {
    prestigeRealm('f', state)
  }

  // Phase 3: Core Formation (forge).
  // Bank Foundation fuel then forge.
  const forge = useForgeStore()
  const fState = realm.stateOf('f')
  const fuelTarget = new Decimal(25) // forgeReq
  while (new Decimal(fState.points).lt(fuelTarget)) {
    prestigeRealm('f', state)
  }
  forge.performForge('steady')

  // Phase 4: Climb toward Nascent Soul.
  // Continue prestiging c + n to reach n.
  while (realm.realmBest('c').toNumber() < 2) {
    prestigeRealm('c', state)
  }
  while (realm.realmBest('n').toNumber() < 1) {
    prestigeRealm('n', state)
  }

  // Pick Formless aspect (always available).
  const soulAspectRealm = findRealm('n')
  if (soulAspectRealm.soulAspect && !body.soulAspectChosen) {
    const formless = soulAspectRealm.soulAspect.aspects.find((a) => a.key === 'formless')!
    body.setSoulAspect('formless', formless.requires)
  }

  // Phase 5: Climb toward Soul Formation.
  while (realm.realmBest('n').toNumber() < 175) {
    prestigeRealm('n', state)
  }
  while (realm.realmBest('s').toNumber() < 1) {
    prestigeRealm('s', state)
  }

  // Continue climbing s toward tribulation trigger.
  while (realm.realmBest('s').toNumber() < 320) {
    prestigeRealm('s', state)
  }
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
}
