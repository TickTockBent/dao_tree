import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import Decimal from 'break_eternity.js'
import { useGameStore } from '@/stores/game'
import { useSectStore } from '@/stores/sect'
import { useRealmStore } from '@/stores/realm'
import { useGateStore } from '@/stores/gate'
import { useJournalStore } from '@/stores/journal'
import { useHintsStore } from '@/stores/hints'
import { useAutomationStore } from '@/stores/automation'
import { useBodyStore } from '@/stores/body'

// ---- Sect ------------------------------------------------------------------

describe('sect store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('starts unrevealed and unjoined', () => {
    const sect = useSectStore()
    expect(sect.joined).toBe(false)
    expect(sect.contribution.toNumber()).toBe(0)
  })

  it('reveal gate met after q 2nd Level (at:3)', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const sect = useSectStore()

    game.points = new Decimal(1e6)
    realm.prestige('q')
    expect(sect.isRevealGateMet()).toBe(true)
  })

  it('joinSect picks an archetype (one-shot)', () => {
    const sect = useSectStore()
    sect.joinSect('azureSword')
    expect(sect.joined).toBe(true)
    expect(sect.archetype).toBe('azureSword')
    // Second join is a no-op.
    sect.joinSect('stoneFormation')
    expect(sect.archetype).toBe('azureSword')
  })

  it('contributionPerSecond is 0 when unjoined', () => {
    const sect = useSectStore()
    expect(sect.contributionPerSecond().toNumber()).toBe(0)
  })

  it('contributionPerSecond is > 0 when joined + qi flowing', () => {
    const sect = useSectStore()
    const game = useGameStore()
    game.points = new Decimal(100)
    sect.joinSect('azureSword')
    expect(sect.contributionPerSecond().toNumber()).toBeGreaterThan(0)
  })

  it('milestones latch when best >= at', () => {
    const sect = useSectStore()
    sect.joinSect('azureSword')
    // Manually set best above stipend (at:250).
    sect.best = new Decimal(300)
    sect.latchMilestones()
    expect(sect.hasMilestone(0)).toBe(true) // stipend
  })

  it('sectStipendQiMult is 1 until stipend milestone earned', () => {
    const sect = useSectStore()
    expect(sect.sectStipendQiMult.toNumber()).toBe(1)
    sect.joinSect('azureSword')
    sect.best = new Decimal(300)
    sect.latchMilestones()
    expect(sect.sectStipendQiMult.toNumber()).toBe(1.15)
  })

  it('techniques are not visible before joining', () => {
    const sect = useSectStore()
    expect(sect.techniqueIsVisible(0)).toBe(false)
  })

  it('techniques visible after joining matching archetype', () => {
    const sect = useSectStore()
    sect.joinSect('azureSword')
    // azureForm (index 0) is sword school, libraryTier 1 — should be visible.
    expect(sect.techniqueIsVisible(0)).toBe(true)
    // stoneSkin (index 3) is formation school — NOT visible to azureSword.
    expect(sect.techniqueIsVisible(3)).toBe(false)
    // breathCanon (index 6) is universal — visible.
    expect(sect.techniqueIsVisible(6)).toBe(true)
  })

  it('library tier 2 techniques require library milestone', () => {
    const sect = useSectStore()
    sect.joinSect('azureSword')
    // swordHeart (index 2) is libraryTier 2 — NOT visible without library milestone.
    expect(sect.techniqueIsVisible(2)).toBe(false)
    // Grant the library milestone.
    sect.best = new Decimal(5000)
    sect.latchMilestones()
    // Still needs the requires gate (Foundation Establishment). Check the milestone.
    // The library milestone requires realm ['f', 'Early Foundation'] — not met here.
    // So technique stays invisible.
    expect(sect.techniqueIsVisible(2)).toBe(false)
  })

  it('buyTechnique spends contribution', () => {
    const sect = useSectStore()
    sect.joinSect('azureSword')
    sect.contribution = new Decimal(1000)
    expect(sect.buyTechnique(0)).toBe(true) // azureForm costs 600
    expect(sect.techniqueIsOwned(0)).toBe(true)
    expect(sect.contribution.toNumber()).toBe(400)
  })
})

// ---- Gate ------------------------------------------------------------------

describe('gate store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('starts with no achievements', () => {
    const gate = useGateStore()
    expect(gate.achievements).toHaveLength(0)
    expect(gate.gateMult.toNumber()).toBe(1)
  })

  it('latches achievements when done condition is met', () => {
    const gate = useGateStore()
    const sect = useSectStore()
    const realm = useRealmStore()
    const body = useBodyStore()

    // Set up for outerDisciple: sectJoined + f Early Foundation + meridians >= 6 + temperTier flesh.
    sect.joinSect('azureSword')
    // Give f best >= 1 (Early Foundation at:1).
    realm.slice.f = { ...realm.slice.f, unlocked: true, best: '5', points: '0', total: '0', resetTime: 0, milestones: [] }
    // Open 6 meridians + temper to flesh (level 5).
    body.primaryMeridians = 6
    body.temperLevel = 5

    gate.latchAchievements()
    // outerDisciple = index 0, id = 11.
    expect(gate.hasAchievement(0)).toBe(true)
    expect(gate.gateMult.toNumber()).toBe(1.25)
  })
})

// ---- Hints -----------------------------------------------------------------

describe('hints store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('returns the climbQi hint when q is unlocked (fresh state)', () => {
    const hints = useHintsStore()
    // q is always unlocked at fresh state → "climbQi" fires before the catch-all.
    expect(hints.hintText).toContain('Climb the Qi Condensation')
  })

  it('returns a specific hint once its condition is met', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const hints = useHintsStore()

    // Prestige q enough to reach 6th Level (at:90) → "breakToFoundation" hint.
    game.points = new Decimal(1e6)
    realm.prestige('q')
    // At best=659, 6th Level (at:90) is reached, so "breakToFoundation" fires
    // (it's higher in the cascade than "openLattice" at 4th Level).
    expect(hints.hintText).toContain('break through')
  })
})

// ---- Journal ---------------------------------------------------------------

describe('journal store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('starts empty', () => {
    const journal = useJournalStore()
    expect(journal.latched.size).toBe(0)
  })

  it('latches firstBreath on q unlocked', () => {
    const journal = useJournalStore()
    journal.latchEntries()
    expect(journal.latched.has('firstBreath')).toBe(true)
  })

  it('reflect grants qi bonus once', () => {
    const journal = useJournalStore()
    journal.latchEntries()
    const game = useGameStore()
    const qiBefore = game.points.toNumber()
    journal.reflect('firstBreath')
    expect(game.points.toNumber()).toBe(qiBefore + 100)
    // Second reflect is a no-op.
    journal.reflect('firstBreath')
    expect(game.points.toNumber()).toBe(qiBefore + 100)
  })

  it('currentCultivationStage reflects realm progress', () => {
    const journal = useJournalStore()
    expect(journal.currentCultivationStage()).toBe('Qi Condensation')
  })
})

// ---- Automation ------------------------------------------------------------

describe('automation store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('no automation granted at fresh state', () => {
    const automation = useAutomationStore()
    expect(automation.grantedRows).toHaveLength(0)
  })

  it('nascentQiPrestige granted once n milestone 0 is earned', () => {
    const automation = useAutomationStore()
    const realm = useRealmStore()
    // Grant n milestone 0 (Early Nascent Soul at:1).
    realm.slice.n = { ...realm.slice.n, unlocked: true, best: '1', points: '1', total: '1', resetTime: 0, milestones: [0] }
    expect(automation.isGranted('nascentQiPrestige')).toBe(true)
  })

  it('autoPrestigeFires returns false when realm is fully formed', () => {
    const automation = useAutomationStore()
    const realm = useRealmStore()
    // Grant n milestone 0.
    realm.slice.n = { ...realm.slice.n, unlocked: true, best: '1', points: '1', total: '1', resetTime: 0, milestones: [0] }
    // q fully formed: best >= top substage (2800).
    realm.slice.q = { ...realm.slice.q, best: '5000', points: '5000', total: '5000', resetTime: 0, milestones: [0,1,2,3,4,5,6,7,8,9,10,11,12] }
    const cfg = automation.prestigeMaturityConfig('q')!
    expect(automation.autoPrestigeIsResting('q')).toBe(true)
    expect(automation.autoPrestigeFires('q', cfg)).toBe(false)
  })
})
