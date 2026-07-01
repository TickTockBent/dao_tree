// src/data/secret-realm.ts — Secret Realm sites, rotation, and expedition tuning (slice 7).
//
// Design §6.4: genuinely optional, repeatable expedition runs. Enter a pocket
// world with rule modifiers; ONLY expedition sub-state resets on entry (never
// main progression — the run bypasses engine/doReset.ts entirely); permanent
// rewards out: materials (the profession economy, §7.6), Insight surges, and
// one first-clear Dao Glimpse. Rotating availability gives idle session
// cadence. Map invariant §6.6 applies: everything here is an ACCELERANT —
// no gated objective anywhere requires a single expedition.
//
// Essence models (deterministic, headless-testable — no RNG in v1):
//   'qiRate'      essence/sec = essenceBase × (1 + log10(1 + Qi/sec)) × rateMult
//                 (sub-linear coupling: late-game runs yield more, never explode)
//   'insightRate' essence/sec = essenceBase × (1 + Insight/sec × insightScale) × rateMult
//                 (the Inverted Spirit Land: spirit, not qi, feeds the land)
//   'fixed'       essence/sec = essenceBase × rateMult
//                 (build-independent; time in the vault is the only input)
// The design doc's "qi gains from spending" modifier example is DEFERRED — it
// needs spend-path hooks; recorded here so the idea isn't lost. ⟨design⟩
//
// Rotation: the active site cycles among UNLOCKED sites every
// rotation.periodSeconds of timePlayed — activeIndex =
// floor(timePlayed / period) % unlockedCount. Only the active site can be
// entered; per-site cooldowns (keyed on timePlayed) stop back-to-back farming
// of one site across its rotation window.

import type { Condition } from '@/engine/meets'
import type { Element, LatticeNodeKey, MaterialKey, SecretRealmSiteKey } from '@/engine/types'

export type EssenceModel = 'qiRate' | 'insightRate' | 'fixed'

export interface SecretRealmModifier {
  readonly key: string
  readonly label: string
  /** Player-facing rule text shown on the site card. */
  readonly description: string
  readonly essenceModel: EssenceModel
  /** Multiplies the model's essence rate (the "rule modifier" knob). */
  readonly rateMult: number
  /** Only read by the 'insightRate' model: essence per (Insight/sec × this). */
  readonly insightScale?: number
}

export interface SecretRealmRewards {
  /** Which material this site drops and how much per essence point. */
  readonly material: MaterialKey
  readonly materialPerEssence: number
  /** Insight surge granted on completion per essence point (§7.3 epiphany source). */
  readonly insightPerEssence: number
  /**
   * First-clear bonus: a free Glimpse (tier 1) of this lattice node if unowned.
   * Only the vault carries one in v1.
   */
  readonly firstClearGlimpseNode?: LatticeNodeKey
}

export interface SecretRealmSite {
  readonly key: SecretRealmSiteKey
  readonly name: string
  readonly element: Element
  readonly color: string
  /** Run length in seconds; the run resolves automatically at the end. */
  readonly durationSeconds: number
  /** Per-site cooldown (seconds of timePlayed) after a run resolves. */
  readonly cooldownSeconds: number
  readonly modifier: SecretRealmModifier
  readonly rewards: SecretRealmRewards
  /** Site availability gate (meets() grammar); {} = available at system reveal. */
  readonly unlock: Condition
}

export interface SecretRealmData {
  /** System reveal (meets() grammar): expeditions open once the core is forged. */
  readonly reveal: Condition
  readonly rotation: {
    /** Seconds of timePlayed per rotation window. */
    readonly periodSeconds: number
  }
  /** Essence accrual base rate shared by all models (essence/sec at 1×). */
  readonly essenceBase: number
  readonly sites: readonly SecretRealmSite[]
}

export const SECRET_REALM_DATA: SecretRealmData = {
  reveal: { coreForged: true },
  rotation: { periodSeconds: 1800 },
  essenceBase: 1,
  sites: [
    {
      key: 'verdantHollow',
      name: 'Verdant Hollow',
      element: 'wood',
      color: '#6fae5c',
      durationSeconds: 120,
      cooldownSeconds: 600,
      modifier: {
        key: 'richGrowth',
        label: 'Rich Growth',
        description:
          'Spirit herbs flourish here. Essence gathers half again as fast, fed by your Qi flow.',
        essenceModel: 'qiRate',
        rateMult: 1.5,
      },
      rewards: { material: 'spiritHerb', materialPerEssence: 1, insightPerEssence: 0.2 },
      unlock: {},
    },
    {
      key: 'invertedSpiritLand',
      name: 'Inverted Spirit Land',
      element: 'water',
      color: '#5a8fc9',
      durationSeconds: 90,
      cooldownSeconds: 600,
      modifier: {
        key: 'inversion',
        label: 'Spiritual Inversion',
        description:
          'Qi is mute in this land — only comprehension speaks. Essence gathers from your Insight flow, not your Qi.',
        essenceModel: 'insightRate',
        rateMult: 1,
        insightScale: 4,
      },
      rewards: { material: 'essenceCrystal', materialPerEssence: 0.5, insightPerEssence: 0.4 },
      unlock: { realm: ['n', 'Early Nascent Soul'] },
    },
    {
      key: 'shatteredStarVault',
      name: 'Shattered Star Vault',
      element: 'metal',
      color: '#c9b45a',
      durationSeconds: 180,
      cooldownSeconds: 1200,
      modifier: {
        key: 'starvedQi',
        label: 'Starved Qi',
        description:
          'The vault suppresses all cultivation — essence gathers slowly, at a fixed trickle no power can hurry. Something bright is buried here.',
        essenceModel: 'fixed',
        rateMult: 0.6,
      },
      rewards: {
        material: 'beastCore',
        materialPerEssence: 0.25,
        insightPerEssence: 0.3,
        firstClearGlimpseNode: 'edge',
      },
      unlock: { realm: ['n', 'Great Circle'] },
    },
  ],
}

/** Find a site row by key (throws on unknown key — data bug, not runtime state). */
export function findSecretRealmSite(key: SecretRealmSiteKey): SecretRealmSite {
  const site = SECRET_REALM_DATA.sites.find((s) => s.key === key)
  if (!site) throw new Error(`unknown secret realm site: ${key}`)
  return site
}
