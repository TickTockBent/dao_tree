// src/stores/sect.ts — Sect standing + techniques (LIFE-scoped).
//
// Port of the factory's sect layer + technique readers. The sect is the THIRD
// grammar: a LIFE-scoped side-spine of CONTRIBUTION that buys stipends, a
// technique library, and arsenal automations. Contribution accrues passively
// while joined (sub-linear in Qi/sec, §4.3).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { SECT_DATA, findSectArchetype } from '@/data/sect'
import { TECHNIQUE_DATA } from '@/data/techniques'
import { usePipelinesStore } from './pipelines'
// Slice 10 (D36): joining a sect is a milestone first (readerless, deferred).
import { recordMilestoneFirst } from '@/engine/karmaEvents'
import type { SectArchetypeKey } from '@/engine/types'

export interface SectSlice {
  archetype: string
  contribution: string
  best: string
  revealed: boolean
  techniques: number[]
  milestones: number[]
}

export function freshSectSlice(): SectSlice {
  return { archetype: '', contribution: '0', best: '0', revealed: false, techniques: [], milestones: [] }
}

export const useSectStore = defineStore('sect', () => {
  const pipelines = usePipelinesStore()

  const archetype = ref<SectArchetypeKey | ''>('')
  const contribution = ref(decimalZero())
  const best = ref(decimalZero())
  const revealed = ref(false)
  const techniques = ref<number[]>([])
  const milestones = ref<number[]>([])

  const joined = computed(() => archetype.value !== '')
  const contributionBestDecimal = computed(() => best.value)

  // ---- Reveal + join ------------------------------------------------------

  function isRevealGateMet(): boolean {
    return meets(SECT_DATA.reveal, buildGameState())
  }

  function isRevealed(): boolean {
    return revealed.value || isRevealGateMet()
  }

  /** Pick an archetype (one-shot per life). */
  function joinSect(key: SectArchetypeKey): void {
    if (joined.value) return
    archetype.value = key
    recordMilestoneFirst('joinSect') // slice 10 (D36): a build-defining pick
  }

  // ---- Contribution accrual -----------------------------------------------

  /** Contribution/sec = rate × (qi/sec)^exponent (sub-linear, §4.3). */
  function contributionPerSecond(): Decimal {
    if (!joined.value) return decimalZero()
    const cfg = SECT_DATA.contribution
    const qiPerSec = pipelines.qiPerSecond
    if (qiPerSec.lte(0)) return decimalZero()
    return new Decimal(cfg.rate).times(qiPerSec.pow(cfg.exponent))
  }

  /** The first unmet-stage milestone's `at` (contribution cap before the gate is met). */
  function contributionStageCap(): number {
    for (const m of SECT_DATA.milestones) {
      const idx = SECT_DATA.milestones.indexOf(m)
      if (milestones.value.includes(idx)) continue // already earned
      if (m.requires && !meets(m.requires, buildGameState())) return m.at
    }
    return Number.POSITIVE_INFINITY
  }

  // ---- Milestones ---------------------------------------------------------

  function hasMilestone(index: number): boolean {
    return milestones.value.includes(index)
  }

  /** Latch milestones whose `at` threshold is met AND whose gate (if any) is satisfied. */
  function latchMilestones(): void {
    const bestNum = best.value.toNumber()
    const earned = new Set(milestones.value)
    for (const m of SECT_DATA.milestones) {
      const idx = SECT_DATA.milestones.indexOf(m)
      if (earned.has(idx)) continue
      if (bestNum < m.at) continue
      if (m.requires && !meets(m.requires, buildGameState())) continue
      earned.add(idx)
    }
    milestones.value = [...earned].sort((a, b) => a - b)
  }

  // ---- Sect stipend (pipeline factor) -------------------------------------

  /** The sect stipend qiMult (from the stipend milestone). Identity if unearned. */
  const sectStipendQiMult = computed<Decimal>(() => {
    const stipendIdx = SECT_DATA.milestones.findIndex((m) => 'qiMult' in m.reward)
    if (stipendIdx < 0) return decimalOne()
    if (!milestones.value.includes(stipendIdx)) return decimalOne()
    const reward = SECT_DATA.milestones[stipendIdx]!.reward
    return 'qiMult' in reward && reward.qiMult !== undefined
      ? new Decimal(reward.qiMult)
      : decimalOne()
  })

  /** Lattice discount for an element (0,1] while joined + element matches. */
  function sectLatticeDiscount(element: string): Decimal {
    if (!joined.value) return decimalOne()
    const arch = findSectArchetype(archetype.value as Exclude<typeof archetype.value, ''>)
    if (arch.element !== element) return decimalOne()
    return new Decimal(arch.latticeDiscount)
  }

  // ---- Techniques ---------------------------------------------------------

  /** Is a technique visible (school available + library tier gate met)? */
  function techniqueIsVisible(index: number): boolean {
    const tech = TECHNIQUE_DATA[index]
    if (!tech) return false
    if (!joined.value) return false
    const arch = findSectArchetype(archetype.value as Exclude<typeof archetype.value, ''>)
    // School gating: sword → azureSword, formation → stoneFormation, universal → both.
    if (tech.school !== 'universal') {
      const expectedElement = tech.school === 'sword' ? 'metal' : 'earth'
      if (arch.element !== expectedElement) return false
    }
    // Library tier 2 requires the library milestone.
    if (tech.libraryTier === 2) {
      const libIdx = SECT_DATA.milestones.findIndex((m) => m.key === 'library')
      if (libIdx >= 0 && !milestones.value.includes(libIdx)) return false
    }
    return true
  }

  function techniqueIsOwned(index: number): boolean {
    return techniques.value.includes(index)
  }

  function techniqueCost(index: number): Decimal {
    const tech = TECHNIQUE_DATA[index]
    if (!tech) return decimalZero()
    return new Decimal(tech.cost)
  }

  function canAffordTechnique(index: number): boolean {
    if (!techniqueIsVisible(index)) return false
    if (techniqueIsOwned(index)) return false
    return contribution.value.gte(techniqueCost(index))
  }

  /** Buy a technique (spends contribution). */
  function buyTechnique(index: number): boolean {
    if (!canAffordTechnique(index)) return false
    const cost = techniqueCost(index)
    contribution.value = contribution.value.sub(cost).max(0)
    techniques.value = [...techniques.value, index]
    return true
  }

  /** Library milestone unlocked (for UI display). */
  function libraryUnlocked(): boolean {
    const libIdx = SECT_DATA.milestones.findIndex((m) => m.key === 'library')
    return libIdx >= 0 && milestones.value.includes(libIdx)
  }

  // ---- Update hook --------------------------------------------------------
  function update(diff: number): void {
    // Latch reveal.
    if (!revealed.value && isRevealGateMet()) revealed.value = true
    if (!revealed.value) return

    // Accrue contribution while joined.
    if (joined.value) {
      const rate = contributionPerSecond()
      if (rate.gt(0)) {
        let newContribution = contribution.value.add(rate.times(diff))
        // Cap at the stage cap (prevents banking past a gated milestone).
        const cap = contributionStageCap()
        if (newContribution.toNumber() > cap) {
          newContribution = new Decimal(cap)
        }
        contribution.value = newContribution
        // Update best (high-water).
        if (newContribution.gt(best.value)) best.value = newContribution
      }
    }

    // Latch milestones.
    latchMilestones()
  }

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return {
      archetype: archetype.value,
      contribution: contribution.value.toString(),
      best: best.value.toString(),
      revealed: revealed.value,
      techniques: techniques.value,
      milestones: milestones.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshSectSlice()) as Partial<SectSlice>
    archetype.value = (s.archetype ?? '') as SectArchetypeKey | ''
    contribution.value = new Decimal(s.contribution ?? '0')
    best.value = new Decimal(s.best ?? '0')
    revealed.value = s.revealed ?? false
    techniques.value = [...(s.techniques ?? [])]
    milestones.value = [...(s.milestones ?? [])]
  }
  function fresh(): Record<string, unknown> {
    return freshSectSlice() as unknown as Record<string, unknown>
  }

  return {
    archetype,
    contribution,
    best,
    revealed,
    techniques,
    milestones,
    joined,
    contributionBestDecimal,
    isRevealGateMet,
    isRevealed,
    joinSect,
    contributionPerSecond,
    contributionStageCap,
    hasMilestone,
    latchMilestones,
    sectStipendQiMult,
    sectLatticeDiscount,
    techniqueIsVisible,
    techniqueIsOwned,
    techniqueCost,
    canAffordTechnique,
    buyTechnique,
    libraryUnlocked,
    update,
    save,
    load,
    fresh,
  }
})
