// src/data/achievements.ts — the achievement registry (deferred-decision #9
// consequence (b): achievements modeled as a registry that can map to Steam
// achievements later).
//
// DISTINCT from src/data/gates.ts ("Deeds"): gates are LIFE-scoped story
// checkpoints that carry qiMult buffs and use positional TMT-style ids.
// Achievements are an ETERNAL-scoped pure RECORD — stable string keys
// (Steam-api-name-safe), zero gameplay effects (closed economy trivially),
// never reset by anything. The registry IS the future Steam mapping table:
// `key` doubles as the Steam API name.
//
// Veil discipline (ledger #11 — "veil the ahead, never the now"): a `hidden`
// achievement shows as ??? until earned (mystified horizon); every earned
// achievement is fully legible. Nothing about the CURRENT loop is hidden.
//
// v1 constraint: every achievement is meets()-expressible (`done` is never
// null in shipped data). The store exposes award(key) for future event-driven
// achievements (forge-push outcomes, tribulation grades) — but no call sites
// exist yet, so no shipped entry may rely on it (lint-pinned).

import type { Condition } from '@/engine/meets'

/** Steam API names: UPPER_SNAKE, start with a letter, 3–63 chars. Lint-pinned. */
export const ACHIEVEMENT_KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,62}$/

export type AchievementCategory =
  | 'spine' // realm progression
  | 'body' // meridians / temper
  | 'forge' // core forging
  | 'world' // sect / secret realms / profession
  | 'heart' // heart demons / corruption
  | 'mastery' // capstones and long-tail feats

export interface AchievementDef {
  /** Stable key — NEVER renamed once shipped (it is the Steam API name). */
  readonly key: string
  readonly name: string
  /** Player-facing description (what was done, in the game's voice). */
  readonly flavor: string
  /**
   * meets() condition, evaluated on tick until earned. `null` reserves the
   * entry for a future event-driven award() call site — forbidden in shipped
   * data for now (see header + lint).
   */
  readonly done: Condition | null
  /** Shown as ??? until earned (horizon content only — never current-loop info). */
  readonly hidden: boolean
  readonly category: AchievementCategory
}

/**
 * The registry. Append-only once a version ships (keys are permanent).
 * The Act I set. Every entry meets()-expressible (done !== null, lint-pinned);
 * hidden is reserved for horizon beats (Nascent Soul onward, heart-demon
 * spoilers, mastery capstones) — the current loop is never veiled.
 *
 * NOT expressible in the v1 grammar (left for event-driven award() call
 * sites later): a specific forge-push outcome, a core GRADE threshold
 * (coreBelowCeiling speaks to headroom, not grade), tribulation grades,
 * "core at its ceiling" (needs negation).
 */
export const ACHIEVEMENT_DATA: readonly AchievementDef[] = [
  // ---- spine — the realm climb ----------------------------------------------
  {
    key: 'FIRST_BREATH',
    name: 'First Breath',
    flavor: 'Draw in a single breath of qi. Every immortal began here.',
    done: { qi: 1 },
    hidden: false,
    category: 'spine',
  },
  {
    key: 'SIXTH_LEVEL',
    name: 'The Sixth Level',
    flavor:
      'Reach the 6th Level of Qi Condensation — the level at which the path ahead first shows itself.',
    done: { realm: ['q', '6th Level'] },
    hidden: false,
    category: 'spine',
  },
  {
    key: 'FOUNDATION_LAID',
    name: 'Foundation Laid',
    flavor: 'Establish your Foundation — the first true step onto the path.',
    done: { realm: ['f', 'Early Foundation'] },
    hidden: false,
    category: 'spine',
  },
  {
    key: 'NASCENT_SOUL',
    name: 'A Second Self',
    flavor:
      'Reach Nascent Soul. Something small and bright opens its eyes inside your dantian, and it is you.',
    done: { realm: ['n', 'Early Nascent Soul'] },
    hidden: true,
    category: 'spine',
  },
  {
    key: 'SOUL_FORMATION',
    name: 'Soul Formation',
    flavor:
      'Enter Soul Formation, where the self you built begins to draw the regard of the heavens.',
    done: { realm: ['s', 'Early Soul Formation'] },
    hidden: true,
    category: 'spine',
  },

  // ---- body — meridians and temper --------------------------------------------
  {
    key: 'FIRST_MERIDIAN',
    name: 'A Channel Opens',
    flavor: 'Open the first of the twelve primary meridians. The way in is also the way through.',
    done: { meridians: 1 },
    hidden: false,
    category: 'body',
  },
  {
    key: 'TWELVE_RIVERS',
    name: 'Twelve Rivers',
    flavor: 'Open all twelve primary meridians. The qi moves through you now without asking.',
    done: { primaryMeridiansAll: true },
    hidden: false,
    category: 'body',
  },
  {
    key: 'TEMPERED_FLESH',
    name: 'Tempered Flesh',
    flavor: 'Temper your body to Flesh. Pain is a teacher with one lesson, taught well.',
    done: { temperTier: 'flesh' },
    hidden: false,
    category: 'body',
  },
  {
    key: 'TEMPERED_MARROW',
    name: 'To the Marrow',
    flavor: 'Temper your body to Marrow. Nothing of the old, untrained flesh remains.',
    done: { temperTier: 'marrow' },
    hidden: false,
    category: 'body',
  },

  // ---- forge — the Golden Core --------------------------------------------------
  {
    key: 'CORE_FORGED',
    name: 'The Golden Core',
    flavor: 'Forge a Golden Core in the crucible of your own Foundation.',
    done: { coreForged: true },
    hidden: false,
    category: 'forge',
  },
  {
    key: 'CORE_TEMPERED',
    name: 'Thrice-Refined',
    flavor:
      'Refine the Golden Core to its tempered state. What is forged once is perfected slowly.',
    done: { realm: ['c', 'Core Tempered'] },
    hidden: false,
    category: 'forge',
  },

  // ---- world — sect, secret realms, profession ----------------------------------
  {
    key: 'SECT_JOINED',
    name: 'A Name in the Ledger',
    flavor: 'Join a sect. A token, a bow, a name written down — and the weight of belonging.',
    done: { sectJoined: true },
    hidden: false,
    category: 'world',
  },
  {
    key: 'SECT_STANDING',
    name: 'Standing',
    flavor:
      'Earn a thousand contribution in service of your sect. Deeds accumulate the way qi does: slowly, then all at once.',
    done: { contribution: 1000 },
    hidden: false,
    category: 'world',
  },
  {
    key: 'FIRST_DELVE',
    name: 'First Delve',
    flavor: 'Clear a Secret Realm expedition and carry something real back out.',
    done: { secretRealmClears: 1 },
    hidden: false,
    category: 'world',
  },
  {
    key: 'REALM_DELVER',
    name: 'Realm Delver',
    flavor: 'Clear ten Secret Realm expeditions. The hidden places have begun to expect you.',
    done: { secretRealmClears: 10 },
    hidden: false,
    category: 'world',
  },
  {
    key: 'SECOND_DISCIPLINE',
    name: 'A Second Discipline',
    flavor: 'Choose a profession. The cauldron asks for its own patience.',
    done: { professionChosen: true },
    hidden: false,
    category: 'world',
  },

  // ---- heart — corruption and Dao Hearts -----------------------------------------
  {
    key: 'THE_WHISPER_COMES',
    name: 'The Whisper Comes',
    flavor: 'Let corruption climb until a heart demon stirs. Every shortcut keeps its own ledger.',
    done: { corruption: 60 },
    hidden: true,
    category: 'heart',
  },
  {
    key: 'FIRST_DAO_HEART',
    name: 'Dao Heart',
    flavor:
      'Clear a Demon Trial and take your first Dao Heart. What did not break you has a shape now.',
    done: { daoHeartStacks: 1 },
    hidden: true,
    category: 'heart',
  },

  // ---- mastery — capstones and long-tail feats -----------------------------------
  {
    key: 'THIRTEENTH_LEVEL',
    name: 'The Thirteenth Level',
    flavor:
      'Reach the 13th Level of Qi Condensation. Most stop counting at nine; the path did not.',
    done: { realm: ['q', '13th Level'] },
    hidden: false,
    category: 'mastery',
  },
  {
    key: 'SEED_OF_THE_DAO',
    name: 'Seed of the Dao',
    flavor: 'Deepen a Dao glimpse into a Seed. Comprehension, planted, grows on its own.',
    done: { anyDaoNode: 2 },
    hidden: false,
    category: 'mastery',
  },
  {
    key: 'CLOSED_DOOR',
    name: 'Closed-Door Cultivator',
    flavor:
      'Master all five disciplines of deep meditation. Behind the closed door, the work continues without you.',
    done: { seclusionRungs: 5 },
    hidden: true,
    category: 'mastery',
  },
  {
    key: 'SECT_ELDER',
    name: 'Elder',
    flavor:
      'Reach Late Soul Formation with thirty thousand contribution to your name. The youngest disciples look at you the way you once looked up.',
    done: { sectJoined: true, contribution: 30000, realm: ['s', 'Late Soul Formation'] },
    hidden: true,
    category: 'mastery',
  },
] as const

/** Look up a definition by key (throws on unknown — data bugs fail loud). */
export function findAchievement(key: string): AchievementDef {
  const def = ACHIEVEMENT_DATA.find((a) => a.key === key)
  if (!def) throw new Error(`Unknown achievement key: ${key}`)
  return def
}
