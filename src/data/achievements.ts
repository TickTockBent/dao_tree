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
 * ⟨seed⟩ Three entries pin the shape; the Act I set is filled in by the
 * implementation pass — every entry meets()-expressible, spoiler-heavy late
 * beats marked hidden.
 */
export const ACHIEVEMENT_DATA: readonly AchievementDef[] = [
  {
    key: 'FIRST_BREATH',
    name: 'First Breath',
    flavor: 'Draw in a single breath of qi. Every immortal began here.',
    done: { qi: 1 },
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
    key: 'CORE_FORGED',
    name: 'The Golden Core',
    flavor: 'Forge a Golden Core in the crucible of your own Foundation.',
    done: { coreForged: true },
    hidden: false,
    category: 'forge',
  },
] as const

/** Look up a definition by key (throws on unknown — data bugs fail loud). */
export function findAchievement(key: string): AchievementDef {
  const def = ACHIEVEMENT_DATA.find((a) => a.key === key)
  if (!def) throw new Error(`Unknown achievement key: ${key}`)
  return def
}
