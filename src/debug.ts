// src/debug.ts — DEBUG-ONLY production accelerator (GitHub Pages build only).
//
// This module exists to power the Pages-only debug keys (see
// .github/pages-debug.html, injected by the "Inject debug keys (Pages only)"
// step in .github/workflows/deploy-pages.yml). It multiplies the three
// per-second production paths (Qi, sect Contribution, Dao Insight) by
// 10^exponent, driven by a module-level ref.
//
// EVERYTHING that reaches a shipped runtime is gated behind the STATIC pattern
//   `typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DAO_DEBUG`
// so Vite dead-code-eliminates the `window.__daoDebug` install (and every
// callsite that applies the multiplier) from any build WITHOUT the flag set —
// zero footprint in the itch.io / CI bundles, not merely inert. Only the Pages
// build sets VITE_DAO_DEBUG=1 (in that workflow's build step env, nowhere else).
//
// Guard shape rationale (verified empirically):
//   * The bare `import.meta.env.VITE_DAO_DEBUG` MUST be referenced directly for
//     Vite's static replacement + DCE to fire — an optional-chained or aliased
//     read is NOT eliminated.
//   * The `typeof import.meta.env !== 'undefined'` prefix keeps the same line
//     from throwing under tsx / plain Node (the pacing sim), where
//     `import.meta.env` is genuinely `undefined`. Under Vite the whole prefix
//     folds to a constant, so DCE is unaffected.
//
// The ref-driven math below (setDebugProductionExponent / debugProductionMultiplier)
// is intentionally NOT gated so it stays directly unit-testable; it is only ever
// reachable at runtime through the gated install + gated callsites, so it too
// tree-shakes out of unflagged builds once those callers are eliminated.

import { ref } from 'vue'
import Decimal from 'break_eternity.js'

/** 10^debugProductionExponent is the production multiplier. Range 0..4 (×1..×10000). */
const debugProductionExponent = ref(0)

const DEBUG_EXPONENT_MIN = 0
const DEBUG_EXPONENT_MAX = 4
const DEBUG_MULTIPLIER_BASE = 10

/** Clamp to 0..4 and set the debug production exponent. */
export function setDebugProductionExponent(requestedExponent: number): void {
  const flooredExponent = Math.floor(requestedExponent)
  const clampedExponent = Math.max(
    DEBUG_EXPONENT_MIN,
    Math.min(DEBUG_EXPONENT_MAX, Number.isFinite(flooredExponent) ? flooredExponent : DEBUG_EXPONENT_MIN),
  )
  debugProductionExponent.value = clampedExponent
}

/** The live production multiplier, 10^exponent (×1 at exponent 0). */
export function debugProductionMultiplier(): Decimal {
  return Decimal.pow(DEBUG_MULTIPLIER_BASE, debugProductionExponent.value)
}

interface DaoDebugApi {
  /** Set the production exponent (clamped 0..4); 10^n multiplies Qi / Contribution / Insight. */
  setProductionExponent(exponent: number): void
}

/**
 * Install `window.__daoDebug` — ONLY when the Pages debug flag is set. In any
 * build without VITE_DAO_DEBUG this whole body is dead-code-eliminated, so the
 * `__daoDebug` symbol never appears in the shipped bundle. Called once from main.ts.
 */
export function installDaoDebug(): void {
  if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DAO_DEBUG) {
    const daoDebugApi: DaoDebugApi = { setProductionExponent: setDebugProductionExponent }
    ;(window as unknown as { __daoDebug: DaoDebugApi }).__daoDebug = daoDebugApi
  }
}
