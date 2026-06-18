// src/stores/body.ts — Body system (meridians, temper, stored grades, scar slot).
//
// Port of the factory's makeBodyLayer + body readers. The Body layer is
// LIFE-scoped and NEVER reset, so meridians/temper/grades survive every realm
// breakthrough by topology. M3 implements the full meridian/temper/grade logic;
// the scar heal arc lands in M5.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { meets, type Condition } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { BODY_DATA, findBodyBuyable, temperTierForLevel } from '@/data/body'
import { useGameStore } from './game'
import { useScarStore } from './scar'
import type { BodyBuyableKey, TemperTierKey } from '@/engine/types'

export interface BodySlice {
  primaryMeridians: number
  extraordinaryMeridians: number
  temperLevel: number
  foundationGrade: number
  coreGrade: number
  soulAspect: string
  scarDepth: number
  scarHealProgress: number
  scarHealedDepth: number
  milestones: number[]
}

export function freshBodySlice(): BodySlice {
  return {
    primaryMeridians: 0,
    extraordinaryMeridians: 0,
    temperLevel: 0,
    foundationGrade: BODY_DATA.grades.foundationGrade.startIndex,
    coreGrade: BODY_DATA.grades.coreGrade.startIndex,
    soulAspect: BODY_DATA.soulAspect.startKey,
    scarDepth: BODY_DATA.scar.startDepth,
    scarHealProgress: BODY_DATA.scar.startHealProgress,
    scarHealedDepth: BODY_DATA.scar.startHealedDepth,
    milestones: [],
  }
}

export const useBodyStore = defineStore('body', () => {
  const game = useGameStore()
  const primaryMeridians = ref(0)
  const extraordinaryMeridians = ref(0)
  const temperLevel = ref(0)
  const foundationGrade = ref(-1)
  const coreGrade = ref(-1)
  const soulAspect = ref('')
  const scarDepth = ref(0)
  const scarHealProgress = ref(0)
  const scarHealedDepth = ref(0)
  const milestones = ref<number[]>([])

  // ---- Buyable amounts (semantic keys replace TMT numeric ids) ------------
  function buyableAmount(key: BodyBuyableKey): number {
    if (key === 'primaryMeridian') return primaryMeridians.value
    if (key === 'extraordinaryMeridian') return extraordinaryMeridians.value
    if (key === 'temper') return temperLevel.value
    return 0
  }

  function buyableCost(key: BodyBuyableKey, amount: number): Decimal {
    const row = findBodyBuyable(key)
    return new Decimal(row.costBase).times(Decimal.pow(row.costRatio, amount))
  }

  function canAffordBuyable(key: BodyBuyableKey): boolean {
    const row = findBodyBuyable(key)
    const amount = buyableAmount(key)
    if (amount >= row.limit) return false
    // Unlock gate (extraordinary meridians gated on primaryMeridiansAll + q 10th Level).
    if (row.unlock !== null) {
      if (!meets(row.unlock, buildGameState())) return false
    }
    return game.points.gte(buyableCost(key, amount))
  }

  function buyBuyable(key: BodyBuyableKey): boolean {
    if (!canAffordBuyable(key)) return false
    const amount = buyableAmount(key)
    const cost = buyableCost(key, amount)
    game.points = game.points.sub(cost).max(0)
    if (key === 'primaryMeridian') primaryMeridians.value++
    else if (key === 'extraordinaryMeridian') extraordinaryMeridians.value++
    else if (key === 'temper') {
      temperLevel.value++
      // Latch temper tier milestones (the per-tier qiBonus grants).
      const tier = temperTierForLevel(temperLevel.value)
      if (tier) {
        const tierIndex = BODY_DATA.temperTiers.indexOf(tier)
        if (tierIndex >= 0 && !milestones.value.includes(tierIndex)) {
          milestones.value = [...milestones.value, tierIndex]
        }
      }
    }
    return true
  }

  // ---- Pipeline multipliers ------------------------------------------------
  const qiBaseRate = new Decimal(BODY_DATA.qi.baseRate)

  /** Meridian mult: product of effectBase^amount for primary + extraordinary. */
  const meridianMult = computed<Decimal>(() => {
    let product = decimalOne()
    const primary = findBodyBuyable('primaryMeridian')
    const extra = findBodyBuyable('extraordinaryMeridian')
    product = product.times(Decimal.pow(primary.effectBase, primaryMeridians.value))
    product = product.times(Decimal.pow(extra.effectBase, extraordinaryMeridians.value))
    return product
  })

  /** Temper mult: product of each reached tier's qiBonus (per-tier milestones). */
  const temperMult = computed<Decimal>(() => {
    let product = decimalOne()
    BODY_DATA.temperTiers.forEach((tier, index) => {
      if (milestones.value.includes(index)) product = product.times(tier.qiBonus)
    })
    return product
  })

  /** Current temper tier key, or null if level 0. */
  const temperTierKey = computed<TemperTierKey | null>(() => temperTierForLevel(temperLevel.value)?.key ?? null)

  // ---- Soul Aspect pick (one-shot, meets-gated) --------------------------
  /**
   * Bind the soul to an aspect. One-shot per life: no-op if already chosen.
   * The aspect's `requires` condition is re-verified at fire time (defensive
   * against a cached UI racing a state change). Returns true on success.
   */
  function setSoulAspect(aspectKey: string, requiresCondition: Condition): boolean {
    if (soulAspect.value !== '') return false
    if (!meets(requiresCondition, buildGameState())) return false
    soulAspect.value = aspectKey
    return true
  }

  /** True once any aspect is chosen this life. */
  const soulAspectChosen = computed(() => soulAspect.value !== '')

  // ---- Milestone helpers (for keep rules, automation grants) --------------
  function hasMilestone(index: number): boolean {
    return milestones.value.includes(index)
  }

  // ---- Update hook --------------------------------------------------------
  function update(diff: number): void {
    // Scar heal tick (passive accrual; converts depth → healedDepth over time).
    useScarStore().scarHealTick(diff)
  }

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return {
      primaryMeridians: primaryMeridians.value,
      extraordinaryMeridians: extraordinaryMeridians.value,
      temperLevel: temperLevel.value,
      foundationGrade: foundationGrade.value,
      coreGrade: coreGrade.value,
      soulAspect: soulAspect.value,
      scarDepth: scarDepth.value,
      scarHealProgress: scarHealProgress.value,
      scarHealedDepth: scarHealedDepth.value,
      milestones: milestones.value,
    } satisfies BodySlice
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshBodySlice()) as Partial<BodySlice>
    primaryMeridians.value = s.primaryMeridians ?? 0
    extraordinaryMeridians.value = s.extraordinaryMeridians ?? 0
    temperLevel.value = s.temperLevel ?? 0
    foundationGrade.value = s.foundationGrade ?? -1
    coreGrade.value = s.coreGrade ?? -1
    soulAspect.value = s.soulAspect ?? ''
    scarDepth.value = s.scarDepth ?? 0
    scarHealProgress.value = s.scarHealProgress ?? 0
    scarHealedDepth.value = s.scarHealedDepth ?? 0
    milestones.value = [...(s.milestones ?? [])]
  }
  function fresh(): Record<string, unknown> {
    return freshBodySlice() as unknown as Record<string, unknown>
  }

  return {
    primaryMeridians,
    extraordinaryMeridians,
    temperLevel,
    foundationGrade,
    coreGrade,
    soulAspect,
    scarDepth,
    scarHealProgress,
    scarHealedDepth,
    milestones,
    qiBaseRate,
    meridianMult,
    temperMult,
    temperTierKey,
    buyableAmount,
    buyableCost,
    canAffordBuyable,
    buyBuyable,
    setSoulAspect,
    soulAspectChosen,
    hasMilestone,
    update,
    save,
    load,
    fresh,
  }
})

export { decimalOne, decimalZero }
