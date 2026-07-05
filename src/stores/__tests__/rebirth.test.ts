// src/stores/__tests__/rebirth.test.ts — the Samsara crossing (slice 10 step 4).
//
// The crossing sequence end-to-end (D39): record firsts → settle → chronicle
// entry written → rebirths latched → life-scoped stores fresh → soul-scoped
// state intact → karma balance carried. Plus the receipt/grade-best latches
// across a simulated double-crossing. Uses the full store wiring (bootTestStores)
// because the crossing drives the compiled reincarnation cascade over the
// registered slice providers.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useRebirthStore, richnessTierFor } from '@/stores/rebirth'
import { useKarmaStore } from '@/stores/karma'
import { useChronicleStore } from '@/stores/chronicle'
import { useSoulStore } from '@/stores/soul'
import { useTribulationStore } from '@/stores/tribulation'
import { useDaoStore } from '@/stores/dao'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useGameStore } from '@/stores/game'
import { useSeveringStore } from '@/stores/severing'
import { KARMA_DATA, KARMA_DECAY_RATIO, VARIANT_SHARE } from '@/data/karma'

const PASSING_TRIB_GRADE = 3 // 'flawless' (SP.firstTribulation.grades[3].passes)
const MILESTONE_BASE = KARMA_DATA.find((r) => r.key === 'reachRealm:f')!.base

/** Set up a life with some firsts + life-scoped state, ready to cross. */
function seedLife(): void {
  const karma = useKarmaStore()
  const trib = useTribulationStore()
  const dao = useDaoStore()
  const body = useBodyStore()
  const realm = useRealmStore()
  const game = useGameStore()
  const soul = useSoulStore()
  const severing = useSeveringStore()

  // Passing tribulation → rebirth unlocked.
  trib.tribGrade = PASSING_TRIB_GRADE
  // Some soul-scoped carry (must survive the crossing).
  soul.recordAscent()
  soul.recordAscent()
  // Life-scoped state that MUST die at the crossing.
  game.points = new Decimal(1000)
  dao.addInsight(new Decimal(500))
  body.primaryMeridians = 5
  realm.slice.f.unlocked = true // realmReached should read 'f'
  // A real severance this life (the chronicle reads the severing store's cuts).
  severing.load({
    severances: [
      {
        corpse: 'past',
        severable: 'soulAspect',
        ritualStepsAtSever: 0,
        severedQiMult: '1',
        severedInsightMult: '1',
      },
    ],
  })
  // Firsts earned this life (recorded directly — the call-site wiring is
  // exercised by the store-level tests; here we drive the crossing).
  karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
  karma.recordFirst('severed:soulAspect', {})
  karma.recordFirst('endureTrial:whisperingDoubt', { realmEra: 'f' })
}

describe('rebirth: the crossing sequence (D39)', () => {
  beforeEach(() => bootTestStores())

  it('is locked until the tribulation is crossed, then unlocked forever', () => {
    const rebirth = useRebirthStore()
    expect(rebirth.rebirthUnlocked).toBe(false)
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE
    expect(rebirth.rebirthUnlocked).toBe(true)
  })

  it('cross() pays the receipt, writes the chronicle, latches the rebirth, and resets the life', () => {
    seedLife()
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    const chronicle = useChronicleStore()
    const soul = useSoulStore()
    const trib = useTribulationStore()
    const dao = useDaoStore()
    const body = useBodyStore()
    const realm = useRealmStore()
    const game = useGameStore()

    const expectedTotal = rebirth.previewReceipt().total
    expect(expectedTotal).toBeGreaterThan(0)

    const receipt = rebirth.cross()!
    expect(receipt.total).toBeCloseTo(expectedTotal, 10)

    // 1) receipt paid into the (soul-scoped) balance, which CARRIES.
    expect(karma.balance).toBeCloseTo(expectedTotal, 10)
    // firsts folded into the lifetime history (each earned key n = 1).
    expect(karma.firstsHistory['reachRealm:f']).toBe(1)
    expect(karma.firstsHistory['severed:soulAspect']).toBe(1)
    // the life ledger cleared for the new life.
    expect(karma.ledger).toEqual([])

    // 2) chronicle entry written from live state.
    expect(chronicle.lifeCount).toBe(1)
    const entry = chronicle.lives[0]!
    expect(entry.lifeNumber).toBe(1)
    expect(entry.realmReached).toBe('f')
    expect(entry.tribulationOutcome).toBe('flawless')
    expect(entry.severances).toEqual(['soulAspect'])
    expect(entry.trialsEndured).toEqual({ whisperingDoubt: 1 })
    expect(entry.firstsReceipt.total).toBeCloseTo(expectedTotal, 10)
    expect(entry.richnessTier).toBe('chapter') // founding life
    expect(entry.rootConfig).toBeNull()
    expect(entry.strandsHeld).toEqual([])

    // 3) rebirth latched.
    expect(soul.rebirths).toBe(1)
    // …and the crossing stays available in the fresh (un-tribulated) life.
    expect(rebirth.rebirthUnlocked).toBe(true)

    // 4) life-scoped state is FRESH.
    expect(game.points.toNumber()).toBe(0)
    expect(dao.insight.toNumber()).toBe(0)
    expect(body.primaryMeridians).toBe(0)
    expect(realm.stateOf('f').unlocked).toBe(false)
    expect(trib.tribGrade).toBe(-1) // the crossing must be re-earned
    expect(useSeveringStore().severances).toEqual([]) // severed things return next life (D23)

    // 5) soul-scoped state is INTACT (the soul knows it).
    expect(soul.ascents).toBe(2)
  })

  it('records at most one first per event per life, and decays it on the next life', () => {
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    // Life 1: the same first twice is one first.
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    expect(karma.ledger).toHaveLength(1)
    const life1 = rebirth.cross()!.total
    expect(life1).toBeCloseTo(MILESTONE_BASE + VARIANT_SHARE * MILESTONE_BASE, 10)

    // Life 2: the SAME first now pays base × r (the fold made it a repeat).
    karma.recordFirst('reachRealm:f', { rootShape: 'rootless', buildMark: 'meridian' })
    const life2 = rebirth.cross()!.total
    expect(life2).toBeCloseTo(life1 * KARMA_DECAY_RATIO, 10)
    expect(life2).toBeLessThan(life1)
  })

  it('grade-best latches across a double crossing (soul-scoped personal best)', () => {
    const rebirth = useRebirthStore()
    const karma = useKarmaStore()
    useTribulationStore().tribGrade = PASSING_TRIB_GRADE

    // Life 1: land Foundation grade 2 → a fresh best, recorded.
    karma.recordGradeDelta('foundationGradeDelta', 2)
    expect(karma.ledger).toHaveLength(1)
    rebirth.cross()
    expect(karma.gradeBests['foundationGradeDelta']).toBe(2) // carried across the crossing

    // Life 2: re-landing grade 2 is not an improvement → pays nothing…
    karma.recordGradeDelta('foundationGradeDelta', 2)
    expect(karma.ledger).toEqual([])
    // …but grade 3 is a fresh personal best → recorded.
    karma.recordGradeDelta('foundationGradeDelta', 3)
    expect(karma.ledger).toHaveLength(1)
    expect(karma.gradeBests['foundationGradeDelta']).toBe(3)
  })
})

describe('rebirth: richnessTier v1 rule (D37)', () => {
  it('the founding lives are always chapters', () => {
    expect(richnessTierFor(0, [])).toBe('chapter')
    const twoPrior = [{ firstsReceipt: { total: 999 } }, { firstsReceipt: { total: 999 } }] as never
    expect(richnessTierFor(1, twoPrior)).toBe('chapter')
  })

  it('past the founding era, a new novelty high is a chapter; substance a summary; the rest a line', () => {
    const prior = [
      { firstsReceipt: { total: 40 } },
      { firstsReceipt: { total: 60 } },
      { firstsReceipt: { total: 50 } },
    ] as never
    expect(richnessTierFor(61, prior)).toBe('chapter') // beats the best prior (60)
    expect(richnessTierFor(35, prior)).toBe('summary') // >= 50% of 60
    expect(richnessTierFor(20, prior)).toBe('line') // < 50% of 60
  })
})
