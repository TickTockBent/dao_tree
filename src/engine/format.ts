// src/engine/format.ts — number formatting (port of js/utils/NumberFormating.js)
//
// Faithful port. Two changes from the original:
//   1. Pure functions — no `player.hasNaN` mutation, no `modInfo.allowSmall`
//      global read. NaN is signalled by returning the literal "NaN" string;
//      callers that need to latch a NaN flag do so themselves.
//   2. `format()` takes an explicit `allowSmall` argument instead of reading
//      `modInfo.allowSmall`.

import Decimal from 'break_eternity.js'
import { decimalOne } from './decimal'

// ---- Formatting thresholds (named per §11; ported verbatim from NumberFormating.js) ----
const LOG10_TOWER_BREAKPOINT = 1e9
const COMMA_EXPONENT_BREAKPOINT = 10000
const SMALL_MAGNITUDE_LIMIT = 0.001
const TINY_MAGNITUDE_LIMIT = 0.0001
const DECIMAL_PRECISION_FLOOR = 0.1
const SMALL_PRECISION_MIN = 4
const SLOG_BREAKPOINT = 1e6
const SLOG_FRACTION_PRECISION = 3
const EEEE1000_BREAKPOINT = 'eeee1000'
const HUGE_EXP_BREAKPOINT = '1e1000000'
const LARGE_EXP_BREAKPOINT = '1e10000'
const BILLION = 1e9
const THOUSAND = 1e3
const HUGE_SLOG_BREAKPOINT = '1e1000'
const WHOLE_SMALL_LIMIT = 0.99
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400
const SECONDS_PER_YEAR = 31536000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const DAYS_PER_YEAR = 365
const TENTH = 0.1
const LOG_BASE = 10

export function exponentialFormat(num: Decimal, precision: number, mantissa = true): string {
  let e = num.log10().floor()
  let m = num.div(Decimal.pow(LOG_BASE, e))
  if (m.toStringWithDecimalPlaces(precision) === '10') {
    m = decimalOne()
    e = e.add(1)
  }
  const eStr = e.gte(LOG10_TOWER_BREAKPOINT)
    ? format(e, SLOG_FRACTION_PRECISION)
    : e.gte(COMMA_EXPONENT_BREAKPOINT)
      ? commaFormat(e, 0)
      : e.toStringWithDecimalPlaces(0)
  if (mantissa) return m.toStringWithDecimalPlaces(precision) + 'e' + eStr
  return 'e' + eStr
}

export function commaFormat(num: Decimal, precision: number): string {
  if (num === null || num === undefined) return 'NaN'
  if (num.mag < SMALL_MAGNITUDE_LIMIT) return (0).toFixed(precision)
  const init = num.toStringWithDecimalPlaces(precision)
  const portions = init.split('.')
  portions[0] = portions[0]!.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,')
  if (portions.length === 1) return portions[0]!
  return portions[0]! + '.' + portions[1]
}

export function regularFormat(num: Decimal, precision: number): string {
  if (num === null || num === undefined) return 'NaN'
  if (num.mag < TINY_MAGNITUDE_LIMIT) return (0).toFixed(precision)
  let p = precision
  if (num.mag < DECIMAL_PRECISION_FLOOR && precision !== 0) p = Math.max(precision, SMALL_PRECISION_MIN)
  return num.toStringWithDecimalPlaces(p)
}

export function fixValue(x: Decimal | null | undefined, y = 0): Decimal {
  return x ?? new Decimal(y)
}

export function sumValues(x: Record<string, Decimal>): Decimal {
  const vals = Object.values(x)
  if (!vals[0]) return new Decimal(0)
  return vals.reduce((a, b) => Decimal.add(a, b))
}

/** True if the formatter would render this value as "NaN". */
export function isFormatNaN(decimal: Decimal): boolean {
  return isNaN(decimal.sign) || isNaN(decimal.layer) || isNaN(decimal.mag)
}

export function format(
  decimal: Decimal | number | string,
  precision = 2,
  allowSmall = false,
): string {
  let d = new Decimal(decimal)
  if (isNaN(d.sign) || isNaN(d.layer) || isNaN(d.mag)) return 'NaN'
  if (d.sign < 0) return '-' + format(d.neg(), precision, allowSmall)
  if (d.mag === Number.POSITIVE_INFINITY) return 'Infinity'
  if (d.gte(EEEE1000_BREAKPOINT)) {
    const slog = d.slog()
    if (slog.gte(SLOG_BREAKPOINT)) return 'F' + format(slog.floor())
    return (
      Decimal.pow(LOG_BASE, slog.sub(slog.floor())).toStringWithDecimalPlaces(SLOG_FRACTION_PRECISION) +
      'F' +
      commaFormat(slog.floor(), 0)
    )
  } else if (d.gte(HUGE_EXP_BREAKPOINT)) return exponentialFormat(d, 0, false)
  else if (d.gte(LARGE_EXP_BREAKPOINT)) return exponentialFormat(d, 0)
  else if (d.gte(BILLION)) return exponentialFormat(d, precision)
  else if (d.gte(THOUSAND)) return commaFormat(d, 0)
  else if (d.gte(TINY_MAGNITUDE_LIMIT) || !allowSmall) return regularFormat(d, precision)
  else if (d.eq(0)) return (0).toFixed(precision)

  d = invertOOM(d)
  if (d.lt(HUGE_SLOG_BREAKPOINT)) {
    const val = exponentialFormat(d, precision)
    return val.replace(/([^(?:e|F)]*)$/, '-$1')
  }
  return format(d, precision) + '⁻¹'
}

export function formatWhole(decimal: Decimal | number | string): string {
  const d = new Decimal(decimal)
  if (d.gte(BILLION)) return format(d, 2)
  if (d.lte(WHOLE_SMALL_LIMIT) && !d.eq(0)) return format(d, 2)
  return format(d, 0)
}

export function formatTime(s: number): string {
  if (s < SECONDS_PER_MINUTE) return format(s) + 's'
  if (s < SECONDS_PER_HOUR) return formatWhole(Math.floor(s / SECONDS_PER_MINUTE)) + 'm ' + format(s % SECONDS_PER_MINUTE) + 's'
  if (s < SECONDS_PER_DAY)
    return (
      formatWhole(Math.floor(s / SECONDS_PER_HOUR)) +
      'h ' +
      formatWhole(Math.floor(s / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR) +
      'm ' +
      format(s % SECONDS_PER_MINUTE) +
      's'
    )
  if (s < SECONDS_PER_YEAR)
    return (
      formatWhole(Math.floor(s / SECONDS_PER_DAY) % DAYS_PER_YEAR) +
      'd ' +
      formatWhole(Math.floor(s / SECONDS_PER_HOUR) % HOURS_PER_DAY) +
      'h ' +
      formatWhole(Math.floor(s / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR) +
      'm ' +
      format(s % SECONDS_PER_MINUTE) +
      's'
    )
  return (
    formatWhole(Math.floor(s / SECONDS_PER_YEAR)) +
    'y ' +
    formatWhole(Math.floor(s / SECONDS_PER_DAY) % DAYS_PER_YEAR) +
    'd ' +
    formatWhole(Math.floor(s / SECONDS_PER_HOUR) % HOURS_PER_DAY) +
    'h ' +
    formatWhole(Math.floor(s / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR) +
    'm ' +
    format(s % SECONDS_PER_MINUTE) +
    's'
  )
}

export function toPlaces(x: Decimal | number | string, precision: number, maxAccepted: number): string {
  const d = new Decimal(x)
  let result = d.toStringWithDecimalPlaces(precision)
  if (new Decimal(result).gte(maxAccepted)) {
    result = new Decimal(maxAccepted - Math.pow(TENTH, precision)).toStringWithDecimalPlaces(precision)
  }
  return result
}

export function formatSmall(x: Decimal | number | string, precision = 2): string {
  return format(x, precision, true)
}

export function invertOOM(x: Decimal): Decimal {
  let e = x.log10().ceil()
  const m = x.div(Decimal.pow(LOG_BASE, e))
  e = e.neg()
  return new Decimal(LOG_BASE).pow(e).times(m)
}
