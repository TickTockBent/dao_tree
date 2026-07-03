// src/stores/legacy.ts — the eternal Act I Legacy Grade (design §8.1).
//
// Port of the factory's actOneLegacyScore + computeAndStoreActOneLegacy +
// legacyQiMult. Computed ONCE on the first tribulation pass, from a weighted
// blend of everything Act I built, stored eternal-scope, NEVER downgraded.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { LEGACY_DATA } from '@/data/legacy'
import { GATE_DATA } from '@/data/gates'
import { useBodyStore } from '@/stores/body'
import { useTribulationStore } from '@/stores/tribulation'
import { useDaoStore } from '@/stores/dao'
import { useGateStore } from '@/stores/gate'
import { realmWithSoulAspect } from '@/data/realms'

export interface LegacySlice {
  actOneGrade: number
  /** Slice 9 §3 (scar-on-entry): the tribulation grade recorded at the FIRST
   *  crossing into Act II (the first realm-x prestige). Feeds the future Act
   *  II legacy grade. Fresh -1; latches like actOneGrade (never downgrades). */
  actTwoEntryGrade: number
}

export function freshLegacySlice(): LegacySlice {
  return { actOneGrade: -1, actTwoEntryGrade: -1 }
}

// Gate achievement IDs are positional + this offset (matches gate.ts + TMT convention).
const GATE_ACHIEVEMENT_ID_OFFSET = 11

/** Normalize a value to [0,1] against a denominator, as a Decimal. */
function normalizedTerm(value: number, denominator: number): Decimal {
  const denom = new Decimal(denominator)
  if (denom.lte(0)) return decimalZero()
  let capped = new Decimal(value)
  if (capped.gt(denom)) capped = denom
  return capped.div(denom)
}

/** Clamp a Decimal to [0,1]. */
function clampUnit(d: Decimal): Decimal {
  if (d.lt(0)) return decimalZero()
  if (d.gt(1)) return decimalOne()
  return d
}

export const useLegacyStore = defineStore('legacy', () => {
  const body = useBodyStore()
  const trib = useTribulationStore()
  const dao = useDaoStore()
  const gate = useGateStore()

  const actOneGrade = ref(-1)
  // Slice 9 §3: recorded once, at the Act II crossing (see realm.ts prestige()).
  const actTwoEntryGrade = ref(-1)

  /** The stored Act I Legacy band row, or null (no grade earned yet). */
  const actOneLegacyBand = computed(() => {
    if (actOneGrade.value < 0) return null
    return LEGACY_DATA.actOne.bands[actOneGrade.value] ?? null
  })

  /** True once the Act II entry grade has been recorded (the crossing happened). */
  const actTwoEntryRecorded = computed(() => actTwoEntryGrade.value >= 0)

  /**
   * The Soul Aspect's legacy "depth": none = 0, formless = 1, element aspect = 2.
   */
  function aspectLegacyDepth(): number {
    const aspectKey = body.soulAspect
    if (!aspectKey) return 0
    const realm = realmWithSoulAspect()
    if (!realm?.soulAspect) return 0
    const aspect = realm.soulAspect.aspects.find((a) => a.key === aspectKey)
    if (!aspect) return 0
    return aspect.element !== null ? 2 : 1
  }

  /** Deeds checkpoint standing: how many gate achievements are earned. */
  function deedsCheckpointsEarned(): number {
    return GATE_DATA.achievements.filter((_ach, index) => gate.earnedIds.has(index + GATE_ACHIEVEMENT_ID_OFFSET)).length
  }

  /**
   * The weighted [0,1] blend: coreGrade / aspect / daoSeeds / sectStanding /
   * tribulation, each normalized by its denominator and scaled by its weight.
   */
  function actOneLegacyScore(): Decimal {
    const cfg = LEGACY_DATA.actOne
    const weights = cfg.weights
    const denoms = cfg.denominators

    const coreIndex = body.coreGrade
    const coreValue = coreIndex < 0 ? 0 : coreIndex
    const coreTerm = normalizedTerm(coreValue, denoms.coreGrade).times(weights.coreGrade)

    const aspectTerm = normalizedTerm(aspectLegacyDepth(), denoms.aspect).times(weights.aspect)
    const daoTerm = normalizedTerm(dao.heldDaoSeedCount(), denoms.daoSeeds).times(weights.daoSeeds)
    const sectTerm = normalizedTerm(deedsCheckpointsEarned(), denoms.sectStanding).times(weights.sectStanding)

    const tribIndex = trib.tribGrade
    const tribValue = tribIndex < 0 ? 0 : tribIndex
    const tribTerm = normalizedTerm(tribValue, denoms.tribulation).times(weights.tribulation)

    return clampUnit(coreTerm.add(aspectTerm).add(daoTerm).add(sectTerm).add(tribTerm))
  }

  /** The highest legacy band index whose floor the score meets. */
  function actOneLegacyBandForScore(score: Decimal): number {
    let chosenIndex = 0
    LEGACY_DATA.actOne.bands.forEach((band, index) => {
      if (score.gte(band.floor)) chosenIndex = index
    })
    return chosenIndex
  }

  /**
   * Compute the weighted score, map to a band, and store the BEST band (never
   * downgrade). Called ONCE on the first tribulation pass; idempotent + monotone.
   */
  function computeAndStoreActOneLegacy(): void {
    const score = actOneLegacyScore()
    const bandIndex = actOneLegacyBandForScore(score)
    if (bandIndex > actOneGrade.value) actOneGrade.value = bandIndex
  }

  /**
   * Record the Act II entry (crossing) grade. Called ONCE, from realm.ts's
   * prestige() on the first realm-x prestige. Latches the BEST grade seen —
   * mirrors actOneGrade's never-downgrade rule — though in practice this is
   * only ever called once (the crossing cannot recur).
   */
  function recordActTwoEntry(gradeIndex: number): void {
    if (gradeIndex > actTwoEntryGrade.value) actTwoEntryGrade.value = gradeIndex
  }

  /** The stored Act I Legacy band's qiMult (the legacyQiMult pipeline factor). */
  const legacyQiMult = computed<Decimal>(() => {
    const band = actOneLegacyBand.value
    if (!band) return decimalOne()
    return new Decimal(band.qiMult)
  })

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return { actOneGrade: actOneGrade.value, actTwoEntryGrade: actTwoEntryGrade.value }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshLegacySlice()) as Partial<LegacySlice>
    actOneGrade.value = s.actOneGrade ?? -1
    // Missing in pre-slice-9 saves → fresh -1 (backward-compatible load).
    actTwoEntryGrade.value = s.actTwoEntryGrade ?? -1
  }
  function fresh(): Record<string, unknown> {
    return freshLegacySlice() as unknown as Record<string, unknown>
  }

  return {
    actOneGrade,
    actOneLegacyBand,
    actOneLegacyScore,
    computeAndStoreActOneLegacy,
    actTwoEntryGrade,
    actTwoEntryRecorded,
    recordActTwoEntry,
    legacyQiMult,
    update: (_diff: number) => {},
    save,
    load,
    fresh,
  }
})
