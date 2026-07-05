// src/stores/rebirth.ts — the Samsara crossing (slice 10 step 4 / D39 + D32).
//
// The biggest moment in the game, orchestrated. Rebirth is a VOLUNTARY prestige
// (D39): unlocked at the first tribulation crossing, available whenever the
// player judges the life complete, never forced. This store owns the crossing
// SEQUENCE and the receipt/menu reads the panel renders; it holds NO persistent
// state of its own (it reads and drives the other stores), so it is not a save
// slice provider.
//
// THE CROSSING, IN ORDER (D39 + spec §3):
//   1. karma.settleLife()   — pay the receipt into the balance, fold history.
//   2. chronicle.writeLife() — fill the per-life entry from live state.
//   3. soul.recordRebirth() — latch the rebirth (never down).
//   4. game.reincarnate()   — the compiled cascade: every life/tree layer resets;
//                             soul/world/file carry BY CONSTRUCTION.
//   5. the new life begins with fresh life-scoped state + carried soul visible.
//
// All live-state reads for the chronicle entry happen BEFORE step 4 (the cascade
// erases them). The receipt is read live before commitment (D32 — the ledger
// read before the crossing) and restated at the armed confirm in the panel.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useKarmaStore, type KarmaReceipt } from '@/stores/karma'
import { useChronicleStore, type ChronicleEntry, type RichnessTier } from '@/stores/chronicle'
import { useSoulStore } from '@/stores/soul'
import { useTribulationStore } from '@/stores/tribulation'
import { useRealmStore } from '@/stores/realm'
import { useBodyStore } from '@/stores/body'
import { useLegacyStore } from '@/stores/legacy'
import { useSeveringStore } from '@/stores/severing'
import { useDaoStore } from '@/stores/dao'
import { useRootsStore } from '@/stores/roots'
import { useGameStore } from '@/stores/game'
import { LEGACY_DATA } from '@/data/legacy'
import { findRealm } from '@/data/realms'
import { findSeverable } from '@/data/severing'
import { SETPIECE_DATA } from '@/data/setpieces'
import { LATTICE_DATA } from '@/data/lattice'
import {
  seedFragmentCost,
  seedFragmentTotal,
  ROOT_CONFIG_COST,
  ROOT_PURITY_COST,
  type PurityGrade,
  type RootConfig,
} from '@/data/rebirth'
import type { Element, LatticeNodeKey, RealmId } from '@/engine/types'

/** Climb realms low → high, for resolving the highest reached. */
const REALM_CLIMB_ORDER: readonly RealmId[] = ['q', 'f', 'c', 'n', 's', 'x']

// ---- richnessTier v1 rule (D37; refined at step 7) --------------------------
//
// The chronicle obeys wider-not-taller (#21) as a VOLUME constraint expressed as
// curation, and the karma receipt total IS the curation signal (D37: "the karma
// receipt is the curation signal"). v1 rule, documented so step 7 can replace it:
//   - the FOUNDING lives (the first few) always get a chapter — a dynasty's
//     origin era reads in full;
//   - after that, a life whose receipt total sets a NEW novelty high is an
//     exceptional late life → chapter (D37: "only exceptional late lives get
//     full treatment");
//   - a still-substantial life (≥ half the best prior total) gets a summary;
//   - an unremarkable late life gets a single epitaph line.
// So a thousand-life save reads like a dynasty history, not a log file.
const FOUNDING_LIVE_COUNT = 3
const SUMMARY_THRESHOLD_FRACTION = 0.5

/**
 * The richness tier for a life whose receipt totalled `total`, given the entries
 * of the PRIOR lives (before this one is written).
 */
export function richnessTierFor(total: number, priorLives: readonly ChronicleEntry[]): RichnessTier {
  if (priorLives.length < FOUNDING_LIVE_COUNT) return 'chapter'
  const bestPriorTotal = priorLives.reduce((max, entry) => Math.max(max, entry.firstsReceipt.total), 0)
  if (total > bestPriorTotal) return 'chapter'
  if (total >= bestPriorTotal * SUMMARY_THRESHOLD_FRACTION) return 'summary'
  return 'line'
}

// ---- Grade index → label helpers (null when never reached) ------------------

function legacyLabel(index: number): string | null {
  return index < 0 ? null : LEGACY_DATA.actOne.bands[index]?.label ?? null
}
function foundationLabel(index: number): string | null {
  return index < 0 ? null : findRealm('f').grade?.bands[index]?.tier ?? null
}
function coreLabel(index: number): string | null {
  return index < 0 ? null : SETPIECE_DATA.forge.grades[index]?.label ?? null
}
function tribLabel(index: number): string | null {
  return index < 0 ? null : SETPIECE_DATA.firstTribulation.grades[index]?.label ?? null
}
function tribKey(index: number): ReturnType<typeof tribGradeKey> {
  return index < 0 ? null : tribGradeKey(index)
}
function tribGradeKey(index: number) {
  return SETPIECE_DATA.firstTribulation.grades[index]?.key ?? null
}

export const useRebirthStore = defineStore('rebirth', () => {
  const soul = useSoulStore()
  const trib = useTribulationStore()

  /**
   * Rebirth is unlocked once the first tribulation is crossed AND stays unlocked
   * forever after (soul.rebirths latches). The rebirths clause keeps the crossing
   * available in a fresh life that has not yet re-passed its own tribulation —
   * once a soul has crossed Samsara, the way is always open (D39: voluntary,
   * available whenever the player judges the life complete).
   */
  const rebirthUnlocked = computed(() => trib.tribulationPassed || soul.rebirths >= 1)

  /** The receipt as it stands right now (live preview, before the crossing). */
  function previewReceipt(): KarmaReceipt {
    return useKarmaStore().previewReceipt()
  }

  /** The karma balance that will carry into the next life. */
  const carriedBalance = computed(() => useKarmaStore().balance)

  /**
   * D39 — the attachments this soul has TRANSCENDED, by display name. The soul's
   * most dramatic carry: gone at full ramp in every life to come. The rebirth
   * screen restates these in "what carries."
   */
  const transcendedCarry = computed<string[]>(() =>
    soul.transcended.map((record) => findSeverable(record.severable).name),
  )

  /** The richness tier this life WOULD earn if crossed now (panel preview). */
  function previewRichnessTier(): RichnessTier {
    return richnessTierFor(previewReceipt().total, useChronicleStore().lives)
  }

  /**
   * The highest climb realm ENTERED this life (never null in practice — q is
   * birth). Reads the durable `unlocked` LATCH (not isUnlocked's meets-condition):
   * a realm is "reached" once actually entered, and the latch persists through
   * every n/s cascade — so a passed tribulation alone does not count Spirit
   * Severing (x) as reached until the offering crossing latches it, matching the
   * reachRealm karma milestone's own trigger.
   */
  function realmReachedNow(): RealmId {
    const realm = useRealmStore()
    let reached: RealmId = 'q'
    for (const id of REALM_CLIMB_ORDER) if (realm.stateOf(id).unlocked) reached = id
    return reached
  }

  /**
   * Per-trial-key endured counts THIS life, derived from the karma ledger's
   * endureTrial:* entries (v1: presence per trial type; repeat-within-life counts
   * are deferred — the ledger records the first endure of each type). Read BEFORE
   * settleLife clears the ledger.
   */
  function trialsEnduredThisLife(): Record<string, number> {
    const prefix = 'endureTrial:'
    const counts: Record<string, number> = {}
    for (const entry of useKarmaStore().ledger) {
      if (entry.eventKey.startsWith(prefix)) counts[entry.eventKey.slice(prefix.length)] = 1
    }
    return counts
  }

  /** Build the per-life chronicle entry from live state (call BEFORE the cascade). */
  function buildChronicleEntry(
    lifeNumber: number,
    receipt: KarmaReceipt,
    trialsEndured: Record<string, number>,
    richnessTier: RichnessTier,
    rootConfig: RootConfig | null,
  ): ChronicleEntry {
    const body = useBodyStore()
    const legacy = useLegacyStore()
    const severing = useSeveringStore()
    return {
      lifeNumber,
      realmReached: realmReachedNow(),
      grades: {
        legacy: legacyLabel(legacy.actOneGrade),
        foundation: foundationLabel(body.foundationGrade),
        core: coreLabel(body.coreGrade),
        tribulation: tribLabel(trib.tribGrade),
      },
      tribulationOutcome: tribKey(trib.tribGrade),
      rootConfig, // this life's root config (null when rootless) — D38
      severances: severing.severances.map((record) => record.severable),
      // D39: severables TRANSCENDED this life — cut this life AND now transcended
      // (the third distinct-life cut lands during the life it completes, so a
      // this-life cut that is now transcended is one transcended THIS life).
      transcendences: severing.severances
        .map((record) => record.severable)
        .filter((severable) => soul.isTranscended(severable)),
      trialsEndured,
      firstsReceipt: {
        total: receipt.total,
        milestoneHeadline: receipt.milestoneHeadline,
        milestoneEcho: receipt.milestoneEcho,
        deedEncounter: receipt.deedEncounter,
        gradeDelta: receipt.gradeDelta,
      },
      richnessTier,
      strandsHeld: [],
      strandsMatured: [],
      strandsTransmitted: [],
      strandsTorn: [],
    }
  }

  // ---- The two-item menu (D38): what you carry + what body you build --------
  //
  // Draft selections for the NEXT life, held here (the rebirth store is not a save
  // slice provider, so these are transient — they never persist, and the crossing
  // consumes then clears them). Choices are made BEFORE the crossing (spec §3
  // order: receipt → menu → crossing) and applied to the fresh life at step 6.

  /** Lattice tier ordinals (positional over LATTICE_DATA.tiers). */
  const GLIMPSE_TIER = 1
  const SEED_TIER = 2

  /** Ordered Seed selections (price escalates by selection order — 1st=15, 2nd=30…). */
  const selectedSeedKeys = ref<LatticeNodeKey[]>([])
  /** Draft root identity (the elements this root holds) + purity for the next life. */
  const rootDraftElements = ref<Element[]>([])
  const rootDraftPurity = ref<PurityGrade>('mortal')

  /** The dying life's carryable Seeds — nodes currently owned at Seed tier or above. */
  function carryableSeeds(): { key: LatticeNodeKey; name: string }[] {
    const dao = useDaoStore()
    return LATTICE_DATA.nodes
      .filter((node) => dao.nodeTierOwned(node.key) >= SEED_TIER)
      .map((node) => ({ key: node.key, name: node.name }))
  }

  /** Selected Seeds that are genuinely owned at Seed tier this life (defensive filter). */
  function validSelectedSeedKeys(): LatticeNodeKey[] {
    const dao = useDaoStore()
    return selectedSeedKeys.value.filter((key) => dao.nodeTierOwned(key) >= SEED_TIER)
  }

  /** Toggle a Seed in the carry selection (append preserves the escalation order). */
  function toggleSeed(key: LatticeNodeKey): void {
    selectedSeedKeys.value = selectedSeedKeys.value.includes(key)
      ? selectedSeedKeys.value.filter((existing) => existing !== key)
      : [...selectedSeedKeys.value, key]
  }

  /** Toggle whether the drafted root holds `element`. */
  function toggleRootElement(element: Element): void {
    rootDraftElements.value = rootDraftElements.value.includes(element)
      ? rootDraftElements.value.filter((existing) => existing !== element)
      : [...rootDraftElements.value, element]
  }

  /** Set the drafted root purity grade. */
  function setRootPurity(grade: PurityGrade): void {
    rootDraftPurity.value = grade
  }

  /** Clear all draft selections (rootless, no carry — the default). */
  function resetDraft(): void {
    selectedSeedKeys.value = []
    rootDraftElements.value = []
    rootDraftPurity.value = 'mortal'
  }

  /** The karma the NEXT selected Seed would cost (escalating; for the menu display). */
  const nextSeedPrice = computed(() => seedFragmentCost(selectedSeedKeys.value.length))
  /** Total karma for the carried Seeds. */
  const seedSpend = computed(() => seedFragmentTotal(selectedSeedKeys.value.length))
  /** Total karma for the drafted root: nominal config cost + purity sink (0 when rootless). */
  const rootSpend = computed(() =>
    rootDraftElements.value.length === 0
      ? 0
      : ROOT_CONFIG_COST + ROOT_PURITY_COST[rootDraftPurity.value],
  )
  /** The whole menu spend. */
  const spendTotal = computed(() => seedSpend.value + rootSpend.value)

  /** The karma balance AFTER the receipt settles at the crossing (what the spend draws on). */
  const balanceAfterCross = computed(() => useKarmaStore().balance + previewReceipt().total)
  /** True if the drafted spend fits the post-crossing balance (loot-never-gate: NEXT life only). */
  const spendAffordable = computed(() => spendTotal.value <= balanceAfterCross.value)
  /** The karma balance that would remain after crossing + spending (the confirm restate). */
  const balanceAfterSpend = computed(() => balanceAfterCross.value - spendTotal.value)

  /**
   * Cross Samsara. Returns the paid receipt (for the panel's post-cross echo), or
   * null if rebirth is not unlocked (guarded — never crosses when locked). D39's
   * crossing, in order, now with the menu applied to the fresh life (step 6).
   */
  function cross(): KarmaReceipt | null {
    if (!rebirthUnlocked.value) return null
    const karma = useKarmaStore()
    const chronicle = useChronicleStore()
    const game = useGameStore()
    const dao = useDaoStore()
    const roots = useRootsStore()

    // Read this-life state the cascade will erase (BEFORE steps 1 & 4).
    const trialsEndured = trialsEnduredThisLife()
    const lifeNumber = soul.rebirths + 1
    const priorLives = [...chronicle.lives]
    const dyingRootConfig = roots.config // this life's config, for the chronicle

    // The graded lattice carry (D37), computed pre-cascade: every owned node's
    // GLIMPSE carries FREE; a selected+paid Seed carries at Seed tier; a
    // Manifestation dies (re-walk is the future walked-path accumulator).
    const carriedTiers: Record<string, number> = {}
    for (const node of LATTICE_DATA.nodes) {
      if (dao.nodeTierOwned(node.key) >= GLIMPSE_TIER) carriedTiers[node.key] = GLIMPSE_TIER
    }
    const paidSeedKeys = validSelectedSeedKeys()

    // 1) Pay the receipt; fold the ledger into the lifetime firsts history.
    const receipt = karma.settleLife()
    // 2) Write the life's entry (live state still intact — cascade is step 4).
    const richnessTier = richnessTierFor(receipt.total, priorLives)
    chronicle.writeLife(
      buildChronicleEntry(lifeNumber, receipt, trialsEndured, richnessTier, dyingRootConfig),
    )
    // 3) Latch the rebirth (soul-scoped, only ever rises).
    soul.recordRebirth()

    // The menu purchase: affordable against the JUST-SETTLED balance (the UI
    // guards this; defense in depth here). Free glimpse carry is unconditional;
    // paid Seeds + the root config apply only when the spend clears.
    const purchaseApplies = spendTotal.value <= karma.balance
    if (purchaseApplies) {
      karma.spendKarma(spendTotal.value)
      for (const key of paidSeedKeys) carriedTiers[key] = SEED_TIER
    }

    // 4) The cascade — every life/tree layer resets; soul/world/file carry.
    game.reincarnate()
    // 5 & 6) The new life begins; apply the carried comprehension + root config.
    dao.applyCarriedTiers(carriedTiers)
    // D39: pre-apply transcended attachments to the fresh (just-reset) severing
    // slice — each gone at full ramp from breath one, no trough. Reuses the
    // severance ramp machinery (see severing.applyTranscendences).
    useSeveringStore().applyTranscendences()
    if (purchaseApplies && rootDraftElements.value.length > 0) {
      roots.configure(rootDraftElements.value, rootDraftPurity.value)
    }
    resetDraft()
    return receipt
  }

  return {
    rebirthUnlocked,
    carriedBalance,
    transcendedCarry,
    previewReceipt,
    previewRichnessTier,
    cross,
    richnessTierFor,
    // menu state + actions
    selectedSeedKeys,
    rootDraftElements,
    rootDraftPurity,
    carryableSeeds,
    toggleSeed,
    toggleRootElement,
    setRootPurity,
    resetDraft,
    nextSeedPrice,
    seedSpend,
    rootSpend,
    spendTotal,
    balanceAfterCross,
    spendAffordable,
    balanceAfterSpend,
  }
})
