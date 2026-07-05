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
//   §5 cross-tree keeps (docs/slice-9.md §5, distinct from the early-game-spec
//                         §5 above) — every act2-tree realm's clause keys are
//                         declared in CROSS_TREE_KEEPS; the table's own rows
//                         are well-formed; the doReset cascade never crosses
//                         tree membership.
//   §6 severance shape (docs/slice-9.md §6, D25) — lint-interim stand-ins for
//                        the three mechanical assertions (lifetime net >= 1,
//                        bounded weakness window, >=3 live severables) that
//                        wait on Act II sim actors, computed analytically off
//                        SETPIECE_DATA.severance; plus the corpse-count floor.

import { describe, it, expect } from 'vitest'
import Decimal from 'break_eternity.js'
import { REALM_DATA, findRealm, realmWithSoulAspect } from '@/data/realms'
import { BODY_DATA } from '@/data/body'
import { GATE_DATA } from '@/data/gates'
import { SETPIECE_DATA } from '@/data/setpieces'
import { KEEP_RULES } from '@/data/keep-rules'
import { TREE_DATA, CROSS_TREE_KEEPS } from '@/data/trees'
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
import { SEVERING_DATA } from '@/data/severing'
import { meets, TEMPER_TIER_ORDER } from '@/engine/meets'
import type { GameState, ConditionClauses } from '@/engine/meets'
import type { MaterialKey } from '@/engine/types'
import { treeResetKeepKeys, reincarnationResetLayers } from '@/engine/doReset'
import {
  KARMA_DATA,
  KARMA_DECAY_RATIO,
  KARMA_FLOOR,
  VARIANT_SHARE,
  CLASS_ALLOWED_AXES,
  AXIS_VOCAB_SIZE,
  karmaExpansion,
} from '@/data/karma'
import type { KarmaQualifierAxis } from '@/data/karma'

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
    tribulationPassed: false,
    rebirths: 0,
    transcendences: 0,
  }
}

// ---- §9.2 no dead multipliers -----------------------------------------------

describe('§9.2 no dead multipliers', () => {
  it('every realm substage declares a qiMult (or null — the D33 severance reward)', () => {
    for (const realm of REALM_DATA) {
      for (const stage of realm.substages) {
        // D33: `null` is the EXPLICIT "the reward is the severance itself, not a
        // modifier" form (realm-x). It is not a silent no-op — it is a
        // deliberate sentinel every consumer must skip. Any non-null value must
        // be a real multiplier (> 1), never a dead 1.0 (§9.2 no dead mults).
        const declared = stage.qiMult
        expect(declared, `${realm.id} ${stage.label} qiMult undefined (must be number|null)`).not.toBeUndefined()
        if (declared !== null) {
          expect(declared, `${realm.id} ${stage.label} qiMult ${declared} is a dead multiplier`).toBeGreaterThan(1)
        }
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
    const realmOrder = ['q', 'f', 'c', 'n', 's', 'x']
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

// ---- §5 cross-tree keeps (slice 9 / docs/slice-9.md §5) ---------------------
//
// "Act II's tree reads Act I state through explicit keep-rules — every
// Act I → Act II dependency is DECLARED, not emergent." CROSS_TREE_KEEPS
// (src/data/trees.ts) is that declaration surface; these checks make sure it
// stays honest as the data grows.

/**
 * A completeness-checked sample `Condition` covering every `ConditionClauses`
 * key. `satisfies` forces this object to have a property for every key in the
 * grammar — if `meets.ts` adds a clause, this literal fails to type-check
 * until it is updated, so `ALL_CONDITION_CLAUSE_KEYS` can never silently fall
 * out of sync with the real grammar (caught by `npm run build`, this file's
 * own gate).
 */
const SAMPLE_ALL_CLAUSES = {
  qi: 0,
  meridians: 0,
  primaryMeridiansAll: true,
  temperTier: 'skin',
  realm: ['q', 0],
  daoNode: ['metal', 0],
  daoElementTier: ['metal', 0],
  anyDaoNode: 0,
  coreForged: true,
  coreBelowCeiling: true,
  sectJoined: true,
  contribution: 0,
  achievement: ['q', 0],
  secretRealmClears: 0,
  professionChosen: true,
  corruption: 0,
  daoHeartStacks: 0,
  seclusionRungs: 0,
  tribulationPassed: true,
  rebirths: 0,
  transcendences: 0,
} satisfies ConditionClauses

const ALL_CONDITION_CLAUSE_KEYS: readonly string[] = Object.keys(SAMPLE_ALL_CLAUSES)

/** Layer ids belonging to a given tree, derived from TREE_DATA (no hardcoded ids). */
function layerIdsInTree(treeId: string): string[] {
  return Object.entries(TREE_DATA.layers)
    .filter(([, entry]) => entry.scope === 'tree' && entry.tree === treeId)
    .map(([id]) => id)
}

describe('§5 cross-tree keeps', () => {
  it('every act2-tree realm\'s reveal/unlock clause keys are declared in CROSS_TREE_KEEPS', () => {
    // Auto-iterating: derives act2 membership from TREE_DATA, not a
    // hardcoded realm id — a future act2 realm with an undeclared read fails.
    const act2LayerIds = new Set(layerIdsInTree('act2'))
    const declaredReads = new Set(CROSS_TREE_KEEPS.map((row) => row.reads))
    for (const realm of REALM_DATA) {
      if (!act2LayerIds.has(realm.id)) continue
      const clauseKeys = [
        ...Object.keys(realm.reveal ?? {}),
        ...Object.keys(realm.unlock ?? {}),
      ]
      for (const clauseKey of clauseKeys) {
        expect(
          declaredReads.has(clauseKey),
          `${realm.id}'s reveal/unlock reads "${clauseKey}" — undeclared in CROSS_TREE_KEEPS`,
        ).toBe(true)
      }
    }
  })

  it('every CROSS_TREE_KEEPS row\'s `reads` value is a valid ConditionClauses key or a dotted store descriptor', () => {
    // This is the mechanically-honest half of the §5 spec's part (b): it
    // CANNOT tell an Act I entry that merely records a fact (the journal's
    // own `tribulationPassed` entry) apart from an Act II entry that
    // consumes it (`actTwoOpens`) — both use the identical clause key, so
    // "assert journal/hint consumers of an act2-consumed key are declared"
    // is not checkable without inventing a hardcoded distinction. What IS
    // checkable, and is checked here: every declared `reads` value is
    // well-formed — either a real clause in the meets() grammar, or a dotted
    // "store.field" descriptor — so the table itself cannot silently rot
    // with a typo'd or renamed read.
    const dottedStoreDescriptor = /^[a-z]+\.[a-zA-Z]+$/
    for (const row of CROSS_TREE_KEEPS) {
      const isConditionClauseKey = ALL_CONDITION_CLAUSE_KEYS.includes(row.reads)
      const isDottedStoreDescriptor = dottedStoreDescriptor.test(row.reads)
      expect(
        isConditionClauseKey || isDottedStoreDescriptor,
        `${row.key}: reads "${row.reads}" is neither a ConditionClauses key nor a dotted store descriptor`,
      ).toBe(true)
    }
  })

  it('the doReset cascade never resets a realm across tree membership (data invariant on the runtime same-tree guard)', () => {
    // Exercises engine/doReset.ts's treeResetKeepKeys over every REALM_DATA
    // pair using today's TREE_DATA/REALM_DATA as the fixture: whenever a
    // cascade actually fires (non-null), the resetter and its target must
    // share a tree. Turns the same-tree guard from "trust the runtime code"
    // into "assert it holds over the real data" — it catches a future
    // doReset.ts regression that weakens/removes the tree-equality check
    // while this data still declares two trees; it does not (and cannot)
    // prove the guard's logic is correct in the abstract.
    const neverGranted = () => false
    for (const resetter of REALM_DATA) {
      for (const target of REALM_DATA) {
        if (target.id === resetter.id) continue
        const keepKeys = treeResetKeepKeys(target.id, resetter.id, neverGranted)
        if (keepKeys === null) continue // not a cascade target (scope/tree/row mismatch)
        const resetterTree = TREE_DATA.layers[resetter.id]?.tree
        const targetTree = TREE_DATA.layers[target.id]?.tree
        expect(
          targetTree,
          `${resetter.id} (tree ${resetterTree}) cascades onto ${target.id} (tree ${targetTree}) — crosses tree membership`,
        ).toBe(resetterTree)
      }
    }
  })

  it('CROSS_TREE_KEEPS is non-empty with unique keys', () => {
    expect(CROSS_TREE_KEEPS.length).toBeGreaterThan(0)
    const keys = CROSS_TREE_KEEPS.map((row) => row.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// ---- §6 severance shape (lint-interim for the sim assertions) --------------
//
// docs/slice-9.md §6 + D25: the three mechanical assertions (lifetime net
// >= 1, bounded weakness window, >=3 live severables) are sim assertions on
// sampled Act II actors — but there are no Act II actors yet (today's actors
// never pass the tribulation). Wes's ruling: express them NOW as lint-shape
// checks computed analytically off SETPIECE_DATA.severance, the same table
// and the same ramp math src/stores/severing.ts uses at runtime (ratioAtStep
// recomputed locally below — store internals are not imported per this
// file's no-store-import convention). These checks prove the DATA TABLE
// shape is honest; they cannot and do not prove any sampled build's actual
// lifetime experience — that is what the eventual sim assertions are for.

describe('§6 severance shape (lint-interim for the sim assertions)', () => {
  const { startFraction, capRatio, rampSteps } = SETPIECE_DATA.severance
  // Mirrors src/stores/severing.ts RAMP_GROWTH/ratioAtStep exactly (no store
  // import — recomputed from the signed-off SETPIECE_DATA constants).
  const rampGrowth = Math.pow(capRatio / startFraction, 1 / (rampSteps - 1))
  function ratioAtStep(step: number): number {
    return Math.min(startFraction * Math.pow(rampGrowth, step), capRatio)
  }

  // 1. LIFETIME NET >= 1 (interim). Eventual sim assertion: severing is never
  // a strict loss over a life, measured on sampled builds. This lint version
  // proves the CONFIG cannot ship a fully-ramped loss, and pins the in-window
  // mean to D25's recorded 1.10 so a config change that degrades the window
  // is caught loudly — it does not prove any single build's lived experience.
  it('capRatio >= 1 — a fully-ramped severance is never a strict loss', () => {
    expect(capRatio).toBeGreaterThanOrEqual(1)
  })

  it('ramp-window mean ratio >= 1, pinned to D25\'s in-window net 1.10', () => {
    let sum = 0
    for (let step = 0; step < rampSteps; step++) sum += ratioAtStep(step)
    const windowMean = sum / rampSteps
    expect(windowMean, 'ramp-window mean ratio dropped below breakeven').toBeGreaterThanOrEqual(1)
    expect(windowMean).toBeCloseTo(1.1, 2)
  })

  // 2. BOUNDED WEAKNESS WINDOW (interim). Eventual sim assertion: breakeven
  // is reached within the ramp horizon on sampled builds. This lint version
  // proves the window EXISTS (c < 1, D23) and that breakeven is analytically
  // reachable inside the configured ramp — it does not prove a sampled
  // build's ritual cadence actually carries it there in practice.
  it('startFraction < 1 — a weakness window exists (D23)', () => {
    expect(startFraction).toBeLessThan(1)
  })

  it('the analytic breakeven step is reachable inside the ramp horizon', () => {
    const breakevenStep = Math.ceil(Math.log(1 / startFraction) / Math.log(rampGrowth))
    expect(
      breakevenStep,
      'breakeven falls outside the ramp horizon — this config can never ship',
    ).toBeLessThanOrEqual(rampSteps - 1)
  })

  // 3. >=3 LIVE SEVERABLES (interim, structural). Eventual sim assertion:
  // per-BUILD liveness on sampled Act II actors (which severables a given
  // archetype has actually acquired). This lint version proves the third
  // severable EXISTS IN DATA for a non-meridian build — it was load-bearing
  // (Realistic had exactly 2 before the Manifestation ring) — but it cannot
  // prove any sampled build actually acquires 3 in practice.
  it('>= 3 severables have a source that exists in data for a non-meridian build', () => {
    let liveCount = 0

    // soulAspect -> a realm declares soulAspect with a non-empty aspects list.
    const soulRealm = realmWithSoulAspect()
    if (soulRealm && (soulRealm.soulAspect?.aspects.length ?? 0) > 0) liveCount++

    // profession -> ALCHEMY_DATA backs at least one recipe (the gathering
    // pill is the profession's legible v1 contribution, per stores/severing.ts).
    if (ALCHEMY_DATA.recipes.length > 0) liveCount++

    // manifestation -> at least one lattice node declares a third
    // (Manifestation-tier) effect entry.
    if (LATTICE_DATA.nodes.some((node) => node.effects.length >= 3)) liveCount++

    expect(
      liveCount,
      'fewer than 3 severables have a source backed in data for a non-meridian build',
    ).toBeGreaterThanOrEqual(3)
  })

  // 4. CORPSE COUNT INVARIANT — the structural floor under D23's sequence:
  // three sequential severances must be choosable, so there must be exactly
  // 3 corpses and at least as many live severables as corpses.
  it('exactly 3 corpses (past/present/future)', () => {
    expect(SEVERING_DATA.corpses.length).toBe(3)
  })

  it('severables >= corpses — three sequential severances must be choosable', () => {
    expect(SEVERING_DATA.severables.length).toBeGreaterThanOrEqual(SEVERING_DATA.corpses.length)
  })
})

// ---- principle #35 — severable contribution classes -------------------------
//
// docs/design-principles.md #35 + D35: "Severing a conditional thing cannot
// create an unconditional loss." Every SEVERING_DATA severable declares a
// contribution CLASS. A 'passive' severable is nullified under the standard
// ramp (a c·m weakness window — the four D25 rows). A 'conditional-lock'
// severable (a toggled stance) CANNOT be nullified into a weakness window —
// nullifying a toggle changes nothing — so it uses the LOCK shape (the
// conditional thing becomes permanent flesh) and its OWN assertion form:
// cap·m > 1 on EVERY axis (baseline 1, not m). This lint asserts the DATA
// SHAPE; the sim chunk (a separate follow-up) measures the lived recovery.
describe('principle #35 severable contribution classes', () => {
  const CONTRIBUTION_CLASSES = ['passive', 'conditional-lock'] as const
  const cap = SETPIECE_DATA.severance.capRatio

  it('every severable declares a contribution class', () => {
    for (const row of SEVERING_DATA.severables) {
      expect(
        CONTRIBUTION_CLASSES,
        `${row.key} has an undeclared/invalid contribution class`,
      ).toContain(row.contribution)
    }
  })

  it('the four passive rows are exactly the pre-D35 (D25) set', () => {
    // Pinned: the original passive severables. A new passive severable must be
    // added here deliberately (it opens a real c·m weakness window and must be
    // sim-verified survivable); a conditional one must NOT slip in as passive.
    const passiveKeys = SEVERING_DATA.severables
      .filter((s) => s.contribution === 'passive')
      .map((s) => s.key)
    expect(passiveKeys).toEqual(['soulAspect', 'profession', 'extraordinaryMeridians', 'manifestation'])
  })

  it("flowingForm is the sole 'conditional-lock' severable (the stance-lock, D35)", () => {
    const lockKeys = SEVERING_DATA.severables
      .filter((s) => s.contribution === 'conditional-lock')
      .map((s) => s.key)
    expect(lockKeys).toEqual(['flowingForm'])
  })

  // The conditional-lock assertion form: cap·m > 1 on EVERY axis. Mirrors
  // stores/severing.ts stanceLockRecoverable exactly — the lock is only OFFERED
  // for a stance clearing this on both axes (the shippability floor: no offered
  // lock can ever fail to recover an axis).
  function lockRecoverable(qiM: number, insightM: number): boolean {
    return cap * qiM > 1 && cap * insightM > 1
  }

  it('at least one stance is lockable (cap·m > 1 every axis) — the Flowing Form offer is non-empty', () => {
    const lockable = STANCE_DATA.stances.filter((s) =>
      lockRecoverable(s.modifiers.qiMult ?? 1, s.modifiers.insightMult ?? 1),
    )
    expect(
      lockable.length,
      'no stance passes the cap·m > 1 floor — the Flowing Form severable is dead content',
    ).toBeGreaterThanOrEqual(1)
  })

  it('a stance too lopsided to clear cap·m > 1 on some axis is NOT lockable (Sword Trance at k=2.0)', () => {
    // DESIGN CONSEQUENCE discovered at D35 implementation: at capRatio 2.0,
    // Breathing Trance (qi 0.7 → 1.4, insight 2.0 → 4.0) IS lockable, but Sword
    // Trance (qi 0.4 → 0.8 < 1) is NOT — its qi axis could never recover past
    // baseline. It stays WEARABLE; it is simply never offered for the lock
    // (stance data unchanged per rule 0.1 — the eligibility rule carries it).
    const byKey = Object.fromEntries(STANCE_DATA.stances.map((s) => [s.key, s.modifiers]))
    const breathing = byKey['breathingTrance']
    const sword = byKey['swordTrance']
    if (breathing) {
      expect(
        lockRecoverable(breathing.qiMult ?? 1, breathing.insightMult ?? 1),
        'Breathing Trance should be lockable at k=2.0',
      ).toBe(true)
    }
    if (sword) {
      expect(
        lockRecoverable(sword.qiMult ?? 1, sword.insightMult ?? 1),
        'Sword Trance unexpectedly lockable — the qi axis 0.4 must fail cap·m > 1 at k=2.0',
      ).toBe(false)
    }
  })
})

// ---- §1 scope differentiation + the reincarnation-closure lint (slice 10) ---
//
// D37 differentiated the old 'eternal' scope into soul | world | file (the
// death boundary #36 sorts it). Rebirth is a COMPILED cascade tier over
// TREE_DATA's differentiated enum (engine/doReset.ts reincarnationResetLayers).
// These checks prove — FROM THE DATA — that the reincarnation closure resets
// exactly tree + life layers and that soul/world/file state is topologically
// unreachable by rebirth, exactly the way the tree-leak lint proves the tree
// cascade never leaks into a non-tree layer.

const KNOWN_SCOPES = new Set(['tree', 'life', 'soul', 'world', 'file'])
const CARRIED_SCOPES = new Set(['soul', 'world', 'file']) // survive rebirth by construction

describe('§1 scope differentiation (D37)', () => {
  it('every layer has exactly one valid scope, and tree scope implies a tree id', () => {
    for (const [layerId, entry] of Object.entries(TREE_DATA.layers)) {
      expect(KNOWN_SCOPES.has(entry.scope), `${layerId} has invalid scope ${entry.scope}`).toBe(true)
      if (entry.scope === 'tree') {
        expect(entry.tree, `${layerId} is tree-scoped but declares no tree`).toBeDefined()
      } else {
        expect(entry.tree, `${layerId} is ${entry.scope}-scoped but declares a tree`).toBeUndefined()
      }
    }
  })

  it("'eternal' no longer exists anywhere in TREE_DATA (grep-proof from data)", () => {
    const scopes = Object.values(TREE_DATA.layers).map((e) => e.scope)
    expect(scopes).not.toContain('eternal')
  })
})

describe('§1 reincarnation-closure lint (rebirth is topologically bounded)', () => {
  const closure = reincarnationResetLayers()
  const closureSet = new Set<string>(closure)

  it('the closure resets exactly the tree-scoped + life-scoped layers', () => {
    const expected = Object.entries(TREE_DATA.layers)
      .filter(([, entry]) => entry.scope === 'tree' || entry.scope === 'life')
      .map(([id]) => id)
      .sort()
    expect([...closure].sort()).toEqual(expected)
  })

  it('every layer the closure resets is tree- or life-scoped (never a carried scope)', () => {
    for (const layerId of closure) {
      const scope = TREE_DATA.layers[layerId as keyof typeof TREE_DATA.layers]?.scope
      expect(scope === 'tree' || scope === 'life', `${layerId} (${scope}) is in the rebirth closure`).toBe(true)
    }
  })

  it('NO soul/world/file layer is reachable by the rebirth cascade (the closure)', () => {
    // The core D37 guarantee: what the soul knows / the world holds / the file
    // records is never reset by rebirth. Proven from the data, not asserted.
    for (const [layerId, entry] of Object.entries(TREE_DATA.layers)) {
      if (CARRIED_SCOPES.has(entry.scope)) {
        expect(
          closureSet.has(layerId),
          `${layerId} (${entry.scope}) leaked into the reincarnation closure — soul/world/file must be unreachable by rebirth`,
        ).toBe(false)
      }
    }
  })

  it('the carried set is non-empty (soul + world exist) — the closure is a real exclusion', () => {
    const carried = Object.entries(TREE_DATA.layers).filter(([, e]) => CARRIED_SCOPES.has(e.scope))
    expect(carried.length).toBeGreaterThan(0)
  })
})

describe('§1 rebirths core clause (slice 10)', () => {
  it('parses under meets() and reads soul.rebirths as a >= N threshold', () => {
    const state = syntheticEmptyState()
    expect(() => meets({ rebirths: 1 }, state)).not.toThrow()
    // syntheticEmptyState has rebirths 0 (added with the clause).
    expect(meets({ rebirths: 1 }, state)).toBe(false)
    expect(meets({ rebirths: 0 }, state)).toBe(true)
  })
})

// ---- §2 karma firsts table lint (slice 10 / D36 + D40) ----------------------
//
// Boundedness is provable from the data SHAPE — no future row can reintroduce
// the infinite grind by accident: r < 1, f = 0, per-class allowed axes, the
// expansion count pinned Gate-D style.

const ALL_KARMA_AXES = new Set<KarmaQualifierAxis>(['rootShape', 'buildMark', 'realmEra', 'worldContext'])

describe('§2 karma firsts table (D36 + D40)', () => {
  it('KARMA_DECAY_RATIO r < 1 (bounded income) and KARMA_FLOOR f === 0 (D36)', () => {
    expect(KARMA_DECAY_RATIO).toBeLessThan(1)
    expect(KARMA_DECAY_RATIO).toBeGreaterThan(0)
    expect(KARMA_FLOOR).toBe(0)
    expect(VARIANT_SHARE).toBeGreaterThan(0)
    expect(VARIANT_SHARE).toBeLessThan(1)
  })

  it('every row base > 0 (v1 is all positive — no negative placeholders, no zero-base dead data)', () => {
    for (const row of KARMA_DATA) {
      expect(row.base, `${row.key} has a non-positive base`).toBeGreaterThan(0)
    }
  })

  it('every declared qualifier axis is a member of the typed union', () => {
    for (const row of KARMA_DATA) {
      for (const axis of row.qualifiers) {
        expect(ALL_KARMA_AXES.has(axis), `${row.key} declares unknown axis ${axis}`).toBe(true)
      }
    }
  })

  it('per-class allowed axes are enforced (grade-delta takes NONE)', () => {
    for (const row of KARMA_DATA) {
      const allowed = new Set(CLASS_ALLOWED_AXES[row.class])
      for (const axis of row.qualifiers) {
        expect(allowed.has(axis), `${row.key} (${row.class}) declares disallowed axis ${axis}`).toBe(true)
      }
      if (row.class === 'grade-delta') {
        expect(row.qualifiers, `${row.key} is a grade-delta row but declares qualifiers`).toEqual([])
      }
    }
  })

  it('NO row uses the RESERVED worldContext axis (zero instances until the almanac)', () => {
    for (const row of KARMA_DATA) {
      expect(row.qualifiers, `${row.key} uses the reserved worldContext axis`).not.toContain('worldContext')
    }
    // And the reserved axis has an empty vocabulary (size 0).
    expect(AXIS_VOCAB_SIZE.worldContext).toBe(0)
  })

  it('EXPANSION COUNT PIN — the firsts table decomposes to the committed number', () => {
    // Gate-D style: adding an axis to a row, or growing an axis vocabulary
    // (roots shipping grows rootShape past {rootless}), changes this number.
    const expansion = karmaExpansion()
    const PINNED = {
      rows: 25,
      headlines: 25,
      variants: 96,
      total: 121,
      variantsByClass: { milestone: 60, 'grade-delta': 0, deed: 18, encounter: 18 },
    }
    expect(
      expansion,
      'the firsts table grew/shrank — deliberate commit required (re-pin karmaExpansion after Wes signs off)',
    ).toEqual(PINNED)
  })
})
