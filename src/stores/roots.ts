// src/stores/roots.ts — spiritual roots (LIFE-scoped; slice 10 step 5 / D38).
//
// SCOPE: life (TREE_DATA layer 'roots', D37 — "roots → life-scoped configuration
// purchased at rebirth"). A root is CHOSEN at the rebirth menu and applies to the
// NEXT life; it dies at that life's death and is re-chosen (or not) at the next
// crossing. Default = ROOTLESS (no elements): zero discounts, the D38 baseline
// invariant — a rootless life's lattice costs are byte-identical to today's game
// (the multiplier is exactly 1, so dao.nodeCost is unchanged).
//
// v1 EFFECT (D38 read #3): lattice-region Insight-cost DISCOUNTS ONLY, and the
// discount is SPEED, NEVER ACCESS — it lowers the cost of nodes whose element the
// root holds and touches no gate. Applied at the single dao cost path
// (dao.nodeCost). Purity scales the discount magnitude (Mortal none → Heaven
// full). Profession affinity + aspect-menu coloring are future domains (D38).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { rootDiscountFraction, type PurityGrade, type RootConfig } from '@/data/rebirth'
import type { Element } from '@/engine/types'

export interface RootsSlice {
  elements: Element[]
  purity: PurityGrade
}

/** Mortal is the free default purity — a rootless life sits here (no power). */
const DEFAULT_PURITY: PurityGrade = 'mortal'

export function freshRootsSlice(): RootsSlice {
  return { elements: [], purity: DEFAULT_PURITY }
}

export const useRootsStore = defineStore('roots', () => {
  const elements = ref<Element[]>([])
  const purity = ref<PurityGrade>(DEFAULT_PURITY)

  /** True once a root has been declared (≥ 1 element). Rootless is the default. */
  const isRooted = computed(() => elements.value.length > 0)

  /** The live config, or null when rootless (what the chronicle records). */
  const config = computed<RootConfig | null>(() =>
    isRooted.value ? { elements: [...elements.value], purity: purity.value } : null,
  )

  /** True if the root holds `element`. */
  function holdsElement(element: Element): boolean {
    return elements.value.includes(element)
  }

  /**
   * The Insight-cost MULTIPLIER (≤ 1) for a node of `element`: identity (exactly
   * 1) when rootless or the element is not held; otherwise (1 − discountFraction)
   * scaled by purity. SPEED, NEVER ACCESS — read only by dao.nodeCost, never by a
   * gate. Rootless → 1 everywhere → dao costs byte-identical to today (the
   * baseline invariant the sim relies on: no sim actor ever roots).
   */
  function latticeDiscountMultiplier(element: Element): Decimal {
    if (!isRooted.value || !holdsElement(element)) return decimalOne()
    const fraction = rootDiscountFraction(elements.value.length, purity.value)
    return decimalOne().sub(fraction)
  }

  /**
   * Set this life's root config (called post-cascade by the crossing). An empty
   * element list means rootless (purity coerced to the default — no power without
   * an identity).
   */
  function configure(nextElements: readonly Element[], nextPurity: PurityGrade): void {
    if (nextElements.length === 0) {
      elements.value = []
      purity.value = DEFAULT_PURITY
      return
    }
    elements.value = [...nextElements]
    purity.value = nextPurity
  }

  // ---- Save slice (id 'roots') --------------------------------------------
  function save(): Record<string, unknown> {
    return { elements: [...elements.value], purity: purity.value }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshRootsSlice()) as Partial<RootsSlice>
    elements.value = Array.isArray(s.elements) ? [...s.elements] : []
    purity.value = s.purity ?? DEFAULT_PURITY
  }
  function fresh(): Record<string, unknown> {
    return freshRootsSlice() as unknown as Record<string, unknown>
  }

  return {
    elements,
    purity,
    isRooted,
    config,
    holdsElement,
    latticeDiscountMultiplier,
    configure,
    save,
    load,
    fresh,
  }
})
