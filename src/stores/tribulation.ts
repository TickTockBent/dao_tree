// src/stores/tribulation.ts — the First Tribulation (set-piece instance 2).
//
// Port of the factory's beginTribulation + tribulationTick + resolveTribulation
// + tribulationPreparednessPool. A timed, multi-wave bar drained against a
// prepared pool. Mounted on the Soul Formation (s) realm. The run-state lives
// on this store; the grade is stored here too (life-scoped, never downgraded).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { SETPIECE_DATA as SP } from '@/data/setpieces'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useSectStore } from '@/stores/sect'
import { useForgeStore } from '@/stores/forge'
import { useScarStore } from '@/stores/scar'
import { useLegacyStore } from '@/stores/legacy'
import { TECHNIQUE_DATA } from '@/data/techniques'

export interface TribulationSlice {
  tribActive: boolean
  tribElapsed: number
  tribPool: string
  tribPoolMax: string
  tribWaveIndex: number
  tribGrade: number
  tribCooldownUntil: number
}

export function freshTribulationSlice(): TribulationSlice {
  return {
    tribActive: false,
    tribElapsed: 0,
    tribPool: '0',
    tribPoolMax: '0',
    tribWaveIndex: 0,
    tribGrade: -1,
    tribCooldownUntil: 0,
  }
}

/** Normalize a value to [0,1] against a denominator. */
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

export const useTribulationStore = defineStore('tribulation', () => {
  const game = useGameStore()
  const body = useBodyStore()
  const realm = useRealmStore()
  const sect = useSectStore()
  const forge = useForgeStore()
  const scar = useScarStore()
  const legacy = useLegacyStore()

  const tribActive = ref(false)
  const tribElapsed = ref(0)
  const tribPool = ref(decimalZero())
  const tribPoolMax = ref(decimalZero())
  const tribWaveIndex = ref(0)
  const tribGrade = ref(-1)
  const tribCooldownUntil = ref(0)

  // ---- Grade reads --------------------------------------------------------

  /** True if the stored grade resolves to a PASSING grade. */
  const tribulationPassed = computed(() => {
    if (tribGrade.value < 0) return false
    const grades = SP.firstTribulation.grades
    const row = grades[tribGrade.value]
    return row ? row.passes : false
  })

  /** Fraction [0,1] of the tribulation pool remaining. */
  const tribulationPoolFraction = computed(() => {
    if (!tribActive.value) return decimalZero()
    if (tribPoolMax.value.lte(0)) return decimalZero()
    const fraction = tribPool.value.div(tribPoolMax.value)
    return clampUnit(fraction)
  })

  /** True if a run is in progress. */
  const tribulationIsActive = computed(() => tribActive.value)

  /** True if the retry cooldown has elapsed. */
  const tribulationCooldownElapsed = computed(() => tribCooldownUntil.value <= 0)

  /** True if the tribulation is ready to begin (trigger met, not passed, not active, cooldown elapsed). */
  const tribulationIsReady = computed(() => {
    if (!realm.isUnlocked('s')) return false
    if (tribulationPassed.value) return false
    if (tribulationIsActive.value) return false
    if (!tribulationCooldownElapsed.value) return false
    return meets(SP.firstTribulation.trigger, buildGameState())
  })

  // ---- Preparedness pool (§6.2) -------------------------------------------

  /** Count of owned techniques. */
  function ownedTechniqueCount(): number {
    return TECHNIQUE_DATA.filter((_tech, index) => sect.techniques.includes(index)).length
  }

  /**
   * The prepared pool: a weighted sum of what Act I built, PLUS banked Qi as
   * fuel. Each term is normalized to [0,1] by its denominator then scaled by
   * its weight. The banked-Qi term is log-normalized so Qi HELPS but cannot
   * SOLO the pool. Deliberately excludes scar debuff (§6.3 completability).
   */
  function tribulationPreparednessPool(): Decimal {
    const pool = SP.firstTribulation.pool
    const temperTerm = normalizedTerm(body.temperLevel, pool.temperDenominator).times(pool.weightTemper)
    const meridianTerm = normalizedTerm(body.primaryMeridians + body.extraordinaryMeridians, pool.meridianDenominator).times(pool.weightMeridians)
    // Core grade term: ceiling index / ladder top.
    const coreIndex = forge.coreGradeIndex
    const coreTop = SP.forge.grades[SP.forge.grades.length - 1]!.ceilingIndex
    const coreFraction = coreIndex < 0 ? decimalZero() : normalizedTerm(coreIndex, coreTop)
    const coreTerm = coreFraction.times(pool.weightCoreGrade)
    const techniqueTerm = normalizedTerm(ownedTechniqueCount(), pool.techniqueDenominator).times(pool.weightTechniques)
    // Banked-Qi fuel: log10(max(qi,1)) / denom, clamped to [0,1], × weight.
    const bankedQi = game.points
    const qiForLog = bankedQi.lt(1) ? decimalOne() : bankedQi
    const qiLog = qiForLog.log10()
    const qiFraction = normalizedTerm(qiLog.toNumber(), pool.qiFuelDenominator)
    const qiFuelTerm = qiFraction.times(pool.qiFuelWeight)
    return temperTerm.add(meridianTerm).add(coreTerm).add(techniqueTerm).add(qiFuelTerm)
  }

  /** Intensity multiplier on wave damage: base + perBest × s.best. */
  function tribulationIntensity(): Decimal {
    const cfg = SP.firstTribulation.intensity
    const best = realm.realmBest('s')
    return new Decimal(cfg.base).add(best.times(cfg.perBest))
  }

  // ---- Begin + resolve ----------------------------------------------------

  /**
   * Begin a tribulation run. Consumes banked Qi as fuel, seeds the run-state,
   * starts the timed bar. Idempotent-guarded.
   */
  function beginTribulation(): void {
    if (!tribulationIsReady.value) return
    const startingPool = tribulationPreparednessPool()
    // Consume banked Qi as fuel (the gamble).
    game.points = decimalZero()
    tribActive.value = true
    tribElapsed.value = 0
    tribPool.value = startingPool
    tribPoolMax.value = startingPool
    tribWaveIndex.value = 0
    tribGrade.value = -1
  }

  /**
   * Resolve a finished run: latch the grade, fire the Act I Legacy Grade on a
   * pass, deepen the scar on a scarring grade, set retry cooldown on Failed.
   */
  function resolveTribulation(gradeIndex: number): void {
    const cfg = SP.firstTribulation
    const gradeRow = cfg.grades[gradeIndex]!

    tribActive.value = false

    if (gradeRow.passes) {
      // Latch the passing grade; NEVER downgrade a higher grade.
      if (gradeIndex > tribGrade.value) tribGrade.value = gradeIndex
      // Compute the Act I Legacy Grade ONCE on first pass (eternal, monotone).
      legacy.computeAndStoreActOneLegacy()
      // A Scarred pass still marks the soul.
      if (gradeRow.scars) scar.deepenScar()
    } else {
      // Failed: deepen the scar, set retry cooldown.
      scar.deepenScar()
      tribCooldownUntil.value = cfg.retryCooldownSeconds
    }
  }

  // ---- Per-tick wave drain ------------------------------------------------

  /** How many waves have crossed their scheduled moment at the given elapsed seconds. */
  function tribulationWavesCrossed(elapsedSeconds: number): number {
    const cfg = SP.firstTribulation
    const waveCount = cfg.waves.length
    const duration = cfg.durationSeconds
    let crossed = 0
    for (let index = 0; index < waveCount; index++) {
      const scheduledAt = (duration * (index + 1)) / waveCount
      if (elapsedSeconds >= scheduledAt) crossed++
    }
    return crossed
  }

  /** Resolve the grade index for a remaining-pool fraction. */
  function tribulationGradeForFraction(fraction: Decimal): number {
    if (fraction.lte(0)) return 0 // pool emptied = Failed
    let chosenIndex = 0
    SP.firstTribulation.grades.forEach((grade, index) => {
      if (grade.floor !== undefined && fraction.gte(grade.floor)) chosenIndex = index
    })
    return chosenIndex
  }

  /**
   * The per-tick wave-drain accrual. Advances elapsed time, drains the pool
   * for each newly-crossed wave, and resolves when the last wave crosses or
   * the pool empties.
   */
  function tribulationTick(diff: number): void {
    // While NOT active, drain any pending retry cooldown.
    if (!tribActive.value) {
      if (tribCooldownUntil.value > 0) {
        tribCooldownUntil.value = Math.max(0, tribCooldownUntil.value - diff)
      }
      return
    }

    const cfg = SP.firstTribulation
    const intensity = tribulationIntensity()

    const elapsed = tribElapsed.value + diff
    tribElapsed.value = elapsed

    // Drain the pool for every wave whose scheduled moment has now been crossed.
    const crossed = tribulationWavesCrossed(elapsed)
    let applied = tribWaveIndex.value
    let pool = tribPool.value
    while (applied < crossed) {
      const wave = cfg.waves[applied]
      if (wave) pool = pool.sub(new Decimal(wave.damage).times(intensity))
      applied++
    }
    if (pool.lt(0)) pool = decimalZero()
    tribPool.value = pool
    tribWaveIndex.value = applied

    // Resolve when the pool empties (Failed) or all waves applied (graded).
    const poolMax = tribPoolMax.value
    const emptied = pool.lte(0)
    const allWavesDone = applied >= cfg.waves.length
    if (emptied || allWavesDone) {
      const fraction = poolMax.lte(0) ? decimalZero() : pool.div(poolMax)
      const gradeIndex = emptied ? 0 : tribulationGradeForFraction(fraction)
      resolveTribulation(gradeIndex)
    }
  }

  // ---- Update hook --------------------------------------------------------
  function update(diff: number): void {
    tribulationTick(diff)
  }

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return {
      tribActive: tribActive.value,
      tribElapsed: tribElapsed.value,
      tribPool: tribPool.value.toString(),
      tribPoolMax: tribPoolMax.value.toString(),
      tribWaveIndex: tribWaveIndex.value,
      tribGrade: tribGrade.value,
      tribCooldownUntil: tribCooldownUntil.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshTribulationSlice()) as Partial<TribulationSlice>
    tribActive.value = s.tribActive ?? false
    tribElapsed.value = s.tribElapsed ?? 0
    tribPool.value = new Decimal(s.tribPool ?? '0')
    tribPoolMax.value = new Decimal(s.tribPoolMax ?? '0')
    tribWaveIndex.value = s.tribWaveIndex ?? 0
    tribGrade.value = s.tribGrade ?? -1
    tribCooldownUntil.value = s.tribCooldownUntil ?? 0
  }
  function fresh(): Record<string, unknown> {
    return freshTribulationSlice() as unknown as Record<string, unknown>
  }

  return {
    tribActive,
    tribElapsed,
    tribPool,
    tribPoolMax,
    tribWaveIndex,
    tribGrade,
    tribCooldownUntil,
    tribulationPassed,
    tribulationPoolFraction,
    tribulationIsActive,
    tribulationCooldownElapsed,
    tribulationIsReady,
    tribulationPreparednessPool,
    tribulationIntensity,
    beginTribulation,
    resolveTribulation,
    tribulationTick,
    update,
    save,
    load,
    fresh,
  }
})
