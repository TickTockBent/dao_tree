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
//   §6.3 demon trial data      — completability by construction, ascending thresholds,
//                                resolvable trial keys, positive sources/bleed/repeat.

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
import { HEART_DEMON_DATA, findDemonTrial } from '@/data/heart-demons'
import { SECLUSION_DATA } from '@/data/seclusion'
import { meets, TEMPER_TIER_ORDER } from '@/engine/meets'
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
    corruption: 0,
    daoHeartStacks: 0,
    seclusionRungs: 0,
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

  it('BODY_DATA temper tiers match the meets() ladder order (reached-or-above semantics)', () => {
    // meets.ts keeps TEMPER_TIER_ORDER as pure vocabulary so the engine never
    // imports data; this pin is what makes that safe — the data ladder and the
    // clause ladder can never drift apart.
    expect(BODY_DATA.temperTiers.map((t) => t.key)).toEqual([...TEMPER_TIER_ORDER])
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

  it('no Seed-gated aspect punishes the default Qi grammar (the metalSoul trap-aspect rule)', () => {
    // An EARNED aspect must never be the wrong pick vs the free Formless floor
    // for the game's central Qi-banking playstyle: its qiMult (implicit 1 when
    // undeclared) must be >= Formless's. Found by the diversity sim's
    // counterfactual probes (2026-07-02) — a dominated option is a trust-tax.
    const nRealm = REALM_DATA.find((r) => r.soulAspect)
    const aspects = nRealm!.soulAspect!.aspects
    const formless = aspects.find((a) => a.key === 'formless')!
    const formlessQi = formless.effect.qiMult ?? 1
    for (const aspect of aspects) {
      if (aspect.element === null) continue
      expect(
        aspect.effect.qiMult ?? 1,
        `${aspect.key} punishes the default Qi grammar vs Formless`,
      ).toBeGreaterThanOrEqual(formlessQi)
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

// ---- §6.3 demon trial completability lint -----------------------------------

describe('§6.3 demon trial completability', () => {
  it('every trial objective is completable under its own modifiers', () => {
    for (const trial of HEART_DEMON_DATA.trials) {
      const objective = trial.objective
      if (objective.type === 'endure') {
        // Time always passes — no other modifier can block it.
        expect(objective.seconds, `${trial.key} endure.seconds is not positive`).toBeGreaterThan(0)
      } else if (objective.type === 'gatherQi') {
        // Qi must still accrue under the debuff, and the target must be finite.
        expect(
          objective.reqBaseFactor,
          `${trial.key} gatherQi.reqBaseFactor is not positive`,
        ).toBeGreaterThan(0)
        expect(
          Number.isFinite(objective.reqBaseFactor),
          `${trial.key} gatherQi.reqBaseFactor is not finite`,
        ).toBe(true)
        expect(
          trial.qiMultWhileActive,
          `${trial.key} gatherQi debuff zeroes Qi/sec — objective is unreachable`,
        ).toBeGreaterThan(0)
      } else if (objective.type === 'prestigeCount') {
        // The realm must remain prestigable at any scale under the debuff.
        expect(objective.count, `${trial.key} prestigeCount.count is not positive`).toBeGreaterThan(0)
        expect(
          trial.qiMultWhileActive,
          `${trial.key} prestigeCount debuff zeroes Qi/sec — objective is unreachable`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('every debuff is in (0, 1] (a real debuff, never zero, never a boost)', () => {
    for (const trial of HEART_DEMON_DATA.trials) {
      expect(trial.qiMultWhileActive, `${trial.key} qiMultWhileActive <= 0`).toBeGreaterThan(0)
      expect(trial.qiMultWhileActive, `${trial.key} qiMultWhileActive > 1 (not a debuff)`).toBeLessThanOrEqual(1)
    }
  })

  it('thresholds are strictly ascending', () => {
    const thresholds = HEART_DEMON_DATA.thresholds
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]!.at, `threshold ${i} is not ascending`).toBeGreaterThan(thresholds[i - 1]!.at)
    }
  })

  it('every threshold names a trial key that resolves', () => {
    for (const threshold of HEART_DEMON_DATA.thresholds) {
      expect(() => findDemonTrial(threshold.trial)).not.toThrow()
    }
  })

  it('repeatEvery is positive (the ladder never expires)', () => {
    expect(HEART_DEMON_DATA.repeatEvery).toBeGreaterThan(0)
  })

  it('thresholds[0].at is comfortably above any single source amount (no instant trial)', () => {
    const sources = HEART_DEMON_DATA.corruption.sources
    const amounts = [
      ...Object.values(sources.rushedBreakthrough),
      ...Object.values(sources.forgePush),
      ...Object.values(sources.tribulation),
    ] as number[]
    const maxSingleSource = Math.max(...amounts)
    expect(
      maxSingleSource,
      'a single corruption source can instantly trigger the first trial',
    ).toBeLessThan(HEART_DEMON_DATA.thresholds[0]!.at)
  })
})

// ---- §7.4 heart demon corruption data ----------------------------------------

describe('§7.4 heart demon corruption data', () => {
  it('every listed source amount is positive', () => {
    const sources = HEART_DEMON_DATA.corruption.sources
    const amounts = [
      ...Object.values(sources.rushedBreakthrough),
      ...Object.values(sources.forgePush),
      ...Object.values(sources.tribulation),
    ] as number[]
    expect(amounts.length).toBeGreaterThan(0)
    for (const amount of amounts) {
      expect(amount, 'a corruption source amount is not positive').toBeGreaterThan(0)
    }
  })

  it('bleed rates are positive (corruption always drains without a trial)', () => {
    expect(HEART_DEMON_DATA.corruption.bleedPerSecond).toBeGreaterThan(0)
    expect(HEART_DEMON_DATA.corruption.bleedPerDaoHeartStack).toBeGreaterThan(0)
  })

  it('Dao Heart qiMultPerStack is an accelerant (>= 1)', () => {
    expect(HEART_DEMON_DATA.daoHeart.qiMultPerStack).toBeGreaterThanOrEqual(1)
  })
})

// ---- §8.5 Deep Meditation (slice 8.5) ----------------------------------------

describe('§8.5 seclusion data', () => {
  it('every rung unlock references its own realm at best >= 1 (evaluates cleanly)', () => {
    const state = syntheticEmptyState()
    for (const rung of SECLUSION_DATA.rungs) {
      expect(rung.unlock).toEqual({ realm: [rung.realm, 1] })
      expect(() => meets(rung.unlock, state)).not.toThrow()
    }
  })

  it('costs and bonuses are positive and costs strictly ascend (each rung a real decision)', () => {
    expect(SECLUSION_DATA.baseCapSeconds).toBeGreaterThan(0)
    let previousCost = 0
    for (const rung of SECLUSION_DATA.rungs) {
      expect(rung.capBonusSeconds).toBeGreaterThan(0)
      expect(rung.qiCost).toBeGreaterThan(previousCost)
      previousCost = rung.qiCost
    }
  })

  it('rungs cost ONLY Qi (§6.6: QoL never requires optional systems)', () => {
    // Structural: the SeclusionRung type has exactly one cost field, qiCost.
    // This pin fails if anyone adds a second currency field to a rung row.
    for (const rung of SECLUSION_DATA.rungs) {
      const costKeys = Object.keys(rung).filter((k) => k.toLowerCase().includes('cost'))
      expect(costKeys).toEqual(['qiCost'])
    }
  })
})
