// Achievement registry invariants (ledger #9 consequence (b)).
//
// SKELETON stub — the implement pass fills these in. Required invariants:
//   1. Keys unique and Steam-api-name-safe (ACHIEVEMENT_KEY_PATTERN).
//   2. name/flavor non-empty.
//   3. v1: every done !== null (no event-driven entries until call sites exist).
//   4. Every done condition evaluates against a fresh GameState without
//      throwing (meets() unknown-key-false semantics make silent typos
//      possible — assert every condition key is a known meets() clause).
//   5. No achievement is earnable on a literally fresh save (a zero-state
//      player has done nothing — a condition that's true at boot is a bug).
//   6. hidden entries must be horizon content (kind check is manual review;
//      at minimum assert hidden === false for the 'spine' category's first
//      steps so the current loop is never veiled).

import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_DATA, ACHIEVEMENT_KEY_PATTERN } from '@/data/achievements'

describe('achievement registry invariants', () => {
  it('keys are unique and Steam-api-name-safe', () => {
    const keys = ACHIEVEMENT_DATA.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(key, `key ${key} must match ${ACHIEVEMENT_KEY_PATTERN}`).toMatch(
        ACHIEVEMENT_KEY_PATTERN,
      )
    }
  })
})
