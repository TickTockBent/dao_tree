// src/stores/sect.ts — Sect standing + techniques (LIFE-scoped).
//
// M3 STUB: returns identity values so the Qi pipeline compiles. Full archetype
// pick, contribution accrual, milestones, techniques land in M6.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalZero } from '@/engine/decimal'
import type { SectArchetypeKey } from '@/engine/types'

export interface SectSlice {
  archetype: string
  contribution: string
  best: string
  revealed: boolean
  techniques: number[]
  milestones: number[]
}

export function freshSectSlice(): SectSlice {
  return { archetype: '', contribution: '0', best: '0', revealed: false, techniques: [], milestones: [] }
}

export const useSectStore = defineStore('sect', () => {
  const archetype = ref<SectArchetypeKey | ''>('')
  const contribution = ref(decimalZero())
  const best = ref(decimalZero())
  const revealed = ref(false)
  const techniques = ref<number[]>([])
  const milestones = ref<number[]>([])

  const joined = computed(() => archetype.value !== '')
  const contributionBestDecimal = computed(() => best.value)

  function hasMilestone(index: number): boolean {
    return milestones.value.includes(index)
  }

  function update(_diff: number): void {
    // M6: contribution accrual, milestone latches.
  }

  function save(): Record<string, unknown> {
    return {
      archetype: archetype.value,
      contribution: contribution.value.toString(),
      best: best.value.toString(),
      revealed: revealed.value,
      techniques: techniques.value,
      milestones: milestones.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshSectSlice()) as Partial<SectSlice>
    archetype.value = (s.archetype ?? '') as SectArchetypeKey | ''
    contribution.value = new Decimal(s.contribution ?? '0')
    best.value = new Decimal(s.best ?? '0')
    revealed.value = s.revealed ?? false
    techniques.value = [...(s.techniques ?? [])]
    milestones.value = [...(s.milestones ?? [])]
  }
  function fresh(): Record<string, unknown> {
    return freshSectSlice() as unknown as Record<string, unknown>
  }

  return {
    archetype,
    contribution,
    best,
    revealed,
    techniques,
    milestones,
    joined,
    contributionBestDecimal,
    hasMilestone,
    update,
    save,
    load,
    fresh,
  }
})
