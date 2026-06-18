// src/stores/dao.ts — Dao lattice + stances (LIFE-scoped).
//
// M3 STUB: returns identity values so the Qi/Insight pipelines compile. Full
// graph logic (nodes, tiers, stances, discounts) lands in M4.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalZero } from '@/engine/decimal'
import type { LatticeNodeKey, StanceKey } from '@/engine/types'

export interface DaoSlice {
  insight: string
  activeStance: string
  revealed: boolean
  nodeTiers: Record<string, number>
}

export function freshDaoSlice(): DaoSlice {
  return { insight: '0', activeStance: '', revealed: false, nodeTiers: {} }
}

export const useDaoStore = defineStore('dao', () => {
  const insight = ref(decimalZero())
  const activeStance = ref<StanceKey | ''>('')
  const revealed = ref(false)
  const nodeTiers = ref<Record<string, number>>({})

  /** Tier owned for a node (0 = none, 1 = Glimpse, 2 = Seed). M4 implements buying. */
  function nodeTierOwned(key: LatticeNodeKey): number {
    return nodeTiers.value[key] ?? 0
  }

  function update(_diff: number): void {
    // M4: insight trickle, reveal latch, stance self-heal.
  }

  function save(): Record<string, unknown> {
    return {
      insight: insight.value.toString(),
      activeStance: activeStance.value,
      revealed: revealed.value,
      nodeTiers: nodeTiers.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshDaoSlice()) as Partial<DaoSlice>
    insight.value = new Decimal(s.insight ?? '0')
    activeStance.value = (s.activeStance ?? '') as StanceKey | ''
    revealed.value = s.revealed ?? false
    nodeTiers.value = { ...(s.nodeTiers ?? {}) }
  }
  function fresh(): Record<string, unknown> {
    return freshDaoSlice() as unknown as Record<string, unknown>
  }

  return { insight, activeStance, revealed, nodeTiers, nodeTierOwned, update, save, load, fresh }
})
