// src/stores/dao.ts — Dao lattice + stances (LIFE-scoped).
//
// Port of the factory's makeDaoLayer + dao readers. The Dao lattice is the
// second grammar: a comprehension graph that NEVER resets within a life. Its
// currency is Insight, which trickles passively once the lattice is revealed
// at Qi Condensation 4th Level. Nodes are bought with Insight; stances are
// free toggles with an opportunity cost (§6.1).
//
// The graph is derived from LATTICE_DATA.nodes (15 nodes: 5 roots + 5 ring-2 +
// 5 ring-2b) + `requires` edges. Conflicts bind at Manifestation tier (Act II).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { LATTICE_DATA, findLatticeNode } from '@/data/lattice'
import { STANCE_DATA, findStance } from '@/data/stances'
import { findSectArchetype } from '@/data/sect'
import { usePipelinesStore } from './pipelines'
import { useSectStore } from './sect'
import type { Element, LatticeNodeKey, StanceKey } from '@/engine/types'

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
  const sect = useSectStore()
  const pipelines = usePipelinesStore()

  const insight = ref(decimalZero())
  const activeStance = ref<StanceKey | ''>('')
  const revealed = ref(false)
  const nodeTiers = ref<Record<string, number>>({})

  // ---- Node tier reads ----------------------------------------------------

  /** Tier owned for a node (0 = none, 1 = Glimpse, 2 = Seed). */
  function nodeTierOwned(key: LatticeNodeKey): number {
    return nodeTiers.value[key] ?? 0
  }

  /** Count of nodes owned at tier >= 2 (Seed) — for legacy score + aspect gates. */
  function heldDaoSeedCount(): number {
    return LATTICE_DATA.nodes.filter((n) => nodeTierOwned(n.key) >= 2).length
  }

  /** Max tier owned across all nodes of an element (for soul aspect gates). */
  function elementMaxTier(element: Element): number {
    let max = 0
    for (const node of LATTICE_DATA.nodes) {
      if (node.element !== element) continue
      const tier = nodeTierOwned(node.key)
      if (tier > max) max = tier
    }
    return max
  }

  // ---- Sect lattice discount (§4.3) ---------------------------------------

  /** Cost multiplier for a node's element: archetype discount if matched, else 1. */
  function sectLatticeDiscount(element: Element): Decimal {
    if (!sect.joined) return decimalOne()
    const archetype = findSectArchetype(sect.archetype as Exclude<typeof sect.archetype, ''>)
    if (!archetype || archetype.element !== element) return decimalOne()
    return new Decimal(archetype.latticeDiscount)
  }

  /** Cost for the NEXT tier of a node (with sect discount, floored, min 1). */
  function nodeCost(key: LatticeNodeKey): Decimal {
    const node = findLatticeNode(key)
    const nextTierIndex = nodeTierOwned(key)
    if (nextTierIndex >= node.costs.length) return decimalZero()
    const baseCost = new Decimal(node.costs[nextTierIndex]!)
    return baseCost.times(sectLatticeDiscount(node.element)).floor().max(decimalOne())
  }

  // ---- Node purchase ------------------------------------------------------

  /** True if all prerequisite nodes own at least a Glimpse (tier >= 1). */
  function nodeRequirementsMet(key: LatticeNodeKey): boolean {
    const node = findLatticeNode(key)
    return node.requires.every((req) => nodeTierOwned(req) >= 1)
  }

  function canAffordNode(key: LatticeNodeKey): boolean {
    if (!nodeRequirementsMet(key)) return false
    const node = findLatticeNode(key)
    if (nodeTierOwned(key) >= node.costs.length) return false
    return insight.value.gte(nodeCost(key))
  }

  /** Buy the next tier of a lattice node. Returns true on success. */
  function buyNodeTier(key: LatticeNodeKey): boolean {
    if (!canAffordNode(key)) return false
    const cost = nodeCost(key)
    insight.value = insight.value.sub(cost).max(0)
    nodeTiers.value = { ...nodeTiers.value, [key]: nodeTierOwned(key) + 1 }
    return true
  }

  // ---- Stances ------------------------------------------------------------

  /** The active stance row, or null. Self-heals if unlock unmet (§6.1 safety). */
  const activeStanceRow = computed(() => {
    const key = activeStance.value
    if (!key) return null
    const stance = STANCE_DATA.stances.find((s) => s.key === key) ?? null
    if (stance && !meets(stance.unlock, buildGameState())) {
      activeStance.value = ''
      return null
    }
    return stance
  })

  /** Toggle a stance: if active, deactivate; otherwise activate (exclusive, maxActive 1). */
  function toggleStance(key: StanceKey): void {
    const stance = findStance(key)
    if (!meets(stance.unlock, buildGameState())) return
    if (activeStance.value === key) {
      activeStance.value = ''
    } else {
      activeStance.value = key
    }
  }

  // ---- Reveal + update ----------------------------------------------------

  /** True if the reveal gate (q 4th Level) is met. */
  function isRevealGateMet(): boolean {
    return meets(LATTICE_DATA.unlock, buildGameState())
  }

  /** True if the lattice is visible (latched or gate met). */
  function isRevealed(): boolean {
    return revealed.value || isRevealGateMet()
  }

  function update(diff: number): void {
    // Latch the reveal flag the first tick the gate is met.
    if (!revealed.value && isRevealGateMet()) {
      revealed.value = true
    }
    if (!revealed.value) return

    // Accrue Insight (no pre-unlock banking, §4.2).
    const rate = pipelines.insightPerSecond
    if (rate.gt(0)) {
      insight.value = insight.value.add(rate.times(diff)).max(0)
    }

    // Stance self-heal: if the active stance's unlock is no longer met, drop it.
    // (Re-evaluated via the activeStanceRow computed; the assignment there clears it.)
    void activeStanceRow.value
  }

  // ---- Save slice ---------------------------------------------------------
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

  return {
    insight,
    activeStance,
    revealed,
    nodeTiers,
    nodeTierOwned,
    heldDaoSeedCount,
    elementMaxTier,
    nodeCost,
    nodeRequirementsMet,
    canAffordNode,
    buyNodeTier,
    activeStanceRow,
    toggleStance,
    isRevealGateMet,
    isRevealed,
    update,
    save,
    load,
    fresh,
  }
})
