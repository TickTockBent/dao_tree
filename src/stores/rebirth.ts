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
import { computed } from 'vue'
import { useKarmaStore, type KarmaReceipt } from '@/stores/karma'
import { useChronicleStore, type ChronicleEntry, type RichnessTier } from '@/stores/chronicle'
import { useSoulStore } from '@/stores/soul'
import { useTribulationStore } from '@/stores/tribulation'
import { useRealmStore } from '@/stores/realm'
import { useBodyStore } from '@/stores/body'
import { useLegacyStore } from '@/stores/legacy'
import { useSeveringStore } from '@/stores/severing'
import { useGameStore } from '@/stores/game'
import { LEGACY_DATA } from '@/data/legacy'
import { findRealm } from '@/data/realms'
import { SETPIECE_DATA } from '@/data/setpieces'
import type { RealmId } from '@/engine/types'

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
      rootConfig: null, // pre-roots (step 5)
      severances: severing.severances.map((record) => record.severable),
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

  /**
   * Cross Samsara. Returns the paid receipt (for the panel's post-cross echo), or
   * null if rebirth is not unlocked (guarded — never crosses when locked). The
   * five-step sequence is D39's crossing, in order.
   */
  function cross(): KarmaReceipt | null {
    if (!rebirthUnlocked.value) return null
    const karma = useKarmaStore()
    const chronicle = useChronicleStore()
    const game = useGameStore()

    // Read this-life state the cascade will erase (BEFORE steps 1 & 4).
    const trialsEndured = trialsEnduredThisLife()
    const lifeNumber = soul.rebirths + 1
    const priorLives = [...chronicle.lives]

    // 1) Pay the receipt; fold the ledger into the lifetime firsts history.
    const receipt = karma.settleLife()
    // 2) Write the life's entry (live state still intact — cascade is step 4).
    const richnessTier = richnessTierFor(receipt.total, priorLives)
    chronicle.writeLife(buildChronicleEntry(lifeNumber, receipt, trialsEndured, richnessTier))
    // 3) Latch the rebirth (soul-scoped, only ever rises).
    soul.recordRebirth()
    // 4) The cascade — every life/tree layer resets; soul/world/file carry.
    game.reincarnate()
    // 5) The new life has begun.
    return receipt
  }

  return {
    rebirthUnlocked,
    carriedBalance,
    previewReceipt,
    previewRichnessTier,
    cross,
    richnessTierFor,
  }
})
