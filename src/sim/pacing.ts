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

interface SimState {
  simSeconds: number
  maxIterations: number
  marks: ProfileMarks
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
// NOT modeled, by design:
// - The First Tribulation set-piece: the run STOPS at s Great Circle (320),
//   the tribulation trigger — the smoke tests cover the set-piece itself.
// - Extraordinary meridians (brief scope is the 12 primary; their ×1.25-each
//   track is reported as known additional headroom, not engaged).
// - Secret realms, alchemy, heart-demon trials, gate achievements: their
//   stores are never engaged and never ticked. Not ticking heartDemons is
//   FAITHFUL here, not a fidelity gap: its passive bleed only DECAYS
//   corruption (never accrues it), and both profiles avoid every corruption
//   source (Steady forges, strong-band breakthroughs) — so corruption stays
//   0 either way, which the §6.6 zero-touch assertion below pins.

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
const Q_TOP_SUBSTAGE_AT = findRealm('q').substages[findRealm('q').substages.length - 1]!.at
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
function tickSystems(dt: number): void {
  useBodyStore().update(dt)
  useDaoStore().update(dt)
  useForgeStore().update(dt)
  useRealmStore().update(dt)
  useSectStore().update(dt)
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
    tickSystems(dt)
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
  setBreathingTrance(target.toNumber() < COMPETENT_BANKING_QI_THRESHOLD)
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
 * Competent prestige at the realm's reqBase — the minimum-gain prestige,
 * time-optimal for sub-linear gainExp (gain/time ∝ points^(gainExp−1) falls
 * with banking). Engages the horizontal systems at the decision point.
 */
function prestigeRealmTicking(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const game = useGameStore()
  const realm = useRealmStore()
  const r = findRealm(realmId)
  advanceBanked(new Decimal(r.reqBase), state)
  if (game.points.lt(r.reqBase)) game.points = new Decimal(r.reqBase)
  realm.prestige(realmId)
  engageHorizontals(state)
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
    realm.prestige(realmId)
    engageHorizontals(state)
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
  void realm
  const buyTargets: { key: 'primaryMeridian' | 'temper'; cap: number }[] = [
    { key: 'primaryMeridian', cap: COMPETENT_MERIDIAN_TARGET },
    { key: 'temper', cap: COMPETENT_TEMPER_TARGET },
  ]
  for (const buyTarget of buyTargets) {
    while (body.buyableAmount(buyTarget.key) < buyTarget.cap) {
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
function tryPickElementAspect(): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  if (body.soulAspectChosen) return
  if (!realm.stateOf('n').unlocked) return
  const aspects = findRealm('n').soulAspect!.aspects
  for (const preferredKey of COMPETENT_ASPECT_PREFERENCE) {
    const aspect = aspects.find((a) => a.key === preferredKey)
    if (aspect && body.setSoulAspect(aspect.key, aspect.requires)) return
  }
}

/** All horizontal-system engagement at a decision point (idempotent, cheap). */
function engageHorizontals(state: SimState): void {
  const sect = useSectStore()
  if (!sect.joined && sect.isRevealGateMet()) sect.joinSect(COMPETENT_SECT_ARCHETYPE)
  buyBodyBuyablesPaybackAware(state)
  buyLatticeNodesCheapestFirst()
  buyTechniquesCheapestFirst()
  tryPickElementAspect()
  recordMarks(state)
}

/**
 * Competent policy: everything Diligent does, plus horizontal engagement and
 * rate restoration. Stops at s Great Circle (320) — the tribulation trigger;
 * the set-piece itself is smoke-test territory, not modeled here.
 */
function runCompetent(state: SimState): void {
  const body = useBodyStore()
  const realm = useRealmStore()
  const forge = useForgeStore()

  // Phase 1: bootstrap Qi Condensation to 6th Level. The sect joins at reveal
  // (q 2nd Level) and meridians/temper accrete payback-aware via the
  // engageHorizontals call inside every prestige.
  engageHorizontals(state)
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
    // Formless now rather than entering Soul Formation aspectless.
    if (!body.soulAspectChosen) {
      tryPickElementAspect()
      if (!body.soulAspectChosen) {
        const formlessAspect = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'formless')!
        body.setSoulAspect(formlessAspect.key, formlessAspect.requires)
      }
    }
    prestigeRealmTicking('s', state)
  }
}

// ---- Main -------------------------------------------------------------------

function runProfile(name: string, fn: (state: SimState) => void): SimState {
  bootSim()
  const state: SimState = { simSeconds: 0, maxIterations: 100000, marks: {} }
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

  // Marks table (hours to each first crossing; '—' = never reached).
  const hoursOrDash = (seconds: number | undefined): string =>
    seconds === undefined ? '—' : (seconds / 3600).toFixed(2)
  const markRow = (profileName: string, run: SimState): Record<string, string> => ({
    profile: profileName,
    totalHours: (run.simSeconds / 3600).toFixed(2),
    fFirst: hoursOrDash(run.marks.fFirst),
    forge: hoursOrDash(run.marks.forge),
    nFirst: hoursOrDash(run.marks.nFirst),
    nPerfected: hoursOrDash(run.marks.nPerfected),
    sFirst: hoursOrDash(run.marks.sFirst),
    s320: hoursOrDash(run.marks.sGreatCircle),
  })
  console.table([markRow('Diligent', diligentRun), markRow('Competent', competentRun)])
}

// Executed via `npm run sim` (tsx src/sim/pacing.ts). Nothing else imports
// this module, so the top-level call below is the sim's sole entry point —
// the M7 scaffold exported `runPacingSim` but never wired an invocation,
// leaving `npm run sim` a silent no-op; wiring it here so the harden pass's
// optionality assertions (and every future addition to this sim) actually run.
runPacingSim()
