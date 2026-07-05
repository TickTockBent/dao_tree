// src/stores/severing.ts — Spirit Severing: active severances + the
// transcendent multiplier (slice 9; docs/slice-9.md §2, D23/D25).
//
// LIFE-scoped (TREE_DATA layer 'severing'): severed things return next life.
// The eternal severance HISTORY lives on the soul store (D24).
//
// CONTRACT for the implementer (now implemented):
// - transcendentQiMult / transcendentInsightMult: product over active
//   severances of the per-axis ramp value. Ramp per D25: ratio starts at
//   startFraction (c), grows geometrically per severance-ritual completion,
//   caps at capRatio (k) by rampSteps; the axis value is ratio × the
//   contribution (m) captured at sever time. An axis the piece did NOT occupy
//   (m === 1) is floored at 1 so a qi-only cut never drags insight below
//   baseline. Constants live on SETPIECE_DATA.severance — never hardcode.
// - isSevered() is consulted by the nullification seams already wired in
//   pipelines.ts (soul aspect + manifestation tier), body.ts (extraordinary
//   meridians), and alchemy.ts (profession pills).
// - sever() captures the piece's live contribution BEFORE nullifying it and
//   records the cut in the eternal history via soul.recordSeverance().

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { SEVERING_DATA, OFFERING_DATA, findOfferingBasket } from '@/data/severing'
import { STANCE_DATA, type StanceRow } from '@/data/stances'
import { SETPIECE_DATA } from '@/data/setpieces'
import { ACCUMULATOR_DATA } from '@/data/accumulators'
import { findBodyBuyable } from '@/data/body'
import { findRecipe } from '@/data/alchemy'
import { LATTICE_DATA } from '@/data/lattice'
import { realmWithSoulAspect } from '@/data/realms'
import { useBodyStore } from './body'
import { useAlchemyStore } from './alchemy'
import { useDaoStore } from './dao'
import { useGameStore } from './game'
import { useRealmStore } from './realm'
import { useSoulStore, TRANSCEND_LIVES } from './soul'
// Slice 10 (D36): a severance is a deed first (headline-only per KARMA_DATA).
// Readerless karma write, deferred lookup keeps it cycle-free.
import { recordSeveranceDeed, recordTranscendenceDeed } from '@/engine/karmaEvents'
import type { CorpseKey, PillKey, SeverableKey, StanceKey } from '@/engine/types'

export interface SeveranceRecord {
  corpse: CorpseKey
  severable: SeverableKey
  /** soul.severanceRituals at sever time — the ramp counts steps from here. */
  ritualStepsAtSever: number
  /** Live contribution captured at sever time (Decimal strings — the m in c·m → k·m). */
  severedQiMult: string
  severedInsightMult: string
  /**
   * D35 — which stance the Flowing Form cut locked into flesh (only set on a
   * 'flowingForm' severance). Additive + save/load-safe: absent on the four
   * passive severables and on every pre-D35 save. Feeds dao's lockedStance
   * getter so the toggle path refuses it and the ramp (not the toggle) carries
   * its captured modifiers.
   */
  lockedStance?: StanceKey
}

export interface SeveringSlice {
  severances: SeveranceRecord[]
  /**
   * D39 — TRANSCENDED attachments pre-applied at FULL RAMP from breath one. A
   * PARALLEL lane to `severances`: these records nullify their piece and feed
   * the transcendent multiplier at cap, but they sit OUTSIDE the three-corpse
   * ceremony (they never advance nextCorpse, offeringCorpse, or the sequential
   * lived-with gate — those read `severances` alone). Rebuilt from the soul's
   * transcended set by {@link useSeveringStore.applyTranscendences} at the
   * crossing; life-scoped like the store, so the cascade clears it first.
   */
  transcendences: SeveranceRecord[]
}

/** Per-severance ramp state the panel renders (all derived, never stored). */
export interface SeveranceReadout {
  /** Ritual completions since this cut (0 at sever). */
  steps: number
  /** 1-indexed presentation step, clamped to the cap step. */
  displayStep: number
  /** Current ramp ratio in [startFraction, capRatio]. */
  ratio: number
  /** Ramp value applied to the qi axis (contribution × ratio, floored per rule). */
  qiMult: Decimal
  /** Ramp value applied to the insight axis. */
  insightMult: Decimal
  /** True once the ramp has carried the multiplier past what was cut. */
  breakevenCrossed: boolean
  /** 1-indexed step at which the ramp first reaches breakeven (data-derived). */
  breakevenStep: number
  /** 1-indexed step at which the ramp reaches its cap. */
  capStep: number
}

/** One ritual turning's projected offering cost within a {@link RecoveryProjection}. */
export interface RecoveryTurning {
  /** 0-indexed position in the trajectory (the growth exponent for this turning). */
  index: number
  qi: Decimal
  insight: Decimal
}

/**
 * D32 — the recovery math for a HYPOTHETICAL cut, shown on the menu BEFORE
 * the knife. All derived, never stored; mutates nothing.
 */
export interface RecoveryProjection {
  /** The corpse this cut would sever — and so bill (D30) from turning one. */
  corpse: CorpseKey
  /** 1-indexed display step at which the ramp first reaches breakeven. */
  breakevenStep: number
  /** 1-indexed step at which the ramp reaches its lifetime cap. */
  capStep: number
  /** Raw ritual turnings needed to cross breakeven (trajectory length). */
  turningsToBreakeven: number
  /** Per-turning offering cost, index 0..turningsToBreakeven-1. */
  trajectory: readonly RecoveryTurning[]
  /** Sum of the trajectory's qi cost. */
  totalQi: Decimal
  /** Sum of the trajectory's insight cost. */
  totalInsight: Decimal
}

export function freshSeveringSlice(): SeveringSlice {
  return { severances: [], transcendences: [] }
}

// ---- Ramp constants (D25 — read from data, never hardcode) ----------------
const SEVER_CFG = SETPIECE_DATA.severance
/** c — where the ramp starts, as a fraction of the severed contribution. */
const START_FRACTION = SEVER_CFG.startFraction
/** k — the lifetime cap, as a ratio over the severed contribution. */
const CAP_RATIO = SEVER_CFG.capRatio
/** Ritual completions from start to cap (display steps 1..rampSteps). */
const RAMP_STEPS = SEVER_CFG.rampSteps
/** Geometric growth per ritual step: c·g^(rampSteps−1) = k. */
const RAMP_GROWTH = Math.pow(CAP_RATIO / START_FRACTION, 1 / (RAMP_STEPS - 1))
/** Raw step count at which ratio first reaches 1 (0-indexed from sever). */
const RAW_BREAKEVEN_STEPS =
  START_FRACTION >= 1 ? 0 : Math.ceil(Math.log(1 / START_FRACTION) / Math.log(RAMP_GROWTH))
/** Breakeven as a 1-indexed presentation step (step 7 at c=0.5, k=2.0). */
const BREAKEVEN_STEP_DISPLAY = RAW_BREAKEVEN_STEPS + 1
/** Cap as a 1-indexed presentation step (step 12 at rampSteps=12). */
const CAP_STEP_DISPLAY = RAMP_STEPS

/** The gathering pill whose nominal mult is the legible v1 profession contribution. */
const GATHERING_PILL_KEY: PillKey = 'gatheringPill'
/** MANIFESTATION-tier effects live at tier index 2 (owned requires tier >= 3). */
const MANIFESTATION_TIER_INDEX = 2

/** The ramp ratio at a given raw step count. */
function ratioAtStep(steps: number): number {
  return Math.min(START_FRACTION * Math.pow(RAMP_GROWTH, steps), CAP_RATIO)
}

/** Axis value: ratio × m, but an unoccupied axis (m === 1) is never dragged below 1. */
function axisValue(contribution: Decimal, ratio: number): Decimal {
  const scaled = contribution.times(ratio)
  return contribution.eq(1) ? scaled.max(decimalOne()) : scaled
}

/**
 * D35 / principle #35 shippability floor for a conditional-lock severable: the
 * captured stance must be RECOVERABLE on EVERY axis — cap·m > 1 (the ramp's
 * lifetime peak clears baseline 1, not the stance's own m; a lock's baseline is
 * 1). A stance too lopsided to clear this on some axis is WEARABLE but not
 * LOCKABLE: locking it would impose a permanent malus the ramp can never repay
 * on that axis. At k=2.0: Breathing Trance qi 0.7 → 1.4 ✓, insight 2.0 → 4.0 ✓
 * (lockable); Sword Trance qi 0.4 → 0.8 ✗ (NOT lockable — discovered at
 * implementation, reported to design, stance data unchanged per rule 0.1).
 */
function stanceLockRecoverable(stance: StanceRow): boolean {
  const qiM = stance.modifiers.qiMult ?? 1
  const insightM = stance.modifiers.insightMult ?? 1
  return CAP_RATIO * qiM > 1 && CAP_RATIO * insightM > 1
}

export const useSeveringStore = defineStore('severing', () => {
  const slice = ref<SeveringSlice>(freshSeveringSlice())

  const severances = computed<readonly SeveranceRecord[]>(() => slice.value.severances)
  /** The pre-applied transcendence records (D39) — nullified + at-cap from breath one. */
  const transcendences = computed<readonly SeveranceRecord[]>(() => slice.value.transcendences)

  /**
   * True if this piece is severed THIS LIFE (its effect is nullified) — whether
   * by a cut made this life OR by a transcendence pre-applied at the crossing
   * (D39: a transcended piece is gone from breath one).
   */
  function isSevered(key: SeverableKey): boolean {
    return (
      slice.value.severances.some((s) => s.severable === key) ||
      slice.value.transcendences.some((s) => s.severable === key)
    )
  }

  /** The next corpse to sever, or null when all three are cut. */
  const nextCorpse = computed<CorpseKey | null>(() => {
    const done = slice.value.severances.length
    return SEVERING_DATA.corpses[done]?.key ?? null
  })

  /**
   * The piece's NOMINAL domain multiplier per axis, from data + owned state
   * (D11 — shown on the menu BEFORE the cut, captured verbatim at sever time).
   * profession is a COMPOSITE effect (pill + breakthrough aid + warding); the
   * gathering pill's nominal mult is the honest legible v1 figure (k-probe).
   */
  /** The stance currently WORN (dao.activeStance resolved to its row), or null. */
  function wornStance(): StanceRow | null {
    const key = useDaoStore().activeStance
    if (!key) return null
    return STANCE_DATA.stances.find((s) => s.key === key) ?? null
  }

  function contributionOf(severable: SeverableKey): { qi: Decimal; insight: Decimal } {
    if (severable === 'flowingForm') {
      // D35 — the WORN stance's modifiers verbatim (D11 — shown exactly on the
      // menu, captured verbatim at sever time as the m in c·m → k·m).
      const stance = wornStance()
      return {
        qi: new Decimal(stance?.modifiers.qiMult ?? 1),
        insight: new Decimal(stance?.modifiers.insightMult ?? 1),
      }
    }
    if (severable === 'soulAspect') {
      const aspectKey = useBodyStore().soulAspect
      const aspect = realmWithSoulAspect()?.soulAspect?.aspects.find((a) => a.key === aspectKey)
      return {
        qi: new Decimal(aspect?.effect.qiMult ?? 1),
        insight: new Decimal(aspect?.effect.insightMult ?? 1),
      }
    }
    if (severable === 'extraordinaryMeridians') {
      const extra = findBodyBuyable('extraordinaryMeridian')
      const owned = useBodyStore().extraordinaryMeridians
      return { qi: Decimal.pow(extra.effectBase, owned), insight: decimalOne() }
    }
    if (severable === 'profession') {
      const effect = findRecipe(GATHERING_PILL_KEY).effect
      const qi = effect.type === 'timedQiMult' ? new Decimal(effect.mult) : decimalOne()
      return { qi, insight: decimalOne() }
    }
    // manifestation: product of every owned MANIFESTATION-tier effect per axis
    // (empty until the manifestation ring lands in lattice data — correct).
    const dao = useDaoStore()
    let qi = decimalOne()
    let insight = decimalOne()
    for (const node of LATTICE_DATA.nodes) {
      if (dao.nodeTierOwned(node.key) < MANIFESTATION_TIER_INDEX + 1) continue
      const effect = node.effects[MANIFESTATION_TIER_INDEX]
      if (!effect) continue
      if ('qiMult' in effect) qi = qi.times(effect.qiMult)
      else insight = insight.times(effect.insightMult)
    }
    return { qi, insight }
  }

  /** True if the severable is ACQUIRED this life (available to cut). */
  function isAcquired(severable: SeverableKey): boolean {
    if (severable === 'flowingForm') {
      // D35 eligibility: you must be WEARING a form (dao.activeStance !== null),
      // AND that form must be lockable — cap·m > 1 on every axis (principle #35).
      // A worn-but-too-lopsided stance (Sword Trance) is deliberately NOT
      // offered; flowingFormBlockReason says why.
      const stance = wornStance()
      return stance !== null && stanceLockRecoverable(stance)
    }
    if (severable === 'soulAspect') return useBodyStore().soulAspect !== ''
    if (severable === 'profession') return useAlchemyStore().professionChosen
    if (severable === 'extraordinaryMeridians') {
      const limit = findBodyBuyable('extraordinaryMeridian').limit
      return useBodyStore().extraordinaryMeridians >= limit
    }
    // manifestation: any lattice node owned at MANIFESTATION tier
    const dao = useDaoStore()
    return LATTICE_DATA.nodes.some((n) => dao.nodeTierOwned(n.key) >= MANIFESTATION_TIER_INDEX + 1)
  }

  /**
   * Severables the player can cut RIGHT NOW: acquired, not already severed this
   * life, and NOT transcended (D39/D31). Transcended pieces leave the menu
   * forever — they are no longer attachments, so they are neither acquirable nor
   * severable. This is the D31 runtime counting basis: the ≥3-live-severables
   * availability is measured over NON-transcended severables (the data-shape
   * lint over SEVERING_DATA is unchanged; runtime availability shrinks as
   * transcendences accumulate, and expanding the roster is the pressure valve).
   */
  const liveSeverables = computed<readonly SeverableKey[]>(() => {
    const soul = useSoulStore()
    return SEVERING_DATA.severables
      .map((s) => s.key)
      .filter((key) => !isSevered(key) && !soul.isTranscended(key) && isAcquired(key))
  })

  /** Raw ritual completions since a cut (0 at sever). */
  function stepsSince(record: SeveranceRecord): number {
    return useSoulStore().severanceRituals - record.ritualStepsAtSever
  }

  /** The cut has been LIVED WITH once its ramp reaches breakeven (D23). */
  function breakevenCrossed(record: SeveranceRecord): boolean {
    return ratioAtStep(stepsSince(record)) >= 1
  }

  /** Per-axis ramp value for one severance (the m·g^steps → k·m term). */
  function axisMultFor(record: SeveranceRecord): { qi: Decimal; insight: Decimal } {
    const ratio = ratioAtStep(stepsSince(record))
    return {
      qi: axisValue(new Decimal(record.severedQiMult), ratio),
      insight: axisValue(new Decimal(record.severedInsightMult), ratio),
    }
  }

  /** Everything the panel needs to render one severance's ramp/weakness state. */
  function readoutFor(record: SeveranceRecord): SeveranceReadout {
    const steps = stepsSince(record)
    const ratio = ratioAtStep(steps)
    const axis = axisMultFor(record)
    return {
      steps,
      displayStep: Math.min(steps + 1, RAMP_STEPS),
      ratio,
      qiMult: axis.qi,
      insightMult: axis.insight,
      breakevenCrossed: ratio >= 1,
      breakevenStep: BREAKEVEN_STEP_DISPLAY,
      capStep: CAP_STEP_DISPLAY,
    }
  }

  /** The previous cut must be lived with (breakeven) before the next opens (D23). */
  const previousLivedWith = computed<boolean>(() => {
    const records = slice.value.severances
    const prev = records[records.length - 1]
    return prev === undefined || breakevenCrossed(prev)
  })

  /** Whether the severing ceremony can begin. */
  const canSever = computed<boolean>(
    () =>
      useRealmStore().stateOf('x').unlocked &&
      nextCorpse.value !== null &&
      liveSeverables.value.length > 0 &&
      previousLivedWith.value,
  )

  /** Perform a severance. Returns success; nullification is automatic via isSevered. */
  function sever(severable: SeverableKey): boolean {
    if (!useRealmStore().stateOf('x').unlocked) return false
    const corpse = nextCorpse.value
    if (corpse === null) return false
    if (!liveSeverables.value.includes(severable)) return false
    // Sequential lived-with rule (D23): the previous cut must have crossed breakeven.
    if (!previousLivedWith.value) return false

    const soul = useSoulStore()
    // Captured BEFORE the D35 lock clears the worn stance (order matters: the
    // Flowing Form's contribution reads the stance that is about to be freed).
    const contribution = contributionOf(severable)
    const record: SeveranceRecord = {
      corpse,
      severable,
      ritualStepsAtSever: soul.severanceRituals,
      severedQiMult: contribution.qi.toString(),
      severedInsightMult: contribution.insight.toString(),
    }
    if (severable === 'flowingForm') {
      // D35 — record WHICH form was made flesh, then clear the toggle so it
      // stops applying via the stance path (the ramp carries its captured
      // modifiers now — this is the double-count guard). The lock is a FLOOR,
      // not a cage: dao.toggleStance still lets OTHER stances stack on top.
      const dao = useDaoStore()
      const worn = dao.activeStance
      if (worn) record.lockedStance = worn
      dao.lockActiveStance()
    }
    slice.value = { ...slice.value, severances: [...slice.value.severances, record] }
    // D39: stamp the cut with the soul's current life index (rebirths + 1) so
    // the history distinguishes DISTINCT lives — the transcendence clock.
    const lifeIndex = soul.rebirths + 1
    soul.recordSeverance(severable, lifeIndex)
    recordSeveranceDeed(severable) // slice 10 (D36): the cut is a deed first
    // D39: the THIRD distinct-life cut of the same attachment transcends it
    // permanently. Carry the contribution captured at THIS cut (the m) so future
    // lives can pre-apply the transcendent multiplier at cap × m.
    if (soul.distinctLivesSevered(severable) >= TRANSCEND_LIVES) {
      soul.recordTranscendence(severable, record.severedQiMult, record.severedInsightMult)
      // Slice 10 (D43 #1): transcendence is a headline deed first — the same
      // detection path pays the receipt (key exists by construction; never throws).
      recordTranscendenceDeed(severable)
    }
    return true
  }

  /**
   * D39/D32 legibility — how many DISTINCT PAST lives have already severed this
   * attachment (0, 1, or 2 before the current life's cut). The panel shows this
   * as "severed in N past lives" so the player sees a cut coming to a head.
   */
  function pastLivesSevered(severable: SeverableKey): number {
    return useSoulStore().distinctLivesSevered(severable)
  }

  /**
   * D39/D32 — true when severing this piece RIGHT NOW would be its THIRD
   * distinct-life cut and therefore TRANSCEND it permanently. The menu and the
   * armed confirm announce this before the knife (never discovered after).
   */
  function severWouldTranscend(severable: SeverableKey): boolean {
    return pastLivesSevered(severable) >= TRANSCEND_LIVES - 1
  }

  /**
   * D39 — pre-apply the soul's transcended attachments to the FRESH life at the
   * rebirth crossing (called by rebirth.cross() AFTER the cascade + carried-tier
   * application, on the just-reset severing slice). Each transcended piece exists
   * pre-completed: nullified (via isSevered) and its transcendent multiplier at
   * cap from breath one, NO trough — the window was lived three times. Reuses the
   * SAME ramp machinery: a SeveranceRecord whose ritualStepsAtSever is set
   * RAMP_STEPS behind the soul's ritual clock, so stepsSince ≥ RAMP_STEPS and the
   * ramp ratio is pinned at capRatio (and stays there — the clock only rises).
   */
  function applyTranscendences(): void {
    const soul = useSoulStore()
    const atCapStepsAtSever = soul.severanceRituals - RAMP_STEPS
    const records: SeveranceRecord[] = soul.transcended.map((record) => ({
      // A nominal corpse: transcendences sit outside the three-corpse ceremony,
      // so this is never read for sequencing — only the ramp fields matter.
      corpse: SEVERING_DATA.corpses[0]!.key,
      severable: record.severable,
      ritualStepsAtSever: atCapStepsAtSever,
      severedQiMult: record.severedQiMult,
      severedInsightMult: record.severedInsightMult,
    }))
    slice.value = { ...slice.value, transcendences: records }
  }

  /**
   * D35 — the stance the Flowing Form severance locked into flesh this life, or
   * null. Read by dao (deferred lookup) to refuse re-toggling it and to exclude
   * it from the active-stance modifier path (the ramp carries it instead).
   */
  const lockedStance = computed<StanceKey | null>(() => {
    const record = slice.value.severances.find((s) => s.severable === 'flowingForm')
    return record?.lockedStance ?? null
  })

  /**
   * D35 eligibility reason: why the currently WORN form cannot be locked, or
   * null (nothing worn, or the worn form is lockable). Lets the panel say "this
   * form is too lopsided to survive as flesh" when a worn stance fails the
   * cap·m > 1 shippability floor (principle #35).
   */
  const flowingFormBlockReason = computed<string | null>(() => {
    const stance = wornStance()
    if (stance === null) return null
    if (stanceLockRecoverable(stance)) return null
    return `${stance.name} is too lopsided to survive as flesh — one axis could never recover past baseline. Wear a more balanced form to sever it.`
  })

  /** The name of the form the Flowing Form cut would lock right now (D11), or null. */
  const wornStanceName = computed<string | null>(() => wornStance()?.name ?? null)

  // ---- D28: The Offering (prestige('x') is a sacrifice) --------------------
  //
  // The severance-ritual mastery discount accumulator (D28). Cost-side DIRECT
  // form max(ratio^rituals, floor) — as rituals accrue the offering cheapens,
  // floored at `floor` (the optimizer bound). Same typed-accumulator math as
  // ascentCounter; soul.reclimbGainMult mirrors the GAIN-side reciprocal.
  const OFFERING_ACC = ACCUMULATOR_DATA.severanceRitual

  /**
   * The corpse whose rite the next offering serves (D30): the MOST RECENT
   * severance's corpse — you pay the rite of the thing you just gave up, for
   * the twelve turnings of mastering that loss. Pre-first-cut practice offerings
   * bill at the FIRST corpse (the Past — qi-heavy, universally affordable, the
   * on-ramp being practiced toward); post-third-cut offerings stay at the last
   * cut (the most recent severance is still the last one — the ?? never fires
   * once anything is cut, so the Future rite is held to cap by construction).
   */
  const offeringCorpse = computed<CorpseKey>(
    () => severances.value[severances.value.length - 1]?.corpse ?? SEVERING_DATA.corpses[0]!.key,
  )

  /**
   * Ritual steps taken toward the CURRENT severance's ramp (D28). Measured
   * from the most recent cut's ritualStepsAtSever; pre-first-severance there
   * is no record, so it counts from 0 (every offering is a practice step that
   * accrues the mastery discount but advances no severance ramp — there isn't
   * one yet). A fresh cut resets this to 0, so each severance's offering ramp
   * restarts from the basket base.
   */
  function stepsIntoCurrentSeverance(): number {
    const records = slice.value.severances
    const last = records[records.length - 1]
    return useSoulStore().severanceRituals - (last?.ritualStepsAtSever ?? 0)
  }

  /** The mastery discount factor max(ratio^rituals, floor) — deepens as rituals accrue (D28). */
  function offeringMasteryScale(): Decimal {
    const rituals = useSoulStore().severanceRituals
    return Decimal.max(Decimal.pow(OFFERING_ACC.ratio!, rituals), OFFERING_ACC.floor!)
  }

  /**
   * The exact qi + insight cost of the NEXT offering (D28, D11 — exact
   * numbers): basket base for the offering corpse (D30 — the corpse just cut) ×
   * growth^stepsInto × mastery discount × (pill discount if a pill is active).
   */
  function offeringCost(): { qi: Decimal; insight: Decimal } {
    const basket = findOfferingBasket(offeringCorpse.value)
    const growthPow = Decimal.pow(OFFERING_DATA.growth, stepsIntoCurrentSeverance())
    const mastery = offeringMasteryScale()
    const pill = useAlchemyStore().activePill !== null
      ? new Decimal(OFFERING_DATA.pillDiscount)
      : decimalOne()
    const scale = growthPow.times(mastery).times(pill)
    return {
      qi: new Decimal(basket.qiBase).times(scale),
      insight: new Decimal(basket.insightBase).times(scale),
    }
  }

  /** True when the player holds enough qi AND insight for the next offering (D28). */
  function canAffordOffering(): boolean {
    const cost = offeringCost()
    return useGameStore().points.gte(cost.qi) && useDaoStore().insight.gte(cost.insight)
  }

  /** Consume the offering basket (qi + insight, both explicitly subtracted). Returns success. */
  function performOffering(): boolean {
    const cost = offeringCost()
    const game = useGameStore()
    const dao = useDaoStore()
    if (game.points.lt(cost.qi) || dao.insight.lt(cost.insight)) return false
    game.points = game.points.sub(cost.qi).max(0)
    dao.insight = dao.insight.sub(cost.insight).max(0)
    return true
  }

  /** Everything the offering UI renders (exact costs, corpse, pill + mastery state, affordability). */
  const offeringInfo = computed(() => {
    const cost = offeringCost()
    const game = useGameStore()
    const dao = useDaoStore()
    return {
      corpse: offeringCorpse.value,
      qi: cost.qi,
      insight: cost.insight,
      qiHave: game.points,
      insightHave: dao.insight,
      qiShort: game.points.lt(cost.qi),
      insightShort: dao.insight.lt(cost.insight),
      affordable: game.points.gte(cost.qi) && dao.insight.gte(cost.insight),
      rituals: useSoulStore().severanceRituals,
      masteryScale: offeringMasteryScale(),
      pillActive: useAlchemyStore().activePill !== null,
    }
  })

  /**
   * D32 — the recovery math for a HYPOTHETICAL cut of `severable` RIGHT NOW,
   * shown on the severance menu BEFORE the knife (never veil the now). Pure
   * projection: reads live state, mutates nothing.
   *
   * The corpse billed is the one THIS cut would target (nextCorpse) — every
   * live candidate at the current cut point shares it (D25's ramp is the
   * same shape regardless of which piece is cut); `severable` is accepted so
   * the panel can call this per-candidate without the caller reasoning about
   * that uniformity itself, and so a future per-severable divergence has a
   * stable call site. Turning `i` prices as
   * basket × growth^i × max(r^(rituals+i), floor): `rituals` is TODAY's
   * severance-ritual count (the mastery clock never resets and keeps
   * advancing at its current pace regardless of which severance it serves),
   * so `rituals+i` is the honest FUTURE ritual count when that turning would
   * be paid. The pill discount is read at its CURRENT state only — the
   * store cannot know a future pill's uptime — so every row assumes today's
   * pill state, held flat across the trajectory (the panel labels it
   * "current").
   */
  function recoveryProjection(severable: SeverableKey): RecoveryProjection {
    void severable
    const corpse = nextCorpse.value ?? SEVERING_DATA.corpses[0]!.key
    const basket = findOfferingBasket(corpse)
    const rituals = useSoulStore().severanceRituals
    const pill = useAlchemyStore().activePill !== null
      ? new Decimal(OFFERING_DATA.pillDiscount)
      : decimalOne()

    const trajectory: RecoveryTurning[] = []
    let totalQi = decimalZero()
    let totalInsight = decimalZero()
    for (let index = 0; index < RAW_BREAKEVEN_STEPS; index++) {
      const growthPow = Decimal.pow(OFFERING_DATA.growth, index)
      const mastery = Decimal.max(Decimal.pow(OFFERING_ACC.ratio!, rituals + index), OFFERING_ACC.floor!)
      const scale = growthPow.times(mastery).times(pill)
      const qi = new Decimal(basket.qiBase).times(scale)
      const insight = new Decimal(basket.insightBase).times(scale)
      trajectory.push({ index, qi, insight })
      totalQi = totalQi.plus(qi)
      totalInsight = totalInsight.plus(insight)
    }

    return {
      corpse,
      breakevenStep: BREAKEVEN_STEP_DISPLAY,
      capStep: CAP_STEP_DISPLAY,
      turningsToBreakeven: RAW_BREAKEVEN_STEPS,
      trajectory,
      totalQi,
      totalInsight,
    }
  }

  /**
   * Transcendent multiplier over the qi axis (identity when nothing is severed).
   * Products over BOTH lanes: this life's cuts AND the pre-applied transcendences
   * (D39 — the latter contribute at cap from breath one).
   */
  const transcendentQiMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const record of slice.value.severances) product = product.times(axisMultFor(record).qi)
    for (const record of slice.value.transcendences) product = product.times(axisMultFor(record).qi)
    return product
  })

  /** Transcendent multiplier over the insight axis (both lanes; identity when none). */
  const transcendentInsightMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const record of slice.value.severances) {
      product = product.times(axisMultFor(record).insight)
    }
    for (const record of slice.value.transcendences) {
      product = product.times(axisMultFor(record).insight)
    }
    return product
  })

  /** Tick hook: the ritual clock is realm-x prestige (soul.recordSeveranceRitual), so no-op. */
  function update(diff: number): void {
    void diff
  }

  // ---- Save slice (id 'severing') -------------------------------------------
  function save(): Record<string, unknown> {
    return slice.value as unknown as Record<string, unknown>
  }
  function load(s: unknown): void {
    const loaded = (s ?? freshSeveringSlice()) as Partial<SeveringSlice>
    slice.value = {
      severances: Array.isArray(loaded.severances) ? [...loaded.severances] : [],
      // D39: transcendences default cleanly for pre-slice-10 saves.
      transcendences: Array.isArray(loaded.transcendences) ? [...loaded.transcendences] : [],
    }
  }
  function fresh(): Record<string, unknown> {
    return freshSeveringSlice() as unknown as Record<string, unknown>
  }

  return {
    slice,
    severances,
    transcendences,
    isSevered,
    nextCorpse,
    contributionOf,
    liveSeverables,
    pastLivesSevered,
    severWouldTranscend,
    applyTranscendences,
    lockedStance,
    flowingFormBlockReason,
    wornStanceName,
    canSever,
    previousLivedWith,
    sever,
    stepsSince,
    breakevenCrossed,
    axisMultFor,
    readoutFor,
    offeringCorpse,
    offeringCost,
    canAffordOffering,
    performOffering,
    offeringInfo,
    recoveryProjection,
    transcendentQiMult,
    transcendentInsightMult,
    update,
    save,
    load,
    fresh,
  }
})
