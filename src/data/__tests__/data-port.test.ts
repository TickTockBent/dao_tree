// Snapshot-style tests asserting the data port faithfully matches the 0.2.x
// originals. Catches accidental drift during the port (a renamed label, a
// transposed digit, a dropped field). These pin the contract the engine code
// in M3+ will rely on.

import { describe, it, expect } from 'vitest'
import {
  REALM_DATA,
  SETPIECE_DATA,
  BODY_DATA,
  GATE_DATA,
  TREE_DATA,
  KEEP_RULES,
  LATTICE_DATA,
  STANCE_DATA,
  HINT_DATA,
  AUTOMATION_DATA,
  SECT_DATA,
  TECHNIQUE_DATA,
  JOURNAL_DATA,
  LEGACY_DATA,
  FACTORY_NUMERICS,
  findRealm,
  substageLabelAtBest,
} from '@/data'

describe('FACTORY_NUMERICS', () => {
  it('matches the 0.2.x values', () => {
    expect(FACTORY_NUMERICS.zero).toBe(0)
    expect(FACTORY_NUMERICS.one).toBe(1)
    expect(FACTORY_NUMERICS.hundred).toBe(100)
    expect(FACTORY_NUMERICS.firstGridClickableId).toBe(11)
    expect(FACTORY_NUMERICS.maturityBarSegments).toBe(20)
    expect(FACTORY_NUMERICS.autoPrestigeSimMaxCycles).toBe(500)
  })
})

describe('REALM_DATA', () => {
  it('has exactly the 5 Act I realms in order', () => {
    expect(REALM_DATA.map((r) => r.id)).toEqual(['q', 'f', 'c', 'n', 's'])
    expect(REALM_DATA.map((r) => r.row)).toEqual([0, 1, 2, 3, 4])
  })

  it('qi condensation tuned values match', () => {
    const q = findRealm('q')
    expect(q.reqBase).toBe(20)
    expect(q.gainExp).toBe(0.6)
    expect(q.unlock).toEqual({ qi: 50 })
    expect(q.substages).toHaveLength(13)
    expect(q.substages[0]).toEqual({ label: '1st Level', at: 1, qiMult: 1.1 })
    expect(q.substages[12]).toEqual({ label: '13th Level', at: 2800, qiMult: 1.2 })
    expect(q.reveals).toEqual({ '6th Level': 'foundation', '10th Level': 'extraordinary' })
  })

  it('foundation is graded with the 4 bands', () => {
    const f = findRealm('f')
    expect(f.graded).toBe(true)
    expect(f.grade?.weightMeridian).toBe(0.4)
    expect(f.grade?.weightTemper).toBe(0.4)
    expect(f.grade?.weightRealm).toBe(0.2)
    expect(f.grade?.bands.map((b) => b.tier)).toEqual(['Flawed', 'Stable', 'Solid', 'Heaven-grade'])
    expect(f.grade?.bands[0]).toEqual({ floor: 0, tier: 'Flawed', fMult: 1, coreCeiling: 'lower', baseCore: 'cracked' })
    expect(f.grade?.bands[3]).toEqual({ floor: 0.85, tier: 'Heaven-grade', fMult: 3.5, coreCeiling: 'perfect', baseCore: 'upper' })
  })

  it('core formation carries the forge setpiece', () => {
    expect(findRealm('c').setpiece).toBe('forge')
  })

  it('nascent soul carries 6 soul aspects with formless floor', () => {
    const n = findRealm('n')
    expect(n.reqBase).toBe(1000000)
    expect(n.soulAspect?.aspects).toHaveLength(6)
    const formless = n.soulAspect?.aspects[0]
    expect(formless?.key).toBe('formless')
    expect(formless?.requires).toEqual({})
    expect(formless?.effect).toEqual({ qiMult: 1.2, insightMult: 1.2 })
  })

  it('soul formation carries the firstTribulation setpiece', () => {
    expect(findRealm('s').setpiece).toBe('firstTribulation')
  })

  it('substageLabelAtBest resolves named labels correctly', () => {
    const q = findRealm('q')
    expect(substageLabelAtBest(q, 0)).toBeNull()
    expect(substageLabelAtBest(q, 1)).toBe('1st Level')
    expect(substageLabelAtBest(q, 90)).toBe('6th Level')
    expect(substageLabelAtBest(q, 800)).toBe('10th Level')
    expect(substageLabelAtBest(q, 5000)).toBe('13th Level')
  })
})

describe('SETPIECE_DATA', () => {
  it('forge has 3 push options and 5 grades', () => {
    expect(SETPIECE_DATA.forge.pushOptions.map((p) => p.key)).toEqual(['steady', 'forceful', 'reckless'])
    expect(SETPIECE_DATA.forge.grades.map((g) => g.key)).toEqual(['cracked', 'lower', 'middle', 'upper', 'perfect'])
    expect(SETPIECE_DATA.forge.grades[4]!.globalMult).toBe(8)
    expect(SETPIECE_DATA.forge.forgeReq).toBe(25)
    expect(SETPIECE_DATA.forge.fuelBase).toBe(25)
  })

  it('tribulation has 5 waves and 4 grades with the scar pattern', () => {
    const t = SETPIECE_DATA.firstTribulation
    expect(t.waves).toHaveLength(5)
    expect(t.waves[4]!.damage).toBe(36)
    expect(t.grades.map((g) => g.key)).toEqual(['failed', 'shaken', 'scarred', 'flawless'])
    expect(t.grades[0]).toMatchObject({ passes: false, scars: true })
    expect(t.grades[2]).toMatchObject({ passes: true, scars: true, floor: 0.35 })
    expect(t.grades[3]).toMatchObject({ passes: true, scars: false, floor: 0.7 })
    expect(t.retryCooldownSeconds).toBe(60)
  })

  it('scar table ceiling is 3', () => {
    expect(SETPIECE_DATA.scar.maxDepth).toBe(3)
    expect(SETPIECE_DATA.scar.debuffQiMultPerDepth).toBe(0.88)
    expect(SETPIECE_DATA.scar.temperedQiMultPerDepth).toBe(1.06)
  })
})

describe('BODY_DATA', () => {
  it('has 3 buyables with tuned costs', () => {
    expect(BODY_DATA.buyables.map((b) => b.key)).toEqual(['primaryMeridian', 'extraordinaryMeridian', 'temper'])
    const primary = BODY_DATA.buyables[0]
    expect(primary?.costBase).toBe(10)
    expect(primary?.costRatio).toBe(2)
    expect(primary?.effectBase).toBe(1.15)
    expect(primary?.limit).toBe(12)
    const extra = BODY_DATA.buyables[1]
    expect(extra?.unlock).toEqual({ primaryMeridiansAll: true, realm: ['q', '10th Level'] })
  })

  it('qi baseRate is 2', () => {
    expect(BODY_DATA.qi.baseRate).toBe(2)
  })

  it('has 5 temper tiers', () => {
    expect(BODY_DATA.temperTiers.map((t) => t.key)).toEqual(['skin', 'flesh', 'tendon', 'bone', 'marrow'])
    expect(BODY_DATA.temperTiers[2]).toEqual({ key: 'tendon', label: 'Tendons', fromLevel: 10, qiBonus: 1.05 })
  })
})

describe('GATE_DATA', () => {
  it('has 2 checkpoint achievements', () => {
    expect(GATE_DATA.achievements.map((a) => a.key)).toEqual(['outerDisciple', 'innerDisciple'])
    expect(GATE_DATA.achievements[0]?.effect.qiMult).toBe(1.25)
    expect(GATE_DATA.achievements[1]?.effect.qiMult).toBe(1.3)
  })
})

describe('TREE_DATA', () => {
  it('has 5 tree-scoped realms + 6 life + 2 eternal', () => {
    const scopes = Object.entries(TREE_DATA.layers).map(([id, e]) => `${id}:${e.scope}`)
    expect(scopes).toEqual([
      'q:tree', 'f:tree', 'c:tree', 'n:tree', 's:tree',
      'b:life', 'gate:life', 'dao:life', 'sect:life',
      'journal:eternal', 'legacy:eternal',
      // Slice 7: expeditions + the profession are life-scoped (never cascade-reset).
      'secret:life', 'alchemy:life',
    ])
  })
})

describe('KEEP_RULES', () => {
  it('has 3 rules mirroring 0.2.x', () => {
    expect(KEEP_RULES.map((r) => r.key)).toEqual([
      'qiInsightSurvivesFoundation',
      'foundationSurvivesNascentSoul',
      'soulCarriesTheClimb',
    ])
    expect(KEEP_RULES[0]).toMatchObject({ grantedBy: { layer: 'f', milestone: 3 }, onResetOf: 'f', target: 'q' })
    expect(KEEP_RULES[2]).toMatchObject({ grantedBy: { layer: 's', milestone: 2 }, onResetOf: 's', target: 'n' })
  })
})

describe('LATTICE_DATA', () => {
  it('has exactly 15 nodes across 3 rings', () => {
    expect(LATTICE_DATA.nodes).toHaveLength(15)
    expect(LATTICE_DATA.nodes[0]).toMatchObject({ key: 'metal', element: 'metal', requires: [] })
    expect(LATTICE_DATA.nodes[5]).toMatchObject({ key: 'sword', element: 'metal', requires: ['metal'] })
    expect(LATTICE_DATA.nodes[14]).toMatchObject({ key: 'endurance', element: 'earth' })
  })

  it('has the flow/stillness conflict', () => {
    expect(LATTICE_DATA.conflicts).toEqual([['flow', 'stillness']])
  })

  it('insight baseRate is 0.5', () => {
    expect(LATTICE_DATA.insight.baseRate).toBe(0.5)
  })
})

describe('STANCE_DATA', () => {
  it('has 2 stances that trade', () => {
    expect(STANCE_DATA.stances.map((s) => s.key)).toEqual(['breathingTrance', 'swordTrance'])
    expect(STANCE_DATA.stances[0]?.modifiers).toEqual({ qiMult: 0.7, insightMult: 2.0 })
    expect(STANCE_DATA.stances[1]?.unlock).toEqual({ daoNode: ['sword', 1] })
  })
})

describe('HINT_DATA', () => {
  it('has exactly one catch-all as the last row', () => {
    const catchAlls = HINT_DATA.hints.filter((h) => h.always === true)
    expect(catchAlls).toHaveLength(1)
    expect(HINT_DATA.hints[HINT_DATA.hints.length - 1]?.always).toBe(true)
    expect(HINT_DATA.hints[HINT_DATA.hints.length - 1]?.key).toBe('gatherQi')
  })

  it('first row is actComplete', () => {
    expect(HINT_DATA.hints[0]?.key).toBe('actComplete')
  })
})

describe('AUTOMATION_DATA', () => {
  it('has 4 grants', () => {
    expect(AUTOMATION_DATA.map((a) => a.key)).toEqual([
      'nascentQiPrestige',
      'nascentPrimaryMeridians',
      'nascentExtraordinaryMeridians',
      'sectFoundationBell',
    ])
    expect(AUTOMATION_DATA[3]?.automates).toMatchObject({ layer: 'f', action: 'prestige' })
  })
})

describe('SECT_DATA', () => {
  it('has 2 archetypes and 3 milestones', () => {
    expect(SECT_DATA.archetypes.map((a) => a.key)).toEqual(['azureSword', 'stoneFormation'])
    expect(SECT_DATA.milestones.map((m) => m.key)).toEqual(['stipend', 'library', 'arsenal'])
    expect(SECT_DATA.milestones[2]?.requires).toEqual({ realm: ['c', 'Core Forged'] })
    expect(SECT_DATA.contribution.exponent).toBe(0.5)
  })
})

describe('TECHNIQUE_DATA', () => {
  it('has 8 techniques across 3 schools', () => {
    expect(TECHNIQUE_DATA).toHaveLength(8)
    const schools = new Set(TECHNIQUE_DATA.map((t) => t.school))
    expect(schools).toEqual(new Set(['sword', 'formation', 'universal']))
  })
})

describe('JOURNAL_DATA', () => {
  it('has 16 entries with firstBreath + actOneLegacy at the ends', () => {
    expect(JOURNAL_DATA.entries).toHaveLength(16)
    expect(JOURNAL_DATA.entries[0]?.key).toBe('firstBreath')
    expect(JOURNAL_DATA.entries[15]?.key).toBe('actOneLegacy')
  })

  it('first two entries grant qi 100 bonus', () => {
    expect(JOURNAL_DATA.entries[0]?.bonus).toEqual({ qi: 100 })
    expect(JOURNAL_DATA.entries[1]?.bonus).toEqual({ qi: 100 })
  })
})

describe('LEGACY_DATA', () => {
  it('actOne weights sum to 1.0 with 4 bands', () => {
    const w = LEGACY_DATA.actOne.weights
    const sum = w.coreGrade + w.tribulation + w.aspect + w.sectStanding + w.daoSeeds
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
    expect(LEGACY_DATA.actOne.bands.map((b) => b.key)).toEqual(['faint', 'steady', 'radiant', 'eternal'])
    expect(LEGACY_DATA.actOne.bands[3]?.qiMult).toBe(1.6)
  })
})
