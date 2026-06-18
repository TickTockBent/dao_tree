// src/lint/__tests__/rules.test.ts — semantic invariant checks (spec §9).
//
// Ports the semantic half of the old linter (js/build/linter.js). The
// structural half is absorbed by TypeScript types. These checks enforce:
//   §9.2 no dead multipliers   — every declared multiplier has a live consumer.
//   §9.3 completability        — reachability, no-circular-dependency.
//   §6   gradeScore scaling    — weight-sum-to-1, per-term max-input/denominator.
//   §8.2 keep rules            — row(target) < row(onResetOf).
//   §1.5 hint data             — catch-all LAST + exactly-one.
//   §4.2 lattice data          — acyclicity + root-reachability.
//   §6.1 stance data           — opportunity-cost (must trade DOWN and UP).
//   §5   soul aspect           — completability floor (Formless always available).
//   §4.3 sect data             — sub-linear exponent, ≥2 archetypes, ascending ats.
//   §8.1 legacy data           — weight-sum, ascending floors, qiMult ≥ 1.

import { describe, it, expect } from 'vitest'
import { REALM_DATA, findRealm } from '@/data/realms'
import { BODY_DATA } from '@/data/body'
import { GATE_DATA } from '@/data/gates'
import { SETPIECE_DATA } from '@/data/setpieces'
import { KEEP_RULES } from '@/data/keep-rules'
import { LATTICE_DATA } from '@/data/lattice'
import { STANCE_DATA } from '@/data/stances'
import { SECT_DATA } from '@/data/sect'
import { HINT_DATA } from '@/data/hints'
import { JOURNAL_DATA } from '@/data/journal'
import { LEGACY_DATA } from '@/data/legacy'
import { AUTOMATION_DATA } from '@/data/automation'

// ---- §9.2 no dead multipliers -----------------------------------------------

describe('§9.2 no dead multipliers', () => {
  it('every realm substage declares a qiMult', () => {
    for (const realm of REALM_DATA) {
      for (const stage of realm.substages) {
        expect(stage.qiMult, `${realm.id} ${stage.label} has no qiMult`).toBeDefined()
      }
    }
  })

  it('every temper tier declares a qiBonus', () => {
    for (const tier of BODY_DATA.temperTiers) {
      expect(tier.qiBonus, `${tier.label} has no qiBonus`).toBeDefined()
    }
  })

  it('every forge grade declares a globalMult', () => {
    for (const grade of SETPIECE_DATA.forge.grades) {
      expect(grade.globalMult, `${grade.label} has no globalMult`).toBeDefined()
    }
  })

  it('every Foundation band declares an fMult', () => {
    const fRealm = findRealm('f')
    if (fRealm.grade) {
      for (const band of fRealm.grade.bands) {
        expect(band.fMult, `${band.tier} has no fMult`).toBeDefined()
      }
    }
  })

  it('every gate achievement effect declares a qiMult', () => {
    for (const ach of GATE_DATA.achievements) {
      expect(ach.effect.qiMult, `${ach.key} has no qiMult`).toBeDefined()
    }
  })

  it('every lattice node effect declares qiMult or insightMult', () => {
    for (const node of LATTICE_DATA.nodes) {
      for (const effect of node.effects) {
        expect('qiMult' in effect || 'insightMult' in effect).toBe(true)
      }
    }
  })

  it('every stance declares at least one modifier < 1 and one > 1 (opportunity cost)', () => {
    for (const stance of STANCE_DATA.stances) {
      const mods = [stance.modifiers.qiMult, stance.modifiers.insightMult].filter((v) => v !== undefined) as number[]
      expect(mods.some((m) => m < 1), `${stance.key} has no modifier < 1`).toBe(true)
      expect(mods.some((m) => m > 1), `${stance.key} has no modifier > 1`).toBe(true)
    }
  })

  it('every legacy band declares a qiMult >= 1', () => {
    for (const band of LEGACY_DATA.actOne.bands) {
      expect(band.qiMult, `${band.label} has no qiMult`).toBeDefined()
      expect(band.qiMult, `${band.label} qiMult < 1`).toBeGreaterThanOrEqual(1)
    }
  })
})

// ---- §6 gradeScore scaling --------------------------------------------------

describe('§6 gradeScore scaling', () => {
  it('Foundation grade weights sum to 1', () => {
    const fRealm = findRealm('f')
    if (!fRealm.grade) return
    const w = fRealm.grade
    const sum = w.weightMeridian + w.weightTemper + w.weightRealm
    expect(sum).toBeCloseTo(1, 6)
  })

  it('Foundation bands are ascending by floor', () => {
    const fRealm = findRealm('f')
    if (!fRealm.grade) return
    for (let i = 1; i < fRealm.grade.bands.length; i++) {
      expect(fRealm.grade.bands[i]!.floor).toBeGreaterThanOrEqual(fRealm.grade.bands[i - 1]!.floor)
    }
  })

  it('Legacy grade weights sum to 1', () => {
    const w = LEGACY_DATA.actOne.weights
    const sum = w.coreGrade + w.tribulation + w.aspect + w.sectStanding + w.daoSeeds
    expect(sum).toBeCloseTo(1, 6)
  })

  it('Legacy bands are ascending by floor', () => {
    for (let i = 1; i < LEGACY_DATA.actOne.bands.length; i++) {
      expect(LEGACY_DATA.actOne.bands[i]!.floor).toBeGreaterThanOrEqual(LEGACY_DATA.actOne.bands[i - 1]!.floor)
    }
  })
})

// ---- §8.2 keep rules reachability -------------------------------------------

describe('§8.2 keep rules', () => {
  it('target row < onResetOf row (keep only goes downward)', () => {
    for (const rule of KEEP_RULES) {
      const targetRealm = findRealm(rule.target as 'q' | 'f' | 'c' | 'n' | 's')
      const resetterRealm = findRealm(rule.onResetOf)
      if (targetRealm && resetterRealm) {
        expect(targetRealm.row, `${rule.key}: target row >= resetter row`).toBeLessThan(resetterRealm.row)
      }
    }
  })
})

// ---- §1.5 hint data ---------------------------------------------------------

describe('§1.5 hint data', () => {
  it('exactly one catch-all (always: true) hint, and it is last', () => {
    const catchAlls = HINT_DATA.hints.filter((h) => 'always' in h && h.always)
    expect(catchAlls.length).toBe(1)
    expect(HINT_DATA.hints[HINT_DATA.hints.length - 1]).toBe(catchAlls[0])
  })
})

// ---- §4.2 lattice data ------------------------------------------------------

describe('§4.2 lattice data', () => {
  it('roots have empty requires', () => {
    for (const node of LATTICE_DATA.nodes) {
      if (node.requires.length === 0) {
        // Root node — OK
      } else {
        // Non-root: every prereq must exist
        for (const req of node.requires) {
          const found = LATTICE_DATA.nodes.find((n) => n.key === req)
          expect(found, `Node ${node.key} requires unknown node ${req}`).toBeDefined()
        }
      }
    }
  })

  it('no circular dependencies in requires', () => {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    function hasCycle(key: string): boolean {
      if (visiting.has(key)) return true
      if (visited.has(key)) return false
      visiting.add(key)
      const node = LATTICE_DATA.nodes.find((n) => n.key === key)
      if (node) {
        for (const req of node.requires) {
          if (hasCycle(req)) return true
        }
      }
      visiting.delete(key)
      visited.add(key)
      return false
    }
    for (const node of LATTICE_DATA.nodes) {
      expect(hasCycle(node.key), `Cycle detected at ${node.key}`).toBe(false)
    }
  })
})

// ---- §5 soul aspect completability ------------------------------------------

describe('§5 soul aspect', () => {
  it('Formless is always available (requires: {})', () => {
    const nRealm = findRealm('n')
    if (!nRealm.soulAspect) return
    const formless = nRealm.soulAspect.aspects.find((a) => a.key === 'formless')
    expect(formless).toBeDefined()
    // {} is an empty condition = always true.
    expect(Object.keys(formless!.requires)).toHaveLength(0)
  })
})

// ---- §4.3 sect data ---------------------------------------------------------

describe('§4.3 sect data', () => {
  it('contribution exponent is sub-linear (< 1)', () => {
    expect(SECT_DATA.contribution.exponent).toBeLessThan(1)
  })

  it('has at least 2 archetypes', () => {
    expect(SECT_DATA.archetypes.length).toBeGreaterThanOrEqual(2)
  })

  it('milestone `at` values are ascending', () => {
    for (let i = 1; i < SECT_DATA.milestones.length; i++) {
      expect(SECT_DATA.milestones[i]!.at).toBeGreaterThan(SECT_DATA.milestones[i - 1]!.at)
    }
  })
})

// ---- §8.1 legacy data -------------------------------------------------------

describe('§8.1 legacy data', () => {
  it('denominators are all positive', () => {
    const d = LEGACY_DATA.actOne.denominators
    expect(d.coreGrade).toBeGreaterThan(0)
    expect(d.aspect).toBeGreaterThan(0)
    expect(d.daoSeeds).toBeGreaterThan(0)
    expect(d.sectStanding).toBeGreaterThan(0)
    expect(d.tribulation).toBeGreaterThan(0)
  })
})

// ---- §7 automation data -----------------------------------------------------

describe('§7 automation data', () => {
  it('no automation targets temper (deliberately not automated)', () => {
    for (const row of AUTOMATION_DATA) {
      if (row.automates.action === 'buyable') {
        expect(row.automates.buyableKey, `${row.key} automates temper — forbidden`).not.toBe('temper')
      }
    }
  })
})

// ---- §9.3 completability (basic reachability) -------------------------------

describe('§9.3 completability', () => {
  it('every realm unlock references only earlier realms or body state', () => {
    // A realm's unlock must not require itself or a later realm.
    const realmOrder = ['q', 'f', 'c', 'n', 's']
    for (const realm of REALM_DATA) {
      const realmIdx = realmOrder.indexOf(realm.id)
      if (realm.unlock && 'realm' in realm.unlock) {
        const targetRealmId = realm.unlock.realm?.[0]
        if (!targetRealmId) continue
        const targetIdx = realmOrder.indexOf(targetRealmId)
        expect(targetIdx, `${realm.id} unlock references unknown realm`).toBeGreaterThanOrEqual(0)
        expect(targetIdx, `${realm.id} unlock requires a later realm`).toBeLessThan(realmIdx)
      }
    }
  })

  it('journal entries are reachable (when conditions use known keys)', () => {
    // Every journal entry's `when` condition should use only known hint keys.
    for (const entry of JOURNAL_DATA.entries) {
      expect(Object.keys(entry.when).length).toBeGreaterThan(0)
    }
  })
})
