// src/engine/doReset.ts — the prestige reset cascade (design §8.1/§8.2).
//
// Port of the factory's `makeTreeDoReset` + `treeResetKeepKeys` + `layerRow` +
// `treeLayerEntry`. Compiled from TREE_DATA + KEEP_RULES: tree-scoped realms
// reset lower rows in their tree; non-tree layers are topologically immune to
// the tree cascade (scope check, not the old isNaN(row) hack). Keep-rule
// acquisition checked via `hasMilestone(grant.layer, grant.milestone)`.
//
// Slice 10 / D37 adds the REINCARNATION cascade tier (rebirth): a second
// compiled tier over the same differentiated scope enum — see
// reincarnationResetLayers() at the bottom.
//
// Returns `null` = do NOT reset; `[]` = reset, keep nothing; `["best", ...]` =
// reset, preserving those state keys.

import { TREE_DATA } from '@/data/trees'
import { KEEP_RULES } from '@/data/keep-rules'
import { REALM_DATA } from '@/data/realms'
import type { LayerId, RealmId, Scope } from './types'
import type { RealmRow } from '@/data/realms'

/** The TREE_DATA.layers entry for a layer id. */
export function treeLayerEntry(layerId: LayerId) {
  return TREE_DATA.layers[layerId]
}

/** The realm's tree row, or undefined for non-realm/side layers. */
export function layerRow(layerId: LayerId): number | undefined {
  const realmData = REALMS_BY_ID[layerId as RealmId]
  return realmData ? realmData.row : undefined
}

const REALMS_BY_ID: Partial<Record<RealmId, RealmRow>> = Object.fromEntries(
  REALM_DATA.map((r) => [r.id, r]),
) as Partial<Record<RealmId, RealmRow>>

/**
 * Decide whether `thisLayerId` resets when `resettingLayerId` prestiges, and if
 * so which state keys to preserve. Returns:
 *   - `null`  → do NOT reset (different scope, different tree, or not strictly lower row)
 *   - `[]`    → reset, preserve nothing (the default cascade)
 *   - `[...keys]` → reset, preserving these keys (earned keep rules)
 */
export function treeResetKeepKeys(
  thisLayerId: LayerId,
  resettingLayerId: LayerId,
  hasMilestone: (layer: LayerId, milestone: number) => boolean,
): readonly string[] | null {
  const thisEntry = treeLayerEntry(thisLayerId)
  const resetterEntry = treeLayerEntry(resettingLayerId)
  if (!thisEntry || !resetterEntry) return null

  // Scope check: both must be tree-scoped. Non-tree layers never reset via the
  // tree cascade (life resets only via the reincarnation tier; soul/world/file
  // never).
  if (thisEntry.scope !== 'tree' || resetterEntry.scope !== 'tree') return null
  // Same-tree check.
  if (thisEntry.tree !== resetterEntry.tree) return null

  const resetterRow = layerRow(resettingLayerId)
  const thisRow = layerRow(thisLayerId)
  if (resetterRow === undefined || thisRow === undefined) return null
  // STRICTLY greater row resets lower rows. Equal-row siblings and self are no-ops.
  if (!(resetterRow > thisRow)) return null

  // Collect keep keys from every earned rule targeting this layer on this reset.
  const keepKeys: string[] = []
  for (const rule of KEEP_RULES) {
    if (rule.onResetOf !== resettingLayerId || rule.target !== thisLayerId) continue
    if (!hasMilestone(rule.grantedBy.layer, rule.grantedBy.milestone)) continue
    for (const keyName of rule.keep) keepKeys.push(keyName)
  }
  return keepKeys
}

// ---- The reincarnation cascade tier (slice 10 / D37 §1) --------------------
//
// Rebirth (Samsara) is the OUTER reset: what the body built dies, what the soul
// knows carries, what belongs to neither is the world's. Like the tree cascade,
// this is a COMPILED tier over TREE_DATA's differentiated scope enum — never a
// hand-written reset list (#32). A rebirth resets every tree-scoped and every
// life-scoped layer; soul/world/file layers are excluded BY CONSTRUCTION (they
// are simply never emitted by this function). The reincarnation-closure lint
// (rules.test.ts) proves from the data that no soul/world/file layer can ever
// appear here, exactly as the tree-leak lint proves the tree cascade.
//
// STATUS: exported and pure; NOTHING calls it yet. The step-4 rebirth-mechanics
// agent wires it into the crossing. Adding it moves not a single live byte.

/** The scopes a rebirth resets. Soul/world/file are excluded by construction. */
const REINCARNATION_RESET_SCOPES: ReadonlySet<Scope> = new Set<Scope>(['tree', 'life'])

/**
 * The set of layer ids a rebirth resets: every tree-scoped + every life-scoped
 * layer, compiled from TREE_DATA. Soul/world/file layers are never included —
 * that exclusion is the reincarnation closure (proven by lint, not asserted).
 */
export function reincarnationResetLayers(): readonly LayerId[] {
  const layers: LayerId[] = []
  for (const [layerId, entry] of Object.entries(TREE_DATA.layers) as [LayerId, { scope: Scope }][]) {
    if (REINCARNATION_RESET_SCOPES.has(entry.scope)) layers.push(layerId)
  }
  return layers
}
