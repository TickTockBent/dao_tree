// src/stores/__tests__/heartDemons.test.ts — Heart Demons + Demon Trials (slice 8).
//
// Every expectation is DERIVED from HEART_DEMON_DATA (never a copied literal),
// so a data re-tune moves the asserts with it. The state machine (§6.3) is
// exercised through the real source hooks, the tick `update`, and real realm
// prestiges — not by poking private internals.

import { describe, it, expect, beforeEach } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { usePipelinesStore } from '@/stores/pipelines'
import { HEART_DEMON_DATA, findDemonTrial } from '@/data/heart-demons'
import type { HeartDemonTrialKey } from '@/data/heart-demons'
import { findRealm } from '@/data/realms'

const CORR = HEART_DEMON_DATA.corruption
const THRESHOLDS = HEART_DEMON_DATA.thresholds
const LAST = THRESHOLDS[THRESHOLDS.length - 1]!

/** gatherQi objective target, computed the same way the store does. */
function gatherTargetFor(key: HeartDemonTrialKey): number {
  const objective = findDemonTrial(key).objective
  if (objective.type !== 'gatherQi') throw new Error('not a gatherQi trial')
  return objective.reqBaseFactor * findRealm('q').reqBase
}

/** Force the store to begin `key` on the next update(0), then fire it. */
function fireTrial(key: HeartDemonTrialKey): void {
  const demons = useHeartDemonsStore()
  const index = THRESHOLDS.findIndex((t) => t.trial === key)
  demons.thresholdsCrossed = index
  demons.corruption = THRESHOLDS[index]!.at
  demons.update(0)
}

describe('heartDemons: source mapping', () => {
  beforeEach(() => bootTestStores())

  it('each listed rushed-breakthrough band adds its data amount and latches touched', () => {
    for (const [band, amount] of Object.entries(CORR.sources.rushedBreakthrough)) {
      bootTestStores()
      const demons = useHeartDemonsStore()
      demons.onGradedPrestige(band as never)
      expect(demons.corruption).toBe(amount)
      expect(demons.touched).toBe(true)
    }
  })

  it('each listed forge push adds its data amount', () => {
    for (const [push, amount] of Object.entries(CORR.sources.forgePush)) {
      bootTestStores()
      const demons = useHeartDemonsStore()
      demons.onForgePush(push as never)
      expect(demons.corruption).toBe(amount)
    }
  })

  it('each listed tribulation grade adds its data amount', () => {
    for (const [grade, amount] of Object.entries(CORR.sources.tribulation)) {
      bootTestStores()
      const demons = useHeartDemonsStore()
      demons.onTribulationResolved(grade as never)
      expect(demons.corruption).toBe(amount)
    }
  })

  it('unlisted grades add zero and never latch touched (Steady/clean)', () => {
    const demons = useHeartDemonsStore()
    demons.onGradedPrestige('Solid') // not in rushedBreakthrough
    demons.onForgePush('steady') // not in forgePush
    demons.onTribulationResolved('flawless') // not in tribulation
    demons.onTribulationResolved('shaken')
    expect(demons.corruption).toBe(0)
    expect(demons.touched).toBe(false)
  })
})

describe('heartDemons: passive bleed', () => {
  beforeEach(() => bootTestStores())

  it('bleeds bleedPerSecond/sec with no stacks', () => {
    const demons = useHeartDemonsStore()
    demons.corruption = 10
    demons.update(1)
    expect(demons.corruption).toBeCloseTo(10 - CORR.bleedPerSecond, 10)
  })

  it('bleeds faster with Dao Heart stacks', () => {
    const demons = useHeartDemonsStore()
    const stacks = 3
    demons.daoHeartStacks = stacks
    demons.corruption = 10
    demons.update(1)
    const rate = CORR.bleedPerSecond + CORR.bleedPerDaoHeartStack * stacks
    expect(demons.corruption).toBeCloseTo(10 - rate, 10)
  })

  it('never bleeds below zero', () => {
    const demons = useHeartDemonsStore()
    demons.corruption = 0.001
    demons.update(1000)
    expect(demons.corruption).toBe(0)
  })

  it('does not bleed while a trial is active', () => {
    const demons = useHeartDemonsStore()
    fireTrial('whisperingDoubt')
    const held = demons.corruption
    demons.update(100)
    expect(demons.corruption).toBe(held)
  })
})

describe('heartDemons: threshold crossing', () => {
  beforeEach(() => bootTestStores())

  it('fires the first threshold trial exactly once at its `at`', () => {
    const demons = useHeartDemonsStore()
    const first = THRESHOLDS[0]!
    demons.corruption = first.at
    demons.update(0)
    expect(demons.activeTrial).toBe(first.trial)
    expect(demons.thresholdsCrossed).toBe(1)
  })

  it('does not fire below the next threshold', () => {
    const demons = useHeartDemonsStore()
    demons.corruption = THRESHOLDS[0]!.at - 1
    demons.update(0)
    expect(demons.activeTrial).toBeNull()
    expect(demons.thresholdsCrossed).toBe(0)
  })
})

describe('heartDemons: endure trial', () => {
  beforeEach(() => bootTestStores())

  it('accrues elapsed, applies the debuff to Qi/sec, clears, grants a stack, and reverts', () => {
    const demons = useHeartDemonsStore()
    const pipelines = usePipelinesStore()
    const trial = findDemonTrial('whisperingDoubt')
    if (trial.objective.type !== 'endure') throw new Error('expected endure')
    const seconds = trial.objective.seconds

    const baseQi = pipelines.qiPerSecond.toNumber()
    expect(baseQi).toBeGreaterThan(0)

    fireTrial('whisperingDoubt')
    expect(demons.activeTrial).toBe('whisperingDoubt')
    // Debuff live in the pipeline while the trial holds.
    expect(demons.trialQiMult.toNumber()).toBe(trial.qiMultWhileActive)
    expect(pipelines.qiPerSecond.toNumber()).toBeCloseTo(baseQi * trial.qiMultWhileActive, 6)

    // Elapsed accrues; not yet complete just below target.
    demons.update(seconds - 1)
    expect(demons.trialElapsed).toBeCloseTo(seconds - 1, 10)
    expect(demons.activeTrial).toBe('whisperingDoubt')

    // Crossing the target clears the trial.
    demons.update(1)
    expect(demons.activeTrial).toBeNull()
    expect(demons.daoHeartStacks).toBe(1)
    // Debuff reverts (trialQiMult identity); only the +1 stack bonus remains.
    expect(demons.trialQiMult.toNumber()).toBe(1)
    const afterQi = pipelines.qiPerSecond.toNumber()
    expect(afterQi).toBeCloseTo(baseQi * HEART_DEMON_DATA.daoHeart.qiMultPerStack, 6)
  })
})

describe('heartDemons: gatherQi trial', () => {
  beforeEach(() => bootTestStores())

  it('accrues gathered Qi via the pipeline rate, caps at target, and clears', () => {
    const demons = useHeartDemonsStore()
    const pipelines = usePipelinesStore()
    fireTrial('hungryShadow')
    expect(demons.activeTrial).toBe('hungryShadow')

    const target = gatherTargetFor('hungryShadow')
    const rate = pipelines.qiPerSecond.toNumber() // already debuffed by the active trial
    expect(rate).toBeGreaterThan(0)

    // A small tick accrues rate×diff (well under target).
    const smallDiff = 1
    demons.update(smallDiff)
    expect(demons.trialQiGathered).toBeCloseTo(Math.min(target, rate * smallDiff), 6)
    expect(demons.activeTrial).toBe('hungryShadow')

    // A huge tick caps at target and clears.
    demons.update(target / rate + 1)
    expect(demons.trialQiGathered).toBe(target)
    expect(demons.activeTrial).toBeNull()
    expect(demons.daoHeartStacks).toBe(1)
  })
})

describe('heartDemons: prestigeCount trial', () => {
  beforeEach(() => bootTestStores())

  it('progresses via real realm prestiges and clears after `count`', () => {
    const demons = useHeartDemonsStore()
    const game = useGameStore()
    const realm = useRealmStore()
    const trial = findDemonTrial('hollowCrown')
    if (trial.objective.type !== 'prestigeCount') throw new Error('expected prestigeCount')
    const count = trial.objective.count

    fireTrial('hollowCrown')
    expect(demons.activeTrial).toBe('hollowCrown')

    const reqBase = findRealm('q').reqBase
    for (let i = 0; i < count; i++) {
      game.points = new Decimal(reqBase * 2)
      realm.prestige('q') // ungraded realm → only onTrialPrestige fires
    }
    expect(demons.trialPrestiges).toBe(count)
    // The next tick observes completion and clears.
    demons.update(0)
    expect(demons.activeTrial).toBeNull()
    expect(demons.daoHeartStacks).toBe(1)
  })
})

describe('heartDemons: concurrency (§6.3)', () => {
  beforeEach(() => bootTestStores())

  it('banks sources during a trial; flush on clear does not double-fire', () => {
    const demons = useHeartDemonsStore()
    fireTrial('whisperingDoubt')
    const heldCorruption = demons.corruption
    const bankAmount = CORR.sources.tribulation.failed!
    demons.onTribulationResolved('failed')
    // Accumulation paused: corruption unchanged, amount banked.
    expect(demons.corruption).toBe(heldCorruption)
    expect(demons.banked).toBe(bankAmount)

    // Clear the endure trial; banked flushes into corruption.
    const seconds = (findDemonTrial('whisperingDoubt').objective as { seconds: number }).seconds
    demons.update(seconds)
    expect(demons.activeTrial).toBeNull()
    expect(demons.corruption).toBe(heldCorruption + bankAmount)
    expect(demons.banked).toBe(0)
  })

  it('a flush crossing the next threshold fires the queued trial next tick, never two at once', () => {
    const demons = useHeartDemonsStore()
    fireTrial('whisperingDoubt')
    const first = THRESHOLDS[0]!
    const second = THRESHOLDS[1]!

    // Bank enough that the flush pushes corruption past the SECOND threshold.
    const bankEach = CORR.sources.tribulation.failed!
    let banked = 0
    while (first.at + banked < second.at) {
      demons.onTribulationResolved('failed')
      banked += bankEach
    }
    expect(demons.corruption).toBe(first.at) // still paused

    // Clear trial 1: flush happens, but NO second trial fires this tick.
    const seconds = (findDemonTrial(first.trial).objective as { seconds: number }).seconds
    demons.update(seconds)
    expect(demons.activeTrial).toBeNull() // the one-tick gap: never two active
    expect(demons.corruption).toBe(first.at + banked)
    expect(demons.corruption).toBeGreaterThanOrEqual(second.at)

    // The next tick's threshold check fires the queued trial.
    demons.update(0)
    expect(demons.activeTrial).toBe(second.trial)
    expect(demons.thresholdsCrossed).toBe(2)
  })
})

describe('heartDemons: repeat ladder', () => {
  beforeEach(() => bootTestStores())

  it('past the last table row, the next trigger is lastAt + repeatEvery', () => {
    const demons = useHeartDemonsStore()
    demons.thresholdsCrossed = THRESHOLDS.length
    expect(demons.nextThresholdAt).toBe(LAST.at + HEART_DEMON_DATA.repeatEvery)

    // Firing it repeats the final trial and advances the ladder by repeatEvery.
    demons.corruption = LAST.at + HEART_DEMON_DATA.repeatEvery
    demons.update(0)
    expect(demons.activeTrial).toBe(LAST.trial)
    expect(demons.nextThresholdAt).toBe(LAST.at + HEART_DEMON_DATA.repeatEvery * 2)
  })
})

describe('heartDemons: rushed-breakthrough end-to-end', () => {
  beforeEach(() => bootTestStores())

  it('a weak-score Foundation prestige corrupts by the band amount', () => {
    const game = useGameStore()
    const realm = useRealmStore()
    const demons = useHeartDemonsStore()
    realm.slice.f = { ...realm.slice.f, unlocked: true }
    game.points = new Decimal(findRealm('f').reqBase * 2)
    realm.prestige('f') // fresh body → score 0 → Flawed band
    expect(demons.corruption).toBe(CORR.sources.rushedBreakthrough.Flawed)
    expect(demons.touched).toBe(true)
  })

  it('a strong-score Foundation prestige adds no corruption', () => {
    const game = useGameStore()
    const body = useBodyStore()
    const realm = useRealmStore()
    const demons = useHeartDemonsStore()
    const grade = findRealm('f').grade!
    // Max meridian + temper terms → score >= Solid floor (Solid is unlisted).
    body.primaryMeridians = grade.meridianDenominator
    body.temperLevel = grade.temperDenominator
    realm.slice.f = { ...realm.slice.f, unlocked: true }
    game.points = new Decimal(findRealm('f').reqBase * 2)
    realm.prestige('f')
    expect(demons.corruption).toBe(0)
    expect(demons.touched).toBe(false)
  })
})

describe('heartDemons: save round-trip', () => {
  beforeEach(() => bootTestStores())

  it('restores mid-trial state exactly', () => {
    const demons = useHeartDemonsStore()
    fireTrial('hungryShadow')
    demons.update(1) // accrue some gathered Qi
    demons.onTribulationResolved('failed') // bank something
    const snapshot = demons.save()

    bootTestStores()
    const reloaded = useHeartDemonsStore()
    reloaded.load(snapshot)
    expect(reloaded.save()).toEqual(snapshot)
    expect(reloaded.activeTrial).toBe('hungryShadow')
    expect(reloaded.banked).toBe(CORR.sources.tribulation.failed)
    expect(reloaded.trialQiGathered).toBe(demons.trialQiGathered)
    expect(reloaded.thresholdsCrossed).toBe(demons.thresholdsCrossed)
    expect(reloaded.touched).toBe(true)
  })
})
