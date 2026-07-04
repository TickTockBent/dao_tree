import { describe, it, expect } from 'vitest'
import Decimal from 'break_eternity.js'
import { format, formatWhole, formatTime } from '@/engine/format'
import { meets, type GameState } from '@/engine/meets'
import { decimalZero } from '@/engine/decimal'

describe('format', () => {
  it('formats zero', () => {
    expect(format(0)).toBe('0.00')
  })
  it('formats small numbers with regular precision', () => {
    expect(format(1)).toBe('1.00')
    expect(format(12.5)).toBe('12.50')
  })
  it('formats thousands with commas', () => {
    expect(format(1234)).toBe('1,234')
    expect(format(1234567)).toBe('1,234,567')
  })
  it('formats large numbers in exponential', () => {
    expect(format(1e10)).toBe('1.00e10')
    expect(format(1.5e15)).toBe('1.50e15')
  })
  it('handles Decimal inputs', () => {
    expect(format(new Decimal('1e10'))).toBe('1.00e10')
  })
  it('returns "NaN" for NaN decimals', () => {
    const nan = Decimal.dNaN
    expect(format(nan)).toBe('NaN')
  })
  it('formatWhole rounds large numbers', () => {
    expect(formatWhole(0)).toBe('0')
    expect(formatWhole(5)).toBe('5')
    expect(formatWhole(1e10)).toBe('1.00e10')
  })
  it('formatTime breaks down seconds', () => {
    expect(formatTime(30)).toBe('30.00s')
    expect(formatTime(90)).toBe('1m 30.00s')
    expect(formatTime(3700)).toBe('1h 1m 40.00s')
  })
})

describe('meets', () => {
  const baseState: GameState = {
    qi: decimalZero(),
    primaryMeridians: 0,
    primaryMeridiansAll: false,
    temperTier: null,
    realmBest: { q: decimalZero(), f: decimalZero(), c: decimalZero(), n: decimalZero(), s: decimalZero(), x: decimalZero() },
    realmSubstageLabel: { q: null, f: null, c: null, n: null, s: null, x: null },
    realmSubstageThresholds: {
      q: { '1st Level': 1, '6th Level': 90, '7th Level': 170 },
      f: {}, c: {}, n: {}, s: {}, x: {},
    },
    daoNodeTier: {} as Record<string, number>,
    daoElementMaxTier: {} as Record<string, number>,
    daoAnyNodeMaxTier: 0,
    coreGradeIndex: -1,
    coreCeilingIndex: 0,
    sectJoined: false,
    contributionBest: decimalZero(),
    achievements: {},
    secretRealmClears: 0,
    professionChosen: false,
    corruption: 0,
    daoHeartStacks: 0,
    seclusionRungs: 0,
    tribulationPassed: false,
    rebirths: 0,
  }

  it('empty condition is always true', () => {
    expect(meets({}, baseState)).toBe(true)
  })
  it('qi clause compares against player points', () => {
    const s = { ...baseState, qi: new Decimal(50) }
    expect(meets({ qi: 50 }, s)).toBe(true)
    expect(meets({ qi: 51 }, s)).toBe(false)
  })
  it('temperTier clause is reached-or-above, never equality (the 0.3.0 forge soft-lock)', () => {
    // A cultivator at Bones has passed Tendons: the tendon gate must hold.
    expect(meets({ temperTier: 'tendon' }, { ...baseState, temperTier: 'bone' })).toBe(true)
    // Exactly at the required tier also holds.
    expect(meets({ temperTier: 'tendon' }, { ...baseState, temperTier: 'tendon' })).toBe(true)
    // Below the required tier does not.
    expect(meets({ temperTier: 'tendon' }, { ...baseState, temperTier: 'flesh' })).toBe(false)
    // Untempered (null) never passes.
    expect(meets({ temperTier: 'skin' }, baseState)).toBe(false)
  })
  it('realm clause with named label checks best >= label threshold', () => {
    // 6th Level at:90. best=100 → reached 6th Level (and beyond).
    const s = { ...baseState, realmBest: { ...baseState.realmBest, q: new Decimal(100) } }
    expect(meets({ realm: ['q', '6th Level'] }, s)).toBe(true)
    // 7th Level at:170. best=100 → not reached.
    expect(meets({ realm: ['q', '7th Level'] }, s)).toBe(false)
  })
  it('realm clause with numeric threshold compares best', () => {
    const s = { ...baseState, realmBest: { ...baseState.realmBest, q: new Decimal(100) } }
    expect(meets({ realm: ['q', 100] }, s)).toBe(true)
    expect(meets({ realm: ['q', 101] }, s)).toBe(false)
  })
  it('multiple clauses AND-combine', () => {
    const s = {
      ...baseState,
      qi: new Decimal(50),
      primaryMeridians: 3,
    }
    expect(meets({ qi: 50, meridians: 3 }, s)).toBe(true)
    expect(meets({ qi: 50, meridians: 4 }, s)).toBe(false)
  })
  it('unknown keys are false (not silently true)', () => {
    // @ts-expect-error — deliberately testing runtime guard against untyped input
    expect(meets({ bogusKey: 1 }, baseState)).toBe(false)
  })
})
