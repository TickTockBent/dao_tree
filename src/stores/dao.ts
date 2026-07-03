// src/stores/dao.ts — Dao lattice + stances (LIFE-scoped).
//
// Port of the factory's makeDaoLayer + dao readers. The Dao lattice is the
// second grammar: a comprehension graph that NEVER resets within a life. Its
// currency is Insight, which trickles passively once the lattice is revealed
// at Qi Condensation 4th Level. Nodes are bought with Insight; stances are
// free toggles with an opportunity cost (§6.1).
//
// The graph is derived from LATTICE_DATA.nodes (25 nodes: 5 roots + 5 ring-2 +
// 5 ring-2b + 10 ring-3, slice 9 / D22) + `requires` edges.
//
// Act II gate (slice 9): buying ANY node's Manifestation tier, OR ANY tier of
// a ring-3 node, additionally requires the passed tribulation
// (meets({ tribulationPassed })), enforced HERE in the buy path — not by
// price alone — so Act I's pinned pacing bands cannot move because this
// content exists in data (ring-3's Glimpse/Seed had to be gated too: the
// Realistic sim actor's lattice buyer is UNCAPPED — unlike Competent's
// 8-Seed target — so over a long run it eventually affords ring-3 from
// banked Insight alone, and the extra qi/insightMult stacking moved the
// pinned Realistic band). The flow/stillness `conflicts` pair BINDS at
// Manifestation: the two may hold Glimpse/Seed freely, but the purchase that
// would put both at tier 3 is refused. Kept data-driven off
// LATTICE_DATA.conflicts and the graph's own shape — no hardcoded keys.

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

  /** 0-indexed position of the Manifestation tier in `costs`/`effects` (owned tier becomes 3). */
  const MANIFESTATION_TIER_INDEX = 2

  /** True if the passed-tribulation gate is met (slice 9's core meets() grammar). */
  function tribulationGateMet(): boolean {
    return meets({ tribulationPassed: true }, buildGameState())
  }

  /**
   * True if `key` is a ring-3 node — structurally, one that requires a node
   * which itself has a prerequisite (depth 2 from a root). Derived from the
   * graph shape, not a hardcoded key list, so it stays correct if the ring
   * grows again later.
   */
  function isRing3Node(key: LatticeNodeKey): boolean {
    const node = findLatticeNode(key)
    const parentKey = node.requires[0]
    if (!parentKey) return false
    return findLatticeNode(parentKey).requires.length > 0
  }

  /**
   * True if the NEXT tier purchase of `key` needs the passed-tribulation
   * gate: any node's Manifestation tier (D22's severable-grade power), OR
   * ANY tier of a ring-3 node — ring-3 is whole-cloth Act II content, not
   * just its Manifestation peak. Without gating ring-3's Glimpse/Seed too,
   * an unbounded cheapest-first buyer (the Realistic sim actor has no Seed
   * cap, unlike Competent) eventually affords them mid-Act-I from banked
   * Insight alone and the extra qi/insightMult stacking moves the pinned
   * pacing bands — caught by `npm run sim` during this slice's implementation.
   */
  function needsTribulationGate(key: LatticeNodeKey, nextTierIndex: number): boolean {
    return nextTierIndex === MANIFESTATION_TIER_INDEX || isRing3Node(key)
  }

  /** The other node key in a `conflicts` pair containing `key`, or null (data-driven, no hardcoded keys). */
  function conflictPartner(key: LatticeNodeKey): LatticeNodeKey | null {
    for (const [a, b] of LATTICE_DATA.conflicts) {
      if (a === key) return b
      if (b === key) return a
    }
    return null
  }

  /**
   * True if buying `key`'s Manifestation tier would violate its `conflicts`
   * pairing — i.e. the partner already holds Manifestation. Glimpse/Seed on
   * both sides of a conflict pair is always fine; only tier 3 binds (D22).
   */
  function manifestationConflictBlocks(key: LatticeNodeKey): boolean {
    const partner = conflictPartner(key)
    if (!partner) return false
    return nodeTierOwned(partner) >= MANIFESTATION_TIER_INDEX + 1
  }

  function canAffordNode(key: LatticeNodeKey): boolean {
    if (!nodeRequirementsMet(key)) return false
    const node = findLatticeNode(key)
    const nextTierIndex = nodeTierOwned(key)
    if (nextTierIndex >= node.costs.length) return false
    if (needsTribulationGate(key, nextTierIndex)) {
      if (!tribulationGateMet()) return false
      if (nextTierIndex === MANIFESTATION_TIER_INDEX && manifestationConflictBlocks(key)) return false
    }
    return insight.value.gte(nodeCost(key))
  }

  /**
   * Human-legible reason the NEXT tier purchase of `key` is currently
   * refused, or null if it is buyable (or already maxed — nothing to refuse).
   * Surfaced by the lattice graph so a conflict-blocked or pre-tribulation
   * attempt is legible, not just silently inert (§4.2/D22).
   */
  function nodeBuyBlockReason(key: LatticeNodeKey): string | null {
    const node = findLatticeNode(key)
    if (!nodeRequirementsMet(key)) return 'Requires a prerequisite Glimpse first.'
    const nextTierIndex = nodeTierOwned(key)
    if (nextTierIndex >= node.costs.length) return null
    if (needsTribulationGate(key, nextTierIndex)) {
      if (!tribulationGateMet()) return 'Act II content — pass the First Tribulation first.'
      const partner = conflictPartner(key)
      if (nextTierIndex === MANIFESTATION_TIER_INDEX && partner && manifestationConflictBlocks(key)) {
        return `${findLatticeNode(partner).name} already holds Manifestation — the two cannot both stand at that depth.`
      }
    }
    if (insight.value.lt(nodeCost(key))) return 'Not enough Insight yet.'
    return null
  }

  /** Buy the next tier of a lattice node. Returns true on success. */
  function buyNodeTier(key: LatticeNodeKey): boolean {
    if (!canAffordNode(key)) return false
    const cost = nodeCost(key)
    insight.value = insight.value.sub(cost).max(0)
    nodeTiers.value = { ...nodeTiers.value, [key]: nodeTierOwned(key) + 1 }
    return true
  }

  /**
   * Grant a FREE Glimpse (tier 1) of a node — the secret-realm first-clear
   * find (slice 7, §6.4 "Dao Glimpses" as expedition rewards). Only fires on
   * an unowned node; deliberately bypasses cost AND prereq edges (a glimpse
   * found in a pocket world, not climbed to). Higher tiers still go through
   * buyNodeTier, whose canAffordNode keeps enforcing prereqs.
   */
  function grantGlimpse(key: LatticeNodeKey): boolean {
    if (nodeTierOwned(key) > 0) return false
    nodeTiers.value = { ...nodeTiers.value, [key]: 1 }
    return true
  }

  /** Deposit an Insight surge (secret-realm completion reward, §7.3 epiphany source). */
  function addInsight(amount: Decimal): void {
    insight.value = insight.value.add(amount).max(0)
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
    tribulationGateMet,
    isRing3Node,
    manifestationConflictBlocks,
    nodeBuyBlockReason,
    buyNodeTier,
    grantGlimpse,
    addInsight,
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
