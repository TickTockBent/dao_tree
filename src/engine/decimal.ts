// src/engine/decimal.ts — break_eternity re-export + helpers
//
// Centralizes Decimal construction so no module-top-level `new Decimal()` runs
// before save load (the TMT `mod.js` did this and it was fragile). All engine
// code imports Decimal + constants from here.

import Decimal from 'break_eternity.js'

export { Decimal }
export type { default as DecimalType } from 'break_eternity.js'

/** Pre-allocated constants (lazy — built on first access, never at module load). */
let cachedZero: Decimal | null = null
let cachedOne: Decimal | null = null

export const decimalZero = (): Decimal => (cachedZero ??= new Decimal(0))
export const decimalOne = (): Decimal => (cachedOne ??= new Decimal(1))

/** Build a Decimal from any source; null/undefined → zero. */
export const D = (value: import('break_eternity.js').DecimalSource | null | undefined): Decimal => {
  if (value === null || value === undefined) return decimalZero()
  return new Decimal(value)
}

/** True if a value is a Decimal instance (not a plain number/string). */
export const isDecimal = (value: unknown): value is Decimal =>
  value instanceof Decimal

export default Decimal
