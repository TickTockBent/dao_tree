// src/data/alchemy.ts — the Alchemy profession: recipes, pills, tuning (slice 7).
//
// Design §7.6: professions are economy tissue, not upgrade tabs. Alchemy
// CONSUMES secret-realm materials (data/secret-realm.ts rewards) and PRODUCES
// what other systems spend: a timed Qi multiplier, a breakthrough aid, and a
// tribulation pill that feeds the §6.2 preparedness pool. The Act I profession
// slot opens with the forged core; Artifice and Formations are sealed until
// later acts (slots open one per act ⟨tune⟩ — v1 renders them as sealed picks).
//
// Map invariant §6.6: every pill is an ACCELERANT. The tribulation pool bonus
// (~9% of a full pool) helps a rushed entry; it is never required — the
// spine-only pacing profile passes with zero pills.
//
// Effect types (one per recipe, discriminated on `type`):
//   'timedQiMult'          activate → Qi/sec × mult for durationSeconds; ONE
//                          active timed pill at a time (activating replaces).
//   'breakthroughAid'      held charge → next prestige of an eligible realm
//                          gains × gainMult, consumed on that prestige. The
//                          boosted gain SHOWS in resetGain while held (UI
//                          honesty). Eligible realms exclude 'q' so Automation
//                          Tier 1's auto-q-prestige can never eat a charge.
//   'tribulationPoolBonus' held pill → consumed when a tribulation begins,
//                          adding poolBonus (flat) to the preparedness pool.

import type { Condition } from '@/engine/meets'
import type { MaterialKey, PillKey, RealmId } from '@/engine/types'

export interface MaterialRow {
  readonly key: MaterialKey
  readonly name: string
  /** Which site drops it — display only; the drop itself lives in SECRET_REALM_DATA. */
  readonly sourceHint: string
}

export type PillEffect =
  | { readonly type: 'timedQiMult'; readonly mult: number; readonly durationSeconds: number }
  | {
      readonly type: 'breakthroughAid'
      readonly gainMult: number
      /** Realms whose prestige consumes (and is boosted by) a held charge. */
      readonly appliesTo: readonly RealmId[]
    }
  | { readonly type: 'tribulationPoolBonus'; readonly poolBonus: number }

export interface RecipeRow {
  readonly key: PillKey
  readonly name: string
  readonly description: string
  /** Material costs per craft. */
  readonly cost: Readonly<Partial<Record<MaterialKey, number>>>
  readonly effect: PillEffect
  /** Recipe visibility gate (meets() grammar); {} = visible once profession chosen. */
  readonly unlock: Condition
}

export interface AlchemyData {
  /** Profession-slot reveal (meets() grammar) — same beat as the Secret Realms. */
  readonly reveal: Condition
  readonly materials: readonly MaterialRow[]
  readonly recipes: readonly RecipeRow[]
}

export const ALCHEMY_DATA: AlchemyData = {
  reveal: { coreForged: true },
  materials: [
    { key: 'spiritHerb', name: 'Spirit Herb', sourceHint: 'Verdant Hollow' },
    { key: 'essenceCrystal', name: 'Essence Crystal', sourceHint: 'Inverted Spirit Land' },
    { key: 'beastCore', name: 'Beast Core', sourceHint: 'Shattered Star Vault' },
  ],
  recipes: [
    {
      key: 'gatheringPill',
      name: 'Qi-Gathering Pill',
      description: 'Swallow to double Qi gathering for ten minutes. One pill burns at a time.',
      cost: { spiritHerb: 10 },
      effect: { type: 'timedQiMult', mult: 2, durationSeconds: 600 },
      unlock: {},
    },
    {
      key: 'clarityPill',
      name: 'Pill of Still Clarity',
      description:
        'Hold before a breakthrough: the next Nascent Soul or Soul Formation advance lands half again as hard.',
      cost: { spiritHerb: 6, essenceCrystal: 4 },
      effect: { type: 'breakthroughAid', gainMult: 1.5, appliesTo: ['n', 's'] },
      unlock: { realm: ['n', 'Early Nascent Soul'] },
    },
    {
      key: 'heavenWardingPill',
      name: 'Heaven-Warding Pill',
      description:
        'Carried into a tribulation, it dissolves into the preparedness pool — a bought answer to a borrowed sky.',
      cost: { essenceCrystal: 6, beastCore: 3 },
      effect: { type: 'tribulationPoolBonus', poolBonus: 40 },
      unlock: { realm: ['s', 1] },
    },
  ],
}

/** Find a recipe row by key (throws on unknown key — data bug, not runtime state). */
export function findRecipe(key: PillKey): RecipeRow {
  const recipe = ALCHEMY_DATA.recipes.find((r) => r.key === key)
  if (!recipe) throw new Error(`unknown alchemy recipe: ${key}`)
  return recipe
}
