// src/stores/__tests__/epitaph.test.ts — the chronicle's voice (slice 10 step 7
// / D8 + D37). Epitaph rendering per richness tier, transcendence weighting, and
// the empty-chronicle veil condition.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChronicleStore } from '@/stores/chronicle'
import { epitaphFor, ordinal } from '@/stores/epitaph'
import type { ChronicleEntry } from '@/stores/chronicle'

function sampleEntry(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return {
    lifeNumber: 1,
    realmReached: 'c',
    grades: { legacy: null, foundation: null, core: null, tribulation: null },
    tribulationOutcome: null,
    rootConfig: null,
    severances: [],
    transcendences: [],
    trialsEndured: {},
    firstsReceipt: { total: 0, milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0 },
    richnessTier: 'line',
    strandsHeld: [],
    strandsMatured: [],
    strandsTransmitted: [],
    strandsTorn: [],
    ...overrides,
  }
}

/** Join an epitaph's clauses the way the UI reads them — one flowing account. */
function accountText(entry: ChronicleEntry): string {
  return epitaphFor(entry)
    .clauses.map((clause) => clause.text)
    .join(' ')
}

describe('epitaph: chapter tier renders the full account', () => {
  it('renders every populated field, in dynasty order', () => {
    const entry = sampleEntry({
      lifeNumber: 3,
      richnessTier: 'chapter',
      realmReached: 'c',
      rootConfig: { elements: ['fire', 'water'], purity: 'heaven' },
      grades: { legacy: 'Radiant Legacy', foundation: 'Solid', core: 'Upper', tribulation: 'Flawless' },
      tribulationOutcome: 'flawless',
      trialsEndured: { hollowCrown: 1 },
      severances: ['extraordinaryMeridians', 'flowingForm'],
      transcendences: ['flowingForm'],
      firstsReceipt: { total: 212, milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0 },
    })
    const epitaph = epitaphFor(entry)
    expect(epitaph.heading).toBe('Life 3')
    expect(epitaph.tier).toBe('chapter')
    expect(accountText(entry)).toBe(
      'Reached Core Formation. ' +
        'Bore a Heaven-grade root of Fire and Water. ' +
        'Left a Radiant Legacy. ' +
        'Built a Solid foundation. ' +
        'Forged an Upper core. ' +
        'Passed the tribulation, Flawless. ' +
        'Endured the Hollow Crown. ' +
        'Severed the Extraordinary Meridians. ' +
        'Transcended the Flowing Form — gone from every life to come. ' +
        'Crossed at 212 karma.',
    )
  })

  it('renders a failed tribulation as a fall, not a passage', () => {
    const entry = sampleEntry({ richnessTier: 'chapter', tribulationOutcome: 'failed', realmReached: 's' })
    expect(accountText(entry)).toContain('Fell to the tribulation.')
    expect(accountText(entry)).not.toContain('Passed the tribulation')
  })

  it('a minimal founding chapter still renders realm + karma', () => {
    const entry = sampleEntry({
      lifeNumber: 1,
      richnessTier: 'chapter',
      realmReached: 'q',
      firstsReceipt: { total: 7, milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0 },
    })
    expect(accountText(entry)).toBe('Reached Qi Condensation. Crossed at 7 karma.')
  })
})

describe('epitaph: summary tier — realm + best grade + the single most notable deed', () => {
  it('picks the most-advanced grade and one deed', () => {
    const entry = sampleEntry({
      richnessTier: 'summary',
      realmReached: 'c',
      grades: { legacy: 'Steady Legacy', foundation: 'Solid', core: 'Upper', tribulation: 'Scarred' },
      tribulationOutcome: 'scarred',
      severances: ['profession'],
      trialsEndured: { whisperingDoubt: 1 },
    })
    expect(epitaphFor(entry).clauses.map((clause) => clause.text)).toEqual([
      'Reached Core Formation.',
      'Passed the tribulation, Scarred.',
      'Severed the Profession.',
    ])
  })

  it('falls back to core when the life never reached the tribulation', () => {
    const entry = sampleEntry({
      richnessTier: 'summary',
      realmReached: 'c',
      grades: { legacy: 'Faint Legacy', foundation: 'Stable', core: 'Middle', tribulation: null },
      tribulationOutcome: null,
      trialsEndured: { hollowCrown: 1 },
    })
    expect(epitaphFor(entry).clauses.map((clause) => clause.text)).toEqual([
      'Reached Core Formation.',
      'Forged a Middle core.',
      'Endured the Hollow Crown.',
    ])
  })

  // The most-notable deed obeys transcendence > severance > trial.
  const deedCases: { name: string; entry: Partial<ChronicleEntry>; deed: string; weighted: boolean }[] = [
    {
      name: 'transcendence outranks severance and trial',
      entry: { transcendences: ['flowingForm'], severances: ['flowingForm', 'profession'], trialsEndured: { hollowCrown: 1 } },
      deed: 'Transcended the Flowing Form — gone from every life to come.',
      weighted: true,
    },
    {
      name: 'severance outranks trial',
      entry: { severances: ['profession'], trialsEndured: { hollowCrown: 1 } },
      deed: 'Severed the Profession.',
      weighted: false,
    },
    {
      name: 'trial when it is the only deed',
      entry: { trialsEndured: { hollowCrown: 1 } },
      deed: 'Endured the Hollow Crown.',
      weighted: false,
    },
  ]
  deedCases.forEach(({ name, entry, deed, weighted }) => {
    it(name, () => {
      const epitaph = epitaphFor(sampleEntry({ richnessTier: 'summary', realmReached: 'c', ...entry }))
      const deedClause = epitaph.clauses[epitaph.clauses.length - 1]!
      expect(deedClause.text).toBe(deed)
      expect(deedClause.transcendence).toBe(weighted)
    })
  })
})

describe('epitaph: line tier is a single clause', () => {
  it('renders realm + karma in one clause', () => {
    const entry = sampleEntry({
      richnessTier: 'line',
      realmReached: 'f',
      firstsReceipt: { total: 88, milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0 },
    })
    const epitaph = epitaphFor(entry)
    expect(epitaph.clauses).toHaveLength(1)
    expect(epitaph.clauses[0]!.text).toBe('Reached Foundation Establishment — crossed at 88 karma.')
  })

  it('renders karma alone when no realm was reached', () => {
    const entry = sampleEntry({
      richnessTier: 'line',
      realmReached: null,
      firstsReceipt: { total: 5, milestoneHeadline: 0, milestoneEcho: 0, deedEncounter: 0, gradeDelta: 0 },
    })
    expect(epitaphFor(entry).clauses.map((clause) => clause.text)).toEqual(['Crossed at 5 karma.'])
  })
})

describe('epitaph: transcendence weighting (the biggest event class, D39)', () => {
  it('weights the transcendence clause and never double-reads it as a severance', () => {
    const entry = sampleEntry({
      richnessTier: 'chapter',
      severances: ['flowingForm'],
      transcendences: ['flowingForm'],
    })
    const clauses = epitaphFor(entry).clauses
    const transcendence = clauses.find((clause) => clause.transcendence)
    expect(transcendence?.text).toBe('Transcended the Flowing Form — gone from every life to come.')
    // The cut is read once, as the transcendence — not also as a plain severance.
    expect(clauses.some((clause) => clause.text === 'Severed the Flowing Form.')).toBe(false)
  })
})

describe('epitaph: the empty-chronicle veil', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('a fresh chronicle has no page — the section is veiled (D11)', () => {
    const chronicle = useChronicleStore()
    expect(chronicle.lifeCount).toBe(0)
    expect(chronicle.lives.map((entry) => epitaphFor(entry))).toEqual([])
  })
})

describe('epitaph: ordinal (the living current-life line)', () => {
  const cases: [number, string][] = [
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [111, '111th'],
  ]
  cases.forEach(([value, expected]) => {
    it(`${value} → ${expected}`, () => {
      expect(ordinal(value)).toBe(expected)
    })
  })
})
