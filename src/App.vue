<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { usePipelinesStore } from '@/stores/pipelines'
import { format } from '@/engine/format'
import { exportSave, importSave } from '@/engine/save'
import type { RealmId } from '@/engine/types'
import { REALM_DATA } from '@/data/realms'
import DaoLatticeGraph from '@/components/DaoLatticeGraph.vue'
import StancesPanel from '@/components/StancesPanel.vue'
import BodyTab from '@/components/BodyTab.vue'
import ForgePanel from '@/components/ForgePanel.vue'
import CoreMemoryDisplay from '@/components/CoreMemoryDisplay.vue'
import TribulationPanel from '@/components/TribulationPanel.vue'
import LegacyDisplay from '@/components/LegacyDisplay.vue'
import SectTab from '@/components/SectTab.vue'
import JournalView from '@/components/JournalView.vue'
import HintBar from '@/components/HintBar.vue'
import SecretRealmTab from '@/components/SecretRealmTab.vue'
import AlchemyTab from '@/components/AlchemyTab.vue'
import AchievementsPanel from '@/components/AchievementsPanel.vue'
import ChroniclePanel from '@/components/ChroniclePanel.vue'
import SeveringPanel from '@/components/SeveringPanel.vue'
import RebirthPanel from '@/components/RebirthPanel.vue'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'
import { useRebirthStore } from '@/stores/rebirth'

type TabId = 'realms' | 'body' | 'dao' | 'sect' | 'secret' | 'alchemy' | 'journal' | 'save'

const game = useGameStore()
const realm = useRealmStore()
const dao = useDaoStore()
const sect = useSectStore()
const secretRealm = useSecretRealmStore()
const alchemy = useAlchemyStore()
const pipelines = usePipelinesStore()
const rebirth = useRebirthStore()

const { points } = storeToRefs(game)
const qiPerSec = computed(() => pipelines.qiPerSecond)

const currentTab = ref<TabId>('realms')

const visibleRealms = computed(() => REALM_DATA.filter((r) => realm.isUnlocked(r.id) || realm.isRevealed(r.id)))

// Each realm's prestige button names the act it performs — the level is
// CONDENSED, the foundation ESTABLISHED, the core REFINED, the soul DEEPENED
// then FORMED. "Break through" was the old one-size verb and lied about all of
// them. Realm x is the Offering (D28) — SeveringPanel owns its button, so this
// entry is never rendered here; it is kept honest for type completeness.
const prestigeActionLabels: Record<RealmId, string> = {
  q: 'Condense the Qi',
  f: 'Establish the Foundation',
  c: 'Refine the Core',
  n: 'Deepen the Soul',
  s: 'Form the Soul',
  x: 'Make the Offering',
}

function onPrestige(id: RealmId) {
  realm.prestige(id)
}

// Levels v1 (D43 #4) — the inline current-substage readout on every climb realm
// card (never veil the now). One line: the reached level's name, plus the next
// threshold when one remains. Before any level is reached, only the next shows
// ("1st Level at 1"); fully climbed, only the current ("13th Level"). Labels +
// thresholds come from the realm data via the store getters — no literals here.
function substageLine(id: RealmId): string {
  const current = realm.currentSubstage(id)
  const next = realm.nextSubstage(id)
  if (current && next) return `${current.label} — ${next.label} at ${format(next.at)}`
  if (current) return current.label
  if (next) return `${next.label} at ${format(next.at)}`
  return ''
}
function onHardReset() {
  if (confirm('Hard reset? This wipes your save.')) game.hardReset()
}
// Feedback lives in the itch page comments for now. Single constant —
// repoint here (e.g. to a Discord) once there's an audience to hold one.
const FEEDBACK_URL = 'https://ticktockbent.itch.io/dao-tree'

const importText = ref('')

function onExport() {
  const data = game.buildSave()
  const encoded = exportSave(data)
  navigator.clipboard?.writeText(encoded)
  alert('Save copied to clipboard. Paste it into a comment to make a bug report far more useful.')
}
function onImport() {
  const encoded = importText.value.trim()
  if (!encoded) return
  if (!confirm('Import this save? It replaces your current progress.')) return
  try {
    const save = importSave(encoded)
    game.applySave(save)
    game.saveNow()
    importText.value = ''
    alert('Save imported.')
  } catch {
    alert('That save code could not be read. Check that it was copied in full.')
  }
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
          <!-- D28: realm x is the Offering, not a qi climb — the generic
               Best/Gain/prestige-action block hides; SeveringPanel owns its UI. -->
          <template v-if="r.id !== 'x'">
            <!-- Levels v1 (D43 #4): the inline current-substage readout + next threshold. -->
            <p class="substage">{{ substageLine(r.id) }}</p>
            <p>Best: {{ format(realm.realmBest(r.id)) }}</p>
            <p v-if="realm.canReset(r.id)">Gain: +{{ format(realm.resetGain(r.id)) }}</p>
            <button :disabled="!realm.canReset(r.id)" @click="onPrestige(r.id)">
              {{ realm.canReset(r.id) ? `${prestigeActionLabels[r.id]} (+${format(realm.resetGain(r.id))})` : `Need ${format(realm.nextAt(r.id))} Qi` }}
            </button>
          </template>
          <ForgePanel v-if="r.id === 'c'" />
          <CoreMemoryDisplay v-if="r.id === 'c'" />
          <TribulationPanel v-if="r.id === 's'" />
          <LegacyDisplay v-if="r.id === 's'" />
          <SeveringPanel v-if="r.id === 'x'" />
        </section>
        <!-- Slice 10 (D39): the Samsara crossing — voluntary, unlocked at the
             first tribulation, available forever after. Its own section on the
             realm surface, below the climb. -->
        <section v-if="rebirth.rebirthUnlocked" class="panel">
          <h3 :style="{ color: '#c9a6f0' }">Samsara</h3>
          <RebirthPanel />
        </section>
      </div>

      <div v-else-if="currentTab === 'body'" class="tab-content"><BodyTab /></div>
      <div v-else-if="currentTab === 'dao'" class="tab-content"><DaoLatticeGraph /><StancesPanel /></div>
      <div v-else-if="currentTab === 'sect'" class="tab-content"><SectTab /></div>
      <div v-else-if="currentTab === 'secret'" class="tab-content"><SecretRealmTab /></div>
      <div v-else-if="currentTab === 'alchemy'" class="tab-content"><AlchemyTab /></div>
      <div v-else-if="currentTab === 'journal'" class="tab-content"><JournalView /><AchievementsPanel /><ChroniclePanel /></div>

      <div v-else-if="currentTab === 'save'" class="tab-content">
        <section class="panel feedback">
          <h3>Feedback</h3>
          <p>Dao Tree is in active development. Bug reports and thoughts go in the
            comments on the itch page — they genuinely shape what gets built next.</p>
          <p class="nudge">Hit a bug? Export your save below and paste it into your
            comment — a save turns "it broke" into something I can actually fix.</p>
          <a class="link-button" :href="FEEDBACK_URL" target="_blank" rel="noopener">Open the itch page →</a>
        </section>
        <section class="panel dev">
          <h3>Save</h3>
          <p>Time played: {{ format(game.timePlayed) }}s</p>
          <button @click="game.saveNow()">Save</button>
          <button @click="onExport">Export</button>
          <button @click="onHardReset">Hard reset</button>
          <p class="import-label">Import a save (moves progress between devices or platforms):</p>
          <textarea v-model="importText" class="import-box" rows="3" placeholder="Paste an exported save code here…"></textarea>
          <button :disabled="!importText.trim()" @click="onImport">Import</button>
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
.panel .substage { margin: 0 0 0.4rem 0; color: #9a9a9a; font-size: 0.9rem; }
button { font-family: inherit; font-size: 1rem; padding: 0.4rem 0.8rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; cursor: pointer; margin: 0.25rem 0.25rem 0.25rem 0; }
button:hover:not(:disabled) { background: #3a3a3a; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.dev { border-color: #555; }
.feedback p { margin: 0 0 0.5rem 0; color: #cfcfcf; font-size: 0.92rem; line-height: 1.4; }
.feedback .nudge { color: #9a9a9a; }
.link-button { display: inline-block; font-size: 1rem; padding: 0.4rem 0.8rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; text-decoration: none; margin: 0.25rem 0; }
.link-button:hover { background: #3a3a3a; }
.import-label { margin: 0.75rem 0 0.25rem 0; color: #9a9a9a; font-size: 0.9rem; }
.import-box { display: block; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 0.85rem; background: #111; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; padding: 0.5rem; resize: vertical; margin-bottom: 0.25rem; }
</style>
