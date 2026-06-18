// src/stores/forge.ts — the Core Formation forge (set-piece instance 1).
//
// M3 STUB: coreGradeMult returns identity (1) until the forge is implemented in
// M5. The store exists so state.ts and pipelines.ts compile. Full forge logic
// (performForge, refinementTick, grade storage) lands in M5.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { SETPIECE_DATA, forgeGradeByKey } from '@/data/setpieces'
import { findRealm } from '@/data/realms'
import { useBodyStore } from '@/stores/body'

export interface ForgeSlice {
  refinementProgress: string
  warming: boolean
  lastForgeCracked: boolean
}

export function freshForgeSlice(): ForgeSlice {
  return { refinementProgress: '0', warming: false, lastForgeCracked: false }
}

export const useForgeStore = defineStore('forge', () => {
  // Note: coreGrade is stored on the Body layer (life-scoped); the forge reads
  // it via the body store. This store owns only the c-layer refinement state.
  const refinementProgress = ref(decimalZero())
  const warming = ref(false)
  const lastForgeCracked = ref(false)

  /** Core grade index from the Body store (-1 = unforged). M5 wires the forge. */
  const coreGradeIndex = computed(() => useBodyStore().coreGrade)

  /** Ceiling index for the current Foundation band (from Body foundationGrade). */
  const coreCeilingGradeIndex = computed(() => {
    const body = useBodyStore()
    const fGrade = body.foundationGrade
    if (fGrade < 0) return 0
    const band = findRealm('f').grade?.bands[fGrade]
    if (!band) return 0
    return forgeGradeByKey(band.coreCeiling).ceilingIndex
  })

  /** Core grade global mult (the coreGradeMult pipeline factor). */
  const coreGradeMult = computed<Decimal>(() => {
    const idx = coreGradeIndex.value
    if (idx < 0) return decimalOne()
    const grade = SETPIECE_DATA.forge.grades.find((g) => g.ceilingIndex === idx)
    return grade ? new Decimal(grade.globalMult) : decimalOne()
  })

  function update(_diff: number): void {
    // M5: refinementTick.
  }

  function save(): Record<string, unknown> {
    return {
      refinementProgress: refinementProgress.value.toString(),
      warming: warming.value,
      lastForgeCracked: lastForgeCracked.value,
    }
  }
  function load(slice: unknown): void {
    const s = (slice ?? freshForgeSlice()) as Partial<ForgeSlice>
    refinementProgress.value = new Decimal(s.refinementProgress ?? '0')
    warming.value = s.warming ?? false
    lastForgeCracked.value = s.lastForgeCracked ?? false
  }
  function fresh(): Record<string, unknown> {
    return freshForgeSlice() as unknown as Record<string, unknown>
  }

  return {
    refinementProgress,
    warming,
    lastForgeCracked,
    coreGradeIndex,
    coreCeilingGradeIndex,
    coreGradeMult,
    update,
    save,
    load,
    fresh,
  }
})
