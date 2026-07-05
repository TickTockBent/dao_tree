// src/stores/__tests__/debug.test.ts — the Pages-only debug production accelerator.
//
// Two layers:
//   1. The ref-driven multiplier math (src/debug.ts) — flag-independent, so it
//      is directly unit-testable.
//   2. End-to-end application in the three per-second pipelines. The VITE_DAO_DEBUG
//      guard is a LIVE `import.meta.env` read under vitest (NOT statically folded,
//      unlike a Vite production build), so vi.stubEnv flips it and we can observe
//      the multiplier reach Qi / Insight / Contribution. The dead-code-elimination
//      of the same guard in an UNFLAGGED production bundle is proven separately by
//      the CI/release `grep -rq '__daoDebug'` guards, which vitest cannot exercise.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { usePipelinesStore } from '@/stores/pipelines'
import { useSectStore } from '@/stores/sect'
import { useDaoStore } from '@/stores/dao'
import { useRealmStore } from '@/stores/realm'
import { useGameStore } from '@/stores/game'
import { SECT_DATA } from '@/data/sect'
import { debugProductionMultiplier, setDebugProductionExponent } from '@/debug'

describe('debug production accelerator (Pages-only)', () => {
  beforeEach(() => {
    bootTestStores()
    setDebugProductionExponent(0)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    setDebugProductionExponent(0)
  })

  // ---- Layer 1: the ref-driven multiplier math ----
  describe('multiplier math', () => {
    it('is 10^exponent, ×1 at exponent 0', () => {
      setDebugProductionExponent(0)
      expect(debugProductionMultiplier().toNumber()).toBe(1)
      setDebugProductionExponent(1)
      expect(debugProductionMultiplier().toNumber()).toBe(10)
      setDebugProductionExponent(2)
      expect(debugProductionMultiplier().toNumber()).toBe(100)
      setDebugProductionExponent(4)
      expect(debugProductionMultiplier().toNumber()).toBe(10000)
    })

    it('clamps to 0..4 and floors fractional input', () => {
      setDebugProductionExponent(-5)
      expect(debugProductionMultiplier().toNumber()).toBe(1)
      setDebugProductionExponent(99)
      expect(debugProductionMultiplier().toNumber()).toBe(10000)
      setDebugProductionExponent(2.9)
      expect(debugProductionMultiplier().toNumber()).toBe(100)
    })
  })

  // ---- Layer 2: end-to-end application in the three per-second pipelines ----
  describe('pipeline application', () => {
    it('is inert when the VITE_DAO_DEBUG flag is absent', () => {
      const pipelines = usePipelinesStore()
      const baseQiPerSecond = pipelines.qiPerSecond.toNumber()
      setDebugProductionExponent(3)
      // No flag → the guard branch never runs → production is untouched.
      expect(pipelines.qiPerSecond.toNumber()).toBe(baseQiPerSecond)
    })

    it('Qi/sec multiplies by 10^n and returns to ×1 at n=0', () => {
      vi.stubEnv('VITE_DAO_DEBUG', '1')
      const pipelines = usePipelinesStore()
      setDebugProductionExponent(0)
      const baseQiPerSecond = pipelines.qiPerSecond
      expect(baseQiPerSecond.toNumber()).toBeGreaterThan(0)

      setDebugProductionExponent(2)
      expect(pipelines.qiPerSecond.div(baseQiPerSecond).toNumber()).toBeCloseTo(100, 6)
      setDebugProductionExponent(4)
      expect(pipelines.qiPerSecond.div(baseQiPerSecond).toNumber()).toBeCloseTo(10000, 6)

      setDebugProductionExponent(0)
      expect(pipelines.qiPerSecond.toNumber()).toBe(baseQiPerSecond.toNumber())
    })

    it('Dao Insight/sec multiplies by 10^n', () => {
      vi.stubEnv('VITE_DAO_DEBUG', '1')
      const game = useGameStore()
      const realm = useRealmStore()
      const dao = useDaoStore()
      const pipelines = usePipelinesStore()
      game.points = new Decimal(1e6)
      realm.prestige('q')
      dao.update(1) // latch the Dao reveal
      dao.insight = new Decimal(500)

      setDebugProductionExponent(0)
      const baseInsightPerSecond = pipelines.insightPerSecond
      expect(baseInsightPerSecond.toNumber()).toBeGreaterThan(0)

      setDebugProductionExponent(3)
      expect(pipelines.insightPerSecond.div(baseInsightPerSecond).toNumber()).toBeCloseTo(1000, 6)
    })

    it('sect Contribution/sec applies its own 10^n on top of the qi boost', () => {
      vi.stubEnv('VITE_DAO_DEBUG', '1')
      const sect = useSectStore()
      sect.joinSect('azureSword')

      setDebugProductionExponent(0)
      const baseContributionPerSecond = sect.contributionPerSecond()
      expect(baseContributionPerSecond.toNumber()).toBeGreaterThan(0)

      // contribution/sec = rate × (qi/sec)^exponent, then ×10^n. Because qi/sec is
      // ALSO boosted by 10^n, the observed ratio is 10^(n·exponent) × 10^n =
      // 10^(n·(exponent+1)); the trailing 10^n is contribution's own debug line.
      const contributionExponent = SECT_DATA.contribution.exponent
      const debugExponent = 2
      setDebugProductionExponent(debugExponent)
      const expectedRatio = Math.pow(10, debugExponent * (contributionExponent + 1))
      expect(sect.contributionPerSecond().div(baseContributionPerSecond).toNumber()).toBeCloseTo(
        expectedRatio,
        6,
      )
    })
  })
})
