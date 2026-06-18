// src/stores/realm.ts — the realm spine (q/f/c/n/s).
//
// M1 skeleton: only the simplest prestige (Qi Condensation `q`) is wired so
// the proof-of-concept loop works. Full realm data + sub-stages + graded
// Foundation + doReset cascade + keep rules land in M3 once the data tables
// are ported (M2).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Decimal from 'break_eternity.js'
import { useGameStore } from './game'
import { decimalOne, decimalZero } from '@/engine/decimal'

export interface RealmSlice {
  q: RealmState
  f: RealmState
  c: RealmState
  n: RealmState
  s: RealmState
}

export interface RealmState {
  points: string
  best: string
  total: string
  unlocked: boolean
  resetTime: number
}

function freshRealmState(unlocked: boolean): RealmState {
  return {
    points: '0',
    best: '0',
    total: '0',
    unlocked,
    resetTime: 0,
  }
}

function freshRealmSlice(): RealmSlice {
  return {
    q: freshRealmState(true), // q starts unlocked
    f: freshRealmState(false),
    c: freshRealmState(false),
    n: freshRealmState(false),
    s: freshRealmState(false),
  }
}

export const useRealmStore = defineStore('realm', () => {
  const game = useGameStore()
  const slice = ref<RealmSlice>(freshRealmSlice())

  // M1 placeholder config — replaced by REALM_DATA in M2/M3.
  const REQ_BASE = 20
  const GAIN_EXP = 0.6

  const q = computed(() => slice.value.q)
  const f = computed(() => slice.value.f)

  const realmMult = computed<Decimal>(() => {
    // M1: identity. M3 multiplies reached sub-stage qiMults.
    return decimalOne()
  })

  function canResetQ(): boolean {
    return game.points.gte(REQ_BASE)
  }

  function resetGainQ(): Decimal {
    if (!canResetQ()) return decimalZero()
    return Decimal.pow(game.points.div(REQ_BASE), GAIN_EXP).floor()
  }

  /** Prestige Qi Condensation: bank q.points, reset Qi to 0. */
  function prestigeQ(): void {
    if (!canResetQ()) return
    const gain = resetGainQ()
    const s = slice.value.q
    const newPoints = new Decimal(s.points).add(gain)
    const newBest = Decimal.max(new Decimal(s.best), newPoints)
    slice.value.q = {
      ...s,
      points: newPoints.toString(),
      best: newBest.toString(),
      total: new Decimal(s.total).add(gain).toString(),
      unlocked: true,
      resetTime: 0,
    }
    // Reset Qi (player.points) to 0.
    game.points = decimalZero()
  }

  function update(diff: number): void {
    slice.value.q.resetTime += diff
    slice.value.f.resetTime += diff
    slice.value.c.resetTime += diff
    slice.value.n.resetTime += diff
    slice.value.s.resetTime += diff
    // Maintain best for unlocked realms.
    for (const id of ['q', 'f', 'c', 'n', 's'] as const) {
      const r = slice.value[id]
      if (r.unlocked) {
        const best = Decimal.max(new Decimal(r.best), new Decimal(r.points))
        if (!best.eq(r.best)) slice.value[id] = { ...r, best: best.toString() }
      }
    }
  }

  // ---- Save slice ---------------------------------------------------------
  function save(): Record<string, unknown> {
    return slice.value as unknown as Record<string, unknown>
  }
  function load(s: unknown): void {
    const loaded = (s ?? freshRealmSlice()) as Partial<RealmSlice>
    slice.value = {
      q: { ...freshRealmState(true), ...loaded.q },
      f: { ...freshRealmState(false), ...loaded.f },
      c: { ...freshRealmState(false), ...loaded.c },
      n: { ...freshRealmState(false), ...loaded.n },
      s: { ...freshRealmState(false), ...loaded.s },
    }
  }
  function fresh(): Record<string, unknown> {
    return freshRealmSlice() as unknown as Record<string, unknown>
  }

  return {
    slice,
    q,
    f,
    realmMult,
    canResetQ,
    resetGainQ,
    prestigeQ,
    update,
    save,
    load,
    fresh,
  }
})

export { decimalOne, decimalZero }
