// src/data/severing.ts — Spirit Severing: the three corpses + the severable
// list (slice 9; docs/slice-9.md, D23/D25).
//
// DESIGN CONSTRAINTS the implementer inherits:
// - Sequential, not simultaneous (D23): the corpses are severed in array
//   order; the next does not open until the current severance is LIVED WITH
//   (breakeven crossed — the severance ritual has carried the transcendent
//   multiplier past what was cut).
// - The severance choice is fully legible (D11 — never veil the now): the
//   menu shows each candidate's measured live contribution before the cut.
// - Loot/curve numbers (start fraction c, cap ratio k, ramp steps) live on
//   SETPIECE_DATA.severance — signed off (D25), rule 0.1 applies.
// - Severed things return next life (life scope); per-attachment severance
//   HISTORY is recorded on the soul slice from day one (D24 — the
//   three-lives-transcendence promise is data-real before Samsara ships it).
// - Every viable build must have >= 3 live severables (shipping assertion,
//   docs/calibration.md k-probe) — the lattice Manifestation is load-bearing
//   for non-meridian builds.

import type { CorpseKey, SeverableKey } from '@/engine/types'

export interface CorpseRow {
  readonly key: CorpseKey
  readonly name: string
  readonly flavor: string
}

export interface SeverableRow {
  readonly key: SeverableKey
  readonly name: string
  /** What the cut takes — shown on the severance menu with the measured contribution. */
  readonly flavor: string
}

export interface SeveringData {
  /** The three corpses, in severing order (sequential by construction). */
  readonly corpses: readonly CorpseRow[]
  /** The v1 severable list (D25 — final; stance is v2 pending redesign). */
  readonly severables: readonly SeverableRow[]
}

export const SEVERING_DATA: SeveringData = {
  corpses: [
    {
      key: 'past',
      name: 'The Corpse of the Past',
      flavor: 'What you were clings to what you are. Cut it loose.',
    },
    {
      key: 'present',
      name: 'The Corpse of the Present',
      flavor: 'What you lean on holds you down. Cut it away.',
    },
    {
      key: 'future',
      name: 'The Corpse of the Future',
      flavor: 'What you hope for binds you here. Cut it free.',
    },
  ],
  severables: [
    {
      key: 'soulAspect',
      name: 'Soul Aspect',
      flavor: 'The form your soul took at Nascent Soul — its element, its identity.',
    },
    {
      key: 'profession',
      name: 'Profession',
      flavor: 'The mortal livelihood: cauldron, ledger, and every pill it would have brewed.',
    },
    {
      key: 'extraordinaryMeridians',
      name: 'Extraordinary Meridians',
      flavor: 'The eight hidden channels, sealed as if never opened.',
    },
    {
      key: 'manifestation',
      name: 'Dao Manifestation',
      flavor: 'A truth of the lattice made real — unmade.',
    },
  ],
}

// ---- D28: The Offering (signed off) ---------------------------------------
//
// A severance ritual STEP completes when the player makes an OFFERING — a
// basket of existing Act I resources, consumed (D28). prestige('x') IS the
// offering action; the geometric ramp + the never-reset severance-ritual
// mastery discount together are "the second mountain, mechanically."
//
// Corpse-colored baskets (D28): each corpse's rite weights its basket toward
// the currency its build speaks — the Past (body's memory) leans qi, the
// Present (the life being lived) is balanced and discounted by an active
// pill, the Future (the promise) leans insight (the lattice's currency).
// Build diversity is which offerings come EASY, never which are possible —
// any basket is fillable by any build (qi and insight are universal).
//
// SCALE: Act II — the player has passed the tribulation. Qi lives in the
// ~2e10 era (realm-x reqBase); Insight at the lattice ring-3 (Manifestation)
// era is tens of thousands (LATTICE_DATA manifestation costs 6k–35k). The
// offering cost formula (severing store) is:
//   basket × growth^stepsIntoCurrentSeverance × max(r^rituals, f) × pill
// where r/f are ACCUMULATOR_DATA.severanceRitual (the mastery discount) and
// pill = pillDiscount when a pill is active, else 1.
//
// ALL numbers ⟨tune⟩ — pending Act II sim evidence (rule 0.1); realm x is
// statically unreachable by today's sim actors, so Act I bands cannot move.

export interface OfferingBasketRow {
  readonly corpse: CorpseKey
  /** ⟨tune⟩ Qi base for this corpse's rite (Act II ~2e10 era). */
  readonly qiBase: number
  /** ⟨tune⟩ Insight base for this corpse's rite (lattice ring-3 ~tens of thousands). */
  readonly insightBase: number
}

export interface OfferingData {
  /** Per-corpse basket bases (corpse-colored lean, D28). */
  readonly baskets: readonly OfferingBasketRow[]
  /** ⟨tune⟩ Geometric growth per ritual step WITHIN a severance (costs rise as you ramp). */
  readonly growth: number
  /** ⟨tune⟩ Cost multiplier while a pill is active (the Present's consumable lean). */
  readonly pillDiscount: number
}

export const OFFERING_DATA: OfferingData = {
  baskets: [
    // Past — the body's memory: qi-heavy, almost no insight. ⟨tune⟩
    { corpse: 'past', qiBase: 2e10, insightBase: 400 },
    // Present — the life being lived: balanced, pill-discounted. ⟨tune⟩
    { corpse: 'present', qiBase: 1.2e10, insightBase: 6000 },
    // Future — the promise: insight-heavy (tens of thousands), less qi. ⟨tune⟩
    { corpse: 'future', qiBase: 3e9, insightBase: 24000 },
  ],
  growth: 1.5, // ⟨tune⟩ — the second mountain steepens each step of a severance.
  pillDiscount: 0.8, // ⟨tune⟩ — a held pill makes every offering ~20% cheaper.
}

export function findCorpse(key: CorpseKey): CorpseRow {
  return SEVERING_DATA.corpses.find((c) => c.key === key)!
}

/** The offering basket for a corpse (D28). */
export function findOfferingBasket(key: CorpseKey): OfferingBasketRow {
  return OFFERING_DATA.baskets.find((b) => b.corpse === key)!
}

export function findSeverable(key: SeverableKey): SeverableRow {
  return SEVERING_DATA.severables.find((s) => s.key === key)!
}
