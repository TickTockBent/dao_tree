// src/stores/body.ts — Body system (meridians, temper, stored grades, scar slot).
//
// M1 skeleton: only qiBaseRate + trivial meridian/temper multipliers so the
// Qi pipeline produces a nonzero rate. Full meridian/temper/grade/scar logic
// lands in M4.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'

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
}

export function freshBodySlice(): BodySlice {
  return {
    primaryMeridians: 0,
    extraordinaryMeridians: 0,
    temperLevel: 0,
    foundationGrade: -1,
    coreGrade: -1,
    soulAspect: '',
    scarDepth: 0,
    scarHealProgress: 0,
    scarHealedDepth: 0,
  }
}

export const useBodyStore = defineStore('body', () => {
  const primaryMeridians = ref(0)
  const extraordinaryMeridians = ref(0)
  const temperLevel = ref(0)
  const foundationGrade = ref(-1)
  const coreGrade = ref(-1)
  const soulAspect = ref('')
  const scarDepth = ref(0)
  const scarHealProgress = ref(0)
  const scarHealedDepth = ref(0)

  // M1 placeholder rates — replaced by data-driven values in M2/M4.
  const qiBaseRate = new Decimal(1)
  const meridianMult = computed(() => decimalOne().add(primaryMeridians.value * 0.25))
  const temperMult = computed(() => decimalOne().add(temperLevel.value * 0.05))

  function update(_diff: number): void {
    // Scar heal tick + temper tier latches land in M4.
  }

  function buyPrimaryMeridian(): void {
    if (primaryMeridians.value >= 12) return
    primaryMeridians.value++
  }

  function buyTemper(): void {
    if (temperLevel.value >= 24) return
    temperLevel.value++
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
    qiBaseRate,
    meridianMult,
    temperMult,
    update,
    buyPrimaryMeridian,
    buyTemper,
    save,
    load,
    fresh,
  }
})

export { decimalZero }
