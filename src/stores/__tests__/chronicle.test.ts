// src/stores/__tests__/chronicle.test.ts — the chronicle (slice 10 / D37 §5).
//
// The per-life entry schema (incl. richness tiers + the strand reserve fields)
// and writeLife are inert skeletons; these tests pin the shape and the
// save/load round-trip so the later chronicle agent builds against a stable
// contract.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChronicleStore, freshChronicleSlice } from '@/stores/chronicle'
import type { ChronicleEntry } from '@/stores/chronicle'

function sampleEntry(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return {
    lifeNumber: 1,
    realmReached: 's',
    grades: { legacy: 'steady', foundation: 'Solid', core: 'middle', tribulation: 'scarred' },
    tribulationOutcome: 'scarred',
    rootConfig: null,
    severances: ['soulAspect'],
    trialsEndured: { whisperingDoubt: 1 },
    firstsReceipt: {
      total: 42,
      milestoneHeadline: 30,
      milestoneEcho: 6,
      deedEncounter: 6,
      gradeDelta: 0,
    },
    richnessTier: 'chapter',
    strandsHeld: [],
    strandsMatured: [],
    strandsTransmitted: [],
    strandsTorn: [],
    ...overrides,
  }
}

describe('chronicle store: fresh slice', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with no entries', () => {
    const chronicle = useChronicleStore()
    expect(chronicle.lives).toEqual([])
    expect(chronicle.lifeCount).toBe(0)
    expect(freshChronicleSlice()).toEqual({ entries: [] })
  })
})

describe('chronicle store: writeLife', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('appends an entry preserving the full schema, incl. strand reserve fields', () => {
    const chronicle = useChronicleStore()
    const entry = sampleEntry()
    chronicle.writeLife(entry)
    expect(chronicle.lifeCount).toBe(1)
    expect(chronicle.lives[0]).toEqual(entry)
    // Strand reserve fields ship empty (all four arrays present).
    expect(chronicle.lives[0]!.strandsHeld).toEqual([])
    expect(chronicle.lives[0]!.strandsMatured).toEqual([])
    expect(chronicle.lives[0]!.strandsTransmitted).toEqual([])
    expect(chronicle.lives[0]!.strandsTorn).toEqual([])
  })

  it('appends in dynasty order and supports every richness tier', () => {
    const chronicle = useChronicleStore()
    chronicle.writeLife(sampleEntry({ lifeNumber: 1, richnessTier: 'chapter' }))
    chronicle.writeLife(sampleEntry({ lifeNumber: 2, richnessTier: 'summary' }))
    chronicle.writeLife(sampleEntry({ lifeNumber: 3, richnessTier: 'line' }))
    expect(chronicle.lives.map((e) => e.lifeNumber)).toEqual([1, 2, 3])
    expect(chronicle.lives.map((e) => e.richnessTier)).toEqual(['chapter', 'summary', 'line'])
  })
})

describe('chronicle store: save/load round-trip', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('round-trips entries', () => {
    const chronicle = useChronicleStore()
    chronicle.writeLife(sampleEntry({ lifeNumber: 1 }))
    chronicle.writeLife(sampleEntry({ lifeNumber: 2, realmReached: 'x', richnessTier: 'summary' }))
    const saved = chronicle.save()

    setActivePinia(createPinia())
    const reloaded = useChronicleStore()
    reloaded.load(saved)
    expect(reloaded.save()).toEqual(saved)
    expect(reloaded.lifeCount).toBe(2)
  })

  it('load(undefined) yields the fresh slice (old saves have no chronicle slice)', () => {
    const chronicle = useChronicleStore()
    chronicle.load(undefined)
    expect(chronicle.lives).toEqual([])
  })
})
