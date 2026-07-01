// src/data/heart-demons.ts — Heart Demon corruption + Demon Trials (slice 8).
//
// Design §7.4: a corruption stat fed by rushed low-grade breakthroughs,
// reckless forge/tribulation pushes (and, later, demonic stances); bled by
// orthodox practice and Dao Heart stacks. The permanent live tension that
// keeps grade-chasing vs rushing a real decision forever.
//
// Design §6.3: threshold crossings force an INVOLUNTARY debuff stance with a
// clear objective. Failure isn't possible — only not-yet-cleared. Clearing
// grants a permanent Dao Heart stack. Concurrency (pinned by the doc):
// corruption accumulation PAUSES while a trial is active (sources bank into
// an overflow pool), a banked crossing fires as a QUEUED trial on clear, and
// at most ONE trial is ever active — so clearability is always linted solo.
//
// Objective types (all deterministic, all completable by construction —
// the §6.3 completability lint asserts the shapes):
//   'endure'        remain in the trial for `seconds` (time always passes)
//   'gatherQi'      gather `reqBaseFactor × q.reqBase` Qi during the trial
//                   (Qi accrues under any debuff > 0, so always reachable)
//   'prestigeCount' perform `count` realm breakthroughs during the trial
//                   (q remains prestigable at any scale)
//
// Dao Heart stacks are LIFE-scoped in v1; whether they carry through Samsara
// (§7.2 memory-fragment precedent) is a slice-10 decision, recorded here.

import type { Element } from '@/engine/types'

export type HeartDemonTrialKey = 'whisperingDoubt' | 'hungryShadow' | 'hollowCrown'

export type TrialObjective =
  | { readonly type: 'endure'; readonly seconds: number }
  | { readonly type: 'gatherQi'; readonly reqBaseFactor: number }
  | { readonly type: 'prestigeCount'; readonly count: number }

export interface DemonTrialRow {
  readonly key: HeartDemonTrialKey
  readonly name: string
  /** The demon's voice — shown while the trial holds. */
  readonly description: string
  readonly element: Element | null
  readonly color: string
  /** Qi/sec multiplier while the trial is active (the involuntary stance debuff, < 1). */
  readonly qiMultWhileActive: number
  readonly objective: TrialObjective
}

export interface CorruptionSources {
  /**
   * Graded (Foundation) breakthrough at a low band: corruption per prestige,
   * indexed by band tier key. Bands not listed add nothing.
   */
  readonly rushedBreakthrough: Readonly<Partial<Record<'Flawed' | 'Stable', number>>>
  /** Forge push corruption by push key; Steady adds nothing. */
  readonly forgePush: Readonly<Partial<Record<'forceful' | 'reckless', number>>>
  /** Tribulation resolution corruption by grade key; clean grades add nothing. */
  readonly tribulation: Readonly<Partial<Record<'failed' | 'scarred', number>>>
}

export interface HeartDemonData {
  readonly corruption: {
    readonly sources: CorruptionSources
    /** Passive orthodox bleed, corruption/sec (paused during a trial). */
    readonly bleedPerSecond: number
    /** Additional bleed/sec per Dao Heart stack (the stacks' main gift). */
    readonly bleedPerDaoHeartStack: number
  }
  /**
   * Trial thresholds in ascending corruption order. Crossing `at` (from below)
   * forces that trial. After the last row, the ladder repeats its final trial
   * every `repeatEvery` further corruption — the tension never expires.
   */
  readonly thresholds: readonly { readonly at: number; readonly trial: HeartDemonTrialKey }[]
  readonly repeatEvery: number
  readonly trials: readonly DemonTrialRow[]
  readonly daoHeart: {
    /** Small permanent Qi mult per stack (accelerant — demonic builds farm trials on purpose). */
    readonly qiMultPerStack: number
  }
}

export const HEART_DEMON_DATA: HeartDemonData = {
  corruption: {
    sources: {
      rushedBreakthrough: { Flawed: 12, Stable: 6 },
      forgePush: { forceful: 10, reckless: 25 },
      tribulation: { failed: 30, scarred: 10 },
    },
    bleedPerSecond: 0.02,
    bleedPerDaoHeartStack: 0.02,
  },
  thresholds: [
    { at: 60, trial: 'whisperingDoubt' },
    { at: 140, trial: 'hungryShadow' },
    { at: 260, trial: 'hollowCrown' },
  ],
  repeatEvery: 120,
  trials: [
    {
      key: 'whisperingDoubt',
      name: 'Trial of Whispering Doubt',
      description:
        'A voice with your own cadence counts everything you skipped. Sit with it. It cannot make you stand.',
      element: null,
      color: '#9a86b8',
      qiMultWhileActive: 0.8,
      objective: { type: 'endure', seconds: 120 },
    },
    {
      key: 'hungryShadow',
      name: 'Trial of the Hungry Shadow',
      description:
        'It eats what you gather before you can swallow. Gather more than it can eat.',
      element: 'water',
      color: '#5a7a99',
      qiMultWhileActive: 0.7,
      objective: { type: 'gatherQi', reqBaseFactor: 400 },
    },
    {
      key: 'hollowCrown',
      name: 'Trial of the Hollow Crown',
      description:
        'It offers you every rank you rushed to reach, hollow. Break through anyway — three times, and mean it.',
      element: 'fire',
      color: '#b86a4a',
      qiMultWhileActive: 0.65,
      objective: { type: 'prestigeCount', count: 3 },
    },
  ],
  daoHeart: {
    qiMultPerStack: 1.02,
  },
}

/** Find a trial row by key (throws on unknown key — data bug, not runtime state). */
export function findDemonTrial(key: HeartDemonTrialKey): DemonTrialRow {
  const trial = HEART_DEMON_DATA.trials.find((t) => t.key === key)
  if (!trial) throw new Error(`unknown demon trial: ${key}`)
  return trial
}
