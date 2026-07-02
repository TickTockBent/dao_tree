// src/stores/seclusion.ts — Deep Meditation / secluded cultivation (ETERNAL).
//
// Owns the offline-progress cap as progression state (data/seclusion.ts).
// Purchased rungs NEVER reset — not by realm cascade (eternal scope,
// topologically immune) and, by design intent, not by future reincarnation
// (the journal/legacy precedent). game.ts reads the live cap through the
// registered offline-cap fn (main.ts wires it, the qiPerSecondFn pattern).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { SECLUSION_DATA, findSeclusionRung } from '@/data/seclusion'
import { useGameStore } from './game'
import type { RealmId } from '@/engine/types'

export interface SeclusionSlice {
  /** Realms whose meditation rung has been purchased (order irrelevant). */
  purchased: RealmId[]
}

export function freshSeclusionSlice(): SeclusionSlice {
  return { purchased: [] }
}

export const useSeclusionStore = defineStore('seclusion', () => {
  const game = useGameStore()

  const purchased = ref<RealmId[]>([])

  /** How many rungs are purchased (meets() clause input). */
  const rungsPurchased = computed<number>(() => purchased.value.length)

  /** The live secluded-banking cap: base + every purchased rung's bonus. */
  const offlineCapSeconds = computed<number>(() =>
    SECLUSION_DATA.rungs.reduce(
      (cap, rung) => (purchased.value.includes(rung.realm) ? cap + rung.capBonusSeconds : cap),
      SECLUSION_DATA.baseCapSeconds,
    ),
  )

  function isPurchased(realm: RealmId): boolean {
    return purchased.value.includes(realm)
  }

  /** A rung is revealed once its realm is reached (live meets() eval). */
  function isRevealed(realm: RealmId): boolean {
    return meets(findSeclusionRung(realm).unlock, buildGameState())
  }

  function canPurchase(realm: RealmId): boolean {
    if (isPurchased(realm)) return false
    if (!isRevealed(realm)) return false
    return game.points.gte(findSeclusionRung(realm).qiCost)
  }

  function purchase(realm: RealmId): boolean {
    if (!canPurchase(realm)) return false
    game.points = game.points.sub(findSeclusionRung(realm).qiCost).max(0)
    purchased.value = [...purchased.value, realm]
    return true
  }

  function update(_diff: number): void {
    // Purely reactive state — no per-tick work.
  }

  function save(): Record<string, unknown> {
    return { purchased: [...purchased.value] }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshSeclusionSlice()) as Partial<SeclusionSlice>
    // Defensive: keep only realms that still have a data rung (stale saves).
    const known = new Set(SECLUSION_DATA.rungs.map((r) => r.realm))
    purchased.value = (s.purchased ?? []).filter((r): r is RealmId => known.has(r as RealmId))
  }
  function fresh(): Record<string, unknown> {
    return freshSeclusionSlice() as unknown as Record<string, unknown>
  }

  return {
    purchased,
    rungsPurchased,
    offlineCapSeconds,
    isPurchased,
    isRevealed,
    canPurchase,
    purchase,
    update,
    save,
    load,
    fresh,
  }
})
