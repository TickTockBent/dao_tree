// src/stores/alchemy.ts — the Alchemy profession (slice 7, design §7.6).
//
// SKELETON: the public API below is the pinned contract — it is wired into
// main.ts, test-setup.ts, pipelines.ts (activePillQiMult), realm.ts
// (breakthroughGainMult + consumeBreakthroughAid), tribulation.ts
// (tribulationPoolBonus + consumeWardingPill), and consumed by the secret
// realm economy (addMaterial). The crafting logic is implemented by the
// slice-7 alchemy agent; every getter currently returns identity/zero so the
// game plays unchanged until then.
//
// Contract notes for the implementer:
//   - LIFE-scoped: materials, pills, and the profession pick survive every
//     realm breakthrough (TREE_DATA 'alchemy' entry); nothing here is touched
//     by doReset.ts.
//   - ONE timed pill active at a time (activating a second replaces the
//     first — no stacking, keeps the pipeline factor a single lookup).
//   - Numbers only from ALCHEMY_DATA. Material/pill counts are plain numbers
//     (small integers), not Decimals — no registerDecimalPaths needed.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import type { MaterialKey, PillKey, ProfessionKey, RealmId } from '@/engine/types'

export interface ActivePill {
  key: PillKey
  /** Seconds left on the timed effect. */
  remaining: number
}

export interface AlchemySlice {
  /** The Act I profession slot: null until picked; only 'alchemy' pickable in v1. */
  profession: ProfessionKey | null
  materials: Partial<Record<MaterialKey, number>>
  /** Crafted, unconsumed pills by key. */
  pills: Partial<Record<PillKey, number>>
  activePill: ActivePill | null
}

export function freshAlchemySlice(): AlchemySlice {
  return { profession: null, materials: {}, pills: {}, activePill: null }
}

export const useAlchemyStore = defineStore('alchemy', () => {
  const profession = ref<ProfessionKey | null>(null)
  const materials = ref<Partial<Record<MaterialKey, number>>>({})
  const pills = ref<Partial<Record<PillKey, number>>>({})
  const activePill = ref<ActivePill | null>(null)

  /** Profession slot revealed (ALCHEMY_DATA.reveal against live state). */
  const revealed = computed<boolean>(() => false) // TODO(slice-7 alchemy agent)

  /** True once the profession is picked (meets() clause input). */
  const professionChosen = computed<boolean>(() => profession.value !== null)

  /** Qi/sec factor from the active timed pill (identity when none). */
  const activePillQiMult = computed<Decimal>(() => decimalOne()) // TODO(slice-7 alchemy agent)

  /** Flat preparedness-pool bonus from a held warding pill (zero when none). */
  const tribulationPoolBonus = computed<Decimal>(() => decimalZero()) // TODO(slice-7 alchemy agent)

  function isRevealed(): boolean {
    return revealed.value
  }

  function materialCount(key: MaterialKey): number {
    return materials.value[key] ?? 0
  }

  function pillCount(key: PillKey): number {
    return pills.value[key] ?? 0
  }

  /** The secret-realm economy's deposit API (fractional amounts floor-accumulate). */
  function addMaterial(_key: MaterialKey, _amount: number): void {
    // TODO(slice-7 alchemy agent)
  }

  function chooseProfession(_key: ProfessionKey): boolean {
    return false // TODO(slice-7 alchemy agent): v1 accepts only 'alchemy'
  }

  function canCraft(_key: PillKey): boolean {
    return false // TODO(slice-7 alchemy agent)
  }

  function craft(_key: PillKey): boolean {
    return false // TODO(slice-7 alchemy agent)
  }

  /** Activate a timed pill (replaces any active one). Non-timed pills are held, not activated. */
  function activatePill(_key: PillKey): boolean {
    return false // TODO(slice-7 alchemy agent)
  }

  /**
   * The breakthrough-aid factor for a realm's prestige gain: >1 only while a
   * clarity charge is held AND the realm is in the recipe's appliesTo list.
   * realm.resetGain folds this in so the SHOWN gain matches the landed gain.
   */
  function breakthroughGainMult(_realmId: RealmId): Decimal {
    return decimalOne() // TODO(slice-7 alchemy agent)
  }

  /** Consume one held clarity charge (called by realm.prestige when the mult applied). */
  function consumeBreakthroughAid(_realmId: RealmId): void {
    // TODO(slice-7 alchemy agent)
  }

  /** Consume one held warding pill (called by tribulation.beginTribulation when bonus applied). */
  function consumeWardingPill(): void {
    // TODO(slice-7 alchemy agent)
  }

  function update(_diff: number): void {
    // TODO(slice-7 alchemy agent): tick activePill.remaining; clear at zero.
  }

  function save(): Record<string, unknown> {
    return {
      profession: profession.value,
      materials: { ...materials.value },
      pills: { ...pills.value },
      activePill: activePill.value ? { ...activePill.value } : null,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshAlchemySlice()) as Partial<AlchemySlice>
    profession.value = s.profession ?? null
    materials.value = { ...(s.materials ?? {}) }
    pills.value = { ...(s.pills ?? {}) }
    activePill.value = s.activePill ? { ...s.activePill } : null
  }
  function fresh(): Record<string, unknown> {
    return freshAlchemySlice() as unknown as Record<string, unknown>
  }

  return {
    profession,
    materials,
    pills,
    activePill,
    revealed,
    professionChosen,
    activePillQiMult,
    tribulationPoolBonus,
    isRevealed,
    materialCount,
    pillCount,
    addMaterial,
    chooseProfession,
    canCraft,
    craft,
    activatePill,
    breakthroughGainMult,
    consumeBreakthroughAid,
    consumeWardingPill,
    update,
    save,
    load,
    fresh,
  }
})
