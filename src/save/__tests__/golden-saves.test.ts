// Golden-save lineage harness (ledger #9 consequence (a), Steam soft-yes).
//
// Every fixture in ../goldens/ is a save exactly as a SHIPPED version wrote
// it. Each is pushed through the full revive path (migrations → merge over
// fresh defaults → Decimal hydration) into live stores on current HEAD, then
// ticked and round-tripped. If one of these tests fails, HEAD broke save
// compatibility with a shipped version: fix HEAD or write a migration —
// never delete the golden. Format + rules: ../goldens/README.md.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { reviveSave, exportSave, importSave, findNaN, SAVE_VERSION } from '@/engine/save'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { useGateStore } from '@/stores/gate'
import { useRealmStore } from '@/stores/realm'
import { useForgeStore } from '@/stores/forge'
import { useTribulationStore } from '@/stores/tribulation'
import { useScarStore } from '@/stores/scar'
import { useLegacyStore } from '@/stores/legacy'
import { useJournalStore } from '@/stores/journal'
import { useHintsStore } from '@/stores/hints'
import { useAutomationStore } from '@/stores/automation'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { useAchievementsStore } from '@/stores/achievements'

interface GoldenExpect {
  path: string
  gte?: number
  equals?: unknown
}

interface GoldenFixture {
  version: string
  note: string
  save: Record<string, unknown>
  expect: GoldenExpect[]
}

const GOLDENS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'goldens')

const fixtureFiles = readdirSync(GOLDENS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()

/** Tick every registered system, mirroring main.ts's updater order. */
function tickAll(diff: number): void {
  useBodyStore().update(diff)
  useDaoStore().update(diff)
  useSectStore().update(diff)
  useGateStore().update(diff)
  useRealmStore().update(diff)
  useForgeStore().update(diff)
  useTribulationStore().update(diff)
  useScarStore().update(diff)
  useLegacyStore().update(diff)
  useJournalStore().update(diff)
  useHintsStore().update(diff)
  useAutomationStore().update(diff)
  useSecretRealmStore().update(diff)
  useAlchemyStore().update(diff)
  useHeartDemonsStore().update(diff)
  useAchievementsStore().update(diff)
}

/** Resolve a dotted path against an object (Decimal-safe leaf return). */
function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** Numeric compare that tolerates Decimal instances and serialized strings. */
function asDecimal(v: unknown): Decimal {
  if (v instanceof Decimal) return v
  return new Decimal(String(v))
}

const TICK_ROUNDS = 20
const TICK_DIFF_SECONDS = 0.5

describe('golden-save lineage', () => {
  it('has at least one golden fixture', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0)
  })

  for (const file of fixtureFiles) {
    const fixture = JSON.parse(readFileSync(join(GOLDENS_DIR, file), 'utf-8')) as GoldenFixture

    describe(`${fixture.version} (${file})`, () => {
      it('revives, loads, and ticks on current HEAD without corruption', () => {
        bootTestStores()
        const game = useGameStore()

        const revived = reviveSave(structuredClone(fixture.save))
        expect(revived.saveVersion).toBe(SAVE_VERSION)
        game.applySave(revived)

        for (let i = 0; i < TICK_ROUNDS; i++) tickAll(TICK_DIFF_SECONDS)

        const rebuilt = game.buildSave()
        expect(findNaN(rebuilt)).toBeNull()

        for (const check of fixture.expect) {
          const value = getPath(rebuilt, check.path)
          if (check.gte !== undefined) {
            expect(
              asDecimal(value).gte(check.gte),
              `${check.path} = ${String(value)} should be >= ${check.gte}`,
            ).toBe(true)
          }
          if (check.equals !== undefined) {
            expect(JSON.parse(JSON.stringify(value)), check.path).toEqual(check.equals)
          }
        }
      })

      it('round-trips through export/import stably', () => {
        bootTestStores()
        const game = useGameStore()
        game.applySave(reviveSave(structuredClone(fixture.save)))

        const once = exportSave(game.buildSave())
        game.applySave(importSave(once))
        const twice = exportSave(game.buildSave())

        // time/timePlayed are wall-clock fields; the export string would only
        // differ if state mutated between the two builds — it must not.
        expect(twice).toBe(once)

        // And the expect block still holds after the round trip.
        const rebuilt = game.buildSave()
        for (const check of fixture.expect) {
          const value = getPath(rebuilt, check.path)
          if (check.gte !== undefined) {
            expect(asDecimal(value).gte(check.gte), check.path).toBe(true)
          }
        }
      })
    })
  }
})
