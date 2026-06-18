// src/data/automation.ts — single source of truth for the automation ladder
// (design §1.7 "Automation as climbing reward" / §7.5 "the automation ladder").
//
// Port of js/data/automation.js. Automation is a REWARD, never a settings
// toggle (§1.7): a grant becomes ACTIVE the moment its milestone is earned and
// stays on forever — no per-automation on/off switch in the UI.
//
// DELIBERATELY NOT AUTOMATED: tempering. Temper is a grade DECISION, not hands
// (§4b) — how far you temper sets your Foundation ceiling, a choice the player
// makes, so it stays MANUAL even at Nascent Soul. Only repetitive, decisionless
// actions are automated here.

import type { BodyBuyableKey, AutomationKey, LayerId, RealmId } from '@/engine/types'

/** Maturity model for auto-prestige bells (decides WHEN the bell fires/rests). */
export interface MaturityConfig {
  /** The "worth it" floor: at zero maturity the bell fires when the pending gain
   * is at least this fraction of current currency. Prevents zeroing the pool. */
  readonly baseFraction: number
  /** Shapes the falloff: effectiveFraction = baseFraction × (1/(1-completeness))^costExponent. */
  readonly costExponent: number
  /** >= 1. Hard ceiling on the multiplier (guarantees the bell reaches rest). */
  readonly costCap: number
  /** Completeness within this of 1.0 = fully formed → bell rests. */
  readonly restEpsilon: number
  /** Optional — also require the forge fuel reserve before resting. */
  readonly fuelFromForge?: boolean
}

export interface AutomatesPrestige {
  readonly layer: RealmId
  readonly action: 'prestige'
  readonly maturity: MaturityConfig
}

export interface AutomatesBuyable {
  readonly layer: 'b'
  readonly action: 'buyable'
  readonly buyableKey: BodyBuyableKey
}

export type Automates = AutomatesPrestige | AutomatesBuyable

export interface AutomationRow {
  readonly key: AutomationKey
  /** The milestone whose acquisition ACTIVATES this grant. */
  readonly grantedBy: { readonly layer: LayerId; readonly milestone: number }
  readonly automates: Automates
}

export const AUTOMATION_DATA: readonly AutomationRow[] = [
  {
    // Auto-prestige Qi Condensation once Nascent Soul is reached (§5). q is the
    // root realm — re-condensing Qi is the most repetitive, decisionless action.
    key: 'nascentQiPrestige',
    grantedBy: { layer: 'n', milestone: 0 },
    automates: {
      layer: 'q',
      action: 'prestige',
      maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5 },
    },
  },
  {
    // Auto-open Primary Meridians once NS reached. Pure repetition (no decision).
    key: 'nascentPrimaryMeridians',
    grantedBy: { layer: 'n', milestone: 0 },
    automates: { layer: 'b', action: 'buyable', buyableKey: 'primaryMeridian' },
  },
  {
    // Auto-open Extraordinary Meridians once NS reached. Same repetition.
    key: 'nascentExtraordinaryMeridians',
    grantedBy: { layer: 'n', milestone: 0 },
    automates: { layer: 'b', action: 'buyable', buyableKey: 'extraordinaryMeridian' },
  },
  {
    // The ARSENAL (§4.3 "arsenal automations", slice 5): auto-Foundation-prestige
    // bell once the arsenal contribution milestone is reached (gated on a forged
    // core). Rebuilds Foundation after a NS cascade, then rests. fuelFromForge
    // holds the bell until enough forge fuel is banked.
    key: 'sectFoundationBell',
    grantedBy: { layer: 'sect', milestone: 2 },
    automates: {
      layer: 'f',
      action: 'prestige',
      maturity: { baseFraction: 0.05, costExponent: 2, restEpsilon: 0.001, costCap: 5, fuelFromForge: true },
    },
  },
]

export function findAutomation(key: AutomationKey): AutomationRow {
  const row = AUTOMATION_DATA.find((a) => a.key === key)
  if (!row) throw new Error(`Unknown automation key: ${key}`)
  return row
}
