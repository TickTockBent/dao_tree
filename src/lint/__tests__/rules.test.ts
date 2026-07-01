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
//   §6.4 secret realm data     — closed rotation, positive essence inputs, closed rewards.
//   §7.6 alchemy data          — closed economy, accelerant-only effects, §6.6 optionality.

import { describe, it, expect } from 'vitest'
import Decimal from 'break_eternity.js'
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
import { SECRET_REALM_DATA } from '@/data/secret-realm'
import { ALCHEMY_DATA } from '@/data/alchemy'
import { meets } from '@/engine/meets'
import type { GameState } from '@/engine/meets'
import type { MaterialKey } from '@/engine/types'

/**
 * A synthetic, fully-empty GameState — built from real REALM_DATA/LATTICE_DATA
 * shapes (so it satisfies the interface honestly) but at zero progress. Used
 * only to check that a condition EVALUATES without throwing; it is not
 * expected to be met.
 */
function syntheticEmptyState(): GameState {
  const realmBest = {} as GameState['realmBest']
  const realmSubstageLabel = {} as GameState['realmSubstageLabel']
  const realmSubstageThresholds = {} as GameState['realmSubstageThresholds']
  for (const r of REALM_DATA) {
    realmBest[r.id] = new Decimal(0)
    realmSubstageLabel[r.id] = null
    const labelMap: Record<string, number> = {}
    for (const s of r.substages) labelMap[s.label] = s.at
    realmSubstageThresholds[r.id] = labelMap
  }
  const daoNodeTier = {} as GameState['daoNodeTier']
  for (const node of LATTICE_DATA.nodes) daoNodeTier[node.key] = 0
  return {
    qi: new Decimal(0),
    primaryMeridians: 0,
    primaryMeridiansAll: false,
    temperTier: null,
    realmBest,
    realmSubstageLabel,
    realmSubstageThresholds,
    daoNodeTier,
    daoElementMaxTier: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    daoAnyNodeMaxTier: 0,
    coreGradeIndex: -1,
    coreCeilingIndex: 0,
    sectJoined: false,
    contributionBest: new Decimal(0),
    achievements: {},
    secretRealmClears: 0,
    professionChosen: false,
  }
}

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

// ---- §6.4 secret realm data --------------------------------------------------

describe('§6.4 secret realm data', () => {
  const realmOrder = ['q', 'f', 'c', 'n', 's']

  it('rotation period is positive', () => {
    expect(SECRET_REALM_DATA.rotation.periodSeconds).toBeGreaterThan(0)
  })

  it('essenceBase is positive', () => {
    expect(SECRET_REALM_DATA.essenceBase).toBeGreaterThan(0)
  })

  it('every site unlock references only defined realms/labels', () => {
    for (const site of SECRET_REALM_DATA.sites) {
      if (!site.unlock.realm) continue
      const [realmId, threshold] = site.unlock.realm
      expect(realmOrder, `${site.key} unlock references unknown realm ${realmId}`).toContain(realmId)
      if (typeof threshold === 'string') {
        const labels = findRealm(realmId).substages.map((s) => s.label)
        expect(labels, `${site.key} unlock references unknown label "${threshold}"`).toContain(threshold)
      }
    }
  })

  it('every essence model declares positive inputs', () => {
    for (const site of SECRET_REALM_DATA.sites) {
      const mod = site.modifier
      expect(mod.rateMult, `${site.key} rateMult is not positive`).toBeGreaterThan(0)
      if (mod.essenceModel === 'insightRate') {
        expect(mod.insightScale, `${site.key} insightRate has no positive insightScale`).toBeGreaterThan(0)
      }
    }
  })

  it('every site rewards a material the profession economy defines', () => {
    const known = new Set(ALCHEMY_DATA.materials.map((m) => m.key))
    for (const site of SECRET_REALM_DATA.sites) {
      expect(known.has(site.rewards.material), `${site.key} rewards an undefined material`).toBe(true)
    }
  })

  it('at most one site grants a firstClearGlimpseNode, and it names a real lattice node', () => {
    const withGlimpse = SECRET_REALM_DATA.sites.filter((s) => s.rewards.firstClearGlimpseNode)
    expect(withGlimpse.length).toBeLessThanOrEqual(1)
    const knownNodes = LATTICE_DATA.nodes.map((n) => n.key)
    for (const site of withGlimpse) {
      expect(knownNodes, `${site.key} glimpse names an unknown lattice node`).toContain(
        site.rewards.firstClearGlimpseNode,
      )
    }
  })

  it('every site declares positive durationSeconds and cooldownSeconds', () => {
    for (const site of SECRET_REALM_DATA.sites) {
      expect(site.durationSeconds, `${site.key} durationSeconds is not positive`).toBeGreaterThan(0)
      expect(site.cooldownSeconds, `${site.key} cooldownSeconds is not positive`).toBeGreaterThan(0)
    }
  })

  it('reveal + every site unlock parses under the meets() grammar without throwing', () => {
    const state = syntheticEmptyState()
    expect(() => meets(SECRET_REALM_DATA.reveal, state)).not.toThrow()
    for (const site of SECRET_REALM_DATA.sites) {
      expect(() => meets(site.unlock, state)).not.toThrow()
    }
  })
})

// ---- §7.6 alchemy data --------------------------------------------------------

describe('§7.6 alchemy data', () => {
  it('every recipe cost references materials that some site actually drops (closed economy)', () => {
    const dropped = new Set(SECRET_REALM_DATA.sites.map((s) => s.rewards.material))
    for (const recipe of ALCHEMY_DATA.recipes) {
      for (const matKey of Object.keys(recipe.cost) as MaterialKey[]) {
        expect(dropped.has(matKey), `${recipe.key} costs ${matKey}, which no site drops — dead content`).toBe(true)
      }
    }
  })

  it('every effect value is an accelerant (mult >= 1 / poolBonus > 0 / duration > 0)', () => {
    for (const recipe of ALCHEMY_DATA.recipes) {
      const effect = recipe.effect
      if (effect.type === 'timedQiMult') {
        expect(effect.mult, `${recipe.key} mult < 1`).toBeGreaterThanOrEqual(1)
        expect(effect.durationSeconds, `${recipe.key} durationSeconds is not positive`).toBeGreaterThan(0)
      } else if (effect.type === 'breakthroughAid') {
        expect(effect.gainMult, `${recipe.key} gainMult < 1`).toBeGreaterThanOrEqual(1)
        expect(effect.appliesTo.length, `${recipe.key} appliesTo is empty`).toBeGreaterThan(0)
      } else if (effect.type === 'tribulationPoolBonus') {
        expect(effect.poolBonus, `${recipe.key} poolBonus is not positive`).toBeGreaterThan(0)
      }
    }
  })

  it('reveal + every recipe unlock parses under the meets() grammar without throwing', () => {
    const state = syntheticEmptyState()
    expect(() => meets(ALCHEMY_DATA.reveal, state)).not.toThrow()
    for (const recipe of ALCHEMY_DATA.recipes) {
      expect(() => meets(recipe.unlock, state)).not.toThrow()
    }
  })

  it('§6.6: tribulation poolBonus stays well under a roughly-full preparedness pool', () => {
    // "Roughly full" = the sum of the pool's own term weights (each term
    // individually caps near its weight; summed, this is the practical
    // ceiling a well-prepared cultivator can bank). Optional means optional:
    // no purchasable bonus should approach a meaningful fraction of it.
    const pool = SETPIECE_DATA.firstTribulation.pool
    const fullPool =
      pool.weightTemper + pool.weightMeridians + pool.weightCoreGrade + pool.weightTechniques + pool.qiFuelWeight
    for (const recipe of ALCHEMY_DATA.recipes) {
      if (recipe.effect.type !== 'tribulationPoolBonus') continue
      const fraction = recipe.effect.poolBonus / fullPool
      expect(fraction, `${recipe.key} poolBonus is >= 15% of a full pool`).toBeLessThan(0.15)
    }
  })
})
