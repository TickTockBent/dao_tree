// src/stores/scar.ts — the failure-scar slot (cross-cutting; reads/writes Body).
//
// M3 STUB: scarQiMult/temperedQiMult return identity until M5 implements the
// heal arc. The scar slot itself lives on the Body store (life-scoped); this
// store owns the scar/heal logic.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { SETPIECE_DATA } from '@/data/setpieces'
import { useBodyStore } from '@/stores/body'

export const useScarStore = defineStore('scar', () => {
  const body = useBodyStore()

  /** Active (unhealed) depth: max(scarDepth - scarHealedDepth, 0). */
  const activeDepth = computed(() => Math.max(body.scarDepth - body.scarHealedDepth, 0))

  const scarIsActive = computed(() => activeDepth.value > 0)

  /** Active debuff: debuffQiMultPerDepth ^ activeDepth (the scarQiMult factor). */
  const scarQiMult = computed<Decimal>(() => {
    const cfg = SETPIECE_DATA.scar
    if (activeDepth.value <= 0) return decimalOne()
    return Decimal.pow(cfg.debuffQiMultPerDepth, activeDepth.value)
  })

  /** Permanent buff: temperedQiMultPerDepth ^ healedDepth (the temperedQiMult factor). */
  const temperedQiMult = computed<Decimal>(() => {
    const cfg = SETPIECE_DATA.scar
    if (body.scarHealedDepth <= 0) return decimalOne()
    return Decimal.pow(cfg.temperedQiMultPerDepth, body.scarHealedDepth)
  })

  function update(_diff: number): void {
    // M5: scarHealTick(diff) — passive accrual, full bar converts one depth.
  }

  return { activeDepth, scarIsActive, scarQiMult, temperedQiMult, update }
})
