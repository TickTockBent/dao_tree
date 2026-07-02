// Achievement registry invariants (ledger #9 consequence (b)).
//
// Numbered invariants per the skeleton spec:
//   1. Keys unique and Steam-api-name-safe (ACHIEVEMENT_KEY_PATTERN).
//   2. name/flavor non-empty.
//   3. v1: every done !== null (no event-driven entries until call sites exist).
//   4. Every condition key is a known meets() clause (typo'd keys evaluate
//      silently false forever — the worst kind of dead achievement).
//   5. No achievement is earnable on a literally fresh save.
//   6. hidden entries are horizon content only — the spine's first two realms
//      (q/f) are the current loop and must never be veiled.
// Plus: the registry is a real Act I set (>= 15 entries), and no hidden entry
// gates early-loop stats (qi / meridians / q / f).

import { describe, it, expect, beforeEach } from 'vitest'
import { ACHIEVEMENT_DATA, ACHIEVEMENT_KEY_PATTERN } from '@/data/achievements'
import { meets, type ConditionClauses } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { bootTestStores } from '@/test-setup'
import { REALM_DATA } from '@/data/realms'

/**
 * The meets() clause whitelist, hardcoded from ConditionClauses in
 * src/engine/meets.ts. PINNED ON PURPOSE: if a clause is added to the grammar,
 * add it here too. Do NOT add hint-shadow keys (sectUnjoined,
 * tribulationPassed, ...) — those live in evaluateHintCondition only, and an
 * achievement using one would silently never fire.
 */
const KNOWN_MEETS_CLAUSES: readonly (keyof ConditionClauses)[] = [
  'qi',
  'meridians',
  'primaryMeridiansAll',
  'temperTier',
  'realm',
  'daoNode',
  'daoElementTier',
  'anyDaoNode',
  'coreForged',
  'coreBelowCeiling',
  'sectJoined',
  'contribution',
  'achievement',
  'secretRealmClears',
  'professionChosen',
  'corruption',
  'daoHeartStacks',
  'seclusionRungs',
]

/** Early-loop clause keys + realms — content a hidden entry must never gate. */
const EARLY_LOOP_CLAUSES: readonly (keyof ConditionClauses)[] = ['qi', 'meridians']
const EARLY_LOOP_REALMS: readonly string[] = ['q', 'f']

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

  it('registry is a real Act I set (>= 15 entries)', () => {
    expect(ACHIEVEMENT_DATA.length).toBeGreaterThanOrEqual(15)
  })

  it('name and flavor are non-empty on every entry', () => {
    for (const def of ACHIEVEMENT_DATA) {
      expect(def.name.trim().length, `${def.key} name`).toBeGreaterThan(0)
      expect(def.flavor.trim().length, `${def.key} flavor`).toBeGreaterThan(0)
    }
  })

  it('v1: every done is meets()-expressible (never null)', () => {
    for (const def of ACHIEVEMENT_DATA) {
      expect(def.done, `${def.key} must not reserve an event-driven award() slot`).not.toBeNull()
    }
  })

  it('every condition key is a known meets() clause', () => {
    for (const def of ACHIEVEMENT_DATA) {
      for (const clauseKey of Object.keys(def.done!)) {
        expect(
          KNOWN_MEETS_CLAUSES,
          `${def.key} uses unknown clause "${clauseKey}" — it would evaluate false forever`,
        ).toContain(clauseKey)
      }
    }
  })

  it('every realm-clause label resolves to a real substage of that realm', () => {
    // A typo'd label also evaluates silently false forever (meets() returns
    // false on an unresolvable label) — pin labels to REALM_DATA.
    for (const def of ACHIEVEMENT_DATA) {
      const realmClause = def.done!.realm
      if (realmClause === undefined) continue
      const [realmId, threshold] = realmClause
      const row = REALM_DATA.find((r) => r.id === realmId)
      expect(row, `${def.key} references unknown realm "${realmId}"`).toBeDefined()
      if (typeof threshold === 'string') {
        const labels = row!.substages.map((s) => s.label)
        expect(
          labels,
          `${def.key} references unknown substage label "${threshold}" on realm ${realmId}`,
        ).toContain(threshold)
      }
    }
  })

  describe('fresh-boot semantics', () => {
    beforeEach(() => {
      bootTestStores()
    })

    it('no achievement is earnable on a literally fresh save', () => {
      const state = buildGameState()
      for (const def of ACHIEVEMENT_DATA) {
        expect(meets(def.done!, state), `${def.key} is true at boot — a zero-state bug`).toBe(false)
      }
    })
  })

  it('spine entries gating the first two realms are never hidden', () => {
    for (const def of ACHIEVEMENT_DATA) {
      if (def.category !== 'spine') continue
      const done = def.done!
      const gatesEarlyRealm =
        done.qi !== undefined ||
        (done.realm !== undefined && EARLY_LOOP_REALMS.includes(done.realm[0]))
      if (gatesEarlyRealm) {
        expect(def.hidden, `${def.key} veils the current loop (q/f spine)`).toBe(false)
      }
    }
  })

  it('hidden entries never gate early-loop content (veil the ahead, never the now)', () => {
    for (const def of ACHIEVEMENT_DATA) {
      if (!def.hidden) continue
      const done = def.done!
      for (const clauseKey of EARLY_LOOP_CLAUSES) {
        expect(done[clauseKey], `hidden ${def.key} gates early-loop clause "${clauseKey}"`).toBe(
          undefined,
        )
      }
      // A hidden entry may COMBINE a q/f clause with a late one, but must not
      // be earnable purely inside the first two realms: require at least one
      // clause beyond q/f-realm progression.
      const clauseKeys = Object.keys(done)
      const allEarly = clauseKeys.every(
        (k) => k === 'realm' && done.realm !== undefined && EARLY_LOOP_REALMS.includes(done.realm[0]),
      )
      expect(allEarly, `hidden ${def.key} is pure q/f-realm content`).toBe(false)
    }
  })
})
