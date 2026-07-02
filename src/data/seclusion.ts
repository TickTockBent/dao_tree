// src/data/seclusion.ts — Deep Meditation: the offline "secluded cultivation" cap.
//
// Wes's design (2026-07-02): offline progress is framed as SECLUDED
// CULTIVATION — deep meditation sustains the cultivator while away, and the
// cap on how much secluded progress can bank is itself PROGRESSION, not a
// setting. Each realm reached reveals the next meditation rung; purchasing it
// (a Qi sink, priced to that realm's economy) permanently deepens the
// meditation. ETERNAL scope: the soul learned to cultivate unattended — a new
// body does not unlearn it (survives even reincarnation; Samsara's first
// pre-built inheritance).
//
// Invariant §6.6: rungs cost ONLY Qi (never sect/lattice currencies) — QoL
// must never require optional systems. Costs are deliberately affordable-but-
// noticeable sinks at each realm's banking scale. ⟨tune⟩
//
// The genre note this answers (docs/idle_research.md): offline generosity is
// one of the most-loved idle features and stingy caps read as punishment. The
// framing here is "your seclusion deepens" (what you KEEP), never "offline
// capped" (what you lose).

import type { Condition } from '@/engine/meets'
import type { RealmId } from '@/engine/types'

export interface SeclusionRung {
  /** The realm whose attainment reveals this rung (also the rung's identity). */
  readonly realm: RealmId
  readonly name: string
  /** Player-facing flavor for the purchase moment. */
  readonly description: string
  /** Reveal gate (meets() grammar — realm reached at best >= 1). */
  readonly unlock: Condition
  /** Qi cost (the only currency seclusion may ever cost — §6.6). */
  readonly qiCost: number
  /** Additional secluded-banking seconds this rung grants, forever. */
  readonly capBonusSeconds: number
}

export interface SeclusionData {
  /** The unenlightened base: how long meditation sustains an untrained soul. */
  readonly baseCapSeconds: number
  /** Ascending rungs, one per Act I realm. Later acts append rows. */
  readonly rungs: readonly SeclusionRung[]
}

const HOUR_SECONDS = 3600

export const SECLUSION_DATA: SeclusionData = {
  baseCapSeconds: HOUR_SECONDS,
  rungs: [
    {
      realm: 'q',
      name: 'Steady Breath',
      description:
        'The first discipline: breath that continues without being watched. Your seclusion deepens by an hour.',
      unlock: { realm: ['q', 1] },
      qiCost: 500,
      capBonusSeconds: HOUR_SECONDS,
    },
    {
      realm: 'f',
      name: 'Rooted Mind',
      description:
        'A foundation holds the mind as well as the qi. Deep meditation sustains you an hour longer.',
      unlock: { realm: ['f', 1] },
      qiCost: 50000,
      capBonusSeconds: HOUR_SECONDS,
    },
    {
      realm: 'c',
      name: 'Core-Warmed Stillness',
      description:
        'The golden core turns within you whether you attend it or not. Another hour of seclusion banks.',
      unlock: { realm: ['c', 1] },
      qiCost: 2000000,
      capBonusSeconds: HOUR_SECONDS,
    },
    {
      realm: 'n',
      name: 'Soul Keeps the Vigil',
      description:
        'The nascent soul watches while the body rests. Your deep meditation grows by another hour.',
      unlock: { realm: ['n', 1] },
      qiCost: 50000000,
      capBonusSeconds: HOUR_SECONDS,
    },
    {
      realm: 's',
      name: 'Closed-Door Perfection',
      description:
        'Behind the closed door, cultivation no longer needs you present at all — only committed. A final Act I hour.',
      unlock: { realm: ['s', 1] },
      qiCost: 10000000000,
      capBonusSeconds: HOUR_SECONDS,
    },
  ],
}

/** Find a rung by its realm key (throws on unknown — data bug, not runtime state). */
export function findSeclusionRung(realm: RealmId): SeclusionRung {
  const rung = SECLUSION_DATA.rungs.find((r) => r.realm === realm)
  if (!rung) throw new Error(`unknown seclusion rung: ${realm}`)
  return rung
}
