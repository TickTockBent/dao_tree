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
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { findRealm } from '@/data/realms'
import { SETPIECE_DATA } from '@/data/setpieces'
import { LATTICE_DATA } from '@/data/lattice'
import { TECHNIQUE_DATA } from '@/data/techniques'
import { findSecretRealmSite } from '@/data/secret-realm'
import type { SectArchetypeKey, SecretRealmSiteKey } from '@/engine/types'

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

/** First-crossing timestamps (sim seconds) for the report table. */
interface ProfileMarks {
  fFirst?: number
  forge?: number
  nFirst?: number
  nPerfected?: number
  sFirst?: number
  sGreatCircle?: number
}

/**
 * A profile's horizontal-engagement plan, threaded through the shared spine
 * driver (`runSpine`). The VERTICAL play — meridians→12, temper→20, q→f→forge
 * steady→warm, and the rate-restoration re-climbs after every n/s cascade — is
 * identical for every profile that carries a config; only these flags flip which
 * horizontal grammar the run touches. Competent flips them all on; each focused
 * profile flips exactly one. See CONFIG objects below.
 */
interface SpineConfig {
  /** Join the sect at reveal + buy techniques cheapest-first. */
  engageSect: boolean
  /** Buy Dao lattice nodes cheapest-first toward COMPETENT_SEED_TARGET Seeds. */
  engageLattice: boolean
  /** Run secret-realm expeditions + craft/swallow alchemy pills. */
  engagePills: boolean
  /** Breathing Trance ON below the banking threshold (the §6.1 stance play). */
  useBreathingTrance: boolean
  /** Tick the alchemy + secretRealm stores across waits (expedition/pill clocks). */
  tickProfession: boolean
  /** Try to bind an element soul aspect (else the spine falls back to Formless). */
  pickElementAspect: boolean
  /** The archetype joined when engageSect is set. */
  sectArchetype: SectArchetypeKey
  /** Element-aspect preference order (only read when pickElementAspect is set). */
  aspectPreference: readonly string[]
  /**
   * COUNTERFACTUAL probe only: at the Formless fallback, force-grant the metal
   * element aspect by bypassing its daoElementTier Seed gate. Isolates the
   * Formless-vs-element penalty for aspect-locked profiles. NOT game-legal.
   */
  counterfactualForceMetalAspect?: boolean
  /**
   * Buy the extraordinary-meridian track payback-aware once unlocked (the
   * MeridianProbe question #14). No horizontal system; a spine-only probe of
   * whether the ×7.45 ext-meridian ceiling is must-buy content or a trap.
   */
  buyExtraordinaryMeridians?: boolean
  /**
   * COUNTERFACTUAL probe only (deferred-decision #2, tax-vs-ritual): force-
   * preserve c.best + c.milestones across every n/s cascade, simulating a
   * c keep rule that does NOT exist in the game. The † runs measure the
   * c-churn tax — the time spent re-climbing Core Formation after each big
   * prestige. NOT game-legal; implemented as a sim-side snapshot/restore
   * around realm.prestige (see simPrestige), never as an engine change.
   */
  counterfactualCKeep?: boolean
}

interface ProfileSummary {
  aspect: string
  seeds: number
  techniques: number
  pillsUsed: number
  expeditions: number
  sBest: number
  extraordinaryMeridians: number
}

/**
 * The Realistic actor's swept knobs (the jitter-sensitivity sweep varies these
 * two; everything else stays at the REALISTIC_* constants). Deterministic —
 * the sweep is a fixed grid, not sampled.
 */
interface RealisticParams {
  /** Late-game (post-forge) check-in interval, sim seconds. */
  lateCheckinSeconds: number
  /** Prestige when banked Qi >= this × reqBase (the over-banking factor). */
  bankMultiple: number
}

interface SimState {
  simSeconds: number
  maxIterations: number
  marks: ProfileMarks
  /** Horizontal plan (spine + focused profiles). Absent for the Diligent driver. */
  config?: SpineConfig
  /** Realistic knobs (defaulted to the REALISTIC_* constants; swept by the jitter grid). */
  realisticParams?: RealisticParams
  /** Gathering pills swallowed this run (report column). */
  pillsSwallowed: number
  /** Gathering/clarity/warding pills crafted this run. */
  pillsCrafted: number
  /** End-state snapshot, captured before the next bootSim swaps the Pinia. */
  summary?: ProfileSummary
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

/**
 * Latch first-crossing marks for the report table. PURE READS — safe to call
 * from the shared helpers without perturbing either profile's behavior.
 * Realm bests only move at prestiges and the core grade at the forge, so
 * checking at prestige boundaries captures every crossing.
 */
function recordMarks(state: SimState): void {
  const realm = useRealmStore()
  const body = useBodyStore()
  const marks = state.marks
  const now = state.simSeconds
  if (marks.fFirst === undefined && realm.realmBest('f').gte(1)) marks.fFirst = now
  if (marks.forge === undefined && body.coreGrade >= 0) marks.forge = now
  if (marks.nFirst === undefined && realm.realmBest('n').gte(1)) marks.nFirst = now
  if (marks.nPerfected === undefined && realm.realmBest('n').gte(N_PERFECTED_AT)) marks.nPerfected = now
  if (marks.sFirst === undefined && realm.realmBest('s').gte(1)) marks.sFirst = now
  if (marks.sGreatCircle === undefined && realm.realmBest('s').gte(S_GREAT_CIRCLE_AT)) marks.sGreatCircle = now
}

/** Prestige a realm, advancing Qi to the threshold first. */
function prestigeRealm(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const game = useGameStore()
  const realm = useRealmStore()
  const r = findRealm(realmId)
  // Mark check at entry catches changes made BETWEEN prestiges (the diligent
  // forge fires right before a c prestige — this stamps it at forge time, not
  // after the first c bank). Read-only; diligent behavior is untouched.
  recordMarks(state)
  advanceToQi(new Decimal(r.reqBase), state)
  game.points = new Decimal(r.reqBase)
  realm.prestige(realmId)
  recordMarks(state)
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

// ---- Competent profile (choice-viability run) --------------------------------
//
// Diligent (above) is deliberately spine-only — it doubles as the §6.6
// zero-touch proof and must stay untouched. Competent models a player who
// engages the horizontal systems and — THE KEY BEHAVIOR — re-climbs the lower
// realms after every n/s prestige cascade wipes them, so the big banks always
// run with the f/c/n sub-stage multipliers restored. Everything in this
// section is SIM POLICY (player behavior), never game data: if the run lands
// off budget that is a finding to report, not a license to retune src/data/**.
//
// NOT modeled, by design (for the Diligent/Competent CONTROL pair; some of these
// are now probed by the focused/probe profiles added below — noted inline):
// - The First Tribulation set-piece: every run STOPS at s Great Circle (320),
//   the tribulation trigger — the smoke tests cover the set-piece itself. (This
//   is also why the PillFocused Heaven-Warding pool bonus is untested: the sim
//   never enters a tribulation to draw it.)
// - Extraordinary meridians: NOT engaged by Diligent/Competent/the three focused
//   builds. The MeridianProbe profile (added below, question #14) DOES engage
//   them, payback-aware, to measure whether the track is must-buy or a trap.
// - Secret realms + alchemy: unengaged by Diligent/Competent/Lattice/Sect; the
//   PillFocused profile (and Realistic) DO engage them (expeditions + pills),
//   ticking the alchemy + secretRealm stores via config.tickProfession.
// - heart-demon trials + gate achievements: never engaged. Not ticking
//   heartDemons is FAITHFUL, not a gap: its passive bleed only DECAYS corruption
//   (never accrues it), and the control pair avoids every corruption source
//   (Steady forges, strong-band breakthroughs) — so corruption stays 0 either
//   way, which the §6.6 zero-touch assertion below pins.
// - SECLUSION (offline progression): DELIBERATELY not modeled by any profile.
//   This sim is a foreground-time oracle — it advances an analytic in-game clock
//   with no wall-clock/offline dimension, so there is no away-time for seclusion
//   rungs to convert. No profile buys a seclusion rung; engaging the system here
//   would measure nothing (the sim has no offline gap to accelerate) and would
//   only perturb the comparable foreground clocks. Left entirely out on purpose.

// Policy constants (player-behavior knobs, in this file's policy-constant style).
const COMPETENT_PAYBACK_SECONDS = 180 // buy a body upgrade when cost <= ~3 min of current Qi/sec
const COMPETENT_BANKING_QI_THRESHOLD = 1e6 // waits at/above this are "banking" — Breathing Trance OFF
const COMPETENT_MAX_EVENT_STEP_SECONDS = 600 // re-sample rates + tick systems at least this often
const COMPETENT_MERIDIAN_TARGET = 12
// HISTORY: this policy originally capped temper at 14 pre-core because meets()'
// temperTier clause was an EQUALITY check — tempering past Tendons before Core
// Formation latched left c.unlock permanently unmeetable (the 0.3.0 forge
// soft-lock, found BY this sim). The clause is now reached-or-above (engine
// fix in meets.ts), so the cap is gone and the policy tempers straight to
// target — which doubles as the regression proof that over-tempering no
// longer locks the forge.
const COMPETENT_TEMPER_TARGET = 20 // Marrow
const COMPETENT_SEED_TARGET = 8 // Dao Seeds held (lattice tier-2 nodes)
const COMPETENT_NASCENT_RECLIMB_PRE_KEEP = 30 // Peak NS — n restoration depth before the s keep rule lands
const COMPETENT_SECT_ARCHETYPE = 'azureSword' // the first archetype in SECT_DATA
const COMPETENT_ASPECT_PREFERENCE = ['fireSoul', 'woodSoul', 'earthSoul', 'metalSoul', 'waterSoul'] as const

// Data-derived thresholds (read from src/data/realms.ts, never retuned here).
const Q_SIXTH_LEVEL_AT = findRealm('q').substages.find((s) => s.label === '6th Level')!.at
const Q_TENTH_LEVEL_AT = findRealm('q').substages.find((s) => s.label === '10th Level')!.at
const Q_TOP_SUBSTAGE_AT = findRealm('q').substages[findRealm('q').substages.length - 1]!.at
// Extraordinary-meridian track cap (data limit) — MeridianProbe only.
const EXTRAORDINARY_MERIDIAN_TARGET = 8
const F_GREAT_CIRCLE_AT = findRealm('f').substages.find((s) => s.label === 'Great Circle')!.at
const C_TOP_SUBSTAGE_AT = findRealm('c').substages[findRealm('c').substages.length - 1]!.at
const N_APEX_AT = findRealm('n').substages.find((s) => s.label === 'Apex')!.at
const N_PERFECTED_AT = findRealm('n').substages.find((s) => s.label === 'Perfected')!.at
const S_GREAT_CIRCLE_AT = findRealm('s').substages.find(
  (s) => s.label === 'Great Circle of Soul Formation',
)!.at
// KEEP_RULES 'soulCarriesTheClimb' is granted by s milestone 2 ('Late Soul
// Formation', at 16): once earned, s prestiges keep n.best + n.milestones.
const S_KEEP_MILESTONE_INDEX = findRealm('s').substages.findIndex(
  (s) => s.label === 'Late Soul Formation',
)

/**
 * Tick the system stores across a competent wait, mirroring game.tick's
 * forward pass (alphabetical updater order). This is what advanceToQi
 * deliberately does NOT do — the diligent zero-touch proof depends on the
 * horizontal systems staying starved there. Contribution, Insight, and forge
 * refinement all accrue through here.
 */
function tickSystems(dt: number, state: SimState): void {
  useBodyStore().update(dt)
  useDaoStore().update(dt)
  useForgeStore().update(dt)
  useRealmStore().update(dt)
  useSectStore().update(dt)
  // The profession clocks (alchemy pill timers, secret-realm expedition essence +
  // cooldowns + rotation) only tick for a profile that engages them (PillFocused
  // and Realistic). Every OTHER profile — Competent included — leaves them
  // starved, so this addition is byte-identical for the pinned Competent run.
  if (state.config?.tickProfession) {
    useAlchemyStore().update(dt)
    useSecretRealmStore().update(dt)
  }
}

/**
 * Competent advance: event-stepped like advanceToQi, but re-samples Qi/sec in
 * bounded chunks and ticks the system stores across the wait. Chunking keeps
 * the analytic step honest when a rate-changing latch fires mid-wait (sect
 * stipend, forge refinement completing) — any residual error is conservative
 * (overestimates time).
 */
function advanceToQiTicking(target: Decimal, state: SimState): void {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  let guard = 0
  while (game.points.lt(target)) {
    const qiPerSec = pipelines.qiPerSecond
    if (qiPerSec.lte(0)) return
    const remainingSeconds = target.sub(game.points).div(qiPerSec).toNumber()
    const dt = Math.min(remainingSeconds, COMPETENT_MAX_EVENT_STEP_SECONDS)
    if (dt >= remainingSeconds) {
      game.points = target
    } else {
      game.points = game.points.add(qiPerSec.times(dt))
    }
    game.timePlayed = game.timePlayed + dt
    state.simSeconds += dt
    tickSystems(dt, state)
    if (++guard > state.maxIterations) {
      throw new Error('advanceToQiTicking exceeded iteration cap — Qi/sec appears stalled')
    }
  }
}

/** Set the Breathing Trance stance (no-op before the lattice reveals). */
function setBreathingTrance(active: boolean): void {
  const dao = useDaoStore()
  if (!dao.isRevealed()) return
  const currentlyActive = dao.activeStance === 'breathingTrance'
  if (currentlyActive !== active) dao.toggleStance('breathingTrance')
}

/**
 * Advance with the stance policy: Breathing Trance ON for small targets
 * (harvest Insight at ×2 for ×0.7 Qi), OFF while banking a big pile — the
 * §6.1 opportunity cost, played deliberately.
 */
function advanceBanked(target: Decimal, state: SimState): void {
  // Only stance-carrying profiles (Competent, LatticeFocused) play the §6.1
  // Breathing Trance opportunity cost. SectFocused and PillFocused take "no
  // stance" (stances are the dao grammar), so their config leaves it off. For
  // Competent (useBreathingTrance = true) this is byte-identical to the prior
  // unconditional call.
  if (state.config?.useBreathingTrance) {
    setBreathingTrance(target.toNumber() < COMPETENT_BANKING_QI_THRESHOLD)
  }
  advanceToQiTicking(target, state)
}

/**
 * Qi needed for a single prestige to land `gain` points — the nextAt()
 * inversion generalized to an arbitrary gain (same formula: graded realms
 * multiply by the stored Foundation band's fMult; the alchemy aid factor is
 * included for parity though this policy never holds a charge).
 */
function qiForGain(realmId: 'q' | 'f' | 'c' | 'n' | 's', gain: Decimal): Decimal {
  const r = findRealm(realmId)
  let gainMult = new Decimal(1)
  if (r.graded) {
    const body = useBodyStore()
    const band = body.foundationGrade >= 0 ? r.grade!.bands[body.foundationGrade] : undefined
    if (band) gainMult = gainMult.times(band.fMult)
  }
  gainMult = gainMult.times(useAlchemyStore().breakthroughGainMult(realmId))
  return gain.div(gainMult).root(r.gainExp).times(r.reqBase).max(r.reqBase).ceil()
}

/**
 * All non-Diligent prestiges route through here. Normally a plain
 * realm.prestige — but when the profile carries the COUNTERFACTUAL
 * counterfactualCKeep flag and the resetter is n or s, c.best + c.milestones
 * are snapshotted before the cascade and restored after, simulating a c keep
 * rule (the same shape as the real soulCarriesTheClimb rule: best + milestones
 * survive, banked points do NOT). Sim-side only; the engine's doReset cascade
 * still runs untouched. This is the churn-decomposition probe for deferred-
 * decision #2 (tax-vs-ritual) — labeled COUNTERFACTUAL, not game-legal.
 */
function simPrestige(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const realm = useRealmStore()
  const probeCKeep =
    state.config?.counterfactualCKeep === true && (realmId === 'n' || realmId === 's')
  const cBefore = probeCKeep ? realm.stateOf('c') : null
  const keptBest = cBefore ? cBefore.best : ''
  const keptMilestones = cBefore ? [...cBefore.milestones] : []
  realm.prestige(realmId)
  if (probeCKeep) {
    const cAfter = realm.stateOf('c')
    // Restore the keep-rule keys only if the cascade actually wiped them (it
    // always does today — nothing keeps c below n/s — but stay defensive).
    if (new Decimal(cAfter.best).lt(new Decimal(keptBest))) {
      realm.slice['c'] = { ...cAfter, best: keptBest, milestones: keptMilestones }
    }
  }
}

/**
 * Competent prestige at the realm's reqBase — the minimum-gain prestige,
 * time-optimal for sub-linear gainExp (gain/time ∝ points^(gainExp−1) falls
 * with banking). Engages the horizontal systems at the decision point.
 */
function prestigeRealmTicking(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const game = useGameStore()
  const r = findRealm(realmId)
  advanceBanked(new Decimal(r.reqBase), state)
  if (game.points.lt(r.reqBase)) game.points = new Decimal(r.reqBase)
  simPrestige(realmId, state)
  engageSpine(state)
}

/**
 * Re-climb a wiped realm to a target best with BANKED prestiges: one big
 * breakthrough instead of `target` minimum ones. Costs somewhat more Qi than
 * min-prestiging (gain is sub-linear), but re-climbs run at restored rates
 * where that Qi is cheap, and it keeps the event count bounded. These are
 * real realm.prestige calls — cascades, keep rules, and milestones all fire
 * authentically; the loop tops up if flooring undershoots.
 */
function climbRealmChunked(
  realmId: 'q' | 'f' | 'c' | 'n' | 's',
  targetBest: number,
  state: SimState,
): void {
  const realm = useRealmStore()
  let iterations = 0
  while (realm.realmBest(realmId).toNumber() < targetBest) {
    const bankedPoints = new Decimal(realm.stateOf(realmId).points)
    const gainNeeded = new Decimal(targetBest).sub(bankedPoints).max(1)
    advanceBanked(qiForGain(realmId, gainNeeded), state)
    simPrestige(realmId, state)
    engageSpine(state)
    if (++iterations > state.maxIterations) {
      throw new Error(`climbRealmChunked('${realmId}') exceeded ${state.maxIterations} iterations`)
    }
  }
}

/**
 * THE KEY BEHAVIOR — rate restoration. After an n/s prestige wipes the lower
 * spine, re-climb c to its top sub-stage and f to Great Circle BEFORE banking
 * the next big pile: their sub-stage qiMults multiply the banking rate.
 * Order matters: c prestiges cascade-wipe f (no keep rule targets f on a c
 * reset), so c climbs first and f re-chunks last. This also means the
 * foundationSurvivesNascentSoul keep rule, once it emerges, is immediately
 * re-wiped by the per-cycle c climbs — emergent, observed, left as-is.
 * q has no keep rule below n/s either; its bigger re-climb is done separately,
 * only ahead of s-scale banks (see runCompetent).
 */
function restoreFoundationAndCore(state: SimState): void {
  const realm = useRealmStore()
  let iterations = 0
  while (realm.realmBest('c').toNumber() < C_TOP_SUBSTAGE_AT) {
    prestigeRealmTicking('c', state)
    if (++iterations > state.maxIterations) {
      throw new Error('restoreFoundationAndCore exceeded iteration cap on the c climb')
    }
  }
  climbRealmChunked('f', F_GREAT_CIRCLE_AT, state)
}

/**
 * Climb Nascent Soul stepwise (minimum-gain prestiges), restoring f/c after
 * EVERY n breakthrough — each n prestige cascade-wipes them (f until the
 * Late-NS keep rule latches; c always, nothing ever keeps c below n).
 */
function climbNascentWithRestoration(targetBest: number, state: SimState): void {
  const realm = useRealmStore()
  let iterations = 0
  while (realm.realmBest('n').toNumber() < targetBest) {
    prestigeRealmTicking('n', state)
    restoreFoundationAndCore(state)
    if (++iterations > state.maxIterations) {
      throw new Error('climbNascentWithRestoration exceeded iteration cap')
    }
  }
}

/** Payback-aware body buys: a track is bought while cost <= ~3 min of Qi/sec. */
function buyBodyBuyablesPaybackAware(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  const pipelines = usePipelinesStore()
  const buyTargets: { key: 'primaryMeridian' | 'temper' | 'extraordinaryMeridian'; cap: number }[] = [
    { key: 'primaryMeridian', cap: COMPETENT_MERIDIAN_TARGET },
    { key: 'temper', cap: COMPETENT_TEMPER_TARGET },
  ]
  // MeridianProbe (#14): the extraordinary-meridian track, payback-aware, once
  // unlocked (all 12 primary open + q 10th Level). Only the probe sets this flag,
  // so this push is skipped for Competent and the focused profiles — bit-identical.
  if (state.config?.buyExtraordinaryMeridians) {
    buyTargets.push({ key: 'extraordinaryMeridian', cap: EXTRAORDINARY_MERIDIAN_TARGET })
  }
  for (const buyTarget of buyTargets) {
    while (body.buyableAmount(buyTarget.key) < buyTarget.cap) {
      // The ext-meridian track is gated; skip (don't burn Qi advancing to a cost
      // we cannot spend) until all 12 primary are open and q hits 10th Level.
      if (
        buyTarget.key === 'extraordinaryMeridian' &&
        !(
          body.primaryMeridians >= COMPETENT_MERIDIAN_TARGET &&
          realm.realmBest('q').toNumber() >= Q_TENTH_LEVEL_AT
        )
      ) {
        break
      }
      const cost = body.buyableCost(buyTarget.key, body.buyableAmount(buyTarget.key))
      const paybackBudget = pipelines.qiPerSecond.times(COMPETENT_PAYBACK_SECONDS)
      if (cost.gt(paybackBudget)) break
      advanceToQiTicking(cost, state)
      if (!body.buyBuyable(buyTarget.key)) break
    }
  }
}

/** Buy lattice node tiers cheapest-first from banked Insight, toward 8 held Seeds. */
function buyLatticeNodesCheapestFirst(): void {
  const dao = useDaoStore()
  if (!dao.revealed) return
  while (dao.heldDaoSeedCount() < COMPETENT_SEED_TARGET) {
    let cheapestNodeKey: (typeof LATTICE_DATA.nodes)[number]['key'] | null = null
    let cheapestCost: Decimal | null = null
    for (const node of LATTICE_DATA.nodes) {
      if (!dao.canAffordNode(node.key)) continue
      const cost = dao.nodeCost(node.key)
      if (cheapestCost === null || cost.lt(cheapestCost)) {
        cheapestNodeKey = node.key
        cheapestCost = cost
      }
    }
    if (cheapestNodeKey === null) return // nothing affordable — Insight accrues during waits
    if (!dao.buyNodeTier(cheapestNodeKey)) return
  }
}

/** Buy techniques cheapest-first as banked Contribution allows. */
function buyTechniquesCheapestFirst(): void {
  const sect = useSectStore()
  if (!sect.joined) return
  for (;;) {
    let cheapestIndex = -1
    let cheapestCost: Decimal | null = null
    for (let index = 0; index < TECHNIQUE_DATA.length; index++) {
      if (!sect.canAffordTechnique(index)) continue
      const cost = sect.techniqueCost(index)
      if (cheapestCost === null || cost.lt(cheapestCost)) {
        cheapestIndex = index
        cheapestCost = cost
      }
    }
    if (cheapestIndex < 0) return
    if (!sect.buyTechnique(cheapestIndex)) return
  }
}

/**
 * Try to bind an ELEMENT soul aspect (qi-leaning elements preferred) once
 * Nascent Soul exists. Each aspect's daoElementTier gate is live-verified by
 * setSoulAspect itself. Formless is deliberately NOT taken here — it is the
 * fallback of last resort, bound just before the first s prestige (see
 * runCompetent) so a slightly-late Seed doesn't lock the run out of ×1.5.
 */
function tryPickElementAspect(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  if (body.soulAspectChosen) return
  if (!realm.stateOf('n').unlocked) return
  const preference = state.config?.aspectPreference ?? COMPETENT_ASPECT_PREFERENCE
  const aspects = findRealm('n').soulAspect!.aspects
  for (const preferredKey of preference) {
    const aspect = aspects.find((a) => a.key === preferredKey)
    if (aspect && body.setSoulAspect(aspect.key, aspect.requires)) return
  }
}

// ---- Alchemy + secret-realm hooks (PillFocused / Realistic) -----------------

// Held-pill targets (sim policy, this file's constant style). ⟨tune⟩
const PILL_CLARITY_HOLD_TARGET = 2 // clarity charges banked ahead of n/s prestiges
const PILL_WARDING_HOLD_TARGET = 1 // one Heaven-Warding pill carried (pool effect untested — sim stops at s320)

/**
 * Does the site's dropped material still have unmet recipe demand? spiritHerb is
 * the perpetual gathering-pill feedstock (always in demand); essenceCrystal and
 * beastCore are only wanted while we are still topping up held Clarity/Warding
 * charges. Used to decide whether entering the currently-active site is worth
 * the run — we never idle-wait for a rotation, only act on natural boundaries.
 */
function pillMaterialHasDemand(siteKey: SecretRealmSiteKey): boolean {
  const alchemy = useAlchemyStore()
  const material = findSecretRealmSite(siteKey).rewards.material
  if (material === 'spiritHerb') return true
  if (material === 'essenceCrystal') {
    return (
      alchemy.pillCount('clarityPill') < PILL_CLARITY_HOLD_TARGET ||
      alchemy.pillCount('heavenWardingPill') < PILL_WARDING_HOLD_TARGET
    )
  }
  if (material === 'beastCore') return alchemy.pillCount('heavenWardingPill') < PILL_WARDING_HOLD_TARGET
  return false
}

/**
 * PillFocused engagement at a decision point: enter the active expedition when
 * profitable, craft what the materials allow, hold Clarity charges (they auto-aid
 * the next n/s prestige via realm.prestige) and one Heaven-Warding pill, and keep
 * a Qi-Gathering pill burning. Deterministic; no idle-waiting for rotation.
 */
function engagePillActions(state: SimState): void {
  const alchemy = useAlchemyStore()
  const secretRealm = useSecretRealmStore()
  if (!alchemy.revealed) return // sealed until the core is forged
  if (!alchemy.professionChosen) alchemy.chooseProfession('alchemy')

  // Enter the active site iff enterable (in rotation, unlocked, off cooldown, no
  // run) AND its material is still wanted. Essence then accrues across the
  // subsequent ticked waits and resolves at the run's duration boundary.
  const activeSite = secretRealm.activeSiteKey
  if (activeSite && secretRealm.canEnter(activeSite) && pillMaterialHasDemand(activeSite)) {
    secretRealm.enter(activeSite)
  }

  // Craft: gathering pills whenever affordable, then top up held Clarity + one
  // Warding pill to their hold targets.
  while (alchemy.canCraft('gatheringPill')) {
    if (!alchemy.craft('gatheringPill')) break
    state.pillsCrafted++
  }
  while (
    alchemy.pillCount('clarityPill') < PILL_CLARITY_HOLD_TARGET &&
    alchemy.canCraft('clarityPill')
  ) {
    if (!alchemy.craft('clarityPill')) break
    state.pillsCrafted++
  }
  while (
    alchemy.pillCount('heavenWardingPill') < PILL_WARDING_HOLD_TARGET &&
    alchemy.canCraft('heavenWardingPill')
  ) {
    if (!alchemy.craft('heavenWardingPill')) break
    state.pillsCrafted++
  }

  // Keep a Qi-Gathering pill burning (×2 Qi/sec). One active timed pill at a
  // time; re-swallow only once the prior lapses.
  if (!alchemy.activePill && alchemy.pillCount('gatheringPill') > 0) {
    if (alchemy.activatePill('gatheringPill')) state.pillsSwallowed++
  }
}

/**
 * All horizontal-system engagement at a decision point, gated by the profile's
 * SpineConfig. The ORDER is the pinned Competent order (sect-join, body buys,
 * lattice, techniques, pills, aspect, marks); body buys and mark-recording are
 * always run (vertical spine), each horizontal grammar is opt-in. With the
 * Competent config every branch that Competent used stays live in the same
 * order and the pill branch is skipped, so the run is byte-identical.
 */
function engageSpine(state: SimState): void {
  const cfg = state.config!
  if (cfg.engageSect) {
    const sect = useSectStore()
    if (!sect.joined && sect.isRevealGateMet()) sect.joinSect(cfg.sectArchetype)
  }
  buyBodyBuyablesPaybackAware(state)
  if (cfg.engageLattice) buyLatticeNodesCheapestFirst()
  if (cfg.engageSect) buyTechniquesCheapestFirst()
  if (cfg.engagePills) engagePillActions(state)
  if (cfg.pickElementAspect) tryPickElementAspect(state)
  recordMarks(state)
}

/**
 * The shared VERTICAL SPINE, parameterized by state.config. Everything Diligent
 * does, plus horizontal engagement (which grammars via the config flags) and
 * rate restoration. Competent is this spine with every flag on; the three
 * focused profiles are this spine with exactly one horizontal grammar on. Stops
 * at s Great Circle (320) — the tribulation trigger; the set-piece itself is
 * smoke-test territory, not modeled here.
 *
 * Bit-identity contract: with the Competent config, every branch below runs the
 * same operations in the same order as the pre-refactor runCompetent — verified
 * to the second (74,041s) against the pre-refactor run on the same data. (That
 * CONSTANT is data-relative: the aspect rebalance in src/data/realms.ts commit
 * 562c6ad shifts the measured hours; the invariant that survives data tunes is
 * the policy shape, re-baselined in the report below.) The refactor only added
 * opt-out branches for the focused profiles and never reordered a
 * Competent-live path.
 */
function runSpine(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  const forge = useForgeStore()

  // Phase 1: bootstrap Qi Condensation to 6th Level. The sect joins at reveal
  // (q 2nd Level) and meridians/temper accrete payback-aware via the
  // engageSpine call inside every prestige.
  engageSpine(state)
  while (realm.realmBest('q').toNumber() < Q_SIXTH_LEVEL_AT) {
    prestigeRealmTicking('q', state)
  }

  // Phase 2: Heaven-grade prep, then Foundation. Force meridians to 12 and
  // temper to the pre-core cap BEFORE the first graded f prestige:
  // gradeScore = 0.4×(12/12) + 0.4×(14/20) + 0.2×(6/6) = 0.88 >= 0.85 —
  // the first breakthrough stores a Heaven-grade Foundation (fMult 3.5,
  // core ceiling Perfect). The payback gate is deliberately bypassed here;
  // this is pre-breakthrough prep, the same shape as Diligent's phase 2.
  while (body.primaryMeridians < COMPETENT_MERIDIAN_TARGET) {
    advanceToQiTicking(body.buyableCost('primaryMeridian', body.primaryMeridians), state)
    if (!body.buyBuyable('primaryMeridian')) break
  }
  while (body.temperLevel < COMPETENT_TEMPER_TARGET) {
    advanceToQiTicking(body.buyableCost('temper', body.temperLevel), state)
    if (!body.buyBuyable('temper')) break
  }
  // First f prestige at reqBase stores the grade (computed live, pre-cascade);
  // the ×3.5 fMult then makes the chunked climb to Great Circle cheap. The
  // chunk also latches Peak Foundation (milestone 3) BEFORE its own cascade,
  // activating the qiInsightSurvivesFoundation keep rule in the same stroke.
  prestigeRealmTicking('f', state)
  climbRealmChunked('f', F_GREAT_CIRCLE_AT, state)

  // Phase 3: the forge. f.points sits at Great Circle (45) >= max(forgeReq,
  // Great Circle) here, and c's unlock is live-met (f Great Circle + Tendons).
  const producedCoreGradeIndex = forge.performForge('steady')
  if (producedCoreGradeIndex < 0) {
    throw new Error('Competent forge failed — availability gate unmet (policy bug)')
  }
  // Refinement choice: warm to the Foundation ceiling. For a Heaven-grade
  // Foundation that is Upper -> Perfect, one 100-unit bar at 1/sec — ~100s of
  // warming, ticked through tickSystems during ordinary waits. Trivially
  // cheap for a permanent ×8 (vs ×6) core mult, so the policy always warms.
  forge.toggleWarming()
  recordMarks(state)

  // Phase 4: Core Formation to its top sub-stage. The first c prestige
  // latches c.unlocked, lifting the temper cap (see the equality-gate note);
  // the c climbs wipe f, so f re-chunks after, and temper tops out to Marrow.
  while (realm.realmBest('c').toNumber() < C_TOP_SUBSTAGE_AT) {
    prestigeRealmTicking('c', state)
  }
  climbRealmChunked('f', F_GREAT_CIRCLE_AT, state)
  while (body.temperLevel < COMPETENT_TEMPER_TARGET) {
    advanceToQiTicking(body.buyableCost('temper', body.temperLevel), state)
    if (!body.buyBuyable('temper')) break
  }

  // Phases 5+6: the n/s climb with rate restoration. Every round: restore
  // c+f (the previous s prestige wiped them), re-climb n (depth depends on
  // whether the soulCarriesTheClimb keep rule has emerged), re-climb q last
  // (nothing protects q from c/n prestiges, so it goes on top of a fully
  // restored spine), then bank the s pile trance-off.
  while (realm.realmBest('s').toNumber() < S_GREAT_CIRCLE_AT) {
    restoreFoundationAndCore(state)
    const nKeepRuleEarned = realm.hasMilestone('s', S_KEEP_MILESTONE_INDEX)
    let nascentTarget = nKeepRuleEarned ? N_PERFECTED_AT : COMPETENT_NASCENT_RECLIMB_PRE_KEEP
    // The FIRST s prestige needs n Apex live (s.unlock latches after it).
    if (!realm.stateOf('s').unlocked) nascentTarget = Math.max(nascentTarget, N_APEX_AT)
    climbNascentWithRestoration(nascentTarget, state)
    climbRealmChunked('q', Q_TOP_SUBSTAGE_AT, state)
    // Aspect fallback of last resort: if no element gate ever landed, take
    // Formless now rather than entering Soul Formation aspectless. The
    // counterfactual probes (SectFocused* / PillFocused*) instead force-grant the
    // metal element aspect here, bypassing the daoElementTier Seed gate — NOT
    // game-legal play, a sim probe isolating the Formless-vs-element delta.
    if (!body.soulAspectChosen) {
      tryPickElementAspect(state)
      if (!body.soulAspectChosen) {
        if (state.config?.counterfactualForceMetalAspect) {
          const metalSoul = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'metalSoul')!
          body.setSoulAspect(metalSoul.key, {}) // {} == unconditional: gate bypass
        } else {
          const formlessAspect = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'formless')!
          body.setSoulAspect(formlessAspect.key, formlessAspect.requires)
        }
      }
    }
    prestigeRealmTicking('s', state)
  }
}

// ---- Spine profile configs --------------------------------------------------
//
// Every config drives the SAME vertical spine (runSpine); the flags select which
// horizontal grammar(s) the run touches. Competent turns them all on and is the
// pinned regression floor; the three focused profiles turn on exactly one.

const COMPETENT_CONFIG: SpineConfig = {
  engageSect: true,
  engageLattice: true,
  engagePills: false,
  useBreathingTrance: true,
  tickProfession: false,
  pickElementAspect: true,
  sectArchetype: COMPETENT_SECT_ARCHETYPE,
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
}

// LatticeFocused: Dao lattice only — nodes cheapest-first toward 8 Seeds,
// Breathing Trance outside banking, element aspect once a Seed lands. No sect,
// no alchemy.
const LATTICE_CONFIG: SpineConfig = {
  engageSect: false,
  engageLattice: true,
  engagePills: false,
  useBreathingTrance: true,
  tickProfession: false,
  pickElementAspect: true,
  sectArchetype: COMPETENT_SECT_ARCHETYPE,
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
}

// SectFocused: sect standing only — join at reveal (first archetype), buy every
// affordable technique cheapest-first, stipend accrues naturally. No lattice
// purchases, NO stance (stances are the dao grammar), no alchemy.
//
// STRUCTURAL COUPLING (reported as a finding): every element soul aspect gates
// on daoElementTier ['x', 2] — a lattice Seed. SectFocused buys ZERO lattice
// nodes, so it can NEVER reach an element aspect and is locked to Formless
// (×1.2/×1.2). The aspect axis is therefore coupled to the lattice grammar, not
// the sect grammar; a pure sect build cannot buy into an element soul. The
// SectFocused* counterfactual isolates how much of its lag is this coupling.
const SECT_CONFIG: SpineConfig = {
  engageSect: true,
  engageLattice: false,
  engagePills: false,
  useBreathingTrance: false,
  tickProfession: false,
  pickElementAspect: false,
  sectArchetype: COMPETENT_SECT_ARCHETYPE, // 'azureSword' — the first archetype in SECT_DATA
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
}

// PillFocused: alchemy + secret realms only — run expeditions when the active
// site is enterable and its material is wanted, craft + swallow Qi-Gathering
// pills, hold Clarity charges + one Heaven-Warding pill. No sect, no lattice, no
// stance. Formless (same lattice-Seed coupling as SectFocused). The Warding
// pill's tribulation-pool effect is UNTESTED here — the run stops at s.best 320
// (the tribulation trigger), before the pool is ever drawn.
const PILL_CONFIG: SpineConfig = {
  engageSect: false,
  engageLattice: false,
  engagePills: true,
  useBreathingTrance: false,
  tickProfession: true,
  pickElementAspect: false,
  sectArchetype: COMPETENT_SECT_ARCHETYPE,
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
}

// MeridianProbe (question #14): the shared spine + the extraordinary-meridian
// track, payback-aware, once unlocked — and NO horizontal system. Isolates
// whether the ×~6 ext-meridian ceiling is must-buy spine content the actors
// wrongly skip, or a trap.
const MERIDIAN_PROBE_CONFIG: SpineConfig = {
  engageSect: false,
  engageLattice: false,
  engagePills: false,
  useBreathingTrance: false,
  tickProfession: false,
  pickElementAspect: false,
  sectArchetype: COMPETENT_SECT_ARCHETYPE,
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
  buyExtraordinaryMeridians: true,
}

/** A spine profile runner: attach the config, then drive the shared spine. */
function spineRunner(config: SpineConfig): (state: SimState) => void {
  return (state: SimState) => {
    state.config = config
    runSpine(state)
  }
}

/** Competent kept as a named export-adjacent runner for the bit-identity check. */
function runCompetent(state: SimState): void {
  state.config = COMPETENT_CONFIG
  runSpine(state)
}

// ---- Realistic profile (the experience-target actor) ------------------------
//
// A deterministically-imperfect player: decisions only on a fixed check-in grid,
// idle time between check-ins, suboptimal (over-banked) prestiges, a shorter
// body-buy payback horizon, partial + late horizontal engagement, and rate
// restoration that "forgets" the core re-climb every other cascade. No RNG.
// This is the calibration target — its hours are REPORTED, never asserted.

// Policy constants (⟨tune⟩ — sim policy, never game data).
const REALISTIC_CHECKIN_EARLY_SECONDS = 300 // watches closely early
const REALISTIC_CHECKIN_LATE_SECONDS = 1800 // stops watching after the forge
const REALISTIC_BANK_MULTIPLE = 1.5 // prestige at 1.5× the min-worthwhile pile, not the optimal window
const REALISTIC_PAYBACK_SECONDS = 60 // buys body upgrades later + less eagerly than the spine's 180s
const REALISTIC_LATTICE_INSIGHT_MULTIPLE = 2 // hesitates: buys a node only when Insight > 2× its cost
const REALISTIC_NASCENT_PRE_KEEP = COMPETENT_NASCENT_RECLIMB_PRE_KEEP // 30 (Peak NS) before the s keep rule
const REALISTIC_SECT_ARCHETYPE: SectArchetypeKey = 'azureSword'
const REALISTIC_TENDON_TEMPER_LEVEL = 10 // the Core-gate temper floor pushed through to unlock the forge

// Realistic uses its OWN driver, but reuses tickSystems + engagePillActions, so
// it carries a config: profession clocks tick, no spine stance, no auto element
// aspect (its ensureRealisticAspect handles that).
const REALISTIC_CONFIG: SpineConfig = {
  engageSect: false,
  engageLattice: false,
  engagePills: false,
  useBreathingTrance: false,
  tickProfession: true,
  pickElementAspect: false,
  sectArchetype: REALISTIC_SECT_ARCHETYPE,
  aspectPreference: COMPETENT_ASPECT_PREFERENCE,
}

interface RealisticContext {
  /** Completed s-cascades (drives the core-restore-every-other alternation). */
  cascades: number
  /** True once the sect reveal has been SEEN at a check-in (join fires one later). */
  sawSectReveal: boolean
}

/** Advance a fixed idle span: accrue Qi at the live rate + tick systems, chunked. */
function advanceIdle(seconds: number, state: SimState): void {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  let remaining = seconds
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, COMPETENT_MAX_EVENT_STEP_SECONDS)
    const qiPerSec = pipelines.qiPerSecond
    if (qiPerSec.gt(0)) game.points = game.points.add(qiPerSec.times(dt))
    game.timePlayed = game.timePlayed + dt
    state.simSeconds += dt
    tickSystems(dt, state)
    remaining -= dt
  }
}

/** 60s-payback body buys from the CURRENT idle pile (Realistic never advances mid-check-in). */
function buyBodyRealistic(): void {
  const body = useBodyStore()
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  const targets: { key: 'primaryMeridian' | 'temper'; cap: number }[] = [
    { key: 'primaryMeridian', cap: COMPETENT_MERIDIAN_TARGET },
    { key: 'temper', cap: COMPETENT_TEMPER_TARGET },
  ]
  for (const target of targets) {
    while (body.buyableAmount(target.key) < target.cap) {
      const cost = body.buyableCost(target.key, body.buyableAmount(target.key))
      if (cost.gt(pipelines.qiPerSecond.times(REALISTIC_PAYBACK_SECONDS))) break // payback gate
      if (game.points.lt(cost)) break // can't afford from the pile yet
      if (!body.buyBuyable(target.key)) break
    }
  }
}

/** Push temper to Tendon so the forge (Core unlock) opens — a player forces this gate. */
function forceTemperForForge(): void {
  const body = useBodyStore()
  const game = useGameStore()
  while (body.temperLevel < REALISTIC_TENDON_TEMPER_LEVEL) {
    const cost = body.buyableCost('temper', body.temperLevel)
    if (game.points.lt(cost)) break
    if (!body.buyBuyable('temper')) break
  }
}

/** Hesitant lattice buys: cheapest-first, but only when Insight > 2× the node cost. */
function buyLatticeHesitant(): void {
  const dao = useDaoStore()
  if (!dao.revealed) return
  for (;;) {
    let cheapestKey: (typeof LATTICE_DATA.nodes)[number]['key'] | null = null
    let cheapestCost: Decimal | null = null
    for (const node of LATTICE_DATA.nodes) {
      if (!dao.canAffordNode(node.key)) continue
      const cost = dao.nodeCost(node.key)
      if (cheapestCost === null || cost.lt(cheapestCost)) {
        cheapestKey = node.key
        cheapestCost = cost
      }
    }
    if (cheapestKey === null || cheapestCost === null) return
    if (dao.insight.lte(cheapestCost.times(REALISTIC_LATTICE_INSIGHT_MULTIPLE))) return // hesitate
    if (!dao.buyNodeTier(cheapestKey)) return
  }
}

/** One over-banked prestige from the idle pile, iff banked >= bankMultiple × reqBase. Returns whether it fired. */
function realisticBankedPrestige(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): boolean {
  const realm = useRealmStore()
  const game = useGameStore()
  if (!realm.canReset(realmId)) return false
  const bankMultiple = state.realisticParams?.bankMultiple ?? REALISTIC_BANK_MULTIPLE
  const reqBase = new Decimal(findRealm(realmId).reqBase)
  if (game.points.lt(reqBase.times(bankMultiple))) return false
  simPrestige(realmId, state)
  recordMarks(state)
  return true
}

/** Bind an aspect once Nascent Soul exists: element if a Seed happened to land, else Formless. */
function ensureRealisticAspect(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  if (body.soulAspectChosen) return
  if (!realm.stateOf('n').unlocked) return
  tryPickElementAspect(state)
  if (!body.soulAspectChosen) {
    const formless = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'formless')!
    body.setSoulAspect(formless.key, formless.requires)
  }
}

/** The n/s climb with imperfect restoration: f every cascade, core only every OTHER. */
function realisticNascentSoulStep(state: SimState, ctx: RealisticContext): void {
  const realm = useRealmStore()
  // Restore f every cascade (it is always wiped).
  if (realm.realmBest('f').toNumber() < F_GREAT_CIRCLE_AT) {
    realisticBankedPrestige('f', state)
    return
  }
  // Restore core only every OTHER cascade (deterministic "forgets half the time").
  const restoreCoreThisCascade = ctx.cascades % 2 === 0
  if (restoreCoreThisCascade && realm.realmBest('c').toNumber() < C_TOP_SUBSTAGE_AT) {
    realisticBankedPrestige('c', state)
    return
  }
  // Nascent Soul target: Perfected once the keep rule is up, else pre-keep depth;
  // the FIRST s prestige needs n Apex live.
  const keepEarned = realm.hasMilestone('s', S_KEEP_MILESTONE_INDEX)
  let nascentTarget = keepEarned ? N_PERFECTED_AT : REALISTIC_NASCENT_PRE_KEEP
  if (!realm.stateOf('s').unlocked) nascentTarget = Math.max(nascentTarget, N_APEX_AT)
  if (realm.realmBest('n').toNumber() < nascentTarget) {
    // n's FIRST unlock needs c Core Refined (best >= 2); force the core up to it
    // even on a "forgot core" cascade, or Nascent Soul can never open.
    if (!realm.stateOf('n').unlocked && realm.realmBest('c').toNumber() < 2) {
      realisticBankedPrestige('c', state)
      return
    }
    realisticBankedPrestige('n', state)
    return
  }
  ensureRealisticAspect(state)
  if (realisticBankedPrestige('s', state)) ctx.cascades++
}

/** One vertical decision at a check-in (exactly one prestige, or the forge). */
function realisticSpineStep(state: SimState, ctx: RealisticContext): void {
  const realm = useRealmStore()
  const body = useBodyStore()
  const forge = useForgeStore()
  if (realm.realmBest('q').toNumber() < Q_SIXTH_LEVEL_AT) {
    realisticBankedPrestige('q', state)
    return
  }
  if (body.coreGrade < 0 && realm.realmBest('f').toNumber() < F_GREAT_CIRCLE_AT) {
    realisticBankedPrestige('f', state)
    return
  }
  if (body.coreGrade < 0) {
    forceTemperForForge()
    if (forge.performForge('steady') >= 0) {
      forge.toggleWarming()
      recordMarks(state)
    }
    return
  }
  realisticNascentSoulStep(state, ctx)
}

/** Partial, imperfectly-timed horizontal engagement at a check-in. */
function realisticHorizontals(state: SimState, ctx: RealisticContext): void {
  const sect = useSectStore()
  // Sect: join one FULL check-in after the reveal is first seen (late).
  if (!sect.joined) {
    if (ctx.sawSectReveal) sect.joinSect(REALISTIC_SECT_ARCHETYPE)
    else if (sect.isRevealGateMet()) ctx.sawSectReveal = true
  } else {
    buyTechniquesCheapestFirst()
  }
  buyLatticeHesitant()
  // Crafts/uses gathering pills, holds Clarity + one Warding, enters an
  // expedition only when the active site is enterable AT this check-in (so it
  // misses rotations it isn't watching). Reuses the PillFocused hook — Realistic
  // never plans Clarity timing, but a held charge auto-aids the next n/s prestige.
  engagePillActions(state)
}

/** The Realistic actor's default knobs (the headline run; the sweep varies them). */
const REALISTIC_DEFAULT_PARAMS: RealisticParams = {
  lateCheckinSeconds: REALISTIC_CHECKIN_LATE_SECONDS,
  bankMultiple: REALISTIC_BANK_MULTIPLE,
}

/**
 * Build a Realistic runner with explicit knobs. config lets the † probe attach
 * counterfactualCKeep; params feed the jitter-sensitivity sweep. The default
 * (REALISTIC_CONFIG + REALISTIC_DEFAULT_PARAMS) is the headline actor.
 */
function realisticRunner(
  config: SpineConfig = REALISTIC_CONFIG,
  params: RealisticParams = REALISTIC_DEFAULT_PARAMS,
): (state: SimState) => void {
  return (state: SimState) => {
    state.config = config
    state.realisticParams = params
    const realm = useRealmStore()
    const body = useBodyStore()
    const ctx: RealisticContext = { cascades: 0, sawSectReveal: false }
    let guard = 0
    while (realm.realmBest('s').toNumber() < S_GREAT_CIRCLE_AT) {
      const interval =
        body.coreGrade >= 0 ? params.lateCheckinSeconds : REALISTIC_CHECKIN_EARLY_SECONDS
      advanceIdle(interval, state)
      buyBodyRealistic()
      realisticHorizontals(state, ctx)
      realisticSpineStep(state, ctx)
      if (++guard > state.maxIterations) {
        throw new Error('runRealistic exceeded the check-in cap — the spine appears stalled')
      }
    }
  }
}

const runRealistic = realisticRunner()

// ---- Main -------------------------------------------------------------------

/** End-state snapshot for the report table (read while this profile's Pinia is live). */
function summarize(state: SimState): ProfileSummary {
  const body = useBodyStore()
  const dao = useDaoStore()
  const sect = useSectStore()
  const secretRealm = useSecretRealmStore()
  const realm = useRealmStore()
  return {
    aspect: body.soulAspect || 'none',
    seeds: dao.heldDaoSeedCount(),
    techniques: sect.techniques.length,
    pillsUsed: state.pillsSwallowed,
    expeditions: secretRealm.totalClears,
    sBest: realm.realmBest('s').toNumber(),
    extraordinaryMeridians: body.extraordinaryMeridians,
  }
}

/**
 * Quiet variant for the jitter sweep: boots + runs a profile and snapshots the
 * summary WITHOUT the per-profile console block (9 sweep points would drown
 * the report). Same boot path and state shape as runProfile.
 */
function runProfileQuiet(fn: (state: SimState) => void): SimState {
  bootSim()
  const state: SimState = {
    simSeconds: 0,
    maxIterations: 100000,
    marks: {},
    pillsSwallowed: 0,
    pillsCrafted: 0,
  }
  fn(state)
  state.summary = summarize(state)
  return state
}

function runProfile(name: string, fn: (state: SimState) => void): SimState {
  bootSim()
  const state: SimState = {
    simSeconds: 0,
    maxIterations: 100000,
    marks: {},
    pillsSwallowed: 0,
    pillsCrafted: 0,
  }
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

  // Snapshot end-state NOW — the next runProfile's bootSim swaps the Pinia.
  state.summary = summarize(state)
  return state
}

export function runPacingSim(): void {
  console.log('=== Dao Tree Pacing Simulation (new engine) ===\n')

  // Run the diligent profile.
  const diligentRun = runProfile('Diligent', runDiligent)

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

  // ---- Competent profile run + choice-viability assertions -----------------
  // (Runs AFTER the diligent §6.6 blocks above — bootSim swaps the active
  // Pinia, so those must finish reading the diligent stores first.)
  const competentRun = runProfile('Competent', runCompetent)
  const competentRealm = useRealmStore()
  const competentBody = useBodyStore()
  const competentDao = useDaoStore()
  const competentSect = useSectStore()
  const competentCoreGradeLabel =
    SETPIECE_DATA.forge.grades.find((g) => g.ceilingIndex === competentBody.coreGrade)?.label ??
    'unforged'
  console.log(`Seeds held: ${competentDao.heldDaoSeedCount()}`)
  console.log(`Techniques owned: ${competentSect.techniques.length}`)
  console.log(`Core grade label: ${competentCoreGradeLabel}`)

  // Structural assertion: competent reaches the tribulation trigger.
  if (competentRealm.realmBest('s').toNumber() < S_GREAT_CIRCLE_AT) {
    console.error(
      `\nFAIL: Competent profile did not reach s Great Circle ` +
        `(s.best=${competentRealm.realmBest('s').toNumber()}, need ${S_GREAT_CIRCLE_AT})`,
    )
  } else {
    console.log(`\nPASS: Competent profile reached s.best >= ${S_GREAT_CIRCLE_AT} (tribulation trigger)`)
  }

  // FIRST CHOICE-VIABILITY ASSERTION (project directive "keep all values and
  // choices in range"): engaging the horizontal systems + rate restoration
  // must be DECISIVELY worth it — competent under a quarter of diligent's
  // time. A failure here is a FINDING about the engine/data balance, never a
  // license to retune src/data/** from this file.
  const diligentHours = diligentRun.simSeconds / 3600
  const competentHours = competentRun.simSeconds / 3600
  if (competentRun.simSeconds < diligentRun.simSeconds / 4) {
    console.log(
      `PASS: choice viability — competent ${competentHours.toFixed(1)}h < ` +
        `diligent/4 (${(diligentHours / 4).toFixed(1)}h of ${diligentHours.toFixed(1)}h)`,
    )
  } else {
    console.error(
      `FAIL (FINDING — report, do not retune): choice viability broken. ` +
        `Competent ${competentHours.toFixed(1)}h >= diligent/4 ` +
        `(${(diligentHours / 4).toFixed(1)}h of ${diligentHours.toFixed(1)}h) — horizontal ` +
        `engagement + rate restoration is not decisively worth it on current data.`,
    )
  }

  // Budget reference (the pinned 120h tribulation-ready target).
  const budgetHours = PACING_BUDGETS.diligent.toTribulation / 3600
  console.log(
    `Budget reference: competent ${competentHours.toFixed(1)}h vs ` +
      `${budgetHours.toFixed(0)}h PACING_BUDGETS.diligent.toTribulation ` +
      `(${((competentRun.simSeconds / PACING_BUDGETS.diligent.toTribulation) * 100).toFixed(0)}% of budget)`,
  )

  // ---- Focused profiles: ONE horizontal grammar each -----------------------
  // (All run AFTER the competent reads above — bootSim swaps the Pinia.)
  const latticeRun = runProfile('LatticeFocused', spineRunner(LATTICE_CONFIG))
  const sectRun = runProfile('SectFocused', spineRunner(SECT_CONFIG))
  const pillRun = runProfile('PillFocused', spineRunner(PILL_CONFIG))

  // ---- MeridianProbe: spine + ext-meridian track, no horizontals (#14) ------
  const meridianRun = runProfile('MeridianProbe', spineRunner(MERIDIAN_PROBE_CONFIG))

  // ---- Counterfactual aspect probes (force-grant metal, bypass the Seed gate)
  const sectCounterfactualRun = runProfile(
    'SectFocused*',
    spineRunner({ ...SECT_CONFIG, counterfactualForceMetalAspect: true }),
  )
  const pillCounterfactualRun = runProfile(
    'PillFocused*',
    spineRunner({ ...PILL_CONFIG, counterfactualForceMetalAspect: true }),
  )

  // ---- Realistic: the experience-target actor (calibration) ----------------
  const realisticRun = runProfile('Realistic', runRealistic)

  // ---- C-keep counterfactuals († runs): the churn-decomposition probes ------
  // Same policies as Competent/Realistic, but c.best + c.milestones are force-
  // preserved across n/s cascades (COUNTERFACTUAL — a c keep rule that does not
  // exist in the game). The base-vs-† delta is the measured c-churn tax.
  const competentCKeepRun = runProfile(
    'Competent†',
    spineRunner({ ...COMPETENT_CONFIG, counterfactualCKeep: true }),
  )
  const realisticCKeepRun = runProfile(
    'Realistic†',
    realisticRunner({ ...REALISTIC_CONFIG, counterfactualCKeep: true }),
  )

  // ---- Structural assertions: focused builds inherit the competent spine ---
  // Each must terminate at the tribulation trigger AND beat Diligent by >= 4×
  // (they share the rate-restoring spine, so this MUST hold — a failure is a
  // loud FINDING, not a tuning license).
  const focused: { name: string; run: SimState }[] = [
    { name: 'LatticeFocused', run: latticeRun },
    { name: 'SectFocused', run: sectRun },
    { name: 'PillFocused', run: pillRun },
  ]
  for (const { name, run } of focused) {
    const sBest = run.summary?.sBest ?? 0
    if (sBest < S_GREAT_CIRCLE_AT) {
      console.error(`\nFAIL (FINDING): ${name} did not reach s.best >= ${S_GREAT_CIRCLE_AT} (got ${sBest})`)
    } else {
      console.log(`\nPASS: ${name} reached s.best >= ${S_GREAT_CIRCLE_AT} (tribulation trigger)`)
    }
    if (run.simSeconds * 4 > diligentRun.simSeconds) {
      console.error(
        `FAIL (FINDING): ${name} ${(run.simSeconds / 3600).toFixed(2)}h does not beat Diligent ` +
          `${diligentHours.toFixed(1)}h by 4× — a focused build on the shared spine is structurally weak.`,
      )
    } else {
      console.log(
        `PASS: ${name} beats Diligent by >= 4× (${(run.simSeconds / 3600).toFixed(2)}h vs ` +
          `${(diligentHours / 4).toFixed(1)}h = Diligent/4)`,
      )
    }
  }

  // ---- Six+ profile marks table (crossings + end-state summary) ------------
  const hoursOrDash = (seconds: number | undefined): string =>
    seconds === undefined ? '—' : (seconds / 3600).toFixed(2)
  const markRow = (profileName: string, run: SimState): Record<string, string | number> => ({
    profile: profileName,
    totalHours: (run.simSeconds / 3600).toFixed(2),
    fFirst: hoursOrDash(run.marks.fFirst),
    forge: hoursOrDash(run.marks.forge),
    nFirst: hoursOrDash(run.marks.nFirst),
    nPerfected: hoursOrDash(run.marks.nPerfected),
    sFirst: hoursOrDash(run.marks.sFirst),
    s320: hoursOrDash(run.marks.sGreatCircle),
    aspect: run.summary?.aspect ?? '?',
    seeds: run.summary?.seeds ?? 0,
    techs: run.summary?.techniques ?? 0,
    pills: run.summary?.pillsUsed ?? 0,
    expeds: run.summary?.expeditions ?? 0,
  })
  console.log('\n=== MARKS TABLE (hours to first crossing + end-state) ===')
  console.table([
    markRow('Diligent', diligentRun),
    markRow('Competent', competentRun),
    markRow('LatticeFocused', latticeRun),
    markRow('SectFocused', sectRun),
    markRow('PillFocused', pillRun),
    markRow('MeridianProbe', meridianRun),
    markRow('SectFocused*', sectCounterfactualRun),
    markRow('PillFocused*', pillCounterfactualRun),
    markRow('Realistic', realisticRun),
    markRow('Competent†', competentCKeepRun),
    markRow('Realistic†', realisticCKeepRun),
  ])

  // ---- BUILD DIVERSITY (calibration — bands await sign-off) -----------------
  const latticeHours = latticeRun.simSeconds / 3600
  const sectHours = sectRun.simSeconds / 3600
  const pillHours = pillRun.simSeconds / 3600
  const focusedHours = [latticeHours, sectHours, pillHours]
  const clusterMax = Math.max(...focusedHours)
  const clusterMin = Math.min(...focusedHours)
  const clusterRatio = clusterMax / clusterMin
  console.log('\n=== BUILD DIVERSITY (calibration — bands await sign-off) ===')
  console.log(`  LatticeFocused: ${latticeHours.toFixed(2)}h  (${(latticeHours / competentHours).toFixed(2)}× Competent)`)
  console.log(`  SectFocused:    ${sectHours.toFixed(2)}h  (${(sectHours / competentHours).toFixed(2)}× Competent)`)
  console.log(`  PillFocused:    ${pillHours.toFixed(2)}h  (${(pillHours / competentHours).toFixed(2)}× Competent)`)
  console.log(
    `  Cluster ratio (max/min) = ${clusterRatio.toFixed(3)}  ` +
      `[${clusterMin.toFixed(2)}h … ${clusterMax.toFixed(2)}h]`,
  )
  console.log('  (Gate-D discipline: first measurement is calibration — NO hard assertion on the cluster; Wes pins the band.)')

  // ---- Formless-penalty attribution (aspect-adjusted diversity) ------------
  // SectFocused + PillFocused are locked to Formless because element aspects gate
  // on lattice Seeds (daoElementTier ['x', 2]) they never buy. The counterfactual
  // variants force-grant the metal aspect to split their lag into "Formless
  // penalty" vs "residual (the horizontal system itself)".
  const sectCfHours = sectCounterfactualRun.simSeconds / 3600
  const pillCfHours = pillCounterfactualRun.simSeconds / 3600
  console.log('\n=== FORMLESS-PENALTY ATTRIBUTION (counterfactual probes) ===')
  console.log('  Element aspects require a lattice Seed; a pure sect/alchemy build cannot reach one.')
  const attribution = (name: string, hours: number, cfHours: number): void => {
    const formlessPenalty = hours - cfHours // time the Formless lock costs
    console.log(
      `  ${name}: ${hours.toFixed(2)}h → counterfactual ${cfHours.toFixed(2)}h  ` +
        `| Formless penalty ${formlessPenalty.toFixed(2)}h, residual ${(cfHours - competentHours).toFixed(2)}h vs Competent`,
    )
  }
  attribution('SectFocused', sectHours, sectCfHours)
  attribution('PillFocused', pillHours, pillCfHours)
  console.log(
    '  NOTE (post-rebalance data): every element aspect now carries qiMult >= 1.2 (the Formless ' +
      'floor), so a forced element aspect can only match-or-beat Formless and the penalty now ' +
      'measures the true cost of the aspect lock. A near-zero penalty means the lock is not the ' +
      "bottleneck; the lag vs Competent is residual/systemic. (Pre-rebalance, metalSoul's missing " +
      'qiMult made this penalty run NEGATIVE — the trap-aspect finding, since fixed in data.)',
  )
  // Aspect-adjusted cluster: swap in the counterfactual (element-aspect) hours for
  // the two Formless-locked builds, leaving LatticeFocused (already element) as-is.
  const adjustedHours = [latticeHours, sectCfHours, pillCfHours]
  const adjustedRatio = Math.max(...adjustedHours) / Math.min(...adjustedHours)
  console.log(
    `  Cluster ratio — raw ${clusterRatio.toFixed(3)} | aspect-adjusted ${adjustedRatio.toFixed(3)}`,
  )

  // ---- MeridianProbe interpretation (#14) ----------------------------------
  const meridianHours = meridianRun.simSeconds / 3600
  const focusedBest = clusterMin
  const focusedWorst = clusterMax
  console.log('\n=== MERIDIAN PROBE (#14 — ext-meridian track vs the focused three) ===')
  console.log(
    `  MeridianProbe: ${meridianHours.toFixed(2)}h  (${(meridianHours / competentHours).toFixed(2)}× Competent)  ` +
      `| extraordinary meridians bought: ${meridianRun.summary?.extraordinaryMeridians ?? 0}/${EXTRAORDINARY_MERIDIAN_TARGET}`,
  )
  console.log(`  Focused band: ${focusedBest.toFixed(2)}h … ${focusedWorst.toFixed(2)}h`)
  let meridianVerdict: string
  if (meridianHours < focusedBest) {
    meridianVerdict =
      'DOMINATES the focused three — ext-meridians read as MUST-BUY spine content; ' +
      'Competent (and every profile) has known headroom by skipping them. Report, do NOT retune.'
  } else if (meridianHours <= focusedWorst) {
    meridianVerdict = 'CLUSTERS with the focused three — the ext-meridian track is competitive standalone content.'
  } else {
    meridianVerdict = 'TRAILS the focused three — the ×~6 ext-meridian ceiling reads as over-advertised trap content.'
  }
  console.log(`  Verdict: ${meridianVerdict}`)

  // ---- EXPERIENCE TARGET (calibration) -------------------------------------
  const realisticHours = realisticRun.simSeconds / 3600
  console.log('\n=== EXPERIENCE TARGET (calibration) ===')
  console.log(
    `  Realistic (imperfect actor): ${realisticHours.toFixed(2)}h — the number to be pinned as the experience band.`,
  )
  console.log(
    `  End-state: aspect=${realisticRun.summary?.aspect}, seeds=${realisticRun.summary?.seeds}, ` +
      `techniques=${realisticRun.summary?.techniques}, pills=${realisticRun.summary?.pillsUsed}, ` +
      `expeditions=${realisticRun.summary?.expeditions}`,
  )
  console.log('  (Calibration only — Competent is the regression floor; Realistic is the experience target. Two bands, two jobs.)')

  // ---- C-CHURN DECOMPOSITION (decision input for #2 — no assertion) --------
  // The † runs force-preserve c across n/s cascades (COUNTERFACTUAL c keep
  // rule). base − † = the c-churn tax; churn share = tax / base. For Realistic,
  // the remaining delta vs Competent splits into idle-gap (R† − C†, the human-
  // imperfection cost with churn removed from both) and churn-gap (the extra
  // churn Realistic pays beyond Competent's — its every-other-cascade lapses
  // make its c climbs slower and rarer, so it banks at degraded rates longer).
  const competentCKeepHours = competentCKeepRun.simSeconds / 3600
  const realisticCKeepHours = realisticCKeepRun.simSeconds / 3600
  const competentChurnHours = competentHours - competentCKeepHours
  const realisticChurnHours = realisticHours - realisticCKeepHours
  console.log('\n=== C-CHURN DECOMPOSITION (decision input for #2 — no assertion) ===')
  console.table([
    {
      profile: 'Competent',
      baseHours: competentHours.toFixed(2),
      withCKeep: competentCKeepHours.toFixed(2),
      churnTaxHours: competentChurnHours.toFixed(2),
      churnShare: `${((competentChurnHours / competentHours) * 100).toFixed(1)}%`,
    },
    {
      profile: 'Realistic',
      baseHours: realisticHours.toFixed(2),
      withCKeep: realisticCKeepHours.toFixed(2),
      churnTaxHours: realisticChurnHours.toFixed(2),
      churnShare: `${((realisticChurnHours / realisticHours) * 100).toFixed(1)}%`,
    },
  ])
  const experienceGapHours = realisticHours - competentHours
  const idleGapHours = realisticCKeepHours - competentCKeepHours
  const churnGapHours = realisticChurnHours - competentChurnHours // == gap − idleGap
  console.log(
    `  Realistic − Competent gap: ${experienceGapHours.toFixed(2)}h = ` +
      `idle/imperfection ${idleGapHours.toFixed(2)}h (${((idleGapHours / experienceGapHours) * 100).toFixed(1)}%) + ` +
      `keep-topology churn ${churnGapHours.toFixed(2)}h (${((churnGapHours / experienceGapHours) * 100).toFixed(1)}%)`,
  )
  console.log(
    '  (COUNTERFACTUAL probe — the c keep rule does not exist in the game; this measures what one would buy back.)',
  )

  // ---- REALISTIC SENSITIVITY (calibration) ----------------------------------
  // Deterministic 9-point grid (no RNG): late-game check-in interval at
  // 0.8×/1.0×/1.2× of REALISTIC_CHECKIN_LATE_SECONDS crossed with banking
  // factor 1.3/1.5/1.7. Quiet runs — only the grid + spread are printed.
  const SWEEP_LATE_FACTORS = [0.8, 1.0, 1.2] as const
  const SWEEP_BANK_MULTIPLES = [1.3, 1.5, 1.7] as const
  const SWEEP_NARROW_SWING_RATIO = 1.15 // ⟨tune⟩ max/min below this reads as "a number, not a range"
  const sweepRows: { lateCheckin: string; bank: number; hours: number }[] = []
  for (const lateFactor of SWEEP_LATE_FACTORS) {
    for (const bankMultiple of SWEEP_BANK_MULTIPLES) {
      const params: RealisticParams = {
        lateCheckinSeconds: REALISTIC_CHECKIN_LATE_SECONDS * lateFactor,
        bankMultiple,
      }
      const sweepRun = runProfileQuiet(realisticRunner(REALISTIC_CONFIG, params))
      sweepRows.push({
        lateCheckin: `${lateFactor.toFixed(1)}× (${(REALISTIC_CHECKIN_LATE_SECONDS * lateFactor).toFixed(0)}s)`,
        bank: bankMultiple,
        hours: sweepRun.simSeconds / 3600,
      })
    }
  }
  const sweepHours = sweepRows.map((row) => row.hours).sort((a, b) => a - b)
  const sweepMin = sweepHours[0]!
  const sweepMax = sweepHours[sweepHours.length - 1]!
  const sweepMedian = sweepHours[Math.floor(sweepHours.length / 2)]!
  const sweepSwing = sweepMax / sweepMin
  console.log('\n=== REALISTIC SENSITIVITY (calibration) ===')
  console.table(
    sweepRows.map((row) => ({
      lateCheckin: row.lateCheckin,
      bankMultiple: row.bank,
      hours: row.hours.toFixed(2),
    })),
  )
  console.log(
    `  min ${sweepMin.toFixed(2)}h | median ${sweepMedian.toFixed(2)}h | max ${sweepMax.toFixed(2)}h ` +
      `| swing ${sweepSwing.toFixed(3)}× (full 9-point grid; wall budget held)`,
  )
  console.log(
    sweepSwing < SWEEP_NARROW_SWING_RATIO
      ? `  Interpretation: NARROW swing (< ${SWEEP_NARROW_SWING_RATIO}×) — the headline is a number; pin the experience band on it.`
      : `  Interpretation: WIDE swing (>= ${SWEEP_NARROW_SWING_RATIO}×) — pin a RANGE [${sweepMin.toFixed(1)}h … ${sweepMax.toFixed(1)}h], not a point.`,
  )
}

// Executed via `npm run sim` (tsx src/sim/pacing.ts). Nothing else imports
// this module, so the top-level call below is the sim's sole entry point —
// the M7 scaffold exported `runPacingSim` but never wired an invocation,
// leaving `npm run sim` a silent no-op; wiring it here so the harden pass's
// optionality assertions (and every future addition to this sim) actually run.
runPacingSim()
