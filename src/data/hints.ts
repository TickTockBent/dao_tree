// src/data/hints.ts — guidance cascade for the hint bar (design doc §1.5).
//
// Port of js/data/hints.js. First-match-wins, top-down. The final row MUST be
// unconditional (always: true) — lint-enforced (§1.5/§8.5). Later-game states
// sit above earlier-game states.

import type { HintCondition } from '@/engine/meets'
import type { HintKey } from '@/engine/types'

/** Conditional row: { key, when, text }. */
export interface ConditionalHintRow {
  readonly key: HintKey
  readonly when: HintCondition
  readonly text: string
  readonly always?: undefined
}

/** Unconditional catch-all row: { key, always: true, text }. Must be last. */
export interface CatchAllHintRow {
  readonly key: HintKey
  readonly always: true
  readonly text: string
  readonly when?: undefined
}

export type HintRow = ConditionalHintRow | CatchAllHintRow

export interface HintData {
  readonly hints: readonly HintRow[]
}

export const HINT_DATA: HintData = {
  hints: [
    {
      // Act I complete — tribulation passed, Legacy recorded. Final Act I state.
      key: 'actComplete',
      when: { tribulationPassed: true },
      text: 'Soul Formation is complete. The Legacy of your mortal road is written. Spirit Severing lies ahead, and with it a heavier question.',
    },
    {
      // First Tribulation ready to trigger.
      key: 'faceTribulation',
      when: { tribulationReady: true },
      text: 'The First Tribulation is ready. Your preparations are as complete as this life allows. Trigger it before you climb further; banked Qi fuels the pool.',
    },
    {
      // A scar is ACTIVE — guide to the heal arc.
      key: 'healScar',
      when: { scarActive: true },
      text: 'The tribulation left a scar. It will heal in time. Keep cultivating; the warmth of qi slowly mends what the storm tore.',
    },
    {
      // Soul Formation entered; climb toward the tribulation gate at the peak.
      key: 'climbSoulFormation',
      when: { realm: ['s', 'Early Soul Formation'] },
      text: 'Climb toward Soul Formation. The final test of your mortal road lies ahead, and the tribulation waits at the peak.',
    },
    {
      // NS layer unlocked but Soul Aspect unchosen.
      key: 'chooseAspect',
      when: { layerUnlocked: 'n', aspectUnchosen: true },
      text: 'Your nascent soul stirs within the Golden Core, formless and eager. Choose its aspect and give it a face.',
    },
    {
      // First NS substage reached; aspect already chosen (or this fires after).
      key: 'climbNascent',
      when: { realm: ['n', 'Early Nascent Soul'] },
      text: 'Deepen the soul. Each sub-stage of the Nascent Soul refines it toward the Soul Formation gate at the mountain\'s edge.',
    },
    {
      // Core forged but below its Foundation ceiling — warm it via refinement.
      key: 'warmCore',
      when: { coreForged: true, coreBelowCeiling: true },
      text: 'Warm your core. Each full bar raises its grade one tier toward the Foundation ceiling.',
    },
    {
      // Core forged and AT its ceiling — tease the next horizon.
      key: 'coreComplete',
      when: { coreForged: true },
      text: 'Your Golden Core is complete. Refine Core Formation toward Core Refined to unlock the Nascent Soul.',
    },
    {
      // Core Formation unlocked — bank Foundation fuel and pick a push.
      key: 'chooseForge',
      when: { layerUnlocked: 'c' },
      text: 'Bank Foundation fuel and choose your forge push. Push harder for a finer core, but risk a crack.',
    },
    {
      // In Foundation; guide toward Great Circle + Tendon temper tier.
      key: 'climbFoundation',
      when: { realm: ['f', 'Early Foundation'] },
      text: 'Climb Foundation toward Great Circle, and temper to Tendons. That opens Core Formation.',
    },
    {
      // Reached 6th Level (Foundation revealed); open 4 meridians and break through.
      key: 'breakToFoundation',
      when: { realm: ['q', '6th Level'] },
      text: 'Open 4 meridians and break through to Foundation Establishment.',
    },
    {
      // Dao Lattice revealed at 4th Level.
      key: 'openLattice',
      when: { realm: ['q', '4th Level'] },
      text: 'The Dao Lattice has revealed itself. Explore it with Insight and claim your first Glimpse.',
    },
    {
      // First Glimpse owned — nudge toward Breathing Trance.
      key: 'enterTrance',
      when: { anyDaoNode: 1 },
      text: 'Enter Breathing Trance to trade some Qi speed for faster Insight. The lattice grows quicker in stillness.',
    },
    {
      // Sect revealed but no archetype chosen (optional — never pins the cascade).
      key: 'joinSect',
      when: { sectUnjoined: true },
      text: 'A sect has taken notice of your progress. Visit the Sect tab and choose your path; the choice shapes your techniques and your Dao.',
    },
    {
      // Qi Condensation unlocked but below 4th Level.
      key: 'climbQi',
      when: { layerUnlocked: 'q' },
      text: 'Climb the Qi Condensation levels and open your meridians. They never reset.',
    },
    {
      // Catch-all — mandatory unconditional last row (§1.5 lint-enforced).
      key: 'gatherQi',
      always: true,
      text: 'Gather Qi until you can condense it. This is the first step on the cultivator\'s road.',
    },
  ],
}
