// src/stores/karma.ts — the karma accumulator (slice 10 / D36 + D40).
//
// SCOPE: soul (TREE_DATA layer 'karma', D37) — the heavens pay the SOUL for
// firsts; the balance and the lifetime firsts history carry across rebirth.
//
// STATUS (skeleton): state + the receipt math + the settle/fold plumbing are
// REAL and unit-tested, but NOTHING calls recordFirst / settleLife yet — the
// step-4 rebirth-mechanics agent wires the ledger to real events and pays the
// receipt at the crossing. Inert until then.
//
// THE MODEL (D40):
//   - A first = an EVENT KEY × a resolved QUALIFIER TUPLE. recordFirst appends
//     one ledger entry per distinct first earned this life (deduped).
//   - previewReceipt reads the ledger against the lifetime firsts history and
//     computes what it WOULD pay: the bare headline pays full `base × rⁿ` once
//     ever; each qualified variant pays `VARIANT_SHARE × base × rⁿ`; n = prior
//     lives that earned that exact first; floor f = 0 (D36).
//   - settleLife pays the receipt into the balance, folds the ledger into the
//     history (each first's n increments by 1), and clears the ledger.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  KARMA_DATA,
  KARMA_DECAY_RATIO,
  KARMA_FLOOR,
  VARIANT_SHARE,
} from '@/data/karma'
import type { KarmaClass, KarmaEventRow } from '@/data/karma'

/** A resolved qualifier tuple: axis name → concrete value (e.g. buildMark → 'meridian'). */
export type ResolvedQualifiers = Readonly<Record<string, string>>

/** One first recorded in the current life's ledger (timestamp-free). */
export interface KarmaLedgerEntry {
  readonly eventKey: string
  readonly class: KarmaClass
  readonly resolvedQualifiers: ResolvedQualifiers
}

export interface KarmaSlice {
  /** Karma balance. Signed by type (D40); v1 income is all positive. */
  balance: number
  /** The current life's firsts records (paid + folded at the crossing). */
  lifeLedger: KarmaLedgerEntry[]
  /**
   * Lifetime firsts history: canonical first-key → times earned in PRIOR lives
   * (the n in `base × rⁿ`). Headlines and variants both get a key here.
   */
  firstsHistory: Record<string, number>
}

export function freshKarmaSlice(): KarmaSlice {
  return { balance: 0, lifeLedger: [], firstsHistory: {} }
}

/** A single receipt line item (for the receipt UI, step 4). */
export interface KarmaReceiptLine {
  readonly key: string
  readonly class: KarmaClass
  /** 'headline' (bare event) or 'echo' (a qualified variant). */
  readonly kind: 'headline' | 'echo'
  /** Prior lives that earned this exact first (the n in rⁿ). */
  readonly priorCount: number
  readonly payout: number
}

/**
 * The receipt: the total plus the D40 income-SHAPE decomposition (milestone
 * headlines / milestone echoes / deed+encounter / grade deltas). The total
 * prices the menu; the shape tells whether karma is a novelty- or a
 * performance-incentive.
 */
export interface KarmaReceipt {
  readonly total: number
  readonly milestoneHeadline: number
  readonly milestoneEcho: number
  readonly deedEncounter: number
  readonly gradeDelta: number
  readonly lines: readonly KarmaReceiptLine[]
}

const KARMA_BY_KEY: ReadonlyMap<string, KarmaEventRow> = new Map(
  KARMA_DATA.map((row) => [row.key, row]),
)

/** Canonical key for a variant (event + sorted axis=value pairs). */
function variantKey(eventKey: string, resolved: ResolvedQualifiers): string {
  const pairs = Object.keys(resolved)
    .sort()
    .map((axis) => `${axis}=${resolved[axis]}`)
  return `${eventKey}#${pairs.join('|')}`
}

/** `base × rⁿ`, floored at f (= 0, D36 — a positive base never actually clamps). */
function decayed(base: number, priorCount: number): number {
  return Math.max(KARMA_FLOOR, base * Math.pow(KARMA_DECAY_RATIO, priorCount))
}

export const useKarmaStore = defineStore('karma', () => {
  const balance = ref(0)
  const lifeLedger = ref<KarmaLedgerEntry[]>([])
  const firstsHistory = ref<Record<string, number>>({})

  const ledger = computed<readonly KarmaLedgerEntry[]>(() => lifeLedger.value)

  /** Whether the ledger already holds this exact first (event + resolved tuple). */
  function ledgerHas(eventKey: string, resolved: ResolvedQualifiers): boolean {
    const key = variantKey(eventKey, resolved)
    return lifeLedger.value.some(
      (entry) => variantKey(entry.eventKey, entry.resolvedQualifiers) === key,
    )
  }

  /**
   * Record a first for the current life. Unknown event keys throw (a code bug,
   * mirroring achievements.award). A first already recorded this life is a
   * no-op — doing the same thing twice in one life is not a new first.
   * NOT CALLED FROM ANYWHERE YET (the step-4 agent wires the events).
   */
  function recordFirst(eventKey: string, resolvedQualifiers: ResolvedQualifiers = {}): void {
    const row = KARMA_BY_KEY.get(eventKey)
    if (!row) throw new Error(`recordFirst(): unknown karma event key ${eventKey}`)
    if (ledgerHas(eventKey, resolvedQualifiers)) return
    lifeLedger.value = [
      ...lifeLedger.value,
      { eventKey, class: row.class, resolvedQualifiers: { ...resolvedQualifiers } },
    ]
  }

  /**
   * Compute what the current ledger WOULD pay against the lifetime history —
   * pure, no mutation. Headlines pay once (deduped across ledger entries that
   * share an event key); variants pay per distinct qualifier tuple.
   */
  function previewReceipt(): KarmaReceipt {
    const lines: KarmaReceiptLine[] = []
    let milestoneHeadline = 0
    let milestoneEcho = 0
    let deedEncounter = 0
    let gradeDelta = 0

    // Distinct headline event keys present in the ledger (each pays once).
    const headlineKeys = new Set(lifeLedger.value.map((entry) => entry.eventKey))
    for (const eventKey of headlineKeys) {
      const row = KARMA_BY_KEY.get(eventKey)
      if (!row) continue
      const priorCount = firstsHistory.value[eventKey] ?? 0
      const payout = decayed(row.base, priorCount)
      lines.push({ key: eventKey, class: row.class, kind: 'headline', priorCount, payout })
      if (row.class === 'milestone') milestoneHeadline += payout
      else if (row.class === 'grade-delta') gradeDelta += payout
      else deedEncounter += payout
    }

    // Qualified variants (echoes) — one per ledger entry with a non-empty tuple.
    for (const entry of lifeLedger.value) {
      if (Object.keys(entry.resolvedQualifiers).length === 0) continue
      const row = KARMA_BY_KEY.get(entry.eventKey)
      if (!row) continue
      const key = variantKey(entry.eventKey, entry.resolvedQualifiers)
      const priorCount = firstsHistory.value[key] ?? 0
      const payout = decayed(VARIANT_SHARE * row.base, priorCount)
      lines.push({ key, class: row.class, kind: 'echo', priorCount, payout })
      if (row.class === 'milestone') milestoneEcho += payout
      else if (row.class === 'grade-delta') gradeDelta += payout
      else deedEncounter += payout
    }

    const total = milestoneHeadline + milestoneEcho + deedEncounter + gradeDelta
    return { total, milestoneHeadline, milestoneEcho, deedEncounter, gradeDelta, lines }
  }

  /**
   * Pay the receipt into the balance, fold the ledger into the lifetime history
   * (each earned first's n increments by 1), and clear the ledger. NOTHING
   * CALLS THIS YET (the crossing wires it in step 4).
   */
  function settleLife(): KarmaReceipt {
    const receipt = previewReceipt()
    balance.value += receipt.total

    const nextHistory = { ...firstsHistory.value }
    const earnedKeys = new Set<string>()
    for (const entry of lifeLedger.value) {
      earnedKeys.add(entry.eventKey) // headline
      if (Object.keys(entry.resolvedQualifiers).length > 0) {
        earnedKeys.add(variantKey(entry.eventKey, entry.resolvedQualifiers)) // variant
      }
    }
    for (const key of earnedKeys) nextHistory[key] = (nextHistory[key] ?? 0) + 1
    firstsHistory.value = nextHistory
    lifeLedger.value = []
    return receipt
  }

  // ---- Save slice (id 'karma') --------------------------------------------
  function save(): Record<string, unknown> {
    return {
      balance: balance.value,
      lifeLedger: lifeLedger.value.map((entry) => ({
        eventKey: entry.eventKey,
        class: entry.class,
        resolvedQualifiers: { ...entry.resolvedQualifiers },
      })),
      firstsHistory: { ...firstsHistory.value },
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshKarmaSlice()) as Partial<KarmaSlice>
    balance.value = typeof s.balance === 'number' ? s.balance : 0
    lifeLedger.value = Array.isArray(s.lifeLedger)
      ? s.lifeLedger.map((entry) => ({
          eventKey: String(entry.eventKey),
          class: entry.class,
          resolvedQualifiers: { ...(entry.resolvedQualifiers ?? {}) },
        }))
      : []
    firstsHistory.value =
      s.firstsHistory && typeof s.firstsHistory === 'object' ? { ...s.firstsHistory } : {}
  }
  function fresh(): Record<string, unknown> {
    return freshKarmaSlice() as unknown as Record<string, unknown>
  }

  return {
    balance,
    ledger,
    firstsHistory,
    recordFirst,
    previewReceipt,
    settleLife,
    save,
    load,
    fresh,
  }
})
