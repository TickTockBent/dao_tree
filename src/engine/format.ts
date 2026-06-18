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

export function exponentialFormat(num: Decimal, precision: number, mantissa = true): string {
  let e = num.log10().floor()
  let m = num.div(Decimal.pow(10, e))
  if (m.toStringWithDecimalPlaces(precision) === '10') {
    m = decimalOne()
    e = e.add(1)
  }
  const eStr = e.gte(1e9)
    ? format(e, 3)
    : e.gte(10000)
      ? commaFormat(e, 0)
      : e.toStringWithDecimalPlaces(0)
  if (mantissa) return m.toStringWithDecimalPlaces(precision) + 'e' + eStr
  return 'e' + eStr
}

export function commaFormat(num: Decimal, precision: number): string {
  if (num === null || num === undefined) return 'NaN'
  if (num.mag < 0.001) return (0).toFixed(precision)
  const init = num.toStringWithDecimalPlaces(precision)
  const portions = init.split('.')
  portions[0] = portions[0]!.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,')
  if (portions.length === 1) return portions[0]!
  return portions[0]! + '.' + portions[1]
}

export function regularFormat(num: Decimal, precision: number): string {
  if (num === null || num === undefined) return 'NaN'
  if (num.mag < 0.0001) return (0).toFixed(precision)
  let p = precision
  if (num.mag < 0.1 && precision !== 0) p = Math.max(precision, 4)
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
  if (d.gte('eeee1000')) {
    const slog = d.slog()
    if (slog.gte(1e6)) return 'F' + format(slog.floor())
    return (
      Decimal.pow(10, slog.sub(slog.floor())).toStringWithDecimalPlaces(3) +
      'F' +
      commaFormat(slog.floor(), 0)
    )
  } else if (d.gte('1e1000000')) return exponentialFormat(d, 0, false)
  else if (d.gte('1e10000')) return exponentialFormat(d, 0)
  else if (d.gte(1e9)) return exponentialFormat(d, precision)
  else if (d.gte(1e3)) return commaFormat(d, 0)
  else if (d.gte(0.0001) || !allowSmall) return regularFormat(d, precision)
  else if (d.eq(0)) return (0).toFixed(precision)

  d = invertOOM(d)
  if (d.lt('1e1000')) {
    const val = exponentialFormat(d, precision)
    return val.replace(/([^(?:e|F)]*)$/, '-$1')
  }
  return format(d, precision) + '⁻¹'
}

export function formatWhole(decimal: Decimal | number | string): string {
  const d = new Decimal(decimal)
  if (d.gte(1e9)) return format(d, 2)
  if (d.lte(0.99) && !d.eq(0)) return format(d, 2)
  return format(d, 0)
}

export function formatTime(s: number): string {
  if (s < 60) return format(s) + 's'
  if (s < 3600) return formatWhole(Math.floor(s / 60)) + 'm ' + format(s % 60) + 's'
  if (s < 86400)
    return (
      formatWhole(Math.floor(s / 3600)) +
      'h ' +
      formatWhole(Math.floor(s / 60) % 60) +
      'm ' +
      format(s % 60) +
      's'
    )
  if (s < 31536000)
    return (
      formatWhole(Math.floor(s / 86400) % 365) +
      'd ' +
      formatWhole(Math.floor(s / 3600) % 24) +
      'h ' +
      formatWhole(Math.floor(s / 60) % 60) +
      'm ' +
      format(s % 60) +
      's'
    )
  return (
    formatWhole(Math.floor(s / 31536000)) +
    'y ' +
    formatWhole(Math.floor(s / 86400) % 365) +
    'd ' +
    formatWhole(Math.floor(s / 3600) % 24) +
    'h ' +
    formatWhole(Math.floor(s / 60) % 60) +
    'm ' +
    format(s % 60) +
    's'
  )
}

export function toPlaces(x: Decimal | number | string, precision: number, maxAccepted: number): string {
  const d = new Decimal(x)
  let result = d.toStringWithDecimalPlaces(precision)
  if (new Decimal(result).gte(maxAccepted)) {
    result = new Decimal(maxAccepted - Math.pow(0.1, precision)).toStringWithDecimalPlaces(precision)
  }
  return result
}

export function formatSmall(x: Decimal | number | string, precision = 2): string {
  return format(x, precision, true)
}

export function invertOOM(x: Decimal): Decimal {
  let e = x.log10().ceil()
  const m = x.div(Decimal.pow(10, e))
  e = e.neg()
  return new Decimal(10).pow(e).times(m)
}
