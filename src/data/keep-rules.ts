// src/data/keep-rules.ts — declarative keep-acquisition table (design §1.2, §8.2).
//
// Port of js/data/keep-rules.js. Compiled by engine/doReset.ts to decide which
// state slices survive a prestige. A keep rule is ACTIVE only once the player
// has earned its milestone. Earned keep rules are UNCONDITIONAL: they apply on
// every reset of `onResetOf`, including the forced resetRow path — kept progress
// is earned permanence, like meridians. Only a hard save wipe clears it.

import type { LayerId, RealmId } from '@/engine/types'
import type { KeepRuleKey } from '@/engine/types'

export interface KeepRule {
  readonly key: KeepRuleKey
  /** The milestone whose acquisition ACTIVATES the rule. */
  readonly grantedBy: { readonly layer: RealmId; readonly milestone: number }
  /** The rule fires when THIS layer prestiges. */
  readonly onResetOf: RealmId
  /** The layer whose keys are preserved. */
  readonly target: LayerId
  /**
   * State key names to preserve. Always ["best", "milestones"]: best preserves
   * the high-water (+ sub-stage mults); milestones preserves the earned list so
   * they do NOT re-fire their unlock notification on every reset.
   */
  readonly keep: readonly ('best' | 'milestones')[]
}

export const KEEP_RULES: readonly KeepRule[] = [
  {
    key: 'qiInsightSurvivesFoundation',
    // f milestone 3 = "Peak Foundation" (f.best >= 22). ⟨tune⟩
    grantedBy: { layer: 'f', milestone: 3 },
    onResetOf: 'f',
    target: 'q',
    keep: ['best', 'milestones'],
  },
  {
    // Nascent Soul carries the Foundation forward (§5 / slice 4): once the soul
    // matures, a NS breakthrough no longer wipes the Foundation climb below it.
    // n milestone 2 = "Late Nascent Soul" (n.best >= 12).
    key: 'foundationSurvivesNascentSoul',
    grantedBy: { layer: 'n', milestone: 2 },
    onResetOf: 'n',
    target: 'f',
    keep: ['best', 'milestones'],
  },
  {
    // Soul Formation carries the NS climb forward (§5 capstone / slice 6): once
    // the formed soul matures partway up SF, an s breakthrough no longer wipes
    // the NS climb below it. s milestone 2 = "Late Soul Formation" (s.best >= 16).
    key: 'soulCarriesTheClimb',
    grantedBy: { layer: 's', milestone: 2 },
    onResetOf: 's',
    target: 'n',
    keep: ['best', 'milestones'],
  },
]
