// src/data/constants.ts — primitive numeric constants for engine code (spec §11).
//
// Port of js/data/constants.js. The §11 rule ("zero numeric literals in engine
// code") is enforced by ESLint's no-magic-numbers on src/stores/** and src/sim/**;
// data tables in src/data/** are exempt. This file holds the handful of
// mathematical primitives engine code needs, so they resolve from data rather
// than as bare literals.
//
// `firstGridClickableId` is TMT-specific (the row*10+col grid base) and is kept
// only for compatibility with any legacy reference; the new engine does not use
// a TMT-style grid and may ignore it.

export interface FactoryNumerics {
  /** 0 — additive identity / sentinel. */
  readonly zero: 0
  /** 1 — multiplicative identity, single-step increment. */
  readonly one: 1
  /** 100 — percentage base for effect text. */
  readonly hundred: 100
  /**
   * 11 — TMT renders clickables/upgrades as a row*10+col grid (see setRowCol in
   * the old layerSupport.js). A generated set keyed from this base lands in row 1.
   * Legacy TMT plumbing; the new engine uses semantic ids and may ignore this.
   */
  readonly firstGridClickableId: 11
  /** 20 — cells in the text maturity bar on an auto-prestige realm (display dimension). */
  readonly maturityBarSegments: 20
  /** 500 — iteration backstop for the auto-prestige time estimator's cycle sim. */
  readonly autoPrestigeSimMaxCycles: 500
}

export const FACTORY_NUMERICS: FactoryNumerics = {
  zero: 0,
  one: 1,
  hundred: 100,
  firstGridClickableId: 11,
  maturityBarSegments: 20,
  autoPrestigeSimMaxCycles: 500,
} as const
