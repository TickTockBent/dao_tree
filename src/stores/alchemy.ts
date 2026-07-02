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
//
// Fractional-material decision (contract point 3): each material stores its
// EXACT accumulated float in `materials` (repeated fractional drops sum
// honestly), and `materialCount` exposes Math.floor for display + affordability.
// Crafting subtracts the integer cost from the raw float, so the sub-unit carry
// (e.g. 0.7 of a herb) survives to the next deposit.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { ALCHEMY_DATA, findRecipe } from '@/data/alchemy'
import { useSeveringStore } from './severing'
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

/** The only profession pickable in v1 (design §7.6: one Act I slot). */
const ALCHEMY_PROFESSION: ProfessionKey = 'alchemy'

export const useAlchemyStore = defineStore('alchemy', () => {
  const profession = ref<ProfessionKey | null>(null)
  const materials = ref<Partial<Record<MaterialKey, number>>>({})
  const pills = ref<Partial<Record<PillKey, number>>>({})
  const activePill = ref<ActivePill | null>(null)

  // Reveal is latched once the gate is met so the slot never re-seals (the
  // sect.revealed idiom). The latch is derived state, not part of the saved
  // slice — ALCHEMY_DATA.reveal ({ coreForged: true }) is monotone, so it
  // re-derives faithfully on load.
  const revealedLatch = ref(false)

  /** Profession slot revealed (ALCHEMY_DATA.reveal against live state). */
  const revealed = computed<boolean>(
    () => revealedLatch.value || meets(ALCHEMY_DATA.reveal, buildGameState()),
  )

  /** True once the profession is picked (meets() clause input). */
  const professionChosen = computed<boolean>(() => profession.value !== null)

  /** The recipe key of the currently-active timed pill (null when none active). */
  function activeTimedRecipe() {
    if (!activePill.value) return null
    if (activePill.value.remaining <= 0) return null
    const recipe = findRecipe(activePill.value.key)
    return recipe.effect.type === 'timedQiMult' ? recipe : null
  }

  /** Qi/sec factor from the active timed pill (identity when none). */
  const activePillQiMult = computed<Decimal>(() => {
    // Slice 9 nullification seam: a severed profession brews nothing — the
    // pill effect is void even if a pill was mid-burn at sever time (D25).
    // Deferred store lookup (the state.ts circular-import pattern). The
    // severing implementer extends this to the OTHER profession effects
    // (breakthrough aid, tribulation warding); this seam covers the pipeline.
    if (useSeveringStore().isSevered('profession')) return decimalOne()
    const recipe = activeTimedRecipe()
    if (!recipe || recipe.effect.type !== 'timedQiMult') return decimalOne()
    return new Decimal(recipe.effect.mult)
  })

  /** The held breakthrough-aid recipe eligible for a realm (null when none held/eligible). */
  function heldBreakthroughAidFor(realmId: RealmId) {
    for (const recipe of ALCHEMY_DATA.recipes) {
      if (recipe.effect.type !== 'breakthroughAid') continue
      if (pillCount(recipe.key) <= 0) continue
      if (recipe.effect.appliesTo.includes(realmId)) return recipe
    }
    return null
  }

  /** The held warding recipe (null when none held). */
  function heldWardingRecipe() {
    for (const recipe of ALCHEMY_DATA.recipes) {
      if (recipe.effect.type !== 'tribulationPoolBonus') continue
      if (pillCount(recipe.key) > 0) return recipe
    }
    return null
  }

  /** Flat preparedness-pool bonus from a held warding pill (zero when none). */
  const tribulationPoolBonus = computed<Decimal>(() => {
    const recipe = heldWardingRecipe()
    if (!recipe || recipe.effect.type !== 'tribulationPoolBonus') return decimalZero()
    return new Decimal(recipe.effect.poolBonus)
  })

  function isRevealed(): boolean {
    return revealed.value
  }

  function materialCount(key: MaterialKey): number {
    return Math.floor(materials.value[key] ?? 0)
  }

  function pillCount(key: PillKey): number {
    return pills.value[key] ?? 0
  }

  /** True once profession chosen AND the recipe's meets() gate is satisfied. */
  function recipeUnlocked(key: PillKey): boolean {
    if (!professionChosen.value) return false
    return meets(findRecipe(key).unlock, buildGameState())
  }

  /** The secret-realm economy's deposit API (fractional amounts floor-accumulate). */
  function addMaterial(key: MaterialKey, amount: number): void {
    if (amount <= 0) return
    materials.value[key] = (materials.value[key] ?? 0) + amount
  }

  function chooseProfession(key: ProfessionKey): boolean {
    if (profession.value !== null) return false // one-time life pick
    if (key !== ALCHEMY_PROFESSION) return false // v1: only Alchemy
    profession.value = key
    return true
  }

  function canCraft(key: PillKey): boolean {
    if (!recipeUnlocked(key)) return false
    const recipe = findRecipe(key)
    for (const [matKey, cost] of Object.entries(recipe.cost) as [MaterialKey, number][]) {
      if (materialCount(matKey) < cost) return false
    }
    return true
  }

  function craft(key: PillKey): boolean {
    if (!canCraft(key)) return false
    const recipe = findRecipe(key)
    for (const [matKey, cost] of Object.entries(recipe.cost) as [MaterialKey, number][]) {
      materials.value[matKey] = (materials.value[matKey] ?? 0) - cost
    }
    pills.value[key] = pillCount(key) + 1
    return true
  }

  /** Activate a timed pill (replaces any active one). Non-timed pills are held, not activated. */
  function activatePill(key: PillKey): boolean {
    const recipe = findRecipe(key)
    if (recipe.effect.type !== 'timedQiMult') return false
    if (pillCount(key) <= 0) return false
    pills.value[key] = pillCount(key) - 1
    activePill.value = { key, remaining: recipe.effect.durationSeconds }
    return true
  }

  /**
   * The breakthrough-aid factor for a realm's prestige gain: >1 only while a
   * clarity charge is held AND the realm is in the recipe's appliesTo list.
   * realm.resetGain folds this in so the SHOWN gain matches the landed gain.
   */
  function breakthroughGainMult(realmId: RealmId): Decimal {
    const recipe = heldBreakthroughAidFor(realmId)
    if (!recipe || recipe.effect.type !== 'breakthroughAid') return decimalOne()
    return new Decimal(recipe.effect.gainMult)
  }

  /** Consume one held clarity charge (called by realm.prestige when the mult applied). */
  function consumeBreakthroughAid(realmId: RealmId): void {
    const recipe = heldBreakthroughAidFor(realmId)
    if (!recipe) return // guard: only decrement when a charge would apply
    pills.value[recipe.key] = pillCount(recipe.key) - 1
  }

  /** Consume one held warding pill (called by tribulation.beginTribulation when bonus applied). */
  function consumeWardingPill(): void {
    const recipe = heldWardingRecipe()
    if (!recipe) return
    pills.value[recipe.key] = pillCount(recipe.key) - 1
  }

  function update(diff: number): void {
    if (!revealedLatch.value && meets(ALCHEMY_DATA.reveal, buildGameState())) {
      revealedLatch.value = true
    }
    if (activePill.value) {
      const remaining = activePill.value.remaining - diff
      if (remaining <= 0) activePill.value = null
      else activePill.value = { ...activePill.value, remaining }
    }
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
    revealedLatch.value = false
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
    recipeUnlocked,
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
