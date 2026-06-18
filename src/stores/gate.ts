// src/stores/gate.ts — story-gate achievements (LIFE-scoped).
//
// M3 STUB: empty achievement set so meets()/state.ts compile. Full latch logic
// (done() evaluation, effect.qiMult pipeline) lands in M6.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { GATE_DATA } from '@/data/gates'

export interface GateSlice {
  unlocked: boolean
  achievements: number[]
}

export function freshGateSlice(): GateSlice {
  return { unlocked: true, achievements: [] }
}

export const useGateStore = defineStore('gate', () => {
  // Gate achievement ids are positional + this offset (matches the old TMT convention).
  const GATE_ACHIEVEMENT_ID_OFFSET = 11
  const achievements = ref<number[]>([])

  /** Set of earned achievement ids (positional + offset). */
  const earnedIds = computed(() => new Set(achievements.value))

  /** Product of earned gate qiMults (the gateMult pipeline factor). */
  const gateMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const ach of GATE_DATA.achievements) {
      const id = GATE_ACHIEVEMENT_ID_OFFSET + GATE_DATA.achievements.indexOf(ach)
      if (achievements.value.includes(id) && ach.effect.qiMult) {
        product = product.times(ach.effect.qiMult)
      }
    }
    return product
  })

  function hasAchievement(id: number): boolean {
    return achievements.value.includes(id)
  }

  function update(_diff: number): void {
    // M6: evaluate done() conditions, latch achievements, fire popups.
  }

  function save(): Record<string, unknown> {
    return { unlocked: true, achievements: achievements.value }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshGateSlice()) as Partial<GateSlice>
    achievements.value = [...(s.achievements ?? [])]
  }
  function fresh(): Record<string, unknown> {
    return freshGateSlice() as unknown as Record<string, unknown>
  }

  return { achievements, earnedIds, gateMult, hasAchievement, update, save, load, fresh }
})
