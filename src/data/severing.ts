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

export function findCorpse(key: CorpseKey): CorpseRow {
  return SEVERING_DATA.corpses.find((c) => c.key === key)!
}

export function findSeverable(key: SeverableKey): SeverableRow {
  return SEVERING_DATA.severables.find((s) => s.key === key)!
}
