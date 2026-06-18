// src/engine/doReset.ts — the prestige reset cascade (design §8.1/§8.2).
//
// Port of the factory's `makeTreeDoReset` + `treeResetKeepKeys` + `layerRow` +
// `treeLayerEntry`. Compiled from TREE_DATA + KEEP_RULES: tree-scoped realms
// reset lower rows in their tree; life/eternal layers are topologically immune
// (scope check, not the old isNaN(row) hack). Keep-rule acquisition checked via
// `hasMilestone(grant.layer, grant.milestone)`.
//
// Returns `null` = do NOT reset; `[]` = reset, keep nothing; `["best", ...]` =
// reset, preserving those state keys.

import { TREE_DATA } from '@/data/trees'
import { KEEP_RULES } from '@/data/keep-rules'
import { REALM_DATA } from '@/data/realms'
import type { LayerId, RealmId } from './types'
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

  // Scope check: both must be tree-scoped. Life/eternal never reset via cascade.
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
