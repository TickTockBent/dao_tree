<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { usePipelinesStore } from '@/stores/pipelines'
import { format } from '@/engine/format'
import { exportSave } from '@/engine/save'
import type { RealmId } from '@/engine/types'
import { REALM_DATA } from '@/data/realms'
import DaoLatticeGraph from '@/components/DaoLatticeGraph.vue'
import StancesPanel from '@/components/StancesPanel.vue'
import BodyTab from '@/components/BodyTab.vue'
import ForgePanel from '@/components/ForgePanel.vue'
import TribulationPanel from '@/components/TribulationPanel.vue'
import LegacyDisplay from '@/components/LegacyDisplay.vue'
import SectTab from '@/components/SectTab.vue'
import JournalView from '@/components/JournalView.vue'
import HintBar from '@/components/HintBar.vue'
import SecretRealmTab from '@/components/SecretRealmTab.vue'
import AlchemyTab from '@/components/AlchemyTab.vue'
import AchievementsPanel from '@/components/AchievementsPanel.vue'
import SeveringPanel from '@/components/SeveringPanel.vue'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'

type TabId = 'realms' | 'body' | 'dao' | 'sect' | 'secret' | 'alchemy' | 'journal' | 'save'

const game = useGameStore()
const realm = useRealmStore()
const dao = useDaoStore()
const sect = useSectStore()
const secretRealm = useSecretRealmStore()
const alchemy = useAlchemyStore()
const pipelines = usePipelinesStore()

const { points } = storeToRefs(game)
const qiPerSec = computed(() => pipelines.qiPerSecond)

const currentTab = ref<TabId>('realms')

const visibleRealms = computed(() => REALM_DATA.filter((r) => realm.isUnlocked(r.id) || realm.isRevealed(r.id)))

function onPrestige(id: RealmId) {
  realm.prestige(id)
}
function onHardReset() {
  if (confirm('Hard reset? This wipes your save.')) game.hardReset()
}
function onExport() {
  const data = game.buildSave()
  const encoded = exportSave(data)
  navigator.clipboard?.writeText(encoded)
  alert('Save copied to clipboard.')
}

const daoTabAvailable = computed(() => dao.isRevealed())
const sectTabAvailable = computed(() => sect.isRevealed())
const secretTabAvailable = computed(() => secretRealm.isRevealed())
const alchemyTabAvailable = computed(() => alchemy.isRevealed())
</script>

<template>
  <div class="app">
    <header class="overlay-head">
      <h2>
        <span class="points">{{ format(points) }}</span> Qi
        <span class="rate">(+{{ format(qiPerSec) }}/s)</span>
      </h2>
    </header>

    <HintBar />

    <nav class="tab-bar">
      <button :class="{ active: currentTab === 'realms' }" @click="currentTab = 'realms'">Realms</button>
      <button :class="{ active: currentTab === 'body' }" @click="currentTab = 'body'">Body</button>
      <button v-if="daoTabAvailable" :class="{ active: currentTab === 'dao' }" @click="currentTab = 'dao'">Dao</button>
      <button v-if="sectTabAvailable" :class="{ active: currentTab === 'sect' }" @click="currentTab = 'sect'">Sect</button>
      <button v-if="secretTabAvailable" :class="{ active: currentTab === 'secret' }" @click="currentTab = 'secret'">Realms Beyond</button>
      <button v-if="alchemyTabAvailable" :class="{ active: currentTab === 'alchemy' }" @click="currentTab = 'alchemy'">Alchemy</button>
      <button :class="{ active: currentTab === 'journal' }" @click="currentTab = 'journal'">Journal</button>
      <button :class="{ active: currentTab === 'save' }" @click="currentTab = 'save'">Save</button>
    </nav>

    <main class="content">
      <div v-if="currentTab === 'realms'" class="tab-content">
        <section v-for="r in visibleRealms" :key="r.id" class="panel">
          <h3 :style="{ color: r.color }">{{ r.name }}</h3>
          <p>Best: {{ format(realm.realmBest(r.id)) }}</p>
          <p v-if="realm.canReset(r.id)">Gain: +{{ format(realm.resetGain(r.id)) }}</p>
          <button :disabled="!realm.canReset(r.id)" @click="onPrestige(r.id)">
            {{ realm.canReset(r.id) ? `Break through (+${format(realm.resetGain(r.id))})` : `Need ${format(realm.nextAt(r.id))} Qi` }}
          </button>
          <ForgePanel v-if="r.id === 'c'" />
          <TribulationPanel v-if="r.id === 's'" />
          <LegacyDisplay v-if="r.id === 's'" />
          <SeveringPanel v-if="r.id === 'x'" />
        </section>
      </div>

      <div v-else-if="currentTab === 'body'" class="tab-content"><BodyTab /></div>
      <div v-else-if="currentTab === 'dao'" class="tab-content"><DaoLatticeGraph /><StancesPanel /></div>
      <div v-else-if="currentTab === 'sect'" class="tab-content"><SectTab /></div>
      <div v-else-if="currentTab === 'secret'" class="tab-content"><SecretRealmTab /></div>
      <div v-else-if="currentTab === 'alchemy'" class="tab-content"><AlchemyTab /></div>
      <div v-else-if="currentTab === 'journal'" class="tab-content"><JournalView /><AchievementsPanel /></div>

      <div v-else-if="currentTab === 'save'" class="tab-content">
        <section class="panel dev">
          <h3>Save</h3>
          <p>Time played: {{ format(game.timePlayed) }}s</p>
          <button @click="game.saveNow()">Save</button>
          <button @click="onExport">Export</button>
          <button @click="onHardReset">Hard reset</button>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app { font-family: 'Inconsolata', monospace; color: #dfdfdf; background: #0f0f0f; min-height: 100vh; padding: 1rem; }
.overlay-head { text-align: center; padding: 0.5rem; }
.overlay-head .points { color: #fff; }
.overlay-head .rate { color: #5fc9e0; font-size: 0.9em; }
.tab-bar { display: flex; gap: 0.25rem; max-width: 600px; margin: 0 auto 1rem auto; }
.tab-bar button { flex: 1; font-family: inherit; font-size: 0.85rem; padding: 0.5rem; background: #1a1a1a; color: #aaa; border: 1px solid #333; border-radius: 4px 4px 0 0; cursor: pointer; }
.tab-bar button.active { background: #2a2a2a; color: #fff; border-bottom-color: #2a2a2a; }
.content { max-width: 600px; margin: 0 auto; }
.tab-content { display: flex; flex-direction: column; gap: 1rem; }
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.panel h3 { margin: 0 0 0.5rem 0; color: #5fc9e0; }
button { font-family: inherit; font-size: 1rem; padding: 0.4rem 0.8rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; cursor: pointer; margin: 0.25rem 0.25rem 0.25rem 0; }
button:hover:not(:disabled) { background: #3a3a3a; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.dev { border-color: #555; }
</style>
