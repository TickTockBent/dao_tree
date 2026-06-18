// src/stores/pipelines.ts — the Qi/sec and Insight/sec composition getters.
//
// Replaces `cultivationQiPerSecond()` / `insightPerSecond()` from the factory.
// Each multiplier is read from its owning store; the pipeline composes them.
// For M1 only the base rate is wired; M3+ adds the rest.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import Decimal from 'break_eternity.js'
import { useBodyStore } from './body'
import { useRealmStore } from './realm'

export const usePipelinesStore = defineStore('pipelines', () => {
  const body = useBodyStore()
  const realm = useRealmStore()

  // The full Qi/sec pipeline (populated progressively as stores come online):
  //   qiBaseRate × meridianMult × temperMult × realmMult × gateMult ×
  //   coreGradeMult × daoNodeQiMult × stanceQiMult × soulAspectQiMult ×
  //   sectStipendQiMult × techniqueQiMult × scarQiMult × temperedQiMult ×
  //   legacyQiMult
  const qiPerSecond = computed<Decimal>(() => {
    let q = body.qiBaseRate
    q = q.times(body.meridianMult)
    q = q.times(body.temperMult)
    q = q.times(realm.realmMult)
    // Future multipliers default to 1 until their stores land.
    return q
  })

  // Insight/sec (Dao lattice) — wired in M4.
  const insightPerSecond = computed<Decimal>(() => new Decimal(0))

  return { qiPerSecond, insightPerSecond }
})
