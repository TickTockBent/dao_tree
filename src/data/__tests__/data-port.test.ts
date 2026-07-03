// Snapshot-style tests asserting the data port faithfully matches the 0.2.x
// originals. Catches accidental drift during the port (a renamed label, a
// transposed digit, a dropped field). These pin the contract the engine code
// in M3+ will rely on.

import { describe, it, expect } from 'vitest'
import {
  CROSS_TREE_KEEPS,
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
  SECRET_REALM_DATA,
  ALCHEMY_DATA,
  HEART_DEMON_DATA,
  SECLUSION_DATA,
  ACCUMULATOR_DATA,
  SEVERING_DATA,
  findDemonTrial,
  findRealm,
  substageLabelAtBest,
} from '@/data'
// OFFERING_DATA (D28) is not re-exported through the data barrel — the
// severing store imports it from its source module directly, and so do we.
import { OFFERING_DATA } from '@/data/severing'

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
  it('has the 5 Act I realms + Spirit Severing in order', () => {
    expect(REALM_DATA.map((r) => r.id)).toEqual(['q', 'f', 'c', 'n', 's', 'x'])
    expect(REALM_DATA.map((r) => r.row)).toEqual([0, 1, 2, 3, 4, 5])
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

  it('spirit severing (slice 9) gates on the passed tribulation and carries the severance setpiece', () => {
    const x = findRealm('x')
    expect(x.row).toBe(5)
    expect(x.reveal).toEqual({ tribulationPassed: true })
    expect(x.unlock).toEqual({ tribulationPassed: true })
    expect(x.substages.map((s) => s.label)).toEqual([
      'The Past Lies Severed',
      'The Present Lies Severed',
      'The Future Lies Severed',
    ])
    // D28: realm-x substage `at` values are REINTERPRETED as severance-COUNT
    // thresholds [1,2,3] (not qi/points) — the realm store latches x
    // milestones off severing.severances.length. reqBase/gainExp are RETIRED
    // (type-shape only) — the offering path ignores them; no gain accrues.
    expect(x.substages.map((s) => s.at)).toEqual([1, 2, 3])
    // D33 (Q12 closed): the substage qiMults (pre-D33: 2.0/2.4/2.8) are stripped
    // to null — the cut grants no qi bonus; the transcendent ramp is the only
    // compensation, so the transition IS the reward (not a separate modifier).
    expect(x.substages.map((s) => s.qiMult)).toEqual([null, null, null])
    expect(x.setpiece).toBe('severance')
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

  it('severance curve constants match the D25 sign-off', () => {
    // Rule 0.1: these three numbers are SIGNED OFF (D25, k-probe evidence in
    // docs/calibration.md) — they move only in a deliberate, signed-off commit.
    expect(SETPIECE_DATA.severance.startFraction).toBe(0.5)
    expect(SETPIECE_DATA.severance.capRatio).toBe(2.0)
    expect(SETPIECE_DATA.severance.rampSteps).toBe(12)
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
  it('has 6 tree-scoped realms across 2 acts + 8 life + 4 eternal', () => {
    expect(TREE_DATA.trees.map((t) => t.id)).toEqual(['act1', 'act2'])
    const scopes = Object.entries(TREE_DATA.layers).map(([id, e]) => `${id}:${e.scope}`)
    expect(scopes).toEqual([
      'q:tree', 'f:tree', 'c:tree', 'n:tree', 's:tree',
      // Slice 9: Spirit Severing opens Act II — a SEPARATE tree, so the
      // cascade can never cross the act boundary (cross-tree keeps are
      // topological).
      'x:tree',
      'b:life', 'gate:life', 'dao:life', 'sect:life',
      'journal:eternal', 'legacy:eternal',
      // Slice 7: expeditions + the profession are life-scoped (never cascade-reset).
      'secret:life', 'alchemy:life',
      // Slice 8: corruption + Dao Heart stacks are life-scoped.
      'demons:life',
      // Slice 8.5: Deep Meditation rungs are eternal (QoL is never clawed back).
      'seclusion:eternal',
      // Slice 9: soul accumulators are eternal-until-Samsara; active
      // severances are life-scoped (severed things return next life).
      'soul:eternal',
      'severing:life',
    ])
    expect(TREE_DATA.layers.x).toEqual({ scope: 'tree', tree: 'act2' })
  })
})

describe('CROSS_TREE_KEEPS (slice 9 §5)', () => {
  it('pins the row count and spot-checks the realm-x tribulation-gate row', () => {
    // Pinned so the table only changes deliberately (§5's own discipline: a
    // new row is a deliberate declaration, never an incidental drift).
    expect(CROSS_TREE_KEEPS).toHaveLength(11)
    expect(CROSS_TREE_KEEPS.find((row) => row.key === 'realmXTribulationGate')).toEqual({
      key: 'realmXTribulationGate',
      reads: 'tribulationPassed',
      consumer: 'realm x (Spirit Severing) reveal/unlock',
      rationale: 'Act II\'s first content only reveals/unlocks once Act I\'s tribulation is crossed (D11 — veil the ahead, never the now).',
    })
  })
})

describe('ACCUMULATOR_DATA (slice 9)', () => {
  it('pins the two soul instances and the D21 constants', () => {
    // Rule 0.1: r and f are SIGNED OFF (D21) — the "moment" register and the
    // optimizer bound in one knob. They move only in a signed-off commit.
    expect(Object.keys(ACCUMULATOR_DATA)).toEqual(['ascentCounter', 'severanceRitual'])
    expect(ACCUMULATOR_DATA.ascentCounter).toEqual({
      key: 'ascentCounter', scope: 'soul', ratio: 0.7, floor: 0.05, persistence: 'never-reset',
    })
    // D28: severanceRitual gains its own acceleration curve — ratio/floor
    // drive the OFFERING mastery discount max(ratio^rituals, floor). ⟨tune⟩.
    expect(ACCUMULATOR_DATA.severanceRitual).toEqual({
      key: 'severanceRitual', scope: 'soul', ratio: 0.9, floor: 0.25, persistence: 'never-reset',
    })
  })
})

describe('SEVERING_DATA (slice 9)', () => {
  it('has the three corpses in severing order and the D25 severable list', () => {
    expect(SEVERING_DATA.corpses.map((c) => c.key)).toEqual(['past', 'present', 'future'])
    expect(SEVERING_DATA.severables.map((s) => s.key)).toEqual([
      'soulAspect', 'profession', 'extraordinaryMeridians', 'manifestation',
    ])
  })
})

describe('OFFERING_DATA (slice 9, D28)', () => {
  it('has one corpse-colored basket per corpse, with the qi/insight lean', () => {
    // One basket per corpse, in corpse order.
    expect(OFFERING_DATA.baskets.map((b) => b.corpse)).toEqual(['past', 'present', 'future'])
    const past = OFFERING_DATA.baskets.find((b) => b.corpse === 'past')!
    const present = OFFERING_DATA.baskets.find((b) => b.corpse === 'present')!
    const future = OFFERING_DATA.baskets.find((b) => b.corpse === 'future')!
    // Past leans Qi (qi-heavy, minimal insight); Future leans Insight; Present
    // sits between them on both axes (D28 corpse-colored lean). ⟨tune⟩ values.
    expect(past.qiBase).toBeGreaterThan(future.qiBase)
    expect(future.insightBase).toBeGreaterThan(past.insightBase)
    expect(present.qiBase).toBeLessThan(past.qiBase)
    expect(present.qiBase).toBeGreaterThan(future.qiBase)
    expect(present.insightBase).toBeGreaterThan(past.insightBase)
    expect(present.insightBase).toBeLessThan(future.insightBase)
    // D34 lowered the offering insight scale to single-thousands ("burning incense,
    // not buying a house"): the Future's twelve-turning rite ≈ ONE ring-3 node.
    // Floor kept low but non-trivial to guard the insight lean from collapsing to 0.
    expect(future.insightBase).toBeGreaterThanOrEqual(2000)
  })

  it('pins the growth and pill-discount factors (⟨tune⟩)', () => {
    expect(OFFERING_DATA.growth).toBe(1.5) // per-step geometric ramp WITHIN a severance
    expect(OFFERING_DATA.pillDiscount).toBe(0.8) // a held pill cheapens every offering
    expect(OFFERING_DATA.growth).toBeGreaterThan(1) // costs must RISE per step
    expect(OFFERING_DATA.pillDiscount).toBeLessThan(1) // a discount, not a surcharge
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
  it('has exactly 25 nodes across 4 rings (slice 9 / D22 medium lattice)', () => {
    expect(LATTICE_DATA.nodes).toHaveLength(25)
    expect(LATTICE_DATA.nodes[0]).toMatchObject({ key: 'metal', element: 'metal', requires: [] })
    expect(LATTICE_DATA.nodes[5]).toMatchObject({ key: 'sword', element: 'metal', requires: ['metal'] })
    expect(LATTICE_DATA.nodes[14]).toMatchObject({ key: 'endurance', element: 'earth' })
    expect(LATTICE_DATA.nodes[15]).toMatchObject({ key: 'severingIntent', element: 'metal', requires: ['sword'] })
    expect(LATTICE_DATA.nodes[24]).toMatchObject({ key: 'boundless', element: 'earth', requires: ['endurance'] })
  })

  it('has a Manifestation tier row and every node carries 3 costs/effects', () => {
    expect(LATTICE_DATA.tiers.map((t) => t.key)).toEqual(['glimpse', 'seed', 'manifestation'])
    for (const node of LATTICE_DATA.nodes) {
      expect(node.costs, `${node.key} missing a Manifestation cost`).toHaveLength(3)
      expect(node.effects, `${node.key} missing a Manifestation effect`).toHaveLength(3)
    }
  })

  it('has the flow/stillness conflict (unchanged — binds at Manifestation via the store)', () => {
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

  it('first row is faceDemonTrial (slice 8: the live involuntary state outranks everything)', () => {
    expect(HINT_DATA.hints[0]?.key).toBe('faceDemonTrial')
    expect(HINT_DATA.hints[0]?.when).toEqual({ demonTrialActive: true })
  })

  it('second row is severSpirit (slice 9: Manifestation nudge outranks the general actComplete row)', () => {
    expect(HINT_DATA.hints[1]?.key).toBe('severSpirit')
    expect(HINT_DATA.hints[1]?.when).toEqual({ anyDaoNode: 3 })
  })

  it('third row is actComplete', () => {
    expect(HINT_DATA.hints[2]?.key).toBe('actComplete')
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
  it('has 23 entries with firstBreath first and firstManifestation last (slice 9 added 2)', () => {
    expect(JOURNAL_DATA.entries).toHaveLength(23)
    expect(JOURNAL_DATA.entries[0]?.key).toBe('firstBreath')
    expect(JOURNAL_DATA.entries[22]?.key).toBe('firstManifestation')
  })

  it('slice 9 entries latch on the passed tribulation and the first Manifestation', () => {
    const actTwoOpens = JOURNAL_DATA.entries.find((e) => e.key === 'actTwoOpens')
    const firstManifestation = JOURNAL_DATA.entries.find((e) => e.key === 'firstManifestation')
    expect(actTwoOpens?.when).toEqual({ tribulationPassed: true })
    expect(firstManifestation?.when).toEqual({ anyDaoNode: 3 })
  })

  it('slice 8.5 entry latches on the first Deep Meditation rung', () => {
    const deepMeditation = JOURNAL_DATA.entries.find((e) => e.key === 'deepMeditation')
    expect(deepMeditation?.when).toEqual({ seclusionRungs: 1 })
  })

  it('slice 7 entries latch on first expedition clear and the profession pick', () => {
    const firstExpedition = JOURNAL_DATA.entries.find((e) => e.key === 'firstExpedition')
    const professionChosen = JOURNAL_DATA.entries.find((e) => e.key === 'professionChosen')
    expect(firstExpedition?.when).toEqual({ secretRealmClears: 1 })
    expect(professionChosen?.when).toEqual({ professionChosen: true })
  })

  it('slice 8 entries latch on first corruption gain and first cleared Demon Trial', () => {
    const corruptionTouched = JOURNAL_DATA.entries.find((e) => e.key === 'corruptionTouched')
    const firstDaoHeart = JOURNAL_DATA.entries.find((e) => e.key === 'firstDaoHeart')
    expect(corruptionTouched?.when).toEqual({ corruption: 1 })
    expect(firstDaoHeart?.when).toEqual({ daoHeartStacks: 1 })
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

describe('SECRET_REALM_DATA', () => {
  it('reveals on coreForged, rotates every 1800s, essenceBase 1', () => {
    expect(SECRET_REALM_DATA.reveal).toEqual({ coreForged: true })
    expect(SECRET_REALM_DATA.rotation).toEqual({ periodSeconds: 1800 })
    expect(SECRET_REALM_DATA.essenceBase).toBe(1)
  })

  it('has exactly the 3 tuned sites in order', () => {
    expect(SECRET_REALM_DATA.sites.map((s) => s.key)).toEqual([
      'verdantHollow',
      'invertedSpiritLand',
      'shatteredStarVault',
    ])
  })

  it('verdantHollow: qiRate model, 120s run, 600s cooldown, spiritHerb drop', () => {
    const s = SECRET_REALM_DATA.sites[0]!
    expect(s.element).toBe('wood')
    expect(s.durationSeconds).toBe(120)
    expect(s.cooldownSeconds).toBe(600)
    expect(s.unlock).toEqual({})
    expect(s.modifier).toEqual({
      key: 'richGrowth',
      label: 'Rich Growth',
      description:
        'Spirit herbs flourish here. Essence gathers half again as fast, fed by your Qi flow.',
      essenceModel: 'qiRate',
      rateMult: 1.5,
    })
    expect(s.rewards).toEqual({ material: 'spiritHerb', materialPerEssence: 1, insightPerEssence: 0.2 })
  })

  it('invertedSpiritLand: insightRate model, 90s run, gated on Early Nascent Soul', () => {
    const s = SECRET_REALM_DATA.sites[1]!
    expect(s.element).toBe('water')
    expect(s.durationSeconds).toBe(90)
    expect(s.cooldownSeconds).toBe(600)
    expect(s.unlock).toEqual({ realm: ['n', 'Early Nascent Soul'] })
    expect(s.modifier.essenceModel).toBe('insightRate')
    expect(s.modifier.rateMult).toBe(1)
    expect(s.modifier.insightScale).toBe(4)
    expect(s.rewards).toEqual({ material: 'essenceCrystal', materialPerEssence: 0.5, insightPerEssence: 0.4 })
  })

  it('shatteredStarVault: fixed model, 180s run, gated on Great Circle, carries the first-clear glimpse', () => {
    const s = SECRET_REALM_DATA.sites[2]!
    expect(s.element).toBe('metal')
    expect(s.durationSeconds).toBe(180)
    expect(s.cooldownSeconds).toBe(1200)
    expect(s.unlock).toEqual({ realm: ['n', 'Great Circle'] })
    expect(s.modifier.essenceModel).toBe('fixed')
    expect(s.modifier.rateMult).toBe(0.6)
    expect(s.rewards).toEqual({
      material: 'beastCore',
      materialPerEssence: 0.25,
      insightPerEssence: 0.3,
      firstClearGlimpseNode: 'edge',
    })
  })
})

describe('ALCHEMY_DATA', () => {
  it('reveals on coreForged, with the 3 sourced materials', () => {
    expect(ALCHEMY_DATA.reveal).toEqual({ coreForged: true })
    expect(ALCHEMY_DATA.materials).toEqual([
      { key: 'spiritHerb', name: 'Spirit Herb', sourceHint: 'Verdant Hollow' },
      { key: 'essenceCrystal', name: 'Essence Crystal', sourceHint: 'Inverted Spirit Land' },
      { key: 'beastCore', name: 'Beast Core', sourceHint: 'Shattered Star Vault' },
    ])
  })

  it('has exactly the 3 tuned recipes in order', () => {
    expect(ALCHEMY_DATA.recipes.map((r) => r.key)).toEqual(['gatheringPill', 'clarityPill', 'heavenWardingPill'])
  })

  it('gatheringPill: 10 spiritHerb → 2x Qi/sec for 600s, open recipe', () => {
    const r = ALCHEMY_DATA.recipes[0]!
    expect(r.cost).toEqual({ spiritHerb: 10 })
    expect(r.effect).toEqual({ type: 'timedQiMult', mult: 2, durationSeconds: 600 })
    expect(r.unlock).toEqual({})
  })

  it('clarityPill: 6 spiritHerb + 4 essenceCrystal → 1.5x breakthrough gain for n/s', () => {
    const r = ALCHEMY_DATA.recipes[1]!
    expect(r.cost).toEqual({ spiritHerb: 6, essenceCrystal: 4 })
    expect(r.effect).toEqual({ type: 'breakthroughAid', gainMult: 1.5, appliesTo: ['n', 's'] })
    expect(r.unlock).toEqual({ realm: ['n', 'Early Nascent Soul'] })
  })

  it('heavenWardingPill: 6 essenceCrystal + 3 beastCore → +40 pool bonus, gated on s milestone 1', () => {
    const r = ALCHEMY_DATA.recipes[2]!
    expect(r.cost).toEqual({ essenceCrystal: 6, beastCore: 3 })
    expect(r.effect).toEqual({ type: 'tribulationPoolBonus', poolBonus: 40 })
    expect(r.unlock).toEqual({ realm: ['s', 1] })
  })
})

describe('HEART_DEMON_DATA', () => {
  it('corruption sources: rushed Foundation bands, forge pushes, tribulation grades', () => {
    expect(HEART_DEMON_DATA.corruption.sources.rushedBreakthrough).toEqual({ Flawed: 12, Stable: 6 })
    expect(HEART_DEMON_DATA.corruption.sources.forgePush).toEqual({ forceful: 10, reckless: 25 })
    expect(HEART_DEMON_DATA.corruption.sources.tribulation).toEqual({ failed: 30, scarred: 10 })
  })

  it('passive bleed: 0.02/sec, +0.02/sec per Dao Heart stack', () => {
    expect(HEART_DEMON_DATA.corruption.bleedPerSecond).toBe(0.02)
    expect(HEART_DEMON_DATA.corruption.bleedPerDaoHeartStack).toBe(0.02)
  })

  it('has exactly the 3 tuned thresholds in ascending order, repeating every 120', () => {
    expect(HEART_DEMON_DATA.thresholds).toEqual([
      { at: 60, trial: 'whisperingDoubt' },
      { at: 140, trial: 'hungryShadow' },
      { at: 260, trial: 'hollowCrown' },
    ])
    expect(HEART_DEMON_DATA.repeatEvery).toBe(120)
  })

  it('whisperingDoubt: endure 120s at 0.8x Qi/sec', () => {
    const t = findDemonTrial('whisperingDoubt')
    expect(t.element).toBeNull()
    expect(t.color).toBe('#9a86b8')
    expect(t.qiMultWhileActive).toBe(0.8)
    expect(t.objective).toEqual({ type: 'endure', seconds: 120 })
  })

  it('hungryShadow: gatherQi 400x q.reqBase at 0.7x Qi/sec', () => {
    const t = findDemonTrial('hungryShadow')
    expect(t.element).toBe('water')
    expect(t.color).toBe('#5a7a99')
    expect(t.qiMultWhileActive).toBe(0.7)
    expect(t.objective).toEqual({ type: 'gatherQi', reqBaseFactor: 400 })
  })

  it('hollowCrown: prestigeCount 3 at 0.65x Qi/sec', () => {
    const t = findDemonTrial('hollowCrown')
    expect(t.element).toBe('fire')
    expect(t.color).toBe('#b86a4a')
    expect(t.qiMultWhileActive).toBe(0.65)
    expect(t.objective).toEqual({ type: 'prestigeCount', count: 3 })
  })

  it('Dao Heart qiMultPerStack is 1.02', () => {
    expect(HEART_DEMON_DATA.daoHeart.qiMultPerStack).toBe(1.02)
  })
})

describe('SECLUSION_DATA (slice 8.5)', () => {
  it('base cap is 1 hour with 5 one-hour Act I rungs', () => {
    expect(SECLUSION_DATA.baseCapSeconds).toBe(3600)
    expect(SECLUSION_DATA.rungs.map((r) => r.realm)).toEqual(['q', 'f', 'c', 'n', 's'])
    for (const rung of SECLUSION_DATA.rungs) expect(rung.capBonusSeconds).toBe(3600)
  })

  it('rung costs match the shipped tuning', () => {
    expect(SECLUSION_DATA.rungs.map((r) => r.qiCost)).toEqual([
      500, 50000, 2000000, 50000000, 10000000000,
    ])
  })
})
