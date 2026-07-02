// src/stores/game.ts — the central game store: save lifecycle, tick loop,
// offline catch-up, devSpeed, autosave.
//
// Replaces TMT's `js/game.js` main loop + `js/utils/save.js` load/save. The
// 50ms setInterval becomes a single `tick()` action; `tmp` is gone entirely
// (Pinia getters replace it). System stores register their `update(diff)`
// via `registerSystemUpdater`; the tick calls them in dependency order.
//
// Per-system state slices live on their own stores, but the canonical
// `PlayerSave` is assembled here from a registered slice-providers. This
// keeps the save schema centralized while letting each store own its state.

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import Decimal from 'break_eternity.js'
import {
  type GameOptions,
  type PlayerSave,
  findNaN,
  getStartOptions,
  loadOptions,
  loadSave,
  registerDecimalPaths,
  registerStartPlayer,
  writeOptions,
  writeSave,
} from '@/engine/save'
import { decimalZero } from '@/engine/decimal'

/** A system updater registered by a store. Called once per tick in order. */
export interface SystemUpdater {
  id: string
  update: (diff: number) => void
}

/** A system reverse-pass hook (automation runs after the forward pass). */
export interface SystemAutomation {
  id: string
  automate: (diff: number) => void
}

/** A provider that returns the store's slice of the save. */
export interface SaveSliceProvider {
  id: string
  /** Return this store's serializable state slice. */
  save: () => Record<string, unknown>
  /** Apply a loaded slice back onto the store. */
  load: (slice: unknown) => void
  /** Hydrate a fresh default slice (for a new save). */
  fresh: () => Record<string, unknown>
}

const MAX_TICK_LENGTH = 3600
const OFFLINE_CAP_SECONDS = 3600
const OFFLINE_CATCHUP_DIVISOR = 10
const TICK_INTERVAL_MS = 50
const AUTOSAVE_INTERVAL_MS = 5000
const MS_PER_SECOND = 1000

export const useGameStore = defineStore('game', () => {
  // ---- Core player state (top-level save fields) --------------------------
  const points = ref(decimalZero())
  const time = ref(Date.now())
  const timePlayed = ref(0)
  const keepGoing = ref(false)
  const hasNaN = ref(false)
  const devSpeed = ref<number | null>(null)
  const offTime = ref<{ remain: number } | null>(null)

  // ---- Options ------------------------------------------------------------
  const options = ref<GameOptions>(getStartOptions())

  // ---- Tick loop state ----------------------------------------------------
  const ticking = ref(false)
  const gameEnded = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let autosaveId: ReturnType<typeof setInterval> | null = null

  // ---- Registry -----------------------------------------------------------
  const updaters: SystemUpdater[] = []
  const automations: SystemAutomation[] = []
  const sliceProviders: SaveSliceProvider[] = []

  function registerUpdater(u: SystemUpdater): void {
    if (updaters.some((x) => x.id === u.id)) return
    updaters.push(u)
    updaters.sort((a, b) => a.id.localeCompare(b.id))
  }

  function registerAutomation(a: SystemAutomation): void {
    if (automations.some((x) => x.id === a.id)) return
    automations.push(a)
    automations.sort((a, b) => a.id.localeCompare(b.id))
  }

  function registerSliceProvider(p: SaveSliceProvider): void {
    if (sliceProviders.some((x) => x.id === p.id)) return
    sliceProviders.push(p)
  }

  // ---- Save assembly ------------------------------------------------------
  function buildSave(): PlayerSave {
    const save: PlayerSave = {
      saveVersion: 1,
      versionType: 'dao-tree',
      time: time.value,
      timePlayed: timePlayed.value,
      points: points.value.toString(),
      keepGoing: keepGoing.value,
      hasNaN: hasNaN.value,
      devSpeed: devSpeed.value,
      offTime: offTime.value,
      tab: null,
      navTab: null,
      subtabs: {},
      lastSafeTab: null,
    }
    for (const p of sliceProviders) {
      save[p.id] = p.save()
    }
    return save
  }

  function buildFreshSave(): PlayerSave {
    const save = buildSave()
    for (const p of sliceProviders) {
      save[p.id] = p.fresh()
    }
    return save
  }

  function applySave(save: PlayerSave): void {
    time.value = save.time
    timePlayed.value = save.timePlayed
    points.value = new Decimal(save.points)
    keepGoing.value = save.keepGoing
    hasNaN.value = save.hasNaN
    devSpeed.value = save.devSpeed
    offTime.value = save.offTime
    for (const p of sliceProviders) {
      p.load(save[p.id])
    }
  }

  // Register the fresh-player factory + decimal paths with the save module.
  // (Idempotent — safe to call from multiple places.)
  registerStartPlayer(buildFreshSave)
  registerDecimalPaths(['points'])

  // ---- Tick ----------------------------------------------------------------
  function tick(): void {
    if (ticking.value) return
    if (gameEnded.value && !keepGoing.value) return
    ticking.value = true
    try {
      const now = Date.now()
      let diff = (now - time.value) / MS_PER_SECOND
      const trueDiff = diff
      // Offline catch-up. The cap is PROGRESSION (Deep Meditation): the
      // seclusion store's live cap arrives through the registered fn; the
      // constant is only the unwired fallback (tests that skip wiring).
      if (offTime.value !== null) {
        const limit = currentOfflineCap()
        if (offTime.value.remain > limit) offTime.value.remain = limit
        if (offTime.value.remain > 0) {
          const offlineDiff = Math.max(offTime.value.remain / OFFLINE_CATCHUP_DIVISOR, diff)
          offTime.value.remain -= offlineDiff
          diff += offlineDiff
        }
        if (!options.value.offlineProd || offTime.value.remain <= 0) offTime.value = null
      }
      if (devSpeed.value !== null) diff *= devSpeed.value
      time.value = now
      if (diff < 0) diff = 0
      if (diff > MAX_TICK_LENGTH) diff = MAX_TICK_LENGTH

      // Forward pass: Qi gain + system updates in dependency order.
      // qiPerSecond is read from the pipelines store (imported lazily to
      // avoid a circular import at module load).
      const qiPerSec = currentQiPerSecond()
      if (!gameEnded.value || keepGoing.value) {
        points.value = points.value.add(qiPerSec.times(diff)).max(0)
        timePlayed.value += diff
      }
      for (const u of updaters) {
        u.update(diff)
      }
      // Reverse pass: automation
      for (const a of automations) {
        a.automate(diff)
      }
      // NaN check
      const nan = findNaN(buildSave())
      if (nan) {
        hasNaN.value = true
        stopLoop()
        console.error('NaN detected; tick loop halted.')
        return
      }
      void trueDiff
    } finally {
      ticking.value = false
    }
  }

  // ---- Qi/sec (set externally by pipelines store to avoid circular import) -
  let qiPerSecondFn: (() => Decimal) | null = null
  function setQiPerSecondFn(fn: () => Decimal): void {
    qiPerSecondFn = fn
  }
  function currentQiPerSecond(): Decimal {
    return qiPerSecondFn ? qiPerSecondFn() : decimalZero()
  }

  // ---- Offline cap (set externally by the seclusion store — same pattern) --
  let offlineCapFn: (() => number) | null = null
  function setOfflineCapFn(fn: () => number): void {
    offlineCapFn = fn
  }
  function currentOfflineCap(): number {
    return offlineCapFn ? offlineCapFn() : OFFLINE_CAP_SECONDS
  }

  // ---- Loop control -------------------------------------------------------
  function startLoop(): void {
    if (intervalId !== null) return
    intervalId = setInterval(tick, TICK_INTERVAL_MS)
    if (options.value.autosave) startAutosave()
  }

  function stopLoop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    stopAutosave()
  }

  function startAutosave(): void {
    if (autosaveId !== null) return
    autosaveId = setInterval(() => {
      if (options.value.autosave) writeSave(buildSave())
    }, AUTOSAVE_INTERVAL_MS)
  }

  function stopAutosave(): void {
    if (autosaveId !== null) {
      clearInterval(autosaveId)
      autosaveId = null
    }
  }

  // ---- Boot / load --------------------------------------------------------
  function load(): void {
    options.value = loadOptions()
    const save = loadSave()
    applySave(save)
    if (options.value.offlineProd && save.time) {
      const elapsed = (Date.now() - save.time) / MS_PER_SECOND
      if (elapsed > 0) offTime.value = { remain: elapsed }
    }
    time.value = Date.now()
  }

  function saveNow(): boolean {
    return writeSave(buildSave())
  }

  function hardReset(): void {
    stopLoop()
    writeSave(buildFreshSave(), true)
    applySave(buildFreshSave())
    time.value = Date.now()
    startLoop()
  }

  // ---- Browser hooks (call from App.vue mounted) --------------------------
  function attachBrowserHooks(): void {
    window.addEventListener('beforeunload', () => {
      if (options.value.autosave) writeSave(buildSave())
    })
    window.addEventListener('resize', () => {
      // Nav store listens for its own resize; this is a no-op hook for the
      // game store. Kept here so future engine-level resize logic has a home.
    })
  }

  return {
    points,
    time,
    timePlayed,
    keepGoing,
    hasNaN,
    devSpeed,
    offTime,
    options,
    gameEnded,
    registerUpdater,
    registerAutomation,
    registerSliceProvider,
    setQiPerSecondFn,
    setOfflineCapFn,
    currentOfflineCap,
    tick,
    startLoop,
    stopLoop,
    load,
    saveNow,
    hardReset,
    attachBrowserHooks,
    buildSave,
    buildFreshSave,
    applySave,
    _writeOptions: () => writeOptions(options.value),
  }
})

// Helper type re-export for stores that need a Ref to the game store.
export type GameStore = ReturnType<typeof useGameStore>
export type { Ref }
