// src/stores/tribulation.ts — the First Tribulation (set-piece instance 2).
//
// M3 STUB: tribulationPassed returns false until M5 implements the run. The
// store exists so state.ts/journal/hints compile.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalZero } from '@/engine/decimal'
import { SETPIECE_DATA } from '@/data/setpieces'

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

export const useTribulationStore = defineStore('tribulation', () => {
  const tribActive = ref(false)
  const tribElapsed = ref(0)
  const tribPool = ref(decimalZero())
  const tribPoolMax = ref(decimalZero())
  const tribWaveIndex = ref(0)
  const tribGrade = ref(-1)
  const tribCooldownUntil = ref(0)

  /** True if the tribulation has been passed (grade resolves to passes:true). */
  const tribulationPassed = computed(() => {
    if (tribGrade.value < 0) return false
    const grades = SETPIECE_DATA.firstTribulation.grades
    const row = grades[tribGrade.value]
    return row ? row.passes : false
  })

  /** True if ready to begin (trigger met, not passed, not active, cooldown elapsed). M5 full impl. */
  const tribulationIsReady = computed(() => false)

  function update(_diff: number): void {
    // M5: tribulationTick.
  }

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
    tribulationIsReady,
    update,
    save,
    load,
    fresh,
  }
})
