// src/stores/gate.ts — story-gate achievements (LIFE-scoped).
//
// Port of the factory's gate layer. Achievements latch when their `done()`
// condition is met. Each achievement carries an optional qiMult effect folded
// into the Qi pipeline (gateMult). IDs are positional + 11 (matching TMT convention).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { GATE_DATA } from '@/data/gates'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'

export interface GateSlice {
  unlocked: boolean
  achievements: number[]
}

export function freshGateSlice(): GateSlice {
  return { unlocked: true, achievements: [] }
}

const GATE_ACHIEVEMENT_ID_OFFSET = 11

export const useGateStore = defineStore('gate', () => {
  const achievements = ref<number[]>([])

  /** Set of earned achievement ids (positional + offset). */
  const earnedIds = computed(() => {
    const set = new Set<number>()
    for (let i = 0; i < GATE_DATA.achievements.length; i++) {
      if (achievements.value.includes(i + GATE_ACHIEVEMENT_ID_OFFSET)) {
        set.add(i + GATE_ACHIEVEMENT_ID_OFFSET)
      }
    }
    return set
  })

  /** Check if an achievement (by index) is earned. */
  function hasAchievement(index: number): boolean {
    return achievements.value.includes(index + GATE_ACHIEVEMENT_ID_OFFSET)
  }

  /** Latch any achievements whose done() condition is met. */
  function latchAchievements(): void {
    const state = buildGameState()
    const earned = new Set(achievements.value)
    for (let i = 0; i < GATE_DATA.achievements.length; i++) {
      const id = i + GATE_ACHIEVEMENT_ID_OFFSET
      if (earned.has(id)) continue
      const ach = GATE_DATA.achievements[i]!
      if (meets(ach.done, state)) earned.add(id)
    }
    achievements.value = [...earned].sort((a, b) => a - b)
  }

  /** Product of earned gate qiMults (the gateMult pipeline factor). */
  const gateMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (let i = 0; i < GATE_DATA.achievements.length; i++) {
      if (!hasAchievement(i)) continue
      const ach = GATE_DATA.achievements[i]!
      if (ach.effect.qiMult) {
        product = product.times(ach.effect.qiMult)
      }
    }
    return product
  })

  function update(_diff: number): void {
    latchAchievements()
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

  return {
    achievements,
    earnedIds,
    hasAchievement,
    latchAchievements,
    gateMult,
    update,
    save,
    load,
    fresh,
  }
})
