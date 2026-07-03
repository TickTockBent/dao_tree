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
import type { ActivePill } from '@/stores/alchemy'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { findRealm } from '@/data/realms'
import { SETPIECE_DATA } from '@/data/setpieces'
import { LATTICE_DATA } from '@/data/lattice'
import { TECHNIQUE_DATA } from '@/data/techniques'
import { findSecretRealmSite } from '@/data/secret-realm'
import { ALCHEMY_DATA } from '@/data/alchemy'
// Act II model (§6): mirror the severing / offering math from DATA, never the
// stores (the sim's convention — the ⊘ probe reads store STATE but the Act II
// mechanics are re-derived here so no severing/dao mutation ever touches a
// measured run). See the ACT II SPINE banner far below.
import { SEVERING_DATA, OFFERING_DATA, findOfferingBasket } from '@/data/severing'
import { ACCUMULATOR_DATA } from '@/data/accumulators'
import { findBodyBuyable } from '@/data/body'
import type { Condition } from '@/engine/meets'
import type { PillKey, SectArchetypeKey, SecretRealmSiteKey } from '@/engine/types'

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

/**
 * SEVERING PROBE (Q9): the D23 candidate severables that are measurable in
 * Act I today. 'extraordinaryMeridians' stands in for D23's "meridian set
 * bonuses" — no distinct set-completion bonus exists in BODY_DATA (meridianMult
 * is a smooth per-meridian 1.15^n / 1.25^n product); the extraordinary track
 * (a "set" of 8) is the closest real effect a severance could take. The
 * lattice Manifestation tier (also a D23 candidate) does not exist yet and is
 * reported as a GAP, never faked.
 */
type SeverableKey = 'soulAspect' | 'stance' | 'profession' | 'extraordinaryMeridians'

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
  /**
   * COUNTERFACTUAL probe only (slice-9 partial-keep design, the ‡ runs):
   * on n/s cascades restore c.milestones ONLY — best wipes normally, so the
   * ×5.25 milestone rate multiplier survives but the sub-stage climb itself
   * (and c's contribution to unlock gates) must be re-earned. The cheapest
   * game-legal-SHAPED keep rule; tests the flat-discount prediction (all
   * three c milestones latch before the first cascade, so a milestones-only
   * keep should discount every re-climb identically — no curve). Mutually
   * exclusive with counterfactualCKeep and counterfactualCoreRemembers
   * (enforced by assertProbeFlagsExclusive in the runner factories).
   */
  counterfactualPartialCKeep?: boolean
  /**
   * COUNTERFACTUAL probe only ("the core remembers", the ⟨tune⟩ r-sweep):
   * the sim CLOCK inside c re-climb segment k advances at r^(k−1) of real
   * dt — re-climbs accelerate with each ascent the core has survived. What
   * it multiplies, exactly: every dt charged to state.simSeconds while a
   * re-climb segment is open (see chargeSimClock); the game-state
   * trajectory (Qi accrual, ticks, decisions, game.timePlayed) is
   * BIT-IDENTICAL to the base run — only the reported clock is discounted,
   * i.e. "re-climb work k proceeds 1/r^(k−1)× faster in felt time".
   * Deterministic; r=1.0 is definitionally the base run. Note the full †
   * keep is NOT this probe's r→0 limit: † also keeps best, skipping the
   * re-climb work entirely rather than compressing its clock. Mutually
   * exclusive with both keep flags.
   */
  counterfactualCoreRemembers?: number
  /**
   * COUNTERFACTUAL probe only — the "brief ritual" asymptote for the
   * remembers sweep (designer follow-up on fixed-r vanishing the tail):
   * with a floor f set, segment k's clock scale is max(r^(k−1), f) — the
   * compression flattens toward a floor instead of decaying to zero, so the
   * late re-climbs stay VISIBLE ("I still do this, but I've mastered it")
   * rather than becoming full-keep with extra steps. Only meaningful
   * alongside counterfactualCoreRemembers; a floor without an r throws at
   * runner construction (assertProbeFlagsExclusive).
   */
  counterfactualRemembersFloor?: number
  /**
   * COUNTERFACTUAL probe only — SEVERING PROBE (Q9, decision input for D23
   * Spirit Severing): EFFECT-ablation of ONE candidate severable. The actor's
   * policy still ACQUIRES and USES the piece exactly as in the base run (same
   * decision rules, same acquisition points — attribution-before-action:
   * decision-ablation would confound the piece's value with policy drift);
   * only the piece's EFFECT is nullified from the moment of acquisition
   * onward. base − ablated = the piece's live felt-hours contribution.
   * Nullification is sim-side store state only (engine untouched):
   * - 'soulAspect': the bind fires normally, then body.soulAspect is cleared
   *   (the acquisition is remembered sim-side so the policy never re-binds).
   * - 'stance': the toggle INTENTS still fire per the base decision rule, but
   *   the stance never engages (dao.activeStance stays ''), nullifying both
   *   its ×0.7 qi and ×2 Insight sides.
   * - 'profession': swallowed gathering pills keep their base timer cadence
   *   but their timedQiMult reads identity (active-pill key swapped to a
   *   non-timed recipe); clarity charges are still crafted/held/CONSUMED on
   *   the base rule but never boost a prestige gain (see simPrestige). The
   *   warding pill's tribulation-pool effect is never drawn (runs stop at
   *   s320), so there is nothing to nullify there.
   * - 'extraordinaryMeridians': each buy is mirrored sim-side (same unlock
   *   gate, cost ladder, payback rule, and Qi spent) while
   *   body.extraordinaryMeridians stays 0 — the track's 1.25^n meridianMult
   *   never applies.
   * Mutually exclusive with every other counterfactual probe flag
   * (assertProbeFlagsExclusive). Observation-only; never asserted on.
   */
  counterfactualSeverEffect?: SeverableKey
  /**
   * Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable) — POLICY VARIANT, not a
   * counterfactual (nothing about the game is nullified; only the actor's
   * stance-timing rule changes). When set, advanceBanked engages Breathing
   * Trance ONLY while insight is the binding constraint (a still-wanted lattice
   * node the actor cannot yet afford) instead of the base "small qi target"
   * heuristic — so the trance harvests its ×2 Insight exactly when insight
   * gates progress and stays off during pure qi-banking (its ×0.7 qi cost with
   * no offsetting benefit). Requires useBreathingTrance. Only the Q10 probe run
   * sets it; every pinned/base profile leaves it undefined, so their
   * advanceBanked path is byte-identical. Observation-only; never asserted on.
   */
  smartTrancePolicy?: boolean
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

/**
 * One completed c re-climb segment (curve instrumentation for the partial-keep
 * probe). Segment boundary, precisely:
 * - OPENS at the sim-time of the first n/s prestige that leaves c below full
 *   restoration (best < C_TOP_SUBSTAGE_AT or any of its substage milestones
 *   unlatched) — i.e. at the cascade itself, checked AFTER any counterfactual
 *   keep restore, so a run whose keep rule fully preserves c opens nothing.
 * - Further n/s cascades landing while a segment is open EXTEND it
 *   (cascadesSpanned++) rather than opening a new one — Realistic's
 *   every-other-cascade core lapses make multi-cascade segments routine;
 *   Competent's restore-after-every-cascade policy keeps them 1:1.
 * - CLOSES at the sim-time of the prestige that first returns c to full
 *   restoration (best >= C_TOP_SUBSTAGE_AT AND all substage milestones
 *   latched — under ‡ the milestones are always latched, so closure reduces
 *   to the best re-climb, which keeps segments comparable across variants).
 * The measured duration therefore INCLUDES everything the actor interleaves
 * inside the window — f restores, n climbs, idle check-ins (Realistic),
 * horizontal engagement — it is "time from losing the ×5.25 to having it
 * back", not "time spent exclusively prestiging c". A segment still open when
 * the run ends at s Great Circle (the final s cascade always wipes c with no
 * re-climb following) is dropped: no re-climb happened.
 */
interface CReclimbSegment {
  /** 1-based ascent index k, in completion order. */
  index: number
  startSeconds: number
  endSeconds: number
  durationSeconds: number
  /** n/s cascades this segment spans (> 1 when the actor lapses between wipes). */
  cascadesSpanned: number
}

/** The in-flight (not yet closed) re-climb segment, if any. */
interface OpenCReclimb {
  startSeconds: number
  cascadesSpanned: number
  /** Sim-clock scale for this segment: r^(k−1) under counterfactualCoreRemembers, else 1. */
  clockScale: number
}

interface SimState {
  simSeconds: number
  maxIterations: number
  marks: ProfileMarks
  /** Horizontal plan (spine + focused profiles). Absent for the Diligent driver. */
  config?: SpineConfig
  /** Realistic knobs (defaulted to the REALISTIC_* constants; swept by the jitter grid). */
  realisticParams?: RealisticParams
  /** Completed c re-climb segments, in order (partial-keep curve probe). */
  cReclimbSegments: CReclimbSegment[]
  /** The currently-open re-climb segment (set by an n/s cascade, cleared at full restore). */
  cReclimbOpen?: OpenCReclimb
  /** Gathering pills swallowed this run (report column). */
  pillsSwallowed: number
  /** Gathering/clarity/warding pills crafted this run. */
  pillsCrafted: number
  /**
   * SEVERING PROBE (Q9): the aspect key the policy bound before its effect was
   * nullified (counterfactualSeverEffect: 'soulAspect' runs only). Doubles as
   * the "already acquired" latch so the policy never re-binds.
   */
  severedAspectKey?: string
  /**
   * SEVERING PROBE (Q9): sim-side purchase counter for the mirrored
   * extraordinary-meridian buys (counterfactualSeverEffect:
   * 'extraordinaryMeridians' runs only — body.extraordinaryMeridians stays 0).
   */
  severedExtraordinaryMeridiansBought?: number
  /**
   * Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable): sim-seconds spent with
   * Breathing Trance actually engaged (dao.activeStance === 'breathingTrance'),
   * accumulated in advanceToQiTicking. A PURE observation counter — never read
   * by any decision, never printed for base profiles — so accumulating it is
   * output-invariant. The Q10 section reports it as a trance-engaged time share
   * (this ÷ simSeconds) for the base vs smart-trance lattice policies.
   */
  tranceEngagedSeconds?: number
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
// All three c substage milestones (the ×5.25 rate product) — full-restore bar
// for the re-climb curve probe, data-derived like the thresholds above.
const C_MILESTONE_COUNT = findRealm('c').substages.length
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
    chargeSimClock(dt, state)
    // Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable): pure observation — tally the
    // wall-time this wait ran with the trance actually engaged. A read + a
    // write to a never-decision-read, never-base-printed field; output-invariant.
    if (useDaoStore().activeStance === 'breathingTrance') {
      state.tranceEngagedSeconds = (state.tranceEngagedSeconds ?? 0) + dt
    }
    tickSystems(dt, state)
    if (++guard > state.maxIterations) {
      throw new Error('advanceToQiTicking exceeded iteration cap — Qi/sec appears stalled')
    }
  }
}

/** Set the Breathing Trance stance (no-op before the lattice reveals). */
function setBreathingTrance(active: boolean, state: SimState): void {
  // SEVERING PROBE (Q9) 'stance' effect-ablation: the toggle INTENT still
  // fires here on the exact base decision rule (the `active` argument is
  // computed identically), but the stance never engages — dao.activeStance
  // stays '', so both its ×0.7 qi and ×2 Insight sides read identity.
  if (state.config?.counterfactualSeverEffect === 'stance') return
  const dao = useDaoStore()
  if (!dao.isRevealed()) return
  const currentlyActive = dao.activeStance === 'breathingTrance'
  if (currentlyActive !== active) dao.toggleStance('breathingTrance')
}

/**
 * Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable): is insight the binding
 * constraint right now for the lattice grammar? TRUE iff the actor still has a
 * planned insight purchase (a wanted Dao node — heldDaoSeedCount below target)
 * that it CANNOT yet afford (no node affordable from banked Insight). In that
 * state the ×2 Insight side of Breathing Trance directly accelerates the piece
 * gating build progress, so the ×0.7 qi hit buys something; otherwise (all
 * Seeds held, or the next node is already affordable and the wait is pure
 * qi-banking) the trance is pure cost and the smart policy holds it OFF. This
 * is exactly Wes's 2026-07-03 definition: engage only during insight-starved
 * phases, disengage during qi-banking. Pure reads; never mutates game state.
 */
function insightIsBindingConstraint(): boolean {
  const dao = useDaoStore()
  if (!dao.isRevealed()) return false
  if (dao.heldDaoSeedCount() >= COMPETENT_SEED_TARGET) return false // no planned insight purchase left
  for (const node of LATTICE_DATA.nodes) {
    if (dao.canAffordNode(node.key)) return false // next node affordable — qi/banking is the constraint, not insight
  }
  return true // wants a node it cannot yet afford → insight-starved
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
    // Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable): the smart-trance policy
    // variant swaps the base "small qi target" heuristic for the insight-binding
    // test. smartTrancePolicy is set ONLY on the Q10 probe run; for every base/
    // pinned profile it is undefined and this reduces to the exact prior call,
    // so their output stays byte-identical.
    const engageTrance = state.config?.smartTrancePolicy
      ? insightIsBindingConstraint()
      : target.toNumber() < COMPETENT_BANKING_QI_THRESHOLD
    setBreathingTrance(engageTrance, state)
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

/** Is c fully restored — top sub-stage re-climbed AND all milestones latched? */
function cIsFullyRestored(): boolean {
  const realm = useRealmStore()
  return (
    realm.realmBest('c').toNumber() >= C_TOP_SUBSTAGE_AT &&
    realm.stateOf('c').milestones.length >= C_MILESTONE_COUNT
  )
}

/**
 * Re-climb curve instrumentation (OBSERVATION-ONLY: pure store reads, writes
 * confined to sim-side state fields — never perturbs a measured run). Called
 * at the tail of every simPrestige; segment boundary semantics are documented
 * on the CReclimbSegment interface above. An n/s cascade that leaves c below
 * full restoration opens (or extends) a segment; any later prestige that
 * returns c to full restoration closes it at the current sim clock.
 */
function trackCReclimbCurve(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  if (realmId === 'n' || realmId === 's') {
    if (cIsFullyRestored()) return // a full † keep leaves nothing to re-climb
    if (state.cReclimbOpen) {
      state.cReclimbOpen.cascadesSpanned++
    } else {
      const ascentIndex = state.cReclimbSegments.length + 1
      const remembersRate = state.config?.counterfactualCoreRemembers
      let clockScale = 1
      if (remembersRate !== undefined) {
        clockScale = remembersRate ** (ascentIndex - 1)
        // "Brief ritual" asymptote: the scale flattens toward the floor
        // instead of decaying to zero (see counterfactualRemembersFloor).
        const scaleFloor = state.config?.counterfactualRemembersFloor
        if (scaleFloor !== undefined) clockScale = Math.max(clockScale, scaleFloor)
      }
      state.cReclimbOpen = {
        startSeconds: state.simSeconds,
        cascadesSpanned: 1,
        clockScale,
      }
    }
    return // an n/s cascade can never close a segment
  }
  if (state.cReclimbOpen && cIsFullyRestored()) {
    const open = state.cReclimbOpen
    state.cReclimbSegments.push({
      index: state.cReclimbSegments.length + 1,
      startSeconds: open.startSeconds,
      endSeconds: state.simSeconds,
      durationSeconds: state.simSeconds - open.startSeconds,
      cascadesSpanned: open.cascadesSpanned,
    })
    state.cReclimbOpen = undefined
  }
}

/**
 * Sim-clock charge for the ticking/idle advancers. Base path is a literal
 * `simSeconds += dt` (bit-identical to the pre-probe code); ONLY a run
 * carrying counterfactualCoreRemembers with a re-climb segment open charges
 * the discounted r^(k−1)·dt instead ("the core remembers" — the felt clock
 * compresses while the game-state trajectory stays identical to base).
 * game.timePlayed is deliberately still charged raw dt by the callers, so
 * the engine sees an unchanged run.
 */
function chargeSimClock(dt: number, state: SimState): void {
  if (state.config?.counterfactualCoreRemembers !== undefined && state.cReclimbOpen) {
    state.simSeconds += dt * state.cReclimbOpen.clockScale
  } else {
    state.simSeconds += dt
  }
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
 *
 * The ‡ variant (counterfactualPartialCKeep) restores c.milestones ONLY —
 * best wipes normally — the milestones-only partial keep for the slice-9
 * probe. The two keep flags are mutually exclusive (assertProbeFlagsExclusive
 * throws at runner construction). Every call ends in trackCReclimbCurve, the
 * observation-only re-climb instrumentation.
 */
function simPrestige(realmId: 'q' | 'f' | 'c' | 'n' | 's', state: SimState): void {
  const realm = useRealmStore()
  const bigCascade = realmId === 'n' || realmId === 's'
  const probeCKeep = state.config?.counterfactualCKeep === true && bigCascade
  const probePartialCKeep = state.config?.counterfactualPartialCKeep === true && bigCascade
  const cBefore = probeCKeep || probePartialCKeep ? realm.stateOf('c') : null
  const keptBest = cBefore ? cBefore.best : ''
  const keptMilestones = cBefore ? [...cBefore.milestones] : []
  // SEVERING PROBE (Q9) 'profession' effect-ablation: a held clarity charge
  // must NOT boost this prestige's gain, but its CONSUMPTION must still land
  // exactly as in the base run (held counts drive the craft-demand decisions,
  // so they have to keep the base cadence). Zero the aid pills around
  // realm.prestige — the engine then sees no aid and consumes nothing — then
  // restore the counts and consume the one charge the base run would have.
  const severedAidWouldApply =
    state.config?.counterfactualSeverEffect === 'profession' &&
    useAlchemyStore().breakthroughGainMult(realmId).gt(1)
  const severedAidPillSnapshots: { key: PillKey; count: number }[] = []
  if (severedAidWouldApply) {
    const alchemy = useAlchemyStore()
    for (const aidPillKey of SEVERING_AID_PILL_KEYS) {
      severedAidPillSnapshots.push({ key: aidPillKey, count: alchemy.pillCount(aidPillKey) })
      alchemy.pills[aidPillKey] = 0
    }
  }
  realm.prestige(realmId)
  if (severedAidWouldApply) {
    const alchemy = useAlchemyStore()
    for (const snapshot of severedAidPillSnapshots) alchemy.pills[snapshot.key] = snapshot.count
    alchemy.consumeBreakthroughAid(realmId)
  }
  if (probeCKeep) {
    const cAfter = realm.stateOf('c')
    // Restore the keep-rule keys only if the cascade actually wiped them (it
    // always does today — nothing keeps c below n/s — but stay defensive).
    if (new Decimal(cAfter.best).lt(new Decimal(keptBest))) {
      realm.slice['c'] = { ...cAfter, best: keptBest, milestones: keptMilestones }
    }
  } else if (probePartialCKeep) {
    const cAfter = realm.stateOf('c')
    // ‡: milestones survive (the ×5.25 rate product), best does NOT — same
    // defensive wipe check as the † branch above.
    if (cAfter.milestones.length < keptMilestones.length) {
      realm.slice['c'] = { ...cAfter, milestones: keptMilestones }
    }
  }
  trackCReclimbCurve(realmId, state)
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
  const game = useGameStore()
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
  // SEVERING PROBE (Q9) 'extraordinaryMeridians' effect-ablation: buys are
  // mirrored sim-side on the identical decision rule (same unlock gate, same
  // cost ladder read from the same owned-count, same payback bar, same Qi
  // deduction as body.buyBuyable) while body.extraordinaryMeridians stays 0 —
  // so the track's 1.25^n meridianMult never applies. Base runs read exactly
  // body.buyableAmount (the sim counter is only set under the flag).
  const severExtraordinaryMeridians =
    state.config?.counterfactualSeverEffect === 'extraordinaryMeridians'
  const ownedCountOf = (key: 'primaryMeridian' | 'temper' | 'extraordinaryMeridian'): number =>
    key === 'extraordinaryMeridian' && severExtraordinaryMeridians
      ? (state.severedExtraordinaryMeridiansBought ?? 0)
      : body.buyableAmount(key)
  for (const buyTarget of buyTargets) {
    while (ownedCountOf(buyTarget.key) < buyTarget.cap) {
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
      const cost = body.buyableCost(buyTarget.key, ownedCountOf(buyTarget.key))
      const paybackBudget = pipelines.qiPerSecond.times(COMPETENT_PAYBACK_SECONDS)
      if (cost.gt(paybackBudget)) break
      advanceToQiTicking(cost, state)
      if (buyTarget.key === 'extraordinaryMeridian' && severExtraordinaryMeridians) {
        if (game.points.lt(cost)) break // mirror buyBuyable's affordability bail
        game.points = game.points.sub(cost).max(0)
        state.severedExtraordinaryMeridiansBought = (state.severedExtraordinaryMeridiansBought ?? 0) + 1
      } else if (!body.buyBuyable(buyTarget.key)) {
        break
      }
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
 * SEVERING PROBE (Q9): has this run acquired its soul aspect — either bound
 * live in the store, or bound-then-nullified under the 'soulAspect'
 * effect-ablation? Every policy "is the aspect chosen yet?" check routes
 * through here so the ablated run never re-binds. Base runs read exactly
 * body.soulAspectChosen (severedAspectKey is only ever set under the flag).
 */
function soulAspectAcquired(state: SimState): boolean {
  return useBodyStore().soulAspectChosen || state.severedAspectKey !== undefined
}

/**
 * All policy soul-aspect binds route through here. Base path is a literal
 * body.setSoulAspect. Under SEVERING PROBE (Q9) 'soulAspect' ablation, the
 * bind fires normally (same gate verification, same decision point) and the
 * effect is then nullified by clearing body.soulAspect — pipelines read
 * identity from an empty key — while the acquisition is remembered sim-side
 * (state.severedAspectKey) so the policy treats the aspect as chosen.
 */
function simBindSoulAspect(aspectKey: string, requiresCondition: Condition, state: SimState): boolean {
  const body = useBodyStore()
  const bound = body.setSoulAspect(aspectKey, requiresCondition)
  if (bound && state.config?.counterfactualSeverEffect === 'soulAspect') {
    state.severedAspectKey = aspectKey
    body.soulAspect = '' // COUNTERFACTUAL: acquired, effect nullified
  }
  return bound
}

/**
 * Try to bind an ELEMENT soul aspect (qi-leaning elements preferred) once
 * Nascent Soul exists. Each aspect's daoElementTier gate is live-verified by
 * setSoulAspect itself. Formless is deliberately NOT taken here — it is the
 * fallback of last resort, bound just before the first s prestige (see
 * runCompetent) so a slightly-late Seed doesn't lock the run out of ×1.5.
 */
function tryPickElementAspect(state: SimState): void {
  const realm = useRealmStore()
  if (soulAspectAcquired(state)) return
  if (!realm.stateOf('n').unlocked) return
  const preference = state.config?.aspectPreference ?? COMPETENT_ASPECT_PREFERENCE
  const aspects = findRealm('n').soulAspect!.aspects
  for (const preferredKey of preference) {
    const aspect = aspects.find((a) => a.key === preferredKey)
    if (aspect && simBindSoulAspect(aspect.key, aspect.requires, state)) return
  }
}

// ---- Alchemy + secret-realm hooks (PillFocused / Realistic) -----------------

// Held-pill targets (sim policy, this file's constant style). ⟨tune⟩
const PILL_CLARITY_HOLD_TARGET = 2 // clarity charges banked ahead of n/s prestiges
const PILL_WARDING_HOLD_TARGET = 1 // one Heaven-Warding pill carried (pool effect untested — sim stops at s320)

// SEVERING PROBE (Q9) — profession effect-ablation plumbing (data-derived).
// A non-timed recipe key: swapping the active pill's key to it makes
// activeTimedRecipe() read null (identity qi factor) while the pill TIMER
// keeps ticking on the base cadence, so re-swallow decisions stay base-shaped.
const SEVERING_NULL_EFFECT_PILL_KEY = ALCHEMY_DATA.recipes.find(
  (recipe) => recipe.effect.type !== 'timedQiMult',
)!.key
// Every breakthrough-aid (clarity-shaped) pill key — zeroed around a severed
// prestige so the gain boost never applies, then restored + consumed manually.
const SEVERING_AID_PILL_KEYS: readonly PillKey[] = ALCHEMY_DATA.recipes
  .filter((recipe) => recipe.effect.type === 'breakthroughAid')
  .map((recipe) => recipe.key)

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
    if (alchemy.activatePill('gatheringPill')) {
      state.pillsSwallowed++
      // SEVERING PROBE (Q9) 'profession' effect-ablation: the swallow just
      // happened on the base rule (pill count decremented, timer started);
      // swap the active key to a non-timed recipe so activePillQiMult reads
      // identity while alchemy.update ticks the SAME remaining-seconds down —
      // the re-swallow cadence stays base-shaped, only the effect is gone.
      // (Fresh store read: the enclosing !activePill check narrows the outer
      // alias to null, but activatePill just replaced the pill.)
      const swallowedPill: ActivePill | null = useAlchemyStore().activePill
      if (state.config?.counterfactualSeverEffect === 'profession' && swallowedPill) {
        alchemy.activePill = { ...swallowedPill, key: SEVERING_NULL_EFFECT_PILL_KEY }
      }
    }
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
    if (!soulAspectAcquired(state)) {
      tryPickElementAspect(state)
      if (!soulAspectAcquired(state)) {
        if (state.config?.counterfactualForceMetalAspect) {
          const metalSoul = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'metalSoul')!
          simBindSoulAspect(metalSoul.key, {}, state) // {} == unconditional: gate bypass
        } else {
          const formlessAspect = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'formless')!
          simBindSoulAspect(formlessAspect.key, formlessAspect.requires, state)
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

/**
 * The counterfactual probes answer different questions on different mechanics
 * († full keep, ‡ milestones-only keep, r clock compression, ⊘ severing
 * effect-ablation) — stacking them has no defined meaning, so a config
 * carrying more than one is a probe-construction bug worth failing loudly at
 * runner build time.
 */
function assertProbeFlagsExclusive(config: SpineConfig): void {
  const flagsSet = [
    config.counterfactualCKeep === true,
    config.counterfactualPartialCKeep === true,
    config.counterfactualCoreRemembers !== undefined,
    config.counterfactualSeverEffect !== undefined,
  ].filter(Boolean).length
  if (flagsSet > 1) {
    throw new Error(
      'counterfactualCKeep (†), counterfactualPartialCKeep (‡), ' +
        'counterfactualCoreRemembers (r), and counterfactualSeverEffect (⊘) ' +
        'are mutually exclusive probes — pick one',
    )
  }
  if (
    config.counterfactualRemembersFloor !== undefined &&
    config.counterfactualCoreRemembers === undefined
  ) {
    throw new Error(
      'counterfactualRemembersFloor is a modifier on the remembers probe — it needs counterfactualCoreRemembers set',
    )
  }
}

/** A spine profile runner: attach the config, then drive the shared spine. */
function spineRunner(config: SpineConfig): (state: SimState) => void {
  assertProbeFlagsExclusive(config)
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
    chargeSimClock(dt, state)
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
  const realm = useRealmStore()
  if (soulAspectAcquired(state)) return
  if (!realm.stateOf('n').unlocked) return
  tryPickElementAspect(state)
  if (!soulAspectAcquired(state)) {
    const formless = findRealm('n').soulAspect!.aspects.find((a) => a.key === 'formless')!
    simBindSoulAspect(formless.key, formless.requires, state)
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
  assertProbeFlagsExclusive(config)
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
    cReclimbSegments: [],
    pillsSwallowed: 0,
    pillsCrafted: 0,
  }
  fn(state)
  state.summary = summarize(state)
  return state
}

// ---- C re-climb curve report helpers (the core remembers — legibility) -------

// Curve-table density (the read is curve SHAPE at the ENDS — whether the
// live gain rule makes late climbs trivially fast or early ones
// indistinguishable from full cost). Full per-k list at/below the max; above
// it, every k for the head, then deciles (p10…p90), then the tail.
const CURVE_PRINT_FULL_MAX = 20
const CURVE_PRINT_HEAD_ROWS = 5
const CURVE_PRINT_TAIL_ROWS = 3
// ⟨tune⟩ Fewer Realistic re-climbs than this = too few samples for the curve to
// be FELT — the pre-named fallback signal (extend the curve into Act II instead).
const FELT_CURVE_MIN_SAMPLES = 5
// Single-breath bar: a re-climb completing within ONE late-game check-in
// interval is felt as "a breath". The single-breath COUNT is the legibility
// metric (how many of the experience-target actor's climbs are breaths).
const BREATH_SECONDS = REALISTIC_CHECKIN_LATE_SECONDS

/** One curve-table row: `k=3: 512s (8.5m) [spans 2 cascades]`. */
function reclimbRowText(segment: CReclimbSegment): string {
  const spans = segment.cascadesSpanned > 1 ? ` [spans ${segment.cascadesSpanned} cascades]` : ''
  return `k=${segment.index}: ${segment.durationSeconds.toFixed(0)}s (${(segment.durationSeconds / 60).toFixed(1)}m)${spans}`
}

/** First-vs-last re-climb duration ratio (>1× = later re-climbs are faster). */
function firstOverLastText(segments: CReclimbSegment[]): string {
  if (segments.length < 2) return '—'
  const lastDuration = segments[segments.length - 1]!.durationSeconds
  if (lastDuration <= 0) return '—'
  return `${(segments[0]!.durationSeconds / lastDuration).toFixed(2)}×`
}

/** Compact curve shape: first / mid / last durations + first-vs-last ratio. */
function curveShapeText(segments: CReclimbSegment[]): string {
  if (segments.length === 0) return 'no re-climbs'
  const first = segments[0]!
  const mid = segments[Math.floor((segments.length - 1) / 2)]!
  const last = segments[segments.length - 1]!
  return (
    `first ${first.durationSeconds.toFixed(0)}s / mid ${mid.durationSeconds.toFixed(0)}s / ` +
    `last ${last.durationSeconds.toFixed(0)}s | first/last ${firstOverLastText(segments)}`
  )
}

/**
 * Per-k curve table. The re-climb COUNT gets its own line — it is a
 * RESOLUTION constraint (how complex an acceleration curve can even be
 * perceived), not just a thin-curve warning. Full per-k list at/below
 * CURVE_PRINT_FULL_MAX; above it, every k for the first CURVE_PRINT_HEAD_ROWS,
 * then the p10…p90 deciles, then the last CURVE_PRINT_TAIL_ROWS — dense at the
 * ends, where a constant-r failure would show (late climbs trivially fast /
 * early ones indistinguishable from full cost).
 */
function printReclimbCurve(label: string, segments: CReclimbSegment[]): void {
  console.log(`  ${label} — re-climb count: ${segments.length}`)
  if (segments.length === 0) {
    console.log('    (c never left full restoration — nothing to re-climb)')
    return
  }
  console.log(`    shape: ${curveShapeText(segments)}`)
  if (segments.length <= CURVE_PRINT_FULL_MAX) {
    for (const segment of segments) console.log(`    ${reclimbRowText(segment)}`)
    return
  }
  // Dense-ends sampling: head rows, decile rows (tagged pNN), tail rows.
  const decileTagByIndex = new Map<number, string>()
  for (let decile = 1; decile <= 9; decile++) {
    decileTagByIndex.set(Math.floor((segments.length * decile) / 10) - 1, `p${decile * 10}`)
  }
  const pickedIndices = new Set<number>()
  for (let i = 0; i < CURVE_PRINT_HEAD_ROWS; i++) pickedIndices.add(i)
  for (const index of decileTagByIndex.keys()) pickedIndices.add(index)
  for (let i = segments.length - CURVE_PRINT_TAIL_ROWS; i < segments.length; i++) pickedIndices.add(i)
  const orderedIndices = [...pickedIndices].sort((a, b) => a - b)
  let previousIndex = -1
  for (const index of orderedIndices) {
    if (previousIndex >= 0 && index > previousIndex + 1) console.log('    …')
    const tag = decileTagByIndex.has(index) ? `  [${decileTagByIndex.get(index)}]` : ''
    console.log(`    ${reclimbRowText(segments[index]!)}${tag}`)
    previousIndex = index
  }
}

// HISTORICAL (retired 2026-07-02): flatDiscountCheck compared base vs the ‡
// milestones-only keep to test the flat-discount prediction. Retired with the ‡
// runs; the mechanic it fed into (D2) is closed and live. Record: calibration.md.

// ---- SEVERING PROBE (Q9) helpers (decision input for D23 Spirit Severing) ----

/**
 * End-of-run rate shares for the SEVERING PROBE (Q9). OBSERVATION-ONLY:
 * measured at the final (trib-trigger) state of a BASE run while its Pinia is
 * still live. For each candidate severable, m = qiPerSecond with the piece's
 * effect ON ÷ with it OFF — the multiplier magnitude a transcendent severance
 * multiplier must cover. Each "off" read is a temporary store mutation,
 * restored immediately; an identity re-read at the end verifies the measured
 * state came back exact (a restore bug throws loudly — that is probe hygiene,
 * not a pacing assertion). Nothing is printed here; the caller stores the
 * numbers and the SEVERING PROBE section prints them, so the base-profile
 * output stays bit-identical.
 */
interface SeveringRateShares {
  soulAspect: number
  stance: number
  profession: number
  extraordinaryMeridians: number
  boundAspectKey: string
  activePillKey: string | null
  extraordinaryMeridiansOwned: number
}

function measureSeveringRateShares(): SeveringRateShares {
  const pipelines = usePipelinesStore()
  const body = useBodyStore()
  const dao = useDaoStore()
  const alchemy = useAlchemyStore()
  const rateWithEffectOn = pipelines.qiPerSecond
  const shareWithEffectOff = (nullify: () => void, restore: () => void): number => {
    nullify()
    const rateWithEffectOff = pipelines.qiPerSecond
    restore()
    return rateWithEffectOff.lte(0) ? Number.NaN : rateWithEffectOn.div(rateWithEffectOff).toNumber()
  }
  const priorAspectKey = body.soulAspect
  const soulAspectShare = shareWithEffectOff(
    () => { body.soulAspect = '' },
    () => { body.soulAspect = priorAspectKey },
  )
  const priorStanceKey = dao.activeStance
  const stanceShare = shareWithEffectOff(
    () => { dao.activeStance = '' },
    () => { dao.activeStance = priorStanceKey },
  )
  const priorActivePill = alchemy.activePill
  const professionShare = shareWithEffectOff(
    () => { alchemy.activePill = null },
    () => { alchemy.activePill = priorActivePill },
  )
  const priorExtraordinaryCount = body.extraordinaryMeridians
  const extraordinaryShare = shareWithEffectOff(
    () => { body.extraordinaryMeridians = 0 },
    () => { body.extraordinaryMeridians = priorExtraordinaryCount },
  )
  if (!pipelines.qiPerSecond.eq(rateWithEffectOn)) {
    throw new Error(
      'measureSeveringRateShares failed to restore the measured end-state exactly — probe bug',
    )
  }
  return {
    soulAspect: soulAspectShare,
    stance: stanceShare,
    profession: professionShare,
    extraordinaryMeridians: extraordinaryShare,
    boundAspectKey: priorAspectKey || 'none',
    activePillKey: priorActivePill?.key ?? null,
    extraordinaryMeridiansOwned: priorExtraordinaryCount,
  }
}

// SEVERING PROBE (Q9) — Part 2 model grid. ⟨tune⟩ The transcendent multiplier
// starts at c·m and ramps geometrically per severance-ritual completion to a
// cap of k·m; growth is derived so the cap is reached exactly at step
// SEVERING_RITUAL_STEP_COUNT — mirroring Act I's 12-re-climb resolution at
// Realistic cadence (D2/D21). A MODEL, not a measurement.
const SEVERING_RAMP_START_FRACTIONS = [0.25, 0.5, 0.75] as const // c: start = c·m
const SEVERING_RAMP_CAP_FACTORS = [1.2, 1.5, 2.0] as const // k: cap = k·m (k>1 = D23's superset rule)
const SEVERING_RITUAL_STEP_COUNT = 12

// =============================================================================
// === ACT II SPINE MODEL (slice-9 §6; D25/D27/D28) — observation-only ==========
// =============================================================================
//
// Extends a COPY of the Competent policy through Spirit Severing. The pinned
// Competent run is UNTOUCHED — this boots its own quiet Competent Act I, reads
// the end state, then models Act II ANALYTICALLY (like the rest of the sim:
// time-to-afford, not a tick loop). Everything here is a MODEL awaiting Gate-D
// sign-off (D28: "all new numbers ⟨tune⟩ pending Act II sim evidence"); NOTHING
// is asserted — no FAIL token is ever emitted (§6: dynamic assertions become
// FAIL-able only after Wes signs off Act II numbers).
//
// The math is MIRRORED FROM DATA, never the severing/dao stores (which the
// pipelines transitively hold): SETPIECE_DATA.severance (the c·m → k·m ramp),
// OFFERING_DATA (corpse baskets), ACCUMULATOR_DATA.severanceRitual (the mastery
// discount), LATTICE_DATA manifestation tier, realm-x substages (null per D33 —
// the cut grants no qi bonus, so act2RealmXQiMult is identity). Only
// end-state RATES and the bound aspect's data multipliers are read live (the
// same read-only convention as measureSeveringRateShares).
//
// THE PIPELINE MODEL (§6, "the severed piece's contribution nullifies; the
// transcendent ramp multiplies"): a severed piece's own multiplier is removed
// from the rate and REPLACED by axisValue(m, ratio) = (m>1 ? m·ratio :
// max(ratio,1)); ratio ramps from startFraction (0.5) through breakeven (>=1)
// to capRatio (2.0). D33 (Q12 closed): the realm-x substage qiMults are now
// null (act2RealmXQiMult strips to identity) — the cut grants NO qi bonus, so
// the transcendent ramp is the ONLY compensation and the trough is a REAL dip
// (pre-D33 the 2.0/2.4/2.8 bumps overwhelmed the 0.5 ramp and qi ROSE at every
// cut). The store still latches x milestones off severance COUNT (realm.ts §D28).

// Ramp constants, mirrored from SETPIECE_DATA.severance (never hardcoded).
const ACT2_SEVER_CFG = SETPIECE_DATA.severance
const ACT2_START_FRACTION = ACT2_SEVER_CFG.startFraction // c = 0.5
const ACT2_CAP_RATIO = ACT2_SEVER_CFG.capRatio // k = 2.0
const ACT2_RAMP_STEPS = ACT2_SEVER_CFG.rampSteps // 12
const ACT2_RAMP_GROWTH = Math.pow(ACT2_CAP_RATIO / ACT2_START_FRACTION, 1 / (ACT2_RAMP_STEPS - 1))
// Raw ritual completions until ratio first reaches 1 (0-indexed from the cut);
// mirrors the severing store's RAW_BREAKEVEN_STEPS. Display step = this + 1.
const ACT2_RAW_BREAKEVEN_STEPS =
  ACT2_START_FRACTION >= 1
    ? 0
    : Math.ceil(Math.log(1 / ACT2_START_FRACTION) / Math.log(ACT2_RAMP_GROWTH))
const ACT2_BREAKEVEN_STEP_DISPLAY = ACT2_RAW_BREAKEVEN_STEPS + 1
// The offering mastery-discount accumulator (D28), cost-side max(r^rituals, f).
const ACT2_OFFERING_ACC = ACCUMULATOR_DATA.severanceRitual
// The tribulation set-piece duration (SETPIECE_DATA.firstTribulation) — the
// entry beat that opens Act II; modeled as a fixed cost (§3 scar-on-entry is
// out of chunk-A scope, noted below).
const ACT2_TRIBULATION_SECONDS = SETPIECE_DATA.firstTribulation.durationSeconds

/** Ramp ratio at a raw step count (mirrors severing store ratioAtStep). */
function act2RatioAtStep(steps: number): number {
  return Math.min(ACT2_START_FRACTION * Math.pow(ACT2_RAMP_GROWTH, steps), ACT2_CAP_RATIO)
}

/**
 * axisValue(m, ratio) = the transcendent multiplier a severance leaves on ONE
 * axis: an occupied axis (m>1) ramps m·ratio; an unoccupied axis (m===1) gets
 * max(ratio,1) — the k>1 superset bonus, never a penalty. Mirrors the severing
 * store's axisValue exactly.
 */
function act2AxisValue(m: Decimal, ratio: number): Decimal {
  return m.eq(1) ? Decimal.max(new Decimal(ratio), 1) : m.times(ratio)
}

/**
 * One severable the Act II spine carries. `inBaseRate` marks pieces already
 * folded into the Competent end-state rate (the bound soul aspect) vs pieces
 * ACQUIRED in Act II (ext track, manifestation) whose owned multiplier is added
 * on acquisition. The per-axis rate factor is: not-acquired → 1; owned →
 * (inBase ? 1 : m); severed → axisValue(m,ratio) / (inBase ? m : 1). The divide
 * for in-base pieces removes the piece's original contribution before the ramp
 * replaces it — so the net is axisValue(m,ratio) either way.
 */
interface Act2Piece {
  // Plain string: the sim's local SeverableKey predates the manifestation
  // severable (it lists only the Act-I-measurable four); key is label-only here.
  readonly key: string
  readonly label: string
  readonly mQi: Decimal
  readonly mInsight: Decimal
  readonly inBaseRate: boolean
  acquired: boolean
  severed: boolean
  ratio: number
}

function act2PieceAxisFactor(piece: Act2Piece, axis: 'qi' | 'insight'): Decimal {
  const m = axis === 'qi' ? piece.mQi : piece.mInsight
  if (piece.severed) {
    const av = act2AxisValue(m, piece.ratio)
    return piece.inBaseRate ? av.div(m) : av
  }
  if (!piece.acquired) return new Decimal(1)
  return piece.inBaseRate ? new Decimal(1) : m
}

/**
 * realm-x qi multiplier after `severCount` cuts — cumulative substage product.
 * D33: realm-x substage qiMults are now `null` (the cut grants no qi bonus; the
 * transcendent ramp is the only compensation), so this strips to identity (1).
 * The loop stays so any future non-null substage would re-enter the product;
 * null is skipped explicitly, never falsy-multiplied.
 */
function act2RealmXQiMult(severCount: number): Decimal {
  const substages = findRealm('x').substages
  let product = new Decimal(1)
  for (let i = 0; i < severCount && i < substages.length; i++) {
    const qiMult = substages[i]!.qiMult
    if (qiMult === null) continue // D33: severance reward is the ramp, not a bonus.
    product = product.times(qiMult)
  }
  return product
}

interface Act2SeverRow {
  severable: string
  corpseCut: string
  offeringCorpse: string
  mQi: string
  mInsight: string
  breakevenStep: number
  weaknessWindowH: string
  offerings: number
  qiSacrificed: string
  insightSacrificed: string
  inWindowNet: string
  lifetimeNet: string
  liveAtChoice: number
}

interface Act2Result {
  actISeconds: number
  actIISeconds: number
  tribToFirstSeverSeconds: number
  extAcquireSeconds: number
  manifestAcquireSeconds: number
  manifestNodesBought: string[]
  manifestInsightSpent: Decimal
  rows: Act2SeverRow[]
  totalOfferings: number
  totalQiSacrificed: Decimal
  totalInsightSacrificed: Decimal
  masteryTrajectory: number[]
  baseQi: Decimal
  baseInsight: Decimal
  qiBankStart: Decimal
  insightBankStart: Decimal
  aspectKey: string
  extMultQi: Decimal
  manifestMultQi: Decimal
  manifestMultInsight: Decimal
  minLiveSeverables: number
  liveAtFirstChoice: number
  timeToCapProjectionH: string[]
}

/**
 * Model the Competent spine through Act II. Boots a fresh Competent Act I (its
 * end state is the launch pad), then runs the analytic Act II model. Returns the
 * measured/derived numbers; the caller prints them. No stores are mutated for
 * the Act II mechanics (all offering/severance math is data-mirrored); the only
 * store writes are the throwaway ext-meridian cost reads via body.buyableCost,
 * which is a pure read.
 */
function runActIISpine(): Act2Result {
  const actState = runProfileQuiet(runCompetent) // Pinia now live at Competent Act I end
  const actISeconds = actState.simSeconds
  const pipelines = usePipelinesStore()
  const body = useBodyStore()
  const dao = useDaoStore()
  const game = useGameStore()

  const baseQi = pipelines.qiPerSecond // includes the bound aspect; no ext, no manifestation
  const baseInsight = pipelines.insightPerSecond

  // --- Piece 1: soul aspect (bound in Act I, in the base rate) ---------------
  const aspectKey = body.soulAspect
  const aspectData = findRealm('n').soulAspect!.aspects.find((a) => a.key === aspectKey)
  const aspectPiece: Act2Piece = {
    key: 'soulAspect',
    label: 'soul aspect',
    mQi: new Decimal(aspectData?.effect.qiMult ?? 1),
    mInsight: new Decimal(aspectData?.effect.insightMult ?? 1),
    inBaseRate: true,
    acquired: true,
    severed: false,
    ratio: 0,
  }

  // --- Piece 3: extraordinary-meridian track (ACQUIRED in Act II) ------------
  // The Competent spine skips the ext track in Act I (byte-identical to the
  // pin). Post-tribulation the gate is long met (12 primary + q 10th Level), so
  // buying the full set of 8 is greedy-but-legal — and it is the THIRD live
  // severable (aspect + manifestation alone is only 2; §6 needs >=3). Justified
  // from the k-probe: the ext track is a CLEAN 5.96× (1.25^8), so cutting it
  // gives a clean ramp — profession is a duty-cycle/episodic composite (not
  // clean), the worse severance to build a policy on. "ext-or-profession → ext."
  const extBuyable = findBodyBuyable('extraordinaryMeridian')
  const extMultQi = Decimal.pow(extBuyable.effectBase, extBuyable.limit)
  let extCostQi = new Decimal(0)
  for (let i = 0; i < extBuyable.limit; i++) {
    extCostQi = extCostQi.add(body.buyableCost('extraordinaryMeridian', i))
  }
  const extPiece: Act2Piece = {
    key: 'extraordinaryMeridians',
    label: 'ext-meridian track',
    mQi: extMultQi,
    mInsight: new Decimal(1),
    inBaseRate: false,
    acquired: false, // flips true after the Act II buy
    severed: false,
    ratio: 0,
  }

  // --- Piece 2: lattice Manifestation (ACQUIRED in Act II) -------------------
  // Greedy-but-legal manifestation policy: buy the Manifestation tier on every
  // node the spine already owns at Seed (tier >= 2), cheapest-first, from banked
  // Insight, refusing the buy that would place BOTH conflict partners
  // (flow/stillness) at Manifestation (data-driven off LATTICE_DATA.conflicts).
  // Requires the passed tribulation (modeled — we are post-tribulation here).
  const MANIFESTATION_TIER_INDEX = 2
  const ownedSeedNodes = LATTICE_DATA.nodes.filter((n) => dao.nodeTierOwned(n.key) >= 2)
  const manifestCandidates = [...ownedSeedNodes].sort(
    (a, b) => a.costs[MANIFESTATION_TIER_INDEX]! - b.costs[MANIFESTATION_TIER_INDEX]!,
  )
  const conflictPairs = LATTICE_DATA.conflicts
  const manifestBoughtKeys: string[] = []
  let manifestMultQi = new Decimal(1)
  let manifestMultInsight = new Decimal(1)
  let manifestInsightCost = new Decimal(0)
  for (const node of manifestCandidates) {
    // Conflict guard: skip if the partner is already taken to Manifestation.
    const conflicted = conflictPairs.some(([x, y]) => {
      const partner = x === node.key ? y : y === node.key ? x : null
      return partner !== null && manifestBoughtKeys.includes(partner)
    })
    if (conflicted) continue
    const effect = node.effects[MANIFESTATION_TIER_INDEX]
    if (!effect) continue
    if ('qiMult' in effect) manifestMultQi = manifestMultQi.times(effect.qiMult)
    else manifestMultInsight = manifestMultInsight.times(effect.insightMult)
    manifestInsightCost = manifestInsightCost.add(node.costs[MANIFESTATION_TIER_INDEX]!)
    manifestBoughtKeys.push(node.key)
  }
  const manifestPiece: Act2Piece = {
    key: 'manifestation',
    label: 'manifestation',
    mQi: manifestMultQi,
    mInsight: manifestMultInsight,
    inBaseRate: false,
    acquired: false,
    severed: false,
    ratio: 0,
  }

  // Sever order (§6 spine policy): aspect → manifestation → ext. Corpses are
  // severed in DATA order (past, present, future) — the severable maps onto the
  // corpse by position, not by theme (the offering basket is the CORPSE's).
  const severOrder = [aspectPiece, manifestPiece, extPiece]
  const corpses = SEVERING_DATA.corpses

  // --- Rate recompute (the pipeline model) -----------------------------------
  const allPieces = [aspectPiece, manifestPiece, extPiece]
  const severCountNow = (): number => allPieces.filter((p) => p.severed).length
  const qiRate = (): Decimal => {
    let rate = baseQi.times(act2RealmXQiMult(severCountNow()))
    for (const piece of allPieces) rate = rate.times(act2PieceAxisFactor(piece, 'qi'))
    return rate
  }
  const insightRate = (): Decimal => {
    let rate = baseInsight
    for (const piece of allPieces) rate = rate.times(act2PieceAxisFactor(piece, 'insight'))
    return rate
  }

  // --- Timeline (analytic; carry live banks into Act II) ---------------------
  let simSeconds = 0
  let qiBank = game.points
  let insightBank = dao.insight
  const qiBankStart = game.points
  const insightBankStart = dao.insight
  let rituals = 0 // soul.severanceRituals mirror (offerings only; sever() never bumps it)
  const advance = (dt: number): void => {
    if (dt <= 0) return
    simSeconds += dt
    qiBank = qiBank.add(qiRate().times(dt))
    insightBank = insightBank.add(insightRate().times(dt))
  }
  const timeToAfford = (needQi: Decimal, needInsight: Decimal): number => {
    const qiGap = needQi.sub(qiBank)
    const insGap = needInsight.sub(insightBank)
    const qiDt = qiGap.lte(0) ? 0 : qiGap.div(qiRate()).toNumber()
    const insDt = insGap.lte(0) ? 0 : insGap.div(insightRate().toNumber() <= 0 ? new Decimal(1) : insightRate()).toNumber()
    return Math.max(qiDt, Number.isFinite(insDt) ? insDt : 0, 0)
  }

  // 1) The tribulation set-piece opens Act II (banks accrue across it).
  advance(ACT2_TRIBULATION_SECONDS)

  // 2) Acquire the ext-meridian track (qi) — cheap at Act II qi scale.
  const extStart = simSeconds
  advance(timeToAfford(extCostQi, new Decimal(0)))
  qiBank = qiBank.sub(extCostQi).max(0)
  extPiece.acquired = true
  const extAcquireSeconds = simSeconds - extStart

  // 3) Acquire manifestation nodes (insight) — the insight competition begins.
  const manifestStart = simSeconds
  for (const node of manifestBoughtKeys) {
    const cost = new Decimal(
      LATTICE_DATA.nodes.find((n) => n.key === node)!.costs[MANIFESTATION_TIER_INDEX]!,
    )
    advance(timeToAfford(new Decimal(0), cost))
    insightBank = insightBank.sub(cost).max(0)
  }
  manifestPiece.acquired = true
  const manifestAcquireSeconds = simSeconds - manifestStart
  const tribToFirstSeverSeconds = simSeconds

  // 4) Sever the three corpses sequentially; each lived-with at breakeven.
  const rows: Act2SeverRow[] = []
  let totalOfferings = 0
  let totalQiSacrificed = new Decimal(0)
  let totalInsightSacrificed = new Decimal(0)
  const masteryTrajectory: number[] = []
  const liveSeverableCount = (): number =>
    allPieces.filter((p) => p.acquired && !p.severed).length
  let minLiveSeverables = Number.POSITIVE_INFINITY
  let liveAtFirstChoice = 0
  const timeToCapProjectionH: string[] = []

  for (let severIndex = 0; severIndex < severOrder.length; severIndex++) {
    const piece = severOrder[severIndex]!
    const liveNow = liveSeverableCount()
    if (severIndex === 0) liveAtFirstChoice = liveNow
    minLiveSeverables = Math.min(minLiveSeverables, liveNow)

    // The cut: capture ramp start; realm-x substage unlocks (severCount++).
    piece.severed = true
    piece.ratio = act2RatioAtStep(0)
    const ritualsAtSever = rituals

    // Offerings until this cut crosses breakeven (raw step >= breakeven).
    const weaknessStart = simSeconds
    let stepsSince = 0
    let severQiSacrificed = new Decimal(0)
    let severInsightSacrificed = new Decimal(0)
    let rampSumToBreakeven = 0
    // D30: the offering corpse is the corpse JUST CUT (severances[last].corpse in
    // the store) — after cutting corpse N you pay corpse N's own rite for the
    // twelve turnings of mastering that loss. (Pre-first-cut practice offerings
    // bill at the Past; the spine never makes any — it severs on entry.)
    const offeringCorpseIndex = Math.min(severIndex, corpses.length - 1)
    const offeringCorpseKey = corpses[offeringCorpseIndex]!.key
    const basket = findOfferingBasket(offeringCorpseKey)

    while (stepsSince < ACT2_RAW_BREAKEVEN_STEPS) {
      const stepsInto = rituals - ritualsAtSever // cost growth within this severance
      const mastery = Decimal.max(
        Decimal.pow(ACT2_OFFERING_ACC.ratio!, rituals),
        ACT2_OFFERING_ACC.floor!,
      )
      // Competent carries no active pill (engagePills:false) → pill factor 1.
      const scale = Decimal.pow(OFFERING_DATA.growth, stepsInto).times(mastery)
      const costQi = new Decimal(basket.qiBase).times(scale)
      const costInsight = new Decimal(basket.insightBase).times(scale)
      piece.ratio = act2RatioAtStep(stepsSince) // weakness-window rate for this wait
      advance(timeToAfford(costQi, costInsight))
      qiBank = qiBank.sub(costQi).max(0)
      insightBank = insightBank.sub(costInsight).max(0)
      severQiSacrificed = severQiSacrificed.add(costQi)
      severInsightSacrificed = severInsightSacrificed.add(costInsight)
      masteryTrajectory.push(mastery.toNumber())
      rituals++
      stepsSince++
      rampSumToBreakeven += act2RatioAtStep(stepsSince - 1)
      totalOfferings++
    }
    piece.ratio = act2RatioAtStep(stepsSince) // now >= 1 (lived-with)

    totalQiSacrificed = totalQiSacrificed.add(severQiSacrificed)
    totalInsightSacrificed = totalInsightSacrificed.add(severInsightSacrificed)

    // In-window net = mean ramp ratio over the steps to breakeven (m-independent,
    // like the Part-2 grid). Full-ramp lifetime net = mean over all 12 steps.
    const inWindowNet = rampSumToBreakeven / ACT2_RAW_BREAKEVEN_STEPS
    let fullRampSum = 0
    for (let step = 0; step < ACT2_RAMP_STEPS; step++) fullRampSum += act2RatioAtStep(step)
    const lifetimeNet = fullRampSum / ACT2_RAMP_STEPS

    // Time-to-cap projection: analytically, the ramp caps at raw step
    // (rampSteps-1); the extra offerings past breakeven cost growth^stepsInto
    // more each. Project the additional wall-time at the CURRENT rate (a
    // lower-bound — the rate rises past breakeven, so real cap-time is shorter).
    let capProjectionSeconds = simSeconds - weaknessStart
    {
      let projRituals = rituals
      let projStepsInto = stepsSince
      let projBankInsight = insightBank
      let projBankQi = qiBank
      let projSeconds = 0
      const projQiRate = qiRate()
      const projInsRate = insightRate()
      while (projStepsInto < ACT2_RAMP_STEPS - 1) {
        const mastery = Decimal.max(
          Decimal.pow(ACT2_OFFERING_ACC.ratio!, projRituals),
          ACT2_OFFERING_ACC.floor!,
        )
        const scale = Decimal.pow(OFFERING_DATA.growth, projStepsInto).times(mastery)
        const costQi = new Decimal(basket.qiBase).times(scale)
        const costInsight = new Decimal(basket.insightBase).times(scale)
        const qiGap = costQi.sub(projBankQi)
        const insGap = costInsight.sub(projBankInsight)
        const dt = Math.max(
          qiGap.lte(0) ? 0 : qiGap.div(projQiRate).toNumber(),
          insGap.lte(0) || projInsRate.lte(0) ? 0 : insGap.div(projInsRate).toNumber(),
        )
        projSeconds += dt
        projBankQi = projBankQi.add(projQiRate.times(dt)).sub(costQi).max(0)
        projBankInsight = projBankInsight.add(projInsRate.times(dt)).sub(costInsight).max(0)
        projRituals++
        projStepsInto++
      }
      capProjectionSeconds += projSeconds
    }
    timeToCapProjectionH.push((capProjectionSeconds / 3600).toFixed(2))

    rows.push({
      severable: piece.label,
      corpseCut: corpses[severIndex]!.name,
      offeringCorpse: corpses[offeringCorpseIndex]!.name,
      mQi: `${piece.mQi.toNumber().toFixed(3)}×`,
      mInsight: `${piece.mInsight.toNumber().toFixed(3)}×`,
      breakevenStep: ACT2_BREAKEVEN_STEP_DISPLAY,
      weaknessWindowH: ((simSeconds - weaknessStart) / 3600).toFixed(2),
      offerings: ACT2_RAW_BREAKEVEN_STEPS,
      qiSacrificed: severQiSacrificed.toExponential(2),
      insightSacrificed: severInsightSacrificed.toExponential(2),
      inWindowNet: inWindowNet.toFixed(3),
      lifetimeNet: lifetimeNet.toFixed(3),
      liveAtChoice: liveNow,
    })
  }

  return {
    actISeconds,
    actIISeconds: simSeconds,
    tribToFirstSeverSeconds,
    extAcquireSeconds,
    manifestAcquireSeconds,
    manifestNodesBought: manifestBoughtKeys,
    manifestInsightSpent: manifestInsightCost,
    rows,
    totalOfferings,
    totalQiSacrificed,
    totalInsightSacrificed,
    masteryTrajectory,
    baseQi,
    baseInsight,
    qiBankStart,
    insightBankStart,
    aspectKey: aspectKey || 'none',
    extMultQi,
    manifestMultQi,
    manifestMultInsight,
    minLiveSeverables: Number.isFinite(minLiveSeverables) ? minLiveSeverables : 0,
    liveAtFirstChoice,
    timeToCapProjectionH,
  }
}

/**
 * Print the ACT II SPINE section (pure insertion; observation-only; no
 * assertion). §6 preview lines emit PREVIEW-OK / PREVIEW-BREACH — NEVER the
 * token CI greps for; these become assertions only after Gate-D sign-off.
 */
function printActIISpine(result: Act2Result, pinnedCompetentSeconds: number): void {
  console.log('\n=== ACT II SPINE (observation-only; no assertion; bands await sign-off) ===')
  console.log(
    '  A COPY of Competent extended through Spirit Severing (the pinned Competent run is untouched).',
  )
  console.log(
    '  Act II mechanics are MODELED analytically from data (SETPIECE_DATA.severance ramp, OFFERING_DATA',
  )
  console.log(
    '  baskets, ACCUMULATOR_DATA.severanceRitual mastery, realm-x substages null-stripped per D33) — numbers ⟨tune⟩',
  )
  console.log('  pending Gate-D (D28). No severing/dao store is mutated; end-state rates are read live.')

  const actIH = result.actISeconds / 3600
  const actIIH = result.actIISeconds / 3600
  const pinH = pinnedCompetentSeconds / 3600
  const actIMatch = Math.round(result.actISeconds) === Math.round(pinnedCompetentSeconds)
  console.log(
    `\n  Act I duration (this run's Competent Act I): ${result.actISeconds.toFixed(0)}s (${actIH.toFixed(2)}h) — ` +
      `${actIMatch ? 'MATCHES' : 'DIVERGES from'} the pinned Competent (${pinnedCompetentSeconds}s / ${pinH.toFixed(2)}h).`,
  )
  console.log(
    `  Act II duration (tribulation → 3rd breakeven): ${result.actIISeconds.toFixed(0)}s (${actIIH.toFixed(2)}h).`,
  )
  console.log(
    `    ├─ tribulation set-piece: ${ACT2_TRIBULATION_SECONDS}s (fixed; §3 scar-on-entry out of chunk-A scope).`,
  )
  console.log(
    `    ├─ ext-meridian track acquire (qi): ${(result.extAcquireSeconds / 3600).toFixed(3)}h ` +
      `(m=${result.extMultQi.toNumber().toFixed(2)}× qi = 1.25^8).`,
  )
  console.log(
    `    ├─ manifestation acquire (insight): ${(result.manifestAcquireSeconds / 3600).toFixed(2)}h ` +
      `for ${result.manifestNodesBought.length} nodes [${result.manifestNodesBought.join(', ')}], ` +
      `${result.manifestInsightSpent.toExponential(2)} insight.`,
  )
  console.log(
    `    └─ tribulation → first sever: ${(result.tribToFirstSeverSeconds / 3600).toFixed(2)}h ` +
      '(acquisition is entirely pre-first-cut so all three severables are live at corpse 1).',
  )
  console.log(
    `  End-state rates (Competent Act I): qi ${result.baseQi.toExponential(2)}/s, ` +
      `insight ${result.baseInsight.toNumber().toFixed(3)}/s | aspect ${result.aspectKey} ` +
      `| manifestation m: ${result.manifestMultQi.toNumber().toFixed(3)}× qi / ${result.manifestMultInsight.toNumber().toFixed(3)}× insight.`,
  )
  console.log(
    `  Act I banks carried into Act II: ${result.qiBankStart.toExponential(2)} qi, ` +
      `${result.insightBankStart.toNumber().toFixed(0)} insight (why ext + manifestation acquire near-instantly — ` +
      'the insight trickle banked ~a run\'s worth; the OFFERINGS drain it and then bind on the trickle).',
  )

  console.log('\n  -- Per-severance (sever order aspect → manifestation → ext; corpses in data order) --')
  console.table(result.rows)
  console.log(
    `  breakevenStep ${ACT2_BREAKEVEN_STEP_DISPLAY} (raw ${ACT2_RAW_BREAKEVEN_STEPS} offerings) is the ` +
      `data-derived lived-with gate (c=${ACT2_START_FRACTION}, k=${ACT2_CAP_RATIO}, growth=${ACT2_RAMP_GROWTH.toFixed(4)}).`,
  )
  console.log(
    '  weaknessWindowH = wall-time from the cut to breakeven (the 6 offerings); inWindowNet/lifetimeNet are ' +
      'm-INDEPENDENT ramp means (steps-to-breakeven vs the full 12-step ramp) — the D25 grid, re-derived live.',
  )
  console.log(`  time-to-cap projections (per severance, to step ${ACT2_RAMP_STEPS} at end-of-window rate): ` +
    `[${result.timeToCapProjectionH.join('h, ')}h].`)

  console.log('\n  -- Offering economics --')
  console.log(
    `  Total offerings: ${result.totalOfferings} (${ACT2_RAW_BREAKEVEN_STEPS}/severance × 3). ` +
      `Total sacrificed: ${result.totalQiSacrificed.toExponential(3)} qi + ` +
      `${result.totalInsightSacrificed.toExponential(3)} insight.`,
  )
  const traj = result.masteryTrajectory
  console.log(
    `  Mastery-discount trajectory max(0.9^rituals, 0.25) across the ${traj.length} offerings: ` +
      `${traj[0]!.toFixed(3)} → ${traj[Math.floor(traj.length / 2)]!.toFixed(3)} → ${traj[traj.length - 1]!.toFixed(3)} ` +
      '(deepens then floors at 0.25 — the optimizer bound).',
  )

  // --- ⟨tune⟩ observations (mispricings the Act II model surfaces) ------------
  console.log('\n  -- ⟨tune⟩ observations (Act II numbers that look mispriced) --')
  console.log(
    '  ⟨tune⟩ INSIGHT IS STILL THE ACT II BOTTLENECK (post-D30): the offering INSIGHT bases (Future basket ' +
      `24,000, growing ×1.5/step) and the ring-3 manifestation node costs (6k–50k) both draw the SAME lattice ` +
      `insight trickle (~${result.baseInsight.toNumber().toFixed(2)}/s). Act II runs ${(result.actIISeconds / 3600).toFixed(0)}h ` +
      '(pre-D30: 67h) with insight the binding axis for the large majority of the wait; qi is oversupplied ' +
      'except on the qi-heavy Past rite (2e10 base), the one basket D30 now lets bind on qi.',
  )
  console.log(
    '  ⟨tune⟩ CORPSE-BASKET BILLING — RESOLVED BY D30: offerings now bill at the corpse JUST CUT (was ' +
      `nextCorpse ?? last), so the spine's 18 offerings redistribute to Past/Present/Future at 6 each (was ` +
      `Present×6 + Future×12). The qi-heavy Past basket is now reached; total insight sacrificed drops to ` +
      `${result.totalInsightSacrificed.toExponential(3)} (pre-D30: 3.964e+5) and Act II to ` +
      `${(result.actIISeconds / 3600).toFixed(2)}h (pre-D30: 67.06h). The billing artifact is separated ` +
      '(rule 0.1); the residual insight pressure above is the real pricing question, now measured clean.',
  )
  console.log(
    '  ⟨tune⟩ THE PRESENT PILL DISCOUNT IS DEAD FOR THIS BUILD: OFFERING_DATA.pillDiscount (0.8) only fires ' +
      'with an active pill; the Competent spine (engagePills:false) never holds one, so the Present rite ' +
      'gives it no discount. The corpse-colored lean rewards only the pill build — a counter-monopoly gap ' +
      'for non-alchemists.',
  )
  console.log(
    `  ⟨tune⟩ MANIFESTATION UNLOCK COSTS MORE INSIGHT THAN THE CUT RETURNS: buying ${result.manifestNodesBought.length} ` +
      `manifestation nodes costs ${result.manifestInsightSpent.toExponential(2)} insight — larger than the entire ` +
      `Act I insight bank (${result.insightBankStart.toNumber().toFixed(0)}) — to unlock a manifestation severance whose ` +
      `m is only ${result.manifestMultQi.toNumber().toFixed(2)}× qi / ${result.manifestMultInsight.toNumber().toFixed(2)}× insight. ` +
      'The severable that makes the third cut POSSIBLE for a non-meridian build (§2 "load-bearing") is priced as the ' +
      'most expensive thing in Act II relative to what it returns.',
  )

  // --- §6 PREVIEW lines (NOT assertions; PREVIEW-OK / PREVIEW-BREACH only) ----
  console.log('\n  -- §6 mechanical-assertion PREVIEW (NOT asserted — Gate-D gates the assertable form) --')
  // 1) lifetime net >= 1 on every sampled severance.
  const lifetimeNets = result.rows.map((r) => Number(r.lifetimeNet))
  const minLifetimeNet = Math.min(...lifetimeNets)
  console.log(
    `  [1] lifetime net >= 1: min lifetimeNet ${minLifetimeNet.toFixed(3)} across ${result.rows.length} severances → ` +
      `${minLifetimeNet >= 1 ? 'PREVIEW-OK' : 'PREVIEW-BREACH'} ` +
      '(severing is never a strict loss over a life).',
  )
  // 2) breakeven within the ramp horizon (<= rampSteps) on every severance.
  const breakevenOk = ACT2_BREAKEVEN_STEP_DISPLAY <= ACT2_RAMP_STEPS
  console.log(
    `  [2] breakeven within ramp horizon: step ${ACT2_BREAKEVEN_STEP_DISPLAY} <= ${ACT2_RAMP_STEPS} → ` +
      `${breakevenOk ? 'PREVIEW-OK' : 'PREVIEW-BREACH'} (the weakness window is bounded).`,
  )
  // 3) >= 3 live severables at the (first) corpse choice — the shipping assertion.
  const threeLiveOk = result.liveAtFirstChoice >= 3
  console.log(
    `  [3] >= 3 live severables: ${result.liveAtFirstChoice} live at the first corpse choice → ` +
      `${threeLiveOk ? 'PREVIEW-OK' : 'PREVIEW-BREACH'} ` +
      '(three sequential severances require the build to offer >= 3; the count then decrements 3→2→1 as cuts land).',
  )
  console.log(
    '  (ACT II SPINE ends — observation/model input for Gate-D; nothing here is asserted, no error token is emitted.)',
  )
}

// =============================================================================
// === ACT II ROSTER MODEL (slice-9 §6; D25/D27/D28) — observation-only ========
// =============================================================================
//
// The GENERALIZED Act II model: chunk A's runActIISpine, parameterized by an
// Act I END-STATE (any profile runner) + a SEVERING POLICY (severable order,
// offering cadence, pill-holding). It REUSES chunk A's leaf machinery unchanged
// — act2RatioAtStep / act2AxisValue / act2PieceAxisFactor / act2RealmXQiMult,
// the Act2Piece shape, and every ACT2_* constant — so nothing is duplicated;
// only the actor-specific ASSEMBLY (which pieces the end-state actually carries,
// the sever order, check-in quantization of offering waits, the held-pill
// discount) is new. Passing the Competent policy (analytic cadence, sever order
// aspect→manifestation→ext, no pill, greedy ext-acquire) reproduces chunk A's
// runActIISpine output — the roster is that same model at three OTHER
// end-states, so runActIISpine stays byte-untouched (pure insertion).
//
// No severing/dao store is mutated for the Act II mechanics (offering/severance
// math is data-mirrored); measureSeveringRateShares reads + restores; the only
// store reads are end-state rates + owned tiers (the measureSeveringRateShares
// convention).

interface Act2ActorPolicy {
  readonly name: string
  readonly actIRunner: (state: SimState) => void
  /** Severable keys in cut order; unavailable ones are skipped (and counted as a gap). */
  readonly severOrderKeys: readonly string[]
  /** Holds a pill through Act II → OFFERING_DATA.pillDiscount multiplies every offering. */
  readonly holdsPill: boolean
  /** Offerings land only on the check-in grid (Realistic); null = analytic (time-to-afford). */
  readonly cadenceCheckinSeconds: number | null
}

interface Act2ActorRow {
  severable: string
  corpseCut: string
  offeringCorpse: string
  mQi: string
  mInsight: string
  breakevenStep: number
  weaknessWindowH: string
  qiDipPct: string
  offerings: number
  qiSacrificed: string
  insightSacrificed: string
  lifetimeNet: string
  liveAtChoice: number
}

interface Act2ActorResult {
  name: string
  cadence: string
  severOrderLabels: string[]
  actISeconds: number
  actIISeconds: number
  rows: Act2ActorRow[]
  totalOfferings: number
  totalQiSacrificed: Decimal
  totalInsightSacrificed: Decimal
  masteryTrajectory: number[]
  baseQi: Decimal
  baseInsight: Decimal
  qiBankStart: Decimal
  insightBankStart: Decimal
  aspectKey: string
  extOwned: number
  extMultQi: Decimal
  manifestNodesBought: string[]
  manifestInsightSpent: Decimal
  manifestMultQi: Decimal
  manifestMultInsight: Decimal
  manifestAvailable: boolean
  professionAvailable: boolean
  professionShareQi: number
  activePillKey: string | null
  holdsPill: boolean
  liveAtFirstChoice: number
  minLifetimeNet: number
  lifetimeNetConst: number
  breakevenStepDisplay: number
  bindTimeQiSeconds: number
  bindTimeInsightSeconds: number
  longestCorpse: string
  longestWindowH: number
  missingSeverables: string[]
}

/**
 * The generalized Act II model. Boots the policy's Act I quiet (its end state is
 * the launch pad), constructs only the severables that end-state carries, then
 * runs the analytic ramp — quantizing offering waits to the check-in grid for a
 * cadence actor and applying the held-pill discount when the policy holds one.
 */
function runActIIActor(policy: Act2ActorPolicy): Act2ActorResult {
  const actState = runProfileQuiet(policy.actIRunner)
  const actISeconds = actState.simSeconds
  const pipelines = usePipelinesStore()
  const body = useBodyStore()
  const dao = useDaoStore()
  const game = useGameStore()
  const alchemy = useAlchemyStore()

  // Profession is a duty-cycle/episodic composite — the k-probe brackets its
  // LIFETIME value by felt hours; its only CLEAN handle is the end-state qi
  // share (whether a pill is burning at the final state). measureSeveringRateShares
  // reads it and restores the end-state exactly.
  const shares = measureSeveringRateShares()
  const baseQi = pipelines.qiPerSecond
  const baseInsight = pipelines.insightPerSecond

  // --- Piece: soul aspect (bound in Act I, in the base rate) -----------------
  const aspectKey = body.soulAspect
  const aspectData = findRealm('n').soulAspect!.aspects.find((a) => a.key === aspectKey)
  const aspectPiece: Act2Piece = {
    key: 'soulAspect',
    label: 'soul aspect',
    mQi: new Decimal(aspectData?.effect.qiMult ?? 1),
    mInsight: new Decimal(aspectData?.effect.insightMult ?? 1),
    inBaseRate: true,
    acquired: true,
    severed: false,
    ratio: 0,
  }

  // --- Piece: extraordinary-meridian track (owned in Act I → in the base rate;
  // the roster never buys it in Act II, so it is absent for builds that skipped it) ---
  const extBuyable = findBodyBuyable('extraordinaryMeridian')
  const extOwned = body.extraordinaryMeridians
  const extMultQi = Decimal.pow(extBuyable.effectBase, extOwned)
  const extPiece: Act2Piece | null =
    extOwned > 0
      ? {
          key: 'extraordinaryMeridians',
          label: 'ext-meridian track',
          mQi: extMultQi,
          mInsight: new Decimal(1),
          inBaseRate: true,
          acquired: true,
          severed: false,
          ratio: 0,
        }
      : null

  // --- Piece: lattice Manifestation (ACQUIRED in Act II; identical greedy policy
  // to chunk A — Manifestation tier on every owned-Seed node, cheapest-first,
  // conflict-guarded). Empty for builds that own no Seeds (Meridian) → not a live severable. ---
  const MANIFESTATION_TIER_INDEX = 2
  const ownedSeedNodes = LATTICE_DATA.nodes.filter((n) => dao.nodeTierOwned(n.key) >= 2)
  const manifestCandidates = [...ownedSeedNodes].sort(
    (a, b) => a.costs[MANIFESTATION_TIER_INDEX]! - b.costs[MANIFESTATION_TIER_INDEX]!,
  )
  const conflictPairs = LATTICE_DATA.conflicts
  const manifestBoughtKeys: string[] = []
  let manifestMultQi = new Decimal(1)
  let manifestMultInsight = new Decimal(1)
  let manifestInsightCost = new Decimal(0)
  for (const node of manifestCandidates) {
    const conflicted = conflictPairs.some(([x, y]) => {
      const partner = x === node.key ? y : y === node.key ? x : null
      return partner !== null && manifestBoughtKeys.includes(partner)
    })
    if (conflicted) continue
    const effect = node.effects[MANIFESTATION_TIER_INDEX]
    if (!effect) continue
    if ('qiMult' in effect) manifestMultQi = manifestMultQi.times(effect.qiMult)
    else manifestMultInsight = manifestMultInsight.times(effect.insightMult)
    manifestInsightCost = manifestInsightCost.add(node.costs[MANIFESTATION_TIER_INDEX]!)
    manifestBoughtKeys.push(node.key)
  }
  const manifestAvailable = manifestBoughtKeys.length > 0
  const manifestPiece: Act2Piece = {
    key: 'manifestation',
    label: 'manifestation',
    mQi: manifestMultQi,
    mInsight: manifestMultInsight,
    inBaseRate: false,
    acquired: false,
    severed: false,
    ratio: 0,
  }

  // --- Piece: profession (available iff the build chose one; m is the end-state
  // qi share — a COMPOSITE, folded into baseQi via the active pill; documented) ---
  const professionAvailable = alchemy.professionChosen
  const professionShareQi = Number.isFinite(shares.profession) ? shares.profession : 1
  const professionPiece: Act2Piece | null = professionAvailable
    ? {
        key: 'profession',
        label: 'profession',
        mQi: new Decimal(professionShareQi),
        mInsight: new Decimal(1),
        inBaseRate: true,
        acquired: true,
        severed: false,
        ratio: 0,
      }
    : null

  // Resolve the policy's sever order against what this end-state actually carries.
  const pieceForKey = (key: string): Act2Piece | null => {
    if (key === 'soulAspect') return aspectPiece
    if (key === 'extraordinaryMeridians') return extPiece
    if (key === 'manifestation') return manifestAvailable ? manifestPiece : null
    if (key === 'profession') return professionPiece
    return null
  }
  const severOrder: Act2Piece[] = []
  const missingSeverables: string[] = []
  for (const key of policy.severOrderKeys) {
    const piece = pieceForKey(key)
    if (piece) severOrder.push(piece)
    else missingSeverables.push(key)
  }

  // Every piece that participates in the rate (owned/acquired severables).
  const allPieces: Act2Piece[] = [aspectPiece]
  if (extPiece) allPieces.push(extPiece)
  if (manifestAvailable) allPieces.push(manifestPiece)
  if (professionPiece) allPieces.push(professionPiece)

  const corpses = SEVERING_DATA.corpses
  const severCountNow = (): number => allPieces.filter((p) => p.severed).length
  const qiRate = (): Decimal => {
    let rate = baseQi.times(act2RealmXQiMult(severCountNow()))
    for (const piece of allPieces) rate = rate.times(act2PieceAxisFactor(piece, 'qi'))
    return rate
  }
  const insightRate = (): Decimal => {
    let rate = baseInsight
    for (const piece of allPieces) rate = rate.times(act2PieceAxisFactor(piece, 'insight'))
    return rate
  }

  // --- Timeline (analytic; carry live banks into Act II) ---------------------
  let simSeconds = 0
  let qiBank = game.points
  let insightBank = dao.insight
  const qiBankStart = game.points
  const insightBankStart = dao.insight
  let rituals = 0
  let bindTimeQiSeconds = 0
  let bindTimeInsightSeconds = 0
  const checkin = policy.cadenceCheckinSeconds
  const pillFactor = policy.holdsPill ? OFFERING_DATA.pillDiscount : 1
  const advance = (dt: number): void => {
    if (dt <= 0) return
    simSeconds += dt
    qiBank = qiBank.add(qiRate().times(dt))
    insightBank = insightBank.add(insightRate().times(dt))
  }
  // Time to afford + advance, quantizing the wait to the check-in grid for a
  // cadence actor (offerings land only when the player checks in), and
  // attributing the wall-time to the binding axis (qi vs insight).
  const advanceAfford = (needQi: Decimal, needInsight: Decimal): void => {
    const qiGap = needQi.sub(qiBank)
    const insGap = needInsight.sub(insightBank)
    const qiDt = qiGap.lte(0) ? 0 : qiGap.div(qiRate()).toNumber()
    const insRateNow = insightRate()
    const insDt = insGap.lte(0) || insRateNow.lte(0) ? 0 : insGap.div(insRateNow).toNumber()
    let dt = Math.max(qiDt, Number.isFinite(insDt) ? insDt : 0, 0)
    if (checkin !== null && dt > 0) dt = Math.ceil(dt / checkin) * checkin
    if (dt > 0) {
      if (insDt >= qiDt) bindTimeInsightSeconds += dt
      else bindTimeQiSeconds += dt
    }
    advance(dt)
  }

  // 1) The tribulation set-piece opens Act II (fixed; banks accrue across it).
  advance(ACT2_TRIBULATION_SECONDS)

  // 2) Acquire manifestation nodes (insight) — the insight competition begins.
  if (manifestAvailable) {
    for (const node of manifestBoughtKeys) {
      const cost = new Decimal(
        LATTICE_DATA.nodes.find((n) => n.key === node)!.costs[MANIFESTATION_TIER_INDEX]!,
      )
      advanceAfford(new Decimal(0), cost)
      insightBank = insightBank.sub(cost).max(0)
    }
    manifestPiece.acquired = true
  }

  // 3) Sever the corpses sequentially; each lived-with to breakeven.
  const rows: Act2ActorRow[] = []
  let totalOfferings = 0
  let totalQiSacrificed = new Decimal(0)
  let totalInsightSacrificed = new Decimal(0)
  const masteryTrajectory: number[] = []
  const liveSeverableCount = (): number => allPieces.filter((p) => p.acquired && !p.severed).length
  const liveAtFirstChoice = liveSeverableCount()
  let fullRampSum = 0
  for (let step = 0; step < ACT2_RAMP_STEPS; step++) fullRampSum += act2RatioAtStep(step)
  const lifetimeNetConst = fullRampSum / ACT2_RAMP_STEPS
  let longestCorpse = '—'
  let longestWindowH = 0

  for (let severIndex = 0; severIndex < severOrder.length; severIndex++) {
    const piece = severOrder[severIndex]!
    const liveNow = liveSeverableCount()

    // The cut: qi rate just before vs at the trough (ratio = startFraction).
    // D33: the realm-x substage bump is gone (null-stripped to identity), so the
    // trough is a REAL dip — the severed piece's own multiplier drops to
    // m·startFraction with nothing offsetting it (pre-D33 the 2.0/2.4/2.8 bumps
    // made qi RISE at the cut; the dip read negative — the D23 contradiction).
    const qiBeforeCut = qiRate()
    piece.severed = true
    piece.ratio = act2RatioAtStep(0)
    const qiAtTrough = qiRate()
    const qiDip = qiBeforeCut.lte(0)
      ? 0
      : qiBeforeCut.sub(qiAtTrough).div(qiBeforeCut).toNumber()
    const ritualsAtSever = rituals

    const weaknessStart = simSeconds
    let stepsSince = 0
    let severQiSacrificed = new Decimal(0)
    let severInsightSacrificed = new Decimal(0)
    // D30: offering corpse = the corpse JUST CUT (the store bills severances[last].corpse).
    const corpseCutIndex = Math.min(severIndex, corpses.length - 1)
    const offeringCorpseIndex = corpseCutIndex
    const basket = findOfferingBasket(corpses[offeringCorpseIndex]!.key)

    while (stepsSince < ACT2_RAW_BREAKEVEN_STEPS) {
      const stepsInto = rituals - ritualsAtSever
      const mastery = Decimal.max(
        Decimal.pow(ACT2_OFFERING_ACC.ratio!, rituals),
        ACT2_OFFERING_ACC.floor!,
      )
      const scale = Decimal.pow(OFFERING_DATA.growth, stepsInto).times(mastery).times(pillFactor)
      const costQi = new Decimal(basket.qiBase).times(scale)
      const costInsight = new Decimal(basket.insightBase).times(scale)
      piece.ratio = act2RatioAtStep(stepsSince)
      advanceAfford(costQi, costInsight)
      qiBank = qiBank.sub(costQi).max(0)
      insightBank = insightBank.sub(costInsight).max(0)
      severQiSacrificed = severQiSacrificed.add(costQi)
      severInsightSacrificed = severInsightSacrificed.add(costInsight)
      masteryTrajectory.push(mastery.toNumber())
      rituals++
      stepsSince++
      totalOfferings++
    }
    piece.ratio = act2RatioAtStep(stepsSince)

    totalQiSacrificed = totalQiSacrificed.add(severQiSacrificed)
    totalInsightSacrificed = totalInsightSacrificed.add(severInsightSacrificed)
    const windowH = (simSeconds - weaknessStart) / 3600
    if (windowH > longestWindowH) {
      longestWindowH = windowH
      longestCorpse = corpses[corpseCutIndex]!.name
    }

    rows.push({
      severable: piece.label,
      corpseCut: corpses[corpseCutIndex]!.name,
      offeringCorpse: corpses[offeringCorpseIndex]!.name,
      mQi: `${piece.mQi.toNumber().toFixed(3)}×`,
      mInsight: `${piece.mInsight.toNumber().toFixed(3)}×`,
      breakevenStep: ACT2_BREAKEVEN_STEP_DISPLAY,
      weaknessWindowH: windowH.toFixed(2),
      qiDipPct: `${(qiDip * 100).toFixed(1)}%`,
      offerings: ACT2_RAW_BREAKEVEN_STEPS,
      qiSacrificed: severQiSacrificed.toExponential(2),
      insightSacrificed: severInsightSacrificed.toExponential(2),
      lifetimeNet: lifetimeNetConst.toFixed(3),
      liveAtChoice: liveNow,
    })
  }

  const minLifetimeNet = rows.length === 0 ? lifetimeNetConst : Math.min(...rows.map((r) => Number(r.lifetimeNet)))

  return {
    name: policy.name,
    cadence: checkin === null ? 'analytic' : `check-in ${checkin}s`,
    severOrderLabels: severOrder.map((p) => p.label),
    actISeconds,
    actIISeconds: simSeconds,
    rows,
    totalOfferings,
    totalQiSacrificed,
    totalInsightSacrificed,
    masteryTrajectory,
    baseQi,
    baseInsight,
    qiBankStart,
    insightBankStart,
    aspectKey: aspectKey || 'none',
    extOwned,
    extMultQi,
    manifestNodesBought: manifestBoughtKeys,
    manifestInsightSpent: manifestInsightCost,
    manifestMultQi,
    manifestMultInsight,
    manifestAvailable,
    professionAvailable,
    professionShareQi,
    activePillKey: shares.activePillKey,
    holdsPill: policy.holdsPill,
    liveAtFirstChoice,
    minLifetimeNet,
    lifetimeNetConst,
    breakevenStepDisplay: ACT2_BREAKEVEN_STEP_DISPLAY,
    bindTimeQiSeconds,
    bindTimeInsightSeconds,
    longestCorpse,
    longestWindowH,
    missingSeverables,
  }
}

/** The Act II roster: three actors, each a fresh quiet Act I + a severing policy. */
function runActIIRoster(): Act2ActorResult[] {
  const policies: Act2ActorPolicy[] = [
    {
      // Realistic's Act I (median jitter point) → Act II at its check-in cadence.
      // Sever order aspect → manifestation → profession (profession LAST = its
      // biggest piece). Holds pills (alchemist) → the Present pill discount is LIVE.
      name: 'Realistic-ActII',
      actIRunner: runRealistic,
      severOrderKeys: ['soulAspect', 'manifestation', 'profession'],
      holdsPill: true,
      cadenceCheckinSeconds: REALISTIC_CHECKIN_LATE_SECONDS,
    },
    {
      // The meridian build: aspect → ext → manifestation. The ext track is a clean
      // 5.96× (owned in Act I) — its cut is the deepest weakness window in the roster.
      name: 'MeridianProbe-ActII',
      actIRunner: spineRunner(MERIDIAN_PROBE_CONFIG),
      severOrderKeys: ['soulAspect', 'extraordinaryMeridians', 'manifestation'],
      holdsPill: false,
      cadenceCheckinSeconds: null,
    },
    {
      // The lattice build: aspect → manifestation → profession-or-ext (whichever its
      // Act I actually acquired — measured; a pure lattice build has neither).
      name: 'LatticeFocused-ActII',
      actIRunner: spineRunner(LATTICE_CONFIG),
      severOrderKeys: ['soulAspect', 'manifestation', 'profession', 'extraordinaryMeridians'],
      holdsPill: false,
      cadenceCheckinSeconds: null,
    },
  ]
  return policies.map(runActIIActor)
}

/** Print the ACT II ROSTER section + the consolidated tune-pass inputs (pure insertion; observation-only). */
function printActIIRoster(actors: Act2ActorResult[], spine: Act2Result): void {
  console.log('\n=== ACT II ROSTER (observation-only; bands await sign-off) ===')
  console.log(
    '  The generalized Act II model (chunk A machinery, reused) run from THREE Act I end-states + severing',
  )
  console.log(
    '  policies. All numbers ⟨tune⟩ pending Gate-D (D28); no store is mutated for Act II; end-state rates read live.',
  )

  for (const actor of actors) {
    console.log(`\n  -- ${actor.name} (${actor.cadence} cadence; sever order: ${actor.severOrderLabels.join(' → ') || 'none live'}) --`)
    console.log(
      `  Act I: ${actor.actISeconds.toFixed(0)}s (${(actor.actISeconds / 3600).toFixed(2)}h) | ` +
        `Act II (tribulation → last breakeven): ${actor.actIISeconds.toFixed(0)}s (${(actor.actIISeconds / 3600).toFixed(2)}h).`,
    )
    console.log(
      `  End-state rates: qi ${actor.baseQi.toExponential(2)}/s, insight ${actor.baseInsight.toNumber().toFixed(3)}/s | ` +
        `aspect ${actor.aspectKey} | ext owned ${actor.extOwned} (m=${actor.extMultQi.toNumber().toFixed(2)}× qi) | ` +
        `manifestation ${actor.manifestAvailable ? `${actor.manifestNodesBought.length} nodes (m ${actor.manifestMultQi.toNumber().toFixed(3)}× qi / ${actor.manifestMultInsight.toNumber().toFixed(3)}× insight, ${actor.manifestInsightSpent.toExponential(2)} insight)` : 'NONE (owns no Seed nodes)'}.`,
    )
    console.log(
      `  Profession: ${actor.professionAvailable ? `chosen (end-state qi share ${actor.professionShareQi.toFixed(3)}×; composite — bracket lifetime value by felt hours, k-probe 30.5h Realistic)` : 'none'} | ` +
        `held pill: ${actor.holdsPill ? `YES → offering discount ×${OFFERING_DATA.pillDiscount} LIVE` : 'no'} (end-state active pill: ${actor.activePillKey ?? 'none'}).`,
    )
    console.log(
      `  Act I banks carried in: ${actor.qiBankStart.toExponential(2)} qi, ${actor.insightBankStart.toNumber().toFixed(0)} insight.`,
    )
    if (actor.missingSeverables.length > 0) {
      console.log(`  MISSING severables (policy named, end-state lacks): [${actor.missingSeverables.join(', ')}] — see the ≥3 preview below.`)
    }
    if (actor.rows.length > 0) console.table(actor.rows)
    else console.log('  (no live severances to model)')
    console.log(
      `  Offerings: ${actor.totalOfferings} (${ACT2_RAW_BREAKEVEN_STEPS}/severance × ${actor.rows.length}). ` +
        `Sacrificed: ${actor.totalQiSacrificed.toExponential(3)} qi + ${actor.totalInsightSacrificed.toExponential(3)} insight.`,
    )
    if (actor.masteryTrajectory.length > 0) {
      const traj = actor.masteryTrajectory
      console.log(
        `  Mastery-discount trajectory max(0.9^rituals, 0.25): ${traj[0]!.toFixed(3)} → ` +
          `${traj[Math.floor(traj.length / 2)]!.toFixed(3)} → ${traj[traj.length - 1]!.toFixed(3)} (deepens, floors at 0.25).`,
      )
    }
    // Weakness-window FELT depth + lifetime net.
    console.log(
      `  Weakness windows (FELT): ${actor.rows.map((r) => `${r.severable} ${r.weaknessWindowH}h below breakeven, qi dip ${r.qiDipPct} at trough`).join('; ') || 'none'}.`,
    )
    console.log(
      `  Lifetime net (m-independent ramp mean): ${actor.lifetimeNetConst.toFixed(3)} on every severance; min ${actor.minLifetimeNet.toFixed(3)}.`,
    )
    // §6 PREVIEW lines (PREVIEW-OK / PREVIEW-BREACH — never asserted, Gate-D gates the assertable form).
    const net1 = actor.minLifetimeNet >= 1
    console.log(
      `  §6[1] lifetime net ≥ 1: min ${actor.minLifetimeNet.toFixed(3)} → ${net1 ? 'PREVIEW-OK' : 'PREVIEW-BREACH'} (severing is never a strict loss over a life).`,
    )
    const be2 = actor.breakevenStepDisplay <= ACT2_RAMP_STEPS
    console.log(
      `  §6[2] breakeven within horizon: step ${actor.breakevenStepDisplay} ≤ ${ACT2_RAMP_STEPS} → ${be2 ? 'PREVIEW-OK' : 'PREVIEW-BREACH'} (weakness window bounded).`,
    )
    const live3 = actor.liveAtFirstChoice >= 3
    console.log(
      `  §6[3] ≥ 3 live severables at first corpse choice: ${actor.liveAtFirstChoice} → ${live3 ? 'PREVIEW-OK' : 'PREVIEW-BREACH'}` +
        `${live3 ? '' : ` — FINDING: ${actor.name} carries only ${actor.liveAtFirstChoice} live severables (missing: ${actor.missingSeverables.join(', ') || 'none named'}); three sequential severances are impossible for this build as-is`}.`,
    )
  }

  // --- CROSS-ACTOR summary ----------------------------------------------------
  console.log('\n  -- CROSS-ACTOR summary --')
  const durationsH = actors.map((a) => a.actIISeconds / 3600)
  const spineH = spine.actIISeconds / 3600
  const allDurationsH = [...durationsH, spineH]
  const maxH = Math.max(...allDurationsH)
  const minH = Math.min(...allDurationsH)
  console.log(
    `  Act II duration spread (incl. chunk-A spine ${spineH.toFixed(2)}h): [${minH.toFixed(2)}h … ${maxH.toFixed(2)}h], ` +
      `cluster-ratio analog ${(maxH / minH).toFixed(3)} (Act I cluster pin is ≤1.5 — this is the Act II counterpart to watch).`,
  )
  for (const actor of actors) {
    const bindTotal = actor.bindTimeQiSeconds + actor.bindTimeInsightSeconds
    const insShare = bindTotal <= 0 ? 0 : (actor.bindTimeInsightSeconds / bindTotal) * 100
    console.log(
      `  ${actor.name}: Act II ${(actor.actIISeconds / 3600).toFixed(2)}h | longest corpse = ${actor.longestCorpse} (${actor.longestWindowH.toFixed(2)}h) | ` +
        `insight-bound ${insShare.toFixed(1)}% of waited time / qi-bound ${(100 - insShare).toFixed(1)}%.`,
    )
  }
  const breaches = actors.filter((a) => a.liveAtFirstChoice < 3)
  console.log(
    `  §6[3] roster status: ${breaches.length === 0 ? 'all actors PREVIEW-OK' : `${breaches.length} PREVIEW-BREACH → [${breaches.map((b) => `${b.name}: ${b.liveAtFirstChoice} live`).join('; ')}]`}` +
      ' — the load-bearing Manifestation (§2) is what a non-meridian, non-alchemist build leans on for the third cut.',
  )

  // --- The consolidated tune-pass inputs (chunk A's four + the roster's) ------
  const realistic = actors.find((a) => a.name === 'Realistic-ActII')
  const meridian = actors.find((a) => a.name === 'MeridianProbe-ActII')
  const lattice = actors.find((a) => a.name === 'LatticeFocused-ActII')
  const insBoundPct = (a: Act2ActorResult | undefined): string => {
    if (!a) return 'n/a'
    const t = a.bindTimeQiSeconds + a.bindTimeInsightSeconds
    return t <= 0 ? '0.0' : ((a.bindTimeInsightSeconds / t) * 100).toFixed(1)
  }
  console.log('\n=== ACT II TUNE-PASS INPUTS (for Gate-D sign-off) ===')
  console.log('  Numbered ⟨tune⟩ questions for Wes\'s ruling — chunk A\'s four (spine) + the roster\'s, evidence inline.')
  console.log(
    `  1. ⟨tune⟩ INSIGHT IS STILL THE ACT II BOTTLENECK, POST-D30 (spine + roster): the Future insight base (24,000, ×1.5/step) + ring-3 ` +
      `manifestation costs (6k–50k) both draw the lattice insight trickle. Roster insight-bound share of waited time (re-measured under D30): ` +
      `Realistic ${insBoundPct(realistic)}%, Meridian ${insBoundPct(meridian)}%, Lattice ${insBoundPct(lattice)}% (pre-D30: 98.4/99.9/100.0%). ` +
      'D30 shed the billing artifact (durations collapsed, insight totals ~halved — see #2) yet insight still binds 90–100% of the wait ' +
      '(D33 stripped the realm-x qi boost, so qi binds a little more — Meridian 95.6→90.6%): ' +
      'the bottleneck SURVIVES the fix. Rebalance offering insight bases DOWN or lattice insight rates UP?',
  )
  console.log(
    `  2. ⟨tune⟩ CORPSE-BASKET BILLING — RESOLVED BY D30 (spine + roster): offerings now bill at the corpse JUST CUT (was ` +
      `nextCorpse ?? last), redistributing the spine's 18 offerings to Past/Present/Future at 6 each (was Present×6 + Future×12). ` +
      `Re-measured: spine insight sacrificed ${spine.totalInsightSacrificed.toExponential(3)} (pre-D30: 3.964e+5), Act II ` +
      `${(spine.actIISeconds / 3600).toFixed(2)}h (pre-D30: 67.06h); roster durations collapsed ` +
      `(Meridian ${meridian ? (meridian.actIISeconds / 3600).toFixed(2) : 'n/a'}h vs pre-D30 110.37h, its ext cut no longer paying the Future rite). ` +
      'The qi-heavy Past basket is now reached; the artifact is off the table — #1 is the residual, real insight-pricing question.',
  )
  console.log(
    `  3. ⟨tune⟩ THE PRESENT PILL DISCOUNT IS A NON-ALCHEMIST GAP (spine + roster): pillDiscount (${OFFERING_DATA.pillDiscount}) fires ONLY ` +
      `with a held pill. In the roster only Realistic holds one (${realistic?.holdsPill ? 'discount LIVE' : 'no'}); ` +
      `Meridian + Lattice get ×1. Realistic total sacrificed ${realistic ? realistic.totalInsightSacrificed.toExponential(2) : 'n/a'} insight WITH the discount — ` +
      'a counter-monopoly gap: should every build get a discount path, or is the pill lean intended to be this decisive?',
  )
  console.log(
    `  4. ⟨tune⟩ MANIFESTATION UNLOCK IS THE COSTLIEST THING IN ACT II vs WHAT IT RETURNS (spine + roster): the spine pays ` +
      `${spine.manifestInsightSpent.toExponential(2)} insight for m ${spine.manifestMultQi.toNumber().toFixed(2)}× qi / ${spine.manifestMultInsight.toNumber().toFixed(2)}× insight; ` +
      `Lattice pays ${lattice ? lattice.manifestInsightSpent.toExponential(2) : 'n/a'} for ${lattice ? lattice.manifestNodesBought.length : 0} nodes. It is the load-bearing third ` +
      'severable for non-meridian builds (§2) yet priced highest — lower the Manifestation tier costs, or raise its m?',
  )
  const realisticBreaches = realistic ? realistic.liveAtFirstChoice < 3 : false
  console.log(
    `  5. ⟨tune⟩ THE EXPERIENCE ACTOR'S ≥3-SEVERABLE FLOOR (roster, LOUD): Realistic lands ${realistic?.liveAtFirstChoice ?? 0} live severables at the first ` +
      `corpse (aspect + ${realistic?.manifestAvailable ? 'manifestation + ' : ''}profession${realistic?.manifestAvailable ? '' : ', NO manifestation'}) → ${realisticBreaches ? 'PREVIEW-BREACH' : 'PREVIEW-OK'}. ` +
      `${realisticBreaches ? `Manifestation is unaffordable/unowned for it (needs owned Seeds + ${realistic ? realistic.manifestInsightSpent.toExponential(2) : ''} insight) — the load-bearing third cut is out of reach for the experience target. Make Manifestation reachable for a hesitant lattice actor, or add a non-lattice third severable?` : 'the load-bearing Manifestation carries it — confirm the hesitant lattice actor reliably owns enough Seeds at Act II entry.'}`,
  )
  console.log(
    `  6. ⟨tune⟩ THE SEVERANCE TROUGH IS NOW A REAL DIP — RESOLVED BY D33 (Q12 closed, roster): the realm-x substage qiMults (pre-D33: 2.0/2.4/2.8) are stripped to null, so the c=0.5 transcendent ramp is the ONLY compensation and every cut DROPS qi at the trough. ` +
      `Re-measured, each cut's own multiplier falls to m·0.5 with nothing offsetting it → a uniform qi dip of ${meridian ? (meridian.rows.find((r) => r.severable === 'ext-meridian track')?.qiDipPct ?? 'n/a') : 'n/a'} at the trough (Meridian's clean ${meridian ? meridian.extMultQi.toNumber().toFixed(2) : '5.96'}× ext cut, over ${meridian ? (meridian.rows.find((r) => r.severable === 'ext-meridian track')?.weaknessWindowH ?? 'n/a') : 'n/a'}h to breakeven). ` +
      'PRE-D33 the same cuts read qi dip -20.0%/-40.0% (qi ROSE — the knife cut and nothing hurt, the D23 contradiction that opened Q12). The dip is bounded: the ramp recovers to breakeven at step 7. ' +
      'Is a uniform ~50% trough at c=0.5 the "felt but bounded" window §2 wants, or should c be raised to soften it?',
  )
  console.log(
    `  7. ⟨tune⟩ CHECK-IN QUANTIZATION INFLATES THE EXPERIENCE ACTOR'S ACT II (roster): Realistic offerings land only on the ` +
      `${REALISTIC_CHECKIN_LATE_SECONDS}s grid, so each of its ${realistic?.totalOfferings ?? 0} offerings rounds its wait UP to a check-in — Act II ` +
      `${realistic ? (realistic.actIISeconds / 3600).toFixed(2) : 'n/a'}h vs the analytic builds. Is Act II offering pacing meant to be cadence-shaped like Act I ` +
      '(the band would then be a cadence function again), or should offerings be bankable/batchable to decouple from check-in?',
  )
  console.log(
    `  8. ⟨tune⟩ ACT II DURATION SPREAD / CLUSTER ANALOG (roster): [${minH.toFixed(2)}h … ${maxH.toFixed(2)}h], ratio ${(maxH / minH).toFixed(3)}. ` +
      'Act I pins the focused-build cluster at ≤1.5; if Act II is to inherit that discipline a pin belongs here too — ' +
      'is this spread acceptable, and should the Act II cluster-ratio become a Gate-D band?',
  )
  console.log(
    '  (ACT II TUNE-PASS INPUTS end — every line answerable from the evidence above; nothing asserted, no error token emitted.)',
  )
}

function runProfile(name: string, fn: (state: SimState) => void): SimState {
  bootSim()
  const state: SimState = {
    simSeconds: 0,
    maxIterations: 100000,
    marks: {},
    cReclimbSegments: [],
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
  // SEVERING PROBE (Q9): silent end-state rate-share reads, taken while each
  // base run's Pinia is still live (the next runProfile boots a fresh one).
  // Pure store reads with exact restores — prints nothing here; the numbers
  // surface in the SEVERING PROBE section far below.
  const latticeSeveringShares = measureSeveringRateShares()
  const sectRun = runProfile('SectFocused', spineRunner(SECT_CONFIG))
  const pillRun = runProfile('PillFocused', spineRunner(PILL_CONFIG))
  const pillSeveringShares = measureSeveringRateShares()

  // ---- MeridianProbe: spine + ext-meridian track, no horizontals (#14) ------
  const meridianRun = runProfile('MeridianProbe', spineRunner(MERIDIAN_PROBE_CONFIG))
  const meridianSeveringShares = measureSeveringRateShares()

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
  const realisticSeveringShares = measureSeveringRateShares() // SEVERING PROBE (Q9) — silent read

  // ---- HISTORICAL (retired 2026-07-02, slice-9 keep-rule activation) ---------
  // The c-keep († counterfactualCKeep), milestones-only (‡
  // counterfactualPartialCKeep), core-remembers clock-compression (r
  // counterfactualCoreRemembers) and r-refinement (r/f) runs were
  // PRE-IMPLEMENTATION probes: they modelled a keep mechanic that did not yet
  // exist. Now that "the core remembers" is a REAL gain rule (soul.reclimbGainMult,
  // live in every base run via realm.resetGain), those counterfactuals would
  // DOUBLE-APPLY on top of the mechanic — so their runner invocations are
  // retired. The decisions they fed are D2/D21; the measured record lives in
  // docs/calibration.md + git history. The sim-side machinery (the config flags
  // and the dormant branches in simPrestige / chargeSimClock / trackCReclimbCurve)
  // is left in place, inert (no run sets the flags). The severing probe (⊘,
  // observation-only) legitimately re-derives on the new baseline and is KEPT.

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

  // ---- C-CHURN DECOMPOSITION — HISTORICAL (retired 2026-07-02) --------------
  // Retired with the † runs it consumed: the c-churn tax was a decision input
  // for D2 (tax-vs-ritual), now closed. The mechanic that resolved it ("the
  // core remembers") is live in every base run; there is no longer a
  // counterfactual keep to decompose against. Record: docs/calibration.md.

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

  // ---- C RE-CLIMB CURVE (the core remembers — REAL mechanic, live) ----------
  // Observation-only legibility evidence. "The core remembers" is now a real
  // gain rule (soul.reclimbGainMult), so these baseline curves ARE the shipped
  // mechanic's curve — no counterfactual compression. The pre-implementation
  // probes (†/‡/r-sweep/r-refinement) that once shared this section are retired
  // (see the HISTORICAL note above): a counterfactual clock scale must never
  // double-apply on top of the live gain rule. What Wes asked to read still
  // prints — per-ascent durations, the first/last collapse, and the Realistic
  // single-breath count — but now as measurement, not model.
  console.log('\n=== C RE-CLIMB CURVE (the core remembers — REAL mechanic; observation-only) ===')
  console.log(
    '  Segment = n/s cascade → c fully restored (best >= top sub-stage + all milestones re-latched);',
  )
  console.log(
    '  duration includes interleaved work (f restores, n climbs, idle check-ins) — see CReclimbSegment.',
  )

  // Competent: the optimizer's re-climb COUNT + collapse shape (its tail already
  // self-compresses; the gain rule accelerates it further — first/last is the read).
  console.log('\n  -- Competent (optimizer): re-climb count + collapse shape --')
  printReclimbCurve('Competent', competentRun.cReclimbSegments)

  // Realistic: the experience-target actor's per-ascent durations, first/last
  // ratio, and single-breath count (climbs completing within one late check-in).
  console.log('\n  -- Realistic (experience target): per-ascent durations + single-breath count --')
  printReclimbCurve('Realistic', realisticRun.cReclimbSegments)
  const realisticSegments = realisticRun.cReclimbSegments
  const realisticReclimbCount = realisticSegments.length
  const realisticSingleBreathCount = realisticSegments.filter(
    (segment) => segment.durationSeconds <= BREATH_SECONDS,
  ).length
  console.log(
    `\n  REALISTIC RE-CLIMB COUNT: ${realisticReclimbCount} felt re-climb segments in Act I ` +
      `(spanning ${realisticSegments.reduce((sum, segment) => sum + segment.cascadesSpanned, 0)} cascades); ` +
      `first/last ${firstOverLastText(realisticSegments)}; ` +
      `single-breath climbs (<= one ${BREATH_SECONDS}s late check-in): ${realisticSingleBreathCount}/${realisticReclimbCount}.`,
  )
  console.log(
    realisticReclimbCount < FELT_CURVE_MIN_SAMPLES
      ? `  SIGNAL (pre-named fallback): fewer than ${FELT_CURVE_MIN_SAMPLES} samples — too few re-climbs for an ` +
          'acceleration curve to be FELT in Act I; the mechanic would need Act II to extend the curve.'
      : `  Curve sample count OK (>= ${FELT_CURVE_MIN_SAMPLES}): enough re-climbs for an acceleration curve to be felt in Act I.`,
  )

  // ---- SEVERING PROBE (Q9 — decision input for D23 Spirit Severing; no assertion) ----
  // COUNTERFACTUAL / SEVERING PROBE (Q9). Part 1 measures each Act-I candidate
  // severable's LIVE contribution by EFFECT-ablation (⊘ runs: the policy still
  // acquires and uses the piece exactly as in the base run; only its effect is
  // nullified from acquisition onward). Part 2 is an analytic breakeven-timing
  // MODEL over candidate ramp parameters — clearly a model, not a measurement.
  // Observation-only throughout: never asserted on, no FAIL lines, and the
  // PINNED BANDS section below is untouched.
  console.log('\n=== SEVERING PROBE (Q9 — Spirit Severing decision input; COUNTERFACTUAL, no assertion) ===')
  console.log('  Part 1 — effect-ablation (⊘): the policy still acquires + uses the piece on the base decision')
  console.log('  rules; the piece\'s EFFECT is nullified from acquisition onward (attribution before action —')
  console.log('  decision-ablation would confound the piece\'s value with policy drift). deltaH = base − ablated:')
  console.log('  negative = the ablated run is SLOWER, i.e. the piece contributes that many felt hours.')
  console.log('  m = end-of-run rate share (qi/sec with the piece\'s effect on ÷ off, at the base run\'s final state).')
  console.log('  GAP: the lattice Manifestation tier (a D23 candidate severable) does not exist in data yet —')
  console.log('  not measured, not faked. NOTE: "meridian set bonuses" also do not exist as a distinct effect;')
  console.log('  the measurable analog is the extraordinary-meridian TRACK (a set of 8 × 1.25 each), probed here.')

  // The ⊘ ablation runs (quiet). Leaning actor per severable, verified against
  // the policies above: soul aspect → LatticeFocused (element aspects gate on
  // lattice Seeds; Sect/Pill are Formless-locked); stance → LatticeFocused
  // (useBreathingTrance; Competent shares the stance play but is the pinned
  // floor, so the focused actor carries the probe); profession → PillFocused;
  // ext-meridian track → MeridianProbe. Realistic runs every ablation as the
  // experience-target counterpart — its stance and ext-meridian ablations are
  // structural no-ops (its policy never enters a stance and never buys an
  // extraordinary meridian), included as measured zeros, not asserted ones.
  const latticeSeverAspectRun = runProfileQuiet(
    spineRunner({ ...LATTICE_CONFIG, counterfactualSeverEffect: 'soulAspect' }),
  )
  const realisticSeverAspectRun = runProfileQuiet(
    realisticRunner({ ...REALISTIC_CONFIG, counterfactualSeverEffect: 'soulAspect' }),
  )
  const latticeSeverStanceRun = runProfileQuiet(
    spineRunner({ ...LATTICE_CONFIG, counterfactualSeverEffect: 'stance' }),
  )
  const realisticSeverStanceRun = runProfileQuiet(
    realisticRunner({ ...REALISTIC_CONFIG, counterfactualSeverEffect: 'stance' }),
  )
  const pillSeverProfessionRun = runProfileQuiet(
    spineRunner({ ...PILL_CONFIG, counterfactualSeverEffect: 'profession' }),
  )
  const realisticSeverProfessionRun = runProfileQuiet(
    realisticRunner({ ...REALISTIC_CONFIG, counterfactualSeverEffect: 'profession' }),
  )
  const meridianSeverExtRun = runProfileQuiet(
    spineRunner({ ...MERIDIAN_PROBE_CONFIG, counterfactualSeverEffect: 'extraordinaryMeridians' }),
  )
  const realisticSeverExtRun = runProfileQuiet(
    realisticRunner({ ...REALISTIC_CONFIG, counterfactualSeverEffect: 'extraordinaryMeridians' }),
  )

  const severingContributionRow = (
    severable: string,
    actor: string,
    baseSeconds: number,
    ablatedRun: SimState,
    endRateShare: number,
    acquiredUnderAblation: string,
  ): Record<string, string> => ({
    severable,
    actor,
    baseH: (baseSeconds / 3600).toFixed(2),
    ablatedH: (ablatedRun.simSeconds / 3600).toFixed(2),
    deltaH: ((baseSeconds - ablatedRun.simSeconds) / 3600).toFixed(2),
    endRateShareM: Number.isNaN(endRateShare) ? '—' : `${endRateShare.toFixed(3)}×`,
    acquiredUnderAblation,
  })
  console.log('\n  -- Part 1: live-contribution measurement (⊘ effect-ablation vs base) --')
  console.table([
    severingContributionRow(
      'soul aspect', 'LatticeFocused', latticeRun.simSeconds, latticeSeverAspectRun,
      latticeSeveringShares.soulAspect,
      `bound ${latticeSeverAspectRun.severedAspectKey ?? 'none'}, nullified`,
    ),
    severingContributionRow(
      'soul aspect', 'Realistic', realisticRun.simSeconds, realisticSeverAspectRun,
      realisticSeveringShares.soulAspect,
      `bound ${realisticSeverAspectRun.severedAspectKey ?? 'none'}, nullified`,
    ),
    severingContributionRow(
      'stance', 'LatticeFocused', latticeRun.simSeconds, latticeSeverStanceRun,
      latticeSeveringShares.stance, 'trance intents fire, never engage',
    ),
    severingContributionRow(
      'stance', 'Realistic', realisticRun.simSeconds, realisticSeverStanceRun,
      realisticSeveringShares.stance, 'no-op: policy never enters a stance',
    ),
    severingContributionRow(
      'profession', 'PillFocused', pillRun.simSeconds, pillSeverProfessionRun,
      pillSeveringShares.profession,
      `${pillSeverProfessionRun.pillsSwallowed} pills swallowed, effects nullified`,
    ),
    severingContributionRow(
      'profession', 'Realistic', realisticRun.simSeconds, realisticSeverProfessionRun,
      realisticSeveringShares.profession,
      `${realisticSeverProfessionRun.pillsSwallowed} pills swallowed, effects nullified`,
    ),
    severingContributionRow(
      'ext-meridian track', 'MeridianProbe', meridianRun.simSeconds, meridianSeverExtRun,
      meridianSeveringShares.extraordinaryMeridians,
      `${meridianSeverExtRun.severedExtraordinaryMeridiansBought ?? 0}/${EXTRAORDINARY_MERIDIAN_TARGET} bought, effect nullified`,
    ),
    severingContributionRow(
      'ext-meridian track', 'Realistic', realisticRun.simSeconds, realisticSeverExtRun,
      realisticSeveringShares.extraordinaryMeridians,
      'no-op: policy never buys the track',
    ),
  ])
  console.log('  Multiplier-shape read per severable (is m a clean multiplier a severance can cover?):')
  console.log(
    `  - soul aspect: CLEAN always-on multiplier once bound — m is the aspect's data qiMult directly ` +
      `(Lattice end-state: ${latticeSeveringShares.boundAspectKey} ${latticeSeveringShares.soulAspect.toFixed(2)}×, ` +
      `Realistic: ${realisticSeveringShares.boundAspectKey} ${realisticSeveringShares.soulAspect.toFixed(2)}×). ` +
      'Its insightMult side is ALSO nullified in the ⊘ run (deltaH includes both axes).',
  )
  console.log(
    '  - stance: NOT a clean multiplier — toggled, with a qi factor <= 1 while active (Breathing Trance ×0.7 qi / ×2 Insight);',
  )
  console.log(
    `    end-of-run m = ${latticeSeveringShares.stance.toFixed(2)}× because banking runs trance-OFF. Its effect domain is the ` +
      'INSIGHT axis + the toggle privilege; a qi-rate severance multiplier does not fit it.',
  )
  console.log(
    `  - profession: NOT clean — a duty-cycle ×2 (gathering-pill uptime) + episodic ×1.5 n/s gain (clarity) + an ` +
      `untested tribulation-pool bonus. End-of-run m (${pillSeveringShares.profession.toFixed(2)}× Pill / ` +
      `${realisticSeveringShares.profession.toFixed(2)}× Realistic) only sees whether a pill was burning at the final state;`,
  )
  console.log('    deltaH is the honest contribution number for this one.')
  console.log(
    `  - ext-meridian track: CLEAN multiplier once complete (1.25^${meridianSeveringShares.extraordinaryMeridiansOwned} = ` +
      `${meridianSeveringShares.extraordinaryMeridians.toFixed(2)}× at MeridianProbe's end state), but it RAMPS IN across ` +
      'the run as meridians are bought — m is end-state, not lifetime-average.',
  )

  // Part 2 — the analytic breakeven-timing MODEL (printed, never simulated:
  // Act II does not exist, so units are RITUAL STEPS, not wall-clock).
  console.log('\n  -- Part 2: breakeven-timing MODEL (analytic — a MODEL, not a measurement) --')
  console.log(
    '  Transcendent multiplier: starts at c·m, grows geometrically per severance-ritual completion, caps at k·m.',
  )
  console.log(
    `  ASSUMPTION ⟨tune⟩: growth g = (k/c)^(1/${SEVERING_RITUAL_STEP_COUNT - 1}) so the cap lands exactly at step ` +
      `${SEVERING_RITUAL_STEP_COUNT} — mirroring Act I's ${SEVERING_RITUAL_STEP_COUNT}-re-climb resolution at Realistic cadence (D2/D21).`,
  )
  console.log(
    '  n* = first step whose multiplier >= m (the felt weakness window closes); lifetimeNet = mean over the',
  )
  console.log(
    `  ${SEVERING_RITUAL_STEP_COUNT} steps of (multiplier ÷ m) vs the never-severing baseline (1.0). Both are m-INDEPENDENT — the`,
  )
  console.log(
    '  breakeven threshold and the ramp scale with m together — so ONE grid serves every severable; m only',
  )
  console.log(
    '  sets the absolute start (c·m) and cap (k·m). Units are ritual STEPS; Act II wall-clock does not exist.',
  )
  const severingModelRows: Record<string, string | number>[] = []
  for (const startFraction of SEVERING_RAMP_START_FRACTIONS) {
    for (const capFactor of SEVERING_RAMP_CAP_FACTORS) {
      const growthPerStep = (capFactor / startFraction) ** (1 / (SEVERING_RITUAL_STEP_COUNT - 1))
      let breakevenStep: number | null = null
      let rampSum = 0
      for (let step = 1; step <= SEVERING_RITUAL_STEP_COUNT; step++) {
        const rampValue = Math.min(startFraction * growthPerStep ** (step - 1), capFactor)
        rampSum += rampValue
        if (breakevenStep === null && rampValue >= 1) breakevenStep = step
      }
      const lifetimeNetRatio = rampSum / SEVERING_RITUAL_STEP_COUNT
      severingModelRows.push({
        c: startFraction,
        k: capFactor,
        growthPerStep: growthPerStep.toFixed(3),
        breakevenStep: breakevenStep ?? `>${SEVERING_RITUAL_STEP_COUNT}`,
        lifetimeNet: lifetimeNetRatio.toFixed(3),
        verdict: lifetimeNetRatio >= 1 ? 'net-positive' : 'net-NEGATIVE over the ramp',
      })
    }
  }
  console.table(severingModelRows)
  console.log('  Absolute coverage per measured clean m (cap k·m must cover the severed m — k>1 makes that definitional):')
  const severingAbsoluteLine = (label: string, rateShare: number): void => {
    const startMin = SEVERING_RAMP_START_FRACTIONS[0] * rateShare
    const startMax = SEVERING_RAMP_START_FRACTIONS[SEVERING_RAMP_START_FRACTIONS.length - 1]! * rateShare
    const capMin = SEVERING_RAMP_CAP_FACTORS[0] * rateShare
    const capMax = SEVERING_RAMP_CAP_FACTORS[SEVERING_RAMP_CAP_FACTORS.length - 1]! * rateShare
    console.log(
      `    ${label}: m=${rateShare.toFixed(2)}× → start c·m ∈ [${startMin.toFixed(2)}, ${startMax.toFixed(2)}]×, ` +
        `cap k·m ∈ [${capMin.toFixed(2)}, ${capMax.toFixed(2)}]×`,
    )
  }
  severingAbsoluteLine(`soul aspect (${latticeSeveringShares.boundAspectKey})`, latticeSeveringShares.soulAspect)
  severingAbsoluteLine('ext-meridian track (complete)', meridianSeveringShares.extraordinaryMeridians)
  console.log('    (stance + profession: not clean multipliers — bracket them by deltaH, not by m; see Part 1 notes.)')
  console.log('  (SEVERING PROBE ends — everything above is observation/model input for Q9; the pins below are the only assertions.)')

  // ---- Q10 TRANCE ATTRIBUTION PROBE (⊕, retirable) ----------------------------
  // Q9's k-probe side-finding: severing Breathing Trance's EFFECT made the
  // focused lattice actor FASTER — the trance is net-negative on total time for
  // that policy at current data. Q10 asks whether that is the STANCE'S fault
  // (a trap on the qi axis — data fix, D1 lint-pin precedent) or the SIM
  // POLICY'S fault (it holds the trance in the wrong phases). Method (Wes,
  // 2026-07-03): a smart-trance variant of the SAME Lattice actor that engages
  // the trance ONLY when insight is the binding constraint (a wanted node it
  // cannot yet afford) and holds it OFF during pure qi-banking. Compare three
  // totals — base policy, smart policy, and the ⊘ stance-effect ablation
  // (latticeSeverStanceRun, computed above) — and read the gap the smart policy
  // closes toward the ablation. Observation-only; NEVER asserted on; the base
  // profiles and the pins below are untouched (smartTrancePolicy is set on this
  // one quiet run alone). Retire with the Q10 decision.
  const latticeSmartTranceRun = runProfileQuiet(
    spineRunner({ ...LATTICE_CONFIG, smartTrancePolicy: true }),
  )
  const q10BaseSeconds = latticeRun.simSeconds
  const q10SmartSeconds = latticeSmartTranceRun.simSeconds
  const q10AblationSeconds = latticeSeverStanceRun.simSeconds
  const q10TranceShare = (run: SimState): string => {
    if (run.simSeconds <= 0) return '—'
    return `${(((run.tranceEngagedSeconds ?? 0) / run.simSeconds) * 100).toFixed(1)}%`
  }
  // Inversion gap = how much FASTER the ⊘ ablation runs than the base policy
  // (positive = the trance is net-negative for the base policy — the finding
  // Q10 investigates). Closure = how much of that gap the smart policy erases.
  const q10InversionGapSeconds = q10BaseSeconds - q10AblationSeconds
  const q10GapClosedSeconds = q10BaseSeconds - q10SmartSeconds
  const q10ClosurePct =
    q10InversionGapSeconds !== 0 ? (q10GapClosedSeconds / q10InversionGapSeconds) * 100 : Number.NaN
  // "Most of the gap" is a computed threshold, not a vibe: >= this % closed (or
  // the smart policy beating the ablation outright) reads as POLICY ERROR.
  const Q10_MOST_OF_GAP_PCT = 70
  console.log('\n=== Q10 TRANCE ATTRIBUTION PROBE (observation-only; no assertion) ===')
  console.log(
    '  Is Breathing Trance a trap for qi-focused lattice play (data wrong), or does the sim policy just use it badly?',
  )
  console.log(
    '  Method: a smart-trance Lattice variant — engage ONLY when insight is the binding constraint',
  )
  console.log(
    '  (a wanted Dao node the actor cannot yet afford: heldSeeds < target AND no node affordable), OFF while qi-banking.',
  )
  console.log(
    `  NOTE: the ledger cites 28.71h/21.59h from the PRE-keep-mechanic calibration; the LIVE sim now runs faster,`,
  )
  console.log(
    `  but the inversion is what matters and it is read here from live numbers (base vs ⊘ ablation).`,
  )
  console.table([
    {
      policy: 'base LatticeFocused (small-target heuristic)',
      totalH: (q10BaseSeconds / 3600).toFixed(2),
      tranceEngagedShare: q10TranceShare(latticeRun),
      note: 'PINNED base run (untouched)',
    },
    {
      policy: 'LatticeSmartTrance (insight-binding only)',
      totalH: (q10SmartSeconds / 3600).toFixed(2),
      tranceEngagedShare: q10TranceShare(latticeSmartTranceRun),
      note: 'the ⊕ policy variant',
    },
    {
      policy: '⊘ ablation reference (trance effect nullified)',
      totalH: (q10AblationSeconds / 3600).toFixed(2),
      tranceEngagedShare: q10TranceShare(latticeSeverStanceRun),
      note: 'trance intents fire, never engage (share ~0)',
    },
  ])
  console.log(
    `  Inversion gap (base − ablation): ${(q10InversionGapSeconds / 3600).toFixed(2)}h ` +
      `(positive ⇒ trance is net-negative for the base policy — the Q9 finding).`,
  )
  console.log(
    `  Smart closes (base − smart): ${(q10GapClosedSeconds / 3600).toFixed(2)}h of that gap ` +
      `= ${Number.isNaN(q10ClosurePct) ? '—' : q10ClosurePct.toFixed(1) + '%'} closure ` +
      `(threshold for "most of the gap": ${Q10_MOST_OF_GAP_PCT}%).`,
  )
  let q10Verdict: string
  if (q10InversionGapSeconds <= 0) {
    q10Verdict =
      'INDETERMINATE: the base policy is not slower than the ⊘ ablation in live data — the inversion this probe ' +
      'investigates is not present here; re-establish it before ruling on the stance.'
  } else if (q10ClosurePct >= Q10_MOST_OF_GAP_PCT) {
    q10Verdict =
      'POLICY ERROR: the sim used the trance badly; the stance data is fine; no data change.'
  } else {
    q10Verdict =
      'TRAP: the stance is net-negative for this build even used optimally — data fix is on the table ' +
      '(D1 lint-pin precedent), Wes decides.'
  }
  console.log(`  VERDICT (${q10ClosurePct >= Q10_MOST_OF_GAP_PCT ? 'closed ≥ threshold' : 'gap survives'}): ${q10Verdict}`)
  console.log('  (Q10 PROBE ends — observation input for the trap-vs-policy call; the pins below are the only assertions.)')

  // ---- ACT II SPINE (slice-9 §6; observation-only, pure insertion) ---------
  // Boots its OWN quiet Competent Act I (the pinned Competent run above is
  // untouched), then models Act II analytically. No FAIL is ever emitted here;
  // the §6 preview lines report PREVIEW-OK / PREVIEW-BREACH only (Gate-D gates
  // the FAIL-able assertions). Runs before PINNED BANDS, which reads only stored
  // numbers (competentRun.simSeconds etc.), so booting a fresh Pinia here is safe.
  const actIIResult = runActIISpine()
  printActIISpine(actIIResult, competentRun.simSeconds)

  // ---- ACT II ROSTER (slice-9 §6; observation-only, pure insertion) --------
  // The generalized Act II model (chunk A's machinery, reused) run from three
  // OTHER Act I end-states + severing policies. Each boots its own quiet Act I;
  // the pinned runs above are untouched. Emits PREVIEW-OK / PREVIEW-BREACH only
  // (never the FAIL token); the consolidated tune-pass inputs follow it.
  const actIIRoster = runActIIRoster()
  printActIIRoster(actIIRoster, actIIResult)

  // ---- PINNED BANDS (Gate-D: re-pinned 2026-07-02 with the keep mechanic live) ----
  // Three bands, three jobs. These are the ONLY hard pacing pins in the sim;
  // they move only with a deliberate, signed-off retune (update the constants
  // in the same commit as the data change that moves them — see ledger #13).
  // MIGRATION (slice-9 keep-rule activation): "the core remembers" is now a real
  // gain rule (soul.reclimbGainMult), so these pins are re-measured on the live
  // baseline. The Competent floor MOVED (74,041s → 41,659s): the gain rule
  // compresses the optimizer's minimum-gain re-climb spam (1,344 climbs, each
  // now up to the 1/f = 20× cap). It lands ABOVE the ~6.6–10.3h clock-compression
  // bracket — the counterfactual compressed the whole segment (interleaved f/n
  // work included); the real gain rule accelerates only c's portion, so it is
  // weaker (and honest). The Realistic band did NOT move: all nine jitter-grid
  // points are byte-identical to pre-activation. Realistic re-climbs c with one
  // OVERKILL prestige from a banked pile, so a 20× gain crosses best>=2 in the
  // same single step — the acceleration is fully absorbed by check-in
  // quantization (exactly the sub-check-in effect the calibration honesty note
  // warned the clock-compression counterfactual would overstate). So the
  // experience-target actor stays at 53.25h, OUTSIDE the ~[28–35h] design target
  // the counterfactual predicted. Flagged for design review — the mechanic
  // accelerates the OPTIMIZER's felt Act I, not the experience-target actor's
  // run total (its felt sub-check-in re-temper still compresses; its wall-clock
  // does not). Numbers + method: docs/calibration.md.
  const COMPETENT_FLOOR_PINNED_SECONDS = 41659 // re-pinned post-keep-mechanic, 1s resolution (was 74,041; regression instrument, not a pacing claim)
  const REALISTIC_BAND_MIN_HOURS = 48.5 // jitter-sweep min (0.8× cadence), rounded out — UNCHANGED (mechanic absorbed by cadence quantization)
  const REALISTIC_BAND_MAX_HOURS = 62.4 // jitter-sweep max (1.2× cadence), rounded out — UNCHANGED
  const CLUSTER_RATIO_PINNED_MAX = 1.5 // re-checked with the rule live: observed 1.392 raw — focused builds must stay clustered
  console.log('\n=== PINNED BANDS (Gate-D: re-pinned 2026-07-02, post-keep-mechanic) ===')
  if (Math.round(competentRun.simSeconds) === COMPETENT_FLOOR_PINNED_SECONDS) {
    console.log(`PASS: Competent regression floor (post-keep-mechanic) — ${COMPETENT_FLOOR_PINNED_SECONDS}s (${competentHours.toFixed(2)}h)`)
  } else {
    console.error(
      `FAIL: Competent regression floor moved — ${Math.round(competentRun.simSeconds)}s vs pinned ` +
        `${COMPETENT_FLOOR_PINNED_SECONDS}s. Either an unintended regression or an unpinned retune: ` +
        'no game-data change ships without updating this pin in the same signed-off commit.',
    )
  }
  const realisticSweepInBand =
    sweepMin >= REALISTIC_BAND_MIN_HOURS - 0.1 && sweepMax <= REALISTIC_BAND_MAX_HOURS + 0.1
  if (realisticHours >= REALISTIC_BAND_MIN_HOURS && realisticHours <= REALISTIC_BAND_MAX_HOURS && realisticSweepInBand) {
    console.log(
      `PASS: Realistic experience band — ${realisticHours.toFixed(2)}h within [${REALISTIC_BAND_MIN_HOURS}h … ` +
        `${REALISTIC_BAND_MAX_HOURS}h] AT 24–36min late-game check-in cadence (the band is cadence-shaped: ` +
        'the banking knob is dead at current mechanics and wakes with bankable events — ledger #13).',
    )
    console.log(
      '      (Band WIDTH is a feature, not tolerance: it is the spread between a twice-a-day checker ' +
        'and an every-few-hours checker, both finishing.)',
    )
  } else {
    console.error(
      `FAIL: Realistic experience band — headline ${realisticHours.toFixed(2)}h / sweep ` +
        `[${sweepMin.toFixed(2)}h … ${sweepMax.toFixed(2)}h] vs pinned [${REALISTIC_BAND_MIN_HOURS}h … ` +
        `${REALISTIC_BAND_MAX_HOURS}h] at 24–36min cadence. If a mechanic now interacts with banking ` +
        'discipline, the cadence assumption changed — re-derive the band, do not widen the pin silently.',
    )
  }
  if (clusterRatio <= CLUSTER_RATIO_PINNED_MAX) {
    console.log(
      `PASS: build-diversity cluster — ratio ${clusterRatio.toFixed(3)} <= ${CLUSTER_RATIO_PINNED_MAX} ` +
        '(focused grammars stay viable relative to each other).',
    )
  } else {
    console.error(
      `FAIL: build-diversity cluster — ratio ${clusterRatio.toFixed(3)} > ${CLUSTER_RATIO_PINNED_MAX}. ` +
        'A focused grammar fell out of the cluster: attribute before retuning (counterfactual probe first, ' +
        'and check the tortoise rule — trailing AND owning nothing distinct = under-tuned; ledger #1).',
    )
  }
}

// Executed via `npm run sim` (tsx src/sim/pacing.ts). Nothing else imports
// this module, so the top-level call below is the sim's sole entry point —
// the M7 scaffold exported `runPacingSim` but never wired an invocation,
// leaving `npm run sim` a silent no-op; wiring it here so the harden pass's
// optionality assertions (and every future addition to this sim) actually run.
runPacingSim()
