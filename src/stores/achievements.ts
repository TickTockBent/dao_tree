// src/stores/achievements.ts — FILE-scoped achievement record (slice: 'ach').
//
// Scope: file (D37 — the Steam-account analog, D9b). Never reset — not by realm
// cascade (achievements is not a TREE_DATA layer, so doReset never visits it),
// not by tribulation, not by the reincarnation cascade, not by anything short
// of a hard save wipe. Slice 10 / D37's scope audit resolved the old
// "effectively file-scoped" note: achievements sit ABOVE the soul (they persist
// across reincarnations by construction — the reincarnation-closure lint proves
// no file/soul/world layer is reachable by rebirth). The 'ach' slice lives
// outside TREE_DATA.layers on purpose: it is not a cascade participant, so it
// carries no LayerId seat and its file scope is documented here rather than in
// the layer registry.
//
// Pure record: no gameplay effects, no pipeline factors. The gate store
// ("Deeds") owns buff-carrying checkpoints; this store owns the permanent
// trophy shelf that maps 1:1 onto Steam achievements later (key = API name).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ACHIEVEMENT_DATA } from '@/data/achievements'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'

export interface AchievementsSlice {
  /** Earned stable keys, sorted. Unknown keys are PRESERVED on load (a save
   * touched by a newer build must not lose earned achievements here). */
  earned: string[]
}

export function freshAchievementsSlice(): AchievementsSlice {
  return { earned: [] }
}

export const useAchievementsStore = defineStore('achievements', () => {
  const earned = ref<string[]>([])

  const earnedSet = computed(() => new Set(earned.value))

  /** Total earned / total defined (for the panel header). */
  const progress = computed(() => ({
    earned: ACHIEVEMENT_DATA.filter((a) => earnedSet.value.has(a.key)).length,
    total: ACHIEVEMENT_DATA.length,
  }))

  function has(key: string): boolean {
    return earnedSet.value.has(key)
  }

  /**
   * Award an achievement by key (event-driven path — for outcomes meets()
   * cannot see, e.g. a specific forge-push result). Validates the key against
   * the registry; awarding an unknown key is a code bug and throws.
   * No shipped call sites yet (v1 is fully meets()-driven).
   */
  function award(key: string): void {
    if (!ACHIEVEMENT_DATA.some((a) => a.key === key)) {
      throw new Error(`award(): unknown achievement key ${key}`)
    }
    if (earnedSet.value.has(key)) return
    earned.value = [...earned.value, key].sort()
  }

  /** Latch any unearned meets()-driven achievements whose condition holds. */
  function latch(): void {
    const unearned = ACHIEVEMENT_DATA.filter((a) => a.done !== null && !earnedSet.value.has(a.key))
    if (unearned.length === 0) return
    const state = buildGameState()
    let added = false
    const next = new Set(earned.value)
    for (const def of unearned) {
      if (meets(def.done!, state)) {
        next.add(def.key)
        added = true
      }
    }
    if (added) earned.value = [...next].sort()
  }

  function update(_diff: number): void {
    latch()
  }

  // ---- Persistence (slice: 'ach') -----------------------------------------
  function save(): Record<string, unknown> {
    return { earned: [...earned.value] }
  }

  function load(slice: unknown): void {
    const s = (slice ?? freshAchievementsSlice()) as Partial<AchievementsSlice>
    // Preserve unknown keys (forward-compat); drop non-strings defensively.
    earned.value = Array.isArray(s.earned)
      ? [...new Set(s.earned.filter((k): k is string => typeof k === 'string'))].sort()
      : []
  }

  function fresh(): Record<string, unknown> {
    return { ...freshAchievementsSlice() }
  }

  return { earned, earnedSet, progress, has, award, latch, update, save, load, fresh }
})
