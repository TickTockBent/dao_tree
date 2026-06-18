// src/data/sect.ts — single source of truth for the Sect side-spine (design §4.3).
//
// Port of js/data/sect.js. The sect is the game's THIRD grammar (horizontal
// standing): not a vertical prestige and not the Dao lattice's comprehension,
// but a side-spine of CONTRIBUTION that buys stipends, a technique library, and
// arsenal automations. It is LIFE-scoped — a member of no tree.

import type { Condition } from '@/engine/meets'
import type { Element, SectArchetypeKey, SectMilestoneKey, TechniqueKey } from '@/engine/types'

export interface SectContributionConfig {
  readonly resource: string
  /** Multiplier on the (qi/sec)^exponent term. */
  readonly rate: number
  /** < 1 — SUB-LINEAR in Qi/sec (linter-enforced), so late-game Qi doesn't trivialize the sect economy. */
  readonly exponent: number
}

export interface SectArchetype {
  readonly key: SectArchetypeKey
  readonly name: string
  readonly element: Element
  /** (0,1] — this element's lattice node costs × this while joined (§4.3). */
  readonly latticeDiscount: number
  /** Technique keys this archetype's school unlocks (display only). */
  readonly techniques: readonly TechniqueKey[]
}

export interface SectMilestoneReward {
  readonly qiMult?: number
  readonly libraryTier?: 2
  readonly arsenal?: true
}

export interface SectMilestone {
  readonly key: SectMilestoneKey
  /** Contribution high-water that earns it. */
  readonly at: number
  readonly reward: SectMilestoneReward
  /** Optional cultivation-stage gate; until met, milestone can't earn AND
   * contribution accrual is CAPPED at this `at`. */
  readonly requires?: Condition
}

export interface SectConfig {
  readonly id: 'sect'
  readonly name: string
  readonly symbol: string
  readonly color: string
  /** meets()-style reveal condition (§5a). Revealed at Qi Condensation 2nd Level. */
  readonly reveal: Condition
  readonly contribution: SectContributionConfig
  readonly archetypes: readonly SectArchetype[]
  /** Contribution high-water milestones; ids = array index. */
  readonly milestones: readonly SectMilestone[]
}

export const SECT_DATA: SectConfig = {
  id: 'sect',
  name: 'Unaffiliated', // display before the pick; becomes archetype name once joined
  symbol: '宗',
  color: '#5aa0c9',
  reveal: { realm: ['q', '2nd Level'] },
  // Passive accrual while JOINED: contribution/sec = rate × (qi/sec)^exponent.
  // Sub-linear sqrt so late-game Qi doesn't trivialize the sect economy.
  contribution: { resource: 'Contribution', rate: 0.5, exponent: 0.5 },
  archetypes: [
    {
      key: 'azureSword',
      name: 'Azure Sword Sect',
      element: 'metal',
      latticeDiscount: 0.75,
      techniques: ['azureForm', 'severingArc', 'swordHeart'],
    },
    {
      key: 'stoneFormation',
      name: 'Stone Formation Sect',
      element: 'earth',
      latticeDiscount: 0.75,
      techniques: ['stoneSkin', 'wardLattice', 'mountainHeart'],
    },
  ],
  milestones: [
    // Stipend: +15% Qi/sec for standing in the sect. No cultivation gate.
    { key: 'stipend', at: 250, reward: { qiMult: 1.15 } },
    // Library: unlocks tier-2 techniques. Gated on Foundation Establishment.
    { key: 'library', at: 4000, reward: { libraryTier: 2 }, requires: { realm: ['f', 'Early Foundation'] } },
    // Arsenal: grants the sectFoundationBell automation. Gated on a forged core.
    { key: 'arsenal', at: 30000, reward: { arsenal: true }, requires: { realm: ['c', 'Core Forged'] } },
  ],
}

export function findSectArchetype(key: SectArchetypeKey): SectArchetype {
  const row = SECT_DATA.archetypes.find((a) => a.key === key)
  if (!row) throw new Error(`Unknown sect archetype key: ${key}`)
  return row
}

export function sectMilestoneIndex(key: SectMilestoneKey): number {
  const idx = SECT_DATA.milestones.findIndex((m) => m.key === key)
  if (idx < 0) throw new Error(`Unknown sect milestone key: ${key}`)
  return idx
}
