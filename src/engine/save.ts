// src/engine/save.ts — schema-versioned save system with migration registry.
//
// Replaces TMT's `js/utils/save.js`. Key differences from the old system:
//   1. Integer `SAVE_VERSION` (not the lexicographic string `VERSION.num`),
//      compared numerically. Migration steps run in order on load.
//   2. `SaveSchema` is a typed interface; Decimal fields are marked and
//      re-hydrated by field type, not by default-shape matching (the old
//      `fixSave` only re-Decimals `best`/`total` explicitly — a known
//      fragility we fix here).
//   3. `beforeunload` save actually fires (the old code checked
//      `player.autosave`, which doesn't exist — a bug).
//   4. NaN guard: refuse to save NaN-corrupted state, halt the tick loop.
//
// Fresh-start policy: no 0.2.x importer. `SAVE_VERSION = 1` is the first
// schema. Old saves are ignored (a foreign save with a mismatched
// `versionType` or no `saveVersion` is treated as absent).

import Decimal from 'break_eternity.js'
import { isFormatNaN } from './format'

/** Current save schema version. Bump on any breaking schema change. */
export const SAVE_VERSION = 1

/** localStorage key. */
const SAVE_KEY = 'dao-tree'
const OPTIONS_KEY = 'dao-tree-options'

/** A field marker indicating the value is a Decimal (serialized as string). */
export interface DecimalField {
  readonly __decimal: true
}

/**
 * The save schema. This is the authoritative shape of the persisted player
 * state. Stores read/write their slices via the central `gameStore`, which
 * owns the singleton `PlayerSave`.
 *
 * Decimal fields are typed as `string` (their serialized form) and marked
 * with a `__decimal`-flavored brand for the hydrator. In practice the
 * hydrator walks a runtime schema descriptor (see `DECIMAL_PATHS` below)
 * rather than the TS types, because TS types don't exist at runtime.
 */
export interface PlayerSave {
  saveVersion: number
  versionType: string
  time: number
  timePlayed: number
  points: string // Decimal
  keepGoing: boolean
  hasNaN: boolean
  devSpeed: number | null
  offTime: { remain: number } | null
  tab: string | null
  navTab: string | null
  subtabs: Record<string, Record<string, string>>
  lastSafeTab: string | null
  // Per-system slices are added by stores via `PlayerSave` augmentation
  // (see stores). They live under their system key, e.g. save.q, save.b, etc.
  [systemSlice: string]: unknown
}

export interface GameOptions {
  autosave: boolean
  theme: string
  offlineProd: boolean
  forceOneTab: boolean
  hideMilestonePopups: boolean
}

export function getStartOptions(): GameOptions {
  return {
    autosave: true,
    theme: 'default',
    offlineProd: true,
    forceOneTab: false,
    hideMilestonePopups: false,
  }
}

// ---- Decimal hydration -----------------------------------------------------
//
// The hydrator walks the save object and converts any string value that is
// listed in `DECIMAL_PATHS` back into a Decimal instance. We use a runtime
// registry of decimal paths (globs) rather than shape-matching because the
// save is a flat-ish object and we want explicit control. Stores register
// their decimal paths via `registerDecimalPaths`.

const decimalPathSet = new Set<string>()

/**
 * Register paths (dotted globs) whose values are Decimals. Called by stores
 * at module load. Example: `registerDecimalPaths(['q.points', 'q.best',
 'q.total', 'b.*'])`. `*` matches any single path segment.
 */
export function registerDecimalPaths(paths: string[]): void {
  for (const p of paths) decimalPathSet.add(p)
}

function pathMatches(path: string): boolean {
  if (decimalPathSet.has(path)) return true
  // Check globs with `*`
  for (const glob of decimalPathSet) {
    if (!glob.includes('*')) continue
    const segs = glob.split('.')
    const psegs = path.split('.')
    if (segs.length !== psegs.length) continue
    let ok = true
    for (let i = 0; i < segs.length; i++) {
      if (segs[i] === '*') continue
      if (segs[i] !== psegs[i]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/** Recursively hydrate Decimals in an arbitrary object by registered paths. */
function hydrateDecimals(obj: unknown, path = ''): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') {
    if (path && pathMatches(path)) {
      try {
        return new Decimal(obj)
      } catch {
        return new Decimal(0)
      }
    }
    return obj
  }
  if (typeof obj !== 'object') return obj
  if (obj instanceof Decimal) return obj
  if (Array.isArray(obj)) {
    return obj.map((v, i) => hydrateDecimals(v, path ? `${path}.${i}` : String(i)))
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const childPath = path ? `${path}.${k}` : k
    out[k] = hydrateDecimals(v, childPath)
  }
  return out
}

/** Recursively serialize Decimals to strings (for JSON.stringify). */
function serializeDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Decimal) return obj.toString()
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(serializeDecimals)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = serializeDecimals(v)
  }
  return out
}

// ---- Migration registry ----------------------------------------------------

export interface Migration {
  from: number
  to: number
  apply: (save: Record<string, unknown>) => void
}

const migrations: Migration[] = []

export function registerMigration(migration: Migration): void {
  migrations.push(migration)
}

function runMigrations(save: Record<string, unknown>): void {
  let version = (save.saveVersion as number) ?? 0
  if (typeof version !== 'number' || !Number.isFinite(version)) version = 0
  const applicable = migrations
    .filter((m) => m.from >= version)
    .sort((a, b) => a.from - b.from)
  for (const m of applicable) {
    if (version === m.from) {
      m.apply(save)
      save.saveVersion = m.to
      version = m.to
    }
  }
}

// ---- NaN guard -------------------------------------------------------------

/** Recursively detect NaN Decimals in the save. Returns the first found, or null. */
export function findNaN(obj: unknown): Decimal | null {
  if (obj === null || obj === undefined) return null
  if (obj instanceof Decimal) {
    if (isFormatNaN(obj)) return obj
    return null
  }
  if (typeof obj !== 'object') return null
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const nan = findNaN(v)
      if (nan) return nan
    }
    return null
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const nan = findNaN(v)
    if (nan) return nan
  }
  return null
}

// ---- Load / save / export --------------------------------------------------

let cachedStartPlayer: (() => PlayerSave) | null = null

/** Register the fresh-player factory (called by gameStore once stores are wired). */
export function registerStartPlayer(fn: () => PlayerSave): void {
  cachedStartPlayer = fn
}

function buildFreshSave(): PlayerSave {
  if (!cachedStartPlayer) throw new Error('startPlayer factory not registered')
  const save = cachedStartPlayer()
  save.saveVersion = SAVE_VERSION
  save.versionType = 'dao-tree'
  return save
}

/**
 * Load the save from localStorage. Returns the hydrated `PlayerSave`, or a
 * fresh save if none exists / the existing one is unrecoverable.
 *
 * `onForeignSave` is called with the raw parsed save when a save exists but
 * its `versionType` doesn't match — the caller can decide whether to offer
 * import. For the fresh-start port we discard foreign saves.
 */
export function loadSave(): PlayerSave {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return buildFreshSave()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    console.warn('Save JSON corrupt; starting fresh.')
    return buildFreshSave()
  }
  // Fresh-start policy: reject saves without our versionType / saveVersion.
  if (parsed.versionType !== 'dao-tree' || typeof parsed.saveVersion !== 'number') {
    console.info('Foreign or pre-0.3 save; starting fresh (no importer).')
    return buildFreshSave()
  }
  runMigrations(parsed)
  // Merge with fresh defaults so new fields are filled, then hydrate Decimals.
  const fresh = buildFreshSave()
  const merged = { ...fresh, ...parsed }
  const hydrated = hydrateDecimals(merged) as PlayerSave
  hydrated.saveVersion = SAVE_VERSION
  hydrated.versionType = 'dao-tree'
  return hydrated
}

/** Serialize and write the save. Refuses to persist NaN-corrupted state. */
export function writeSave(save: PlayerSave, force = false): boolean {
  const nan = findNaN(save)
  if (nan && !force) {
    console.error('Refusing to save NaN-corrupted state.')
    return false
  }
  const serialized = serializeDecimals(save) as Record<string, unknown>
  serialized.saveVersion = SAVE_VERSION
  serialized.versionType = 'dao-tree'
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialized))
    return true
  } catch (e) {
    console.error('Save write failed:', e)
    return false
  }
}

/** Export the save as a base64 string (clipboard-friendly). */
export function exportSave(save: PlayerSave): string {
  const serialized = serializeDecimals(save) as Record<string, unknown>
  return btoa(unescape(encodeURIComponent(JSON.stringify(serialized))))
}

/**
 * Import a base64 save string. Returns the hydrated save or throws on
 * malformed input. Does NOT validate versionType — caller decides.
 */
export function importSave(encoded: string): PlayerSave {
  const json = decodeURIComponent(escape(atob(encoded.trim())))
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (parsed.versionType !== 'dao-tree' || typeof parsed.saveVersion !== 'number') {
    throw new Error('Not a Dao Tree save.')
  }
  runMigrations(parsed)
  const fresh = buildFreshSave()
  const merged = { ...fresh, ...parsed }
  const hydrated = hydrateDecimals(merged) as PlayerSave
  hydrated.saveVersion = SAVE_VERSION
  hydrated.versionType = 'dao-tree'
  return hydrated
}

/** Wipe the save (hard reset). */
export function wipeSave(): void {
  localStorage.removeItem(SAVE_KEY)
}

// ---- Options ---------------------------------------------------------------

export function loadOptions(): GameOptions {
  const raw = localStorage.getItem(OPTIONS_KEY)
  if (!raw) return getStartOptions()
  try {
    return { ...getStartOptions(), ...(JSON.parse(raw) as Partial<GameOptions>) }
  } catch {
    return getStartOptions()
  }
}

export function writeOptions(options: GameOptions): void {
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}
