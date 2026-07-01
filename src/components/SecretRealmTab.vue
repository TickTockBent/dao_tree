<script setup lang="ts">
// SecretRealmTab.vue — rotating expedition sites (slice 7, design §6.4).
// Enter the active pocket world; gather essence over a fixed run; the run
// resolves automatically into materials, an Insight surge, and (once per site)
// a free Dao Glimpse. Everything here is optional — an accelerant, never a gate.

import { computed } from 'vue'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { SECRET_REALM_DATA } from '@/data/secret-realm'
import { format, formatTime } from '@/engine/format'
import type { MaterialKey } from '@/engine/types'

const secretRealm = useSecretRealmStore()
const sites = SECRET_REALM_DATA.sites

const MATERIAL_LABELS: Record<MaterialKey, string> = {
  spiritHerb: 'Spirit Herb',
  essenceCrystal: 'Essence Crystal',
  beastCore: 'Beast Core',
}

const run = computed(() => secretRealm.expedition)
const runSiteKey = computed(() => run.value.siteKey)
const runSite = computed(() => sites.find((s) => s.key === runSiteKey.value) ?? null)
const progressPct = computed(() => {
  const site = runSite.value
  if (!site) return 0
  return Math.min(100, (run.value.elapsed / site.durationSeconds) * 100)
})
</script>

<template>
  <div class="realm-tab">
    <section v-if="!secretRealm.isRevealed()" class="panel">
      <h3>Secret Realms</h3>
      <p class="dormant">The world holds its secrets still. Forge your core, and pocket worlds will open.</p>
    </section>

    <template v-else>
      <section class="panel intro">
        <h3>Secret Realms</h3>
        <p class="lede">
          Pocket worlds surface one at a time. Only the <b>active</b> site can be entered; the
          rotation advances every {{ formatTime(SECRET_REALM_DATA.rotation.periodSeconds) }}
          (next shift in {{ formatTime(secretRealm.secondsUntilRotation) }}). Expeditions never
          touch your cultivation — they only add to it.
        </p>
      </section>

      <section
        v-for="site in sites"
        :key="site.key"
        class="panel site"
        :class="{ locked: !secretRealm.siteIsUnlocked(site.key), active: site.key === secretRealm.activeSiteKey }"
        :style="{ '--accent': site.color }"
      >
        <header class="site-head">
          <span class="site-name">{{ site.name }}</span>
          <span class="site-element">{{ site.element }}</span>
          <span v-if="site.key === secretRealm.activeSiteKey" class="badge active-badge">Active</span>
          <span v-else-if="secretRealm.siteIsUnlocked(site.key)" class="badge">Dormant in rotation</span>
          <span v-else class="badge locked-badge">Sealed</span>
        </header>

        <template v-if="!secretRealm.siteIsUnlocked(site.key)">
          <p class="dormant">A realm sealed to you still — deepen your cultivation to reach it.</p>
        </template>

        <template v-else>
          <p class="modifier"><b>{{ site.modifier.label }}.</b> {{ site.modifier.description }}</p>

          <ul class="rewards">
            <li>
              Materials: <b>{{ MATERIAL_LABELS[site.rewards.material] }}</b>
              ×{{ format(site.rewards.materialPerEssence) }} per essence
            </li>
            <li>Insight surge: ×{{ format(site.rewards.insightPerEssence) }} per essence</li>
            <li v-if="site.rewards.firstClearGlimpseNode" class="glimpse">
              First clear: a free Dao Glimpse
              <span v-if="secretRealm.clearsOf(site.key) > 0" class="claimed">(claimed)</span>
            </li>
          </ul>

          <p class="run-meta">
            Run: {{ formatTime(site.durationSeconds) }} · Cooldown: {{ formatTime(site.cooldownSeconds) }}
            · Clears: {{ secretRealm.clearsOf(site.key) }}
          </p>

          <!-- Active run on THIS site -->
          <div v-if="run.active && site.key === runSiteKey" class="run-panel">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>
            <p class="run-line">
              Essence gathered: <b>{{ format(run.essence) }}</b>
              (+{{ format(secretRealm.essenceRate()) }}/s) ·
              {{ formatTime(Math.max(0, site.durationSeconds - run.elapsed)) }} left
            </p>
            <p class="run-converts">
              → {{ format(run.essence * site.rewards.materialPerEssence) }} {{ MATERIAL_LABELS[site.rewards.material] }},
              +{{ format(run.essence * site.rewards.insightPerEssence) }} Insight on completion
            </p>
          </div>

          <!-- Idle controls -->
          <div v-else class="controls">
            <button :disabled="!secretRealm.canEnter(site.key)" @click="secretRealm.enter(site.key)">
              Enter Expedition
            </button>
            <span v-if="run.active" class="hint">Another expedition is underway.</span>
            <span v-else-if="secretRealm.cooldownRemaining(site.key) > 0" class="hint">
              Recovering: {{ formatTime(secretRealm.cooldownRemaining(site.key)) }}
            </span>
            <span v-else-if="site.key !== secretRealm.activeSiteKey" class="hint">
              Not the active site — wait for the rotation.
            </span>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.realm-tab { display: flex; flex-direction: column; gap: 1rem; }
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.panel h3 { margin: 0 0 0.5rem 0; color: #c9b45a; }
.dormant { color: #888; font-size: 0.85rem; }
.intro .lede { color: #aaa; font-size: 0.9rem; margin: 0; line-height: 1.4; }

.site { border-left: 3px solid var(--accent); }
.site.active { border-color: var(--accent); background: #1f1d17; }
.site.locked { opacity: 0.7; }

.site-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
.site-name { font-weight: bold; color: var(--accent); font-size: 1.05rem; }
.site-element { color: #888; font-size: 0.75rem; text-transform: capitalize; }
.badge { margin-left: auto; font-size: 0.72rem; padding: 0.12rem 0.5rem; border-radius: 999px; background: #2a2a2a; color: #999; border: 1px solid #444; }
.active-badge { background: var(--accent); color: #0f0f0f; border-color: var(--accent); font-weight: bold; }
.locked-badge { color: #d47; }

.modifier { color: #cfcfcf; font-size: 0.9rem; margin: 0 0 0.5rem 0; }
.rewards { list-style: none; padding: 0; margin: 0 0 0.5rem 0; display: flex; flex-direction: column; gap: 0.15rem; }
.rewards li { color: #bdbdbd; font-size: 0.85rem; }
.rewards b { color: #dfdfdf; }
.glimpse { color: #5fc9e0; }
.claimed { color: #888; }
.run-meta { color: #888; font-size: 0.8rem; margin: 0 0 0.5rem 0; }

.run-panel { background: #0f0f0f; border: 1px solid #333; border-radius: 4px; padding: 0.6rem; }
.progress-track { height: 10px; background: #222; border-radius: 5px; overflow: hidden; margin-bottom: 0.4rem; }
.progress-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
.run-line { color: #dfdfdf; font-size: 0.88rem; margin: 0 0 0.2rem 0; }
.run-line b { color: var(--accent); }
.run-converts { color: #9fbfa0; font-size: 0.82rem; margin: 0; }

.controls { display: flex; align-items: center; gap: 0.75rem; }
.hint { color: #888; font-size: 0.82rem; }
button { font-family: inherit; font-size: 0.9rem; padding: 0.4rem 0.9rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; cursor: pointer; }
button:hover:not(:disabled) { background: #3a3a3a; border-color: var(--accent); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
