// src/stores/journal.ts — the narrative journal (ETERNAL scope, design §1.6).
//
// Port of the factory's journal layer. Entries latch when their `when` condition
// is met and NEVER re-lock, even across reincarnations (§8.1). The journal uses
// the hint-shadow grammar (HintCondition), evaluated via evaluateHintCondition.
// The Reflect action delivers bonus rewards once per entry.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { JOURNAL_DATA } from '@/data/journal'
import { evaluateHintCondition, type HintState } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useSectStore } from '@/stores/sect'
import { useTribulationStore } from '@/stores/tribulation'
import { useScarStore } from '@/stores/scar'
import type { JournalEntryKey, LayerId } from '@/engine/types'

export interface JournalSlice {
  latched: string[]
  reflected: string[]
  stage: string
}

export function freshJournalSlice(): JournalSlice {
  return { latched: [], reflected: [], stage: '' }
}

export const useJournalStore = defineStore('journal', () => {
  const game = useGameStore()
  const body = useBodyStore()
  const realm = useRealmStore()
  const sect = useSectStore()
  const trib = useTribulationStore()
  const scar = useScarStore()

  const latched = ref<Set<string>>(new Set())
  const reflected = ref<Set<string>>(new Set())
  const stage = ref('')

  /** Build the HintState snapshot for journal/hint evaluation. */
  function buildHintState(): HintState {
    const base = buildGameState()
    const unlockedLayers = new Set<LayerId>(['q'])
    if (realm.isUnlocked('f')) unlockedLayers.add('f')
    if (realm.isUnlocked('c')) unlockedLayers.add('c')
    if (realm.isUnlocked('n')) unlockedLayers.add('n')
    if (realm.isUnlocked('s')) unlockedLayers.add('s')
    if (sect.isRevealed()) unlockedLayers.add('sect' as LayerId)

    return {
      ...base,
      unlockedLayers,
      aspectUnchosen: realm.isUnlocked('n') && !body.soulAspectChosen,
      sectUnjoined: sect.isRevealed() && !sect.joined,
      tribulationReady: trib.tribulationIsReady,
      scarActive: scar.scarIsActive,
      tribulationPassed: trib.tribulationPassed,
      scarHealed: body.scarHealedDepth > 0,
    }
  }

  /** Latch any journal entries whose `when` condition is newly met. */
  function latchEntries(): void {
    const state = buildHintState()
    for (const entry of JOURNAL_DATA.entries) {
      if (latched.value.has(entry.key)) continue
      if (evaluateHintCondition(entry.when, state)) {
        latched.value = new Set(latched.value).add(entry.key)
      }
    }
  }

  /** The current cultivation stage (stamped on the journal for display). */
  function currentCultivationStage(): string {
    if (trib.tribulationPassed) return 'Soul Formation — Complete'
    if (realm.isUnlocked('s')) return 'Soul Formation'
    if (realm.isUnlocked('n')) return 'Nascent Soul'
    if (realm.isUnlocked('c')) return 'Core Formation'
    if (realm.isUnlocked('f')) return 'Foundation Establishment'
    return 'Qi Condensation'
  }

  /** Reflect on a journal entry (delivers bonus once). */
  function reflect(key: JournalEntryKey): void {
    if (!latched.value.has(key)) return
    if (reflected.value.has(key)) return
    const entry = JOURNAL_DATA.entries.find((e) => e.key === key)
    if (!entry?.bonus) return
    if ('qi' in entry.bonus) {
      game.points = game.points.add(new Decimal(entry.bonus.qi))
    } else if ('achievement' in entry.bonus) {
      const [_layer, _id] = entry.bonus.achievement
      void _layer; void _id
      // M6: gate store latches achievements via done(); bonus achievements
      // could be force-granted here, but the current data doesn't use this path.
    }
    reflected.value = new Set(reflected.value).add(key)
  }

  /** Ordered list of latched entries (for UI display). */
  const latchedEntries = computed(() =>
    JOURNAL_DATA.entries.filter((e) => latched.value.has(e.key)),
  )

  function update(_diff: number): void {
    latchEntries()
    stage.value = currentCultivationStage()
  }

  function save(): Record<string, unknown> {
    return {
      latched: [...latched.value],
      reflected: [...reflected.value],
      stage: stage.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshJournalSlice()) as Partial<JournalSlice>
    latched.value = new Set(s.latched ?? [])
    reflected.value = new Set(s.reflected ?? [])
    stage.value = s.stage ?? ''
  }
  function fresh(): Record<string, unknown> {
    return freshJournalSlice() as unknown as Record<string, unknown>
  }

  return {
    latched,
    reflected,
    stage,
    latchedEntries,
    latchEntries,
    currentCultivationStage,
    reflect,
    update,
    save,
    load,
    fresh,
  }
})
