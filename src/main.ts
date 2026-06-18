// src/main.ts — app bootstrap.
//
// Wires the save system, registers system updaters/slice-providers with the
// game store, loads the save, starts the tick loop, and mounts Vue.

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerDecimalPaths } from '@/engine/save'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { usePipelinesStore } from '@/stores/pipelines'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// --- Wire stores into the game store's registries -------------------------
const game = useGameStore()
const body = useBodyStore()
const realm = useRealmStore()
const pipelines = usePipelinesStore()
const nav = useNavStore()

// Slice providers (each store owns its save slice; game store assembles).
game.registerSliceProvider({ id: 'b', save: body.save, load: body.load, fresh: body.fresh })
game.registerSliceProvider({ id: 'realms', save: realm.save, load: realm.load, fresh: realm.fresh })

// System updaters (forward pass, in dependency order: body before realm).
game.registerUpdater({ id: 'body', update: body.update })
game.registerUpdater({ id: 'realm', update: realm.update })

// Qi/sec pipeline: game store reads from pipelines store.
game.setQiPerSecondFn(() => pipelines.qiPerSecond)

// Decimal paths for save hydration (per-realm points/best/total).
registerDecimalPaths([
  'realms.q.points',
  'realms.q.best',
  'realms.q.total',
  'realms.f.points',
  'realms.f.best',
  'realms.f.total',
  'realms.c.points',
  'realms.c.best',
  'realms.c.total',
  'realms.n.points',
  'realms.n.best',
  'realms.n.total',
  'realms.s.points',
  'realms.s.best',
  'realms.s.total',
])

// --- Load save + start loop -----------------------------------------------
game.load()
game.attachBrowserHooks()
game.startLoop()

// Browser resize → nav store (split-screen detection).
window.addEventListener('resize', () => nav.setWindowWidth(window.innerWidth))

app.mount('#app')
