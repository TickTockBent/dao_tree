// src/stores/chronicle.ts — the chronicle (slice 10 / D37 §5).
//
// SCOPE: world (TREE_DATA layer 'chronicle', D37) — the founding WORLD-scope
// instance. The world's record of your lives: it persists after death and
// belongs to no soul. ONE schema, THREE consumers (D37): karma computation at
// death, epitaph rendering, and future shrine/strand reads.
//
// STATUS (skeleton): the per-life entry schema (incl. richness tiers + the
// strand reserve fields) and writeLife ship here; NOTHING calls writeLife yet
// (the step-7 chronicle agent writes the entry at the crossing). Inert.
//
// CURATION (D37, schema-level not post-hoc): the chronicle obeys wider-not-
// taller (#21) as a VOLUME constraint expressed as curation. Each entry carries
// a RICHNESS TIER driven by the karma receipt (the novelty measure already
// exists): founding lives get chapters, the middle era gets summaries, only
// exceptional late lives get full treatment. A thousand-life save reads like a
// dynasty history, not a log file.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RealmId, SeverableKey, TribGradeKey } from '@/engine/types'

/**
 * Per-entry richness tier (D37). Driven by the karma receipt at write time:
 *   - 'chapter' — a founding or exceptionally novel life (full treatment).
 *   - 'summary' — the middle era (briefer).
 *   - 'line'    — an unremarkable late life (a single epitaph line).
 */
export type RichnessTier = 'chapter' | 'summary' | 'line'

/** The grades a life earned (personal-best snapshots; null when never reached). */
export interface ChronicleGrades {
  readonly legacy: string | null
  readonly foundation: string | null
  readonly core: string | null
  readonly tribulation: string | null
}

/** The karma-receipt summary folded into the entry (the curation signal). */
export interface FirstsReceiptSummary {
  readonly total: number
  readonly milestoneHeadline: number
  readonly milestoneEcho: number
  readonly deedEncounter: number
  readonly gradeDelta: number
}

/**
 * One life's chronicle entry (§5). Strand reserve fields ship in the schema
 * (all empty until the strand arcs): strands held / matured / transmitted /
 * torn — reserved so the schema is complete from day one (Act III shrines read
 * it).
 */
export interface ChronicleEntry {
  readonly lifeNumber: number
  readonly realmReached: RealmId | null
  readonly grades: ChronicleGrades
  readonly tribulationOutcome: TribGradeKey | null
  /** Root configuration — null pre-roots (roots ship in step 5). */
  readonly rootConfig: null
  readonly severances: readonly SeverableKey[]
  /** Per demon-trial-key endured counts this life. */
  readonly trialsEndured: Readonly<Record<string, number>>
  readonly firstsReceipt: FirstsReceiptSummary
  readonly richnessTier: RichnessTier
  // ---- Strand reserve fields (empty until the strand arcs) ----
  readonly strandsHeld: readonly unknown[]
  readonly strandsMatured: readonly unknown[]
  readonly strandsTransmitted: readonly unknown[]
  readonly strandsTorn: readonly unknown[]
}

export interface ChronicleSlice {
  entries: ChronicleEntry[]
}

export function freshChronicleSlice(): ChronicleSlice {
  return { entries: [] }
}

export const useChronicleStore = defineStore('chronicle', () => {
  const entries = ref<ChronicleEntry[]>([])

  const lives = computed<readonly ChronicleEntry[]>(() => entries.value)
  const lifeCount = computed(() => entries.value.length)

  /**
   * Append a life's entry (D37 §5). NOTHING CALLS THIS YET — the step-7
   * chronicle agent writes the entry at the crossing, driving the richness tier
   * off the karma receipt.
   */
  function writeLife(entry: ChronicleEntry): void {
    entries.value = [...entries.value, entry]
  }

  // ---- Save slice (id 'chronicle') ----------------------------------------
  function save(): Record<string, unknown> {
    return { entries: entries.value.map((entry) => ({ ...entry })) }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshChronicleSlice()) as Partial<ChronicleSlice>
    entries.value = Array.isArray(s.entries) ? [...s.entries] : []
  }
  function fresh(): Record<string, unknown> {
    return freshChronicleSlice() as unknown as Record<string, unknown>
  }

  return { entries, lives, lifeCount, writeLife, save, load, fresh }
})
