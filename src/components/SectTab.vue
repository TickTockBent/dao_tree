<script setup lang="ts">
// SectTab.vue — sect archetype pick, contribution, milestones, technique library.

import { computed } from 'vue'
import { useSectStore } from '@/stores/sect'
import { SECT_DATA } from '@/data/sect'
import { TECHNIQUE_DATA } from '@/data/techniques'
import { format } from '@/engine/format'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import type { SectArchetypeKey } from '@/engine/types'

const sect = useSectStore()

const archetypes = SECT_DATA.archetypes
const milestones = SECT_DATA.milestones
const visibleTechniques = computed(() =>
  TECHNIQUE_DATA.map((tech, index) => ({ tech, index })).filter(({ index }) => sect.techniqueIsVisible(index)),
)

function onJoin(key: SectArchetypeKey): void {
  if (!confirm(`Join this sect? This is permanent for this life.`)) return
  sect.joinSect(key)
}

function milestoneGateMet(requires?: import('@/engine/meets').Condition): boolean {
  if (!requires) return true
  return meets(requires, buildGameState())
}
</script>

<template>
  <div class="sect-tab">
    <section v-if="!sect.isRevealed()" class="panel">
      <h3>Sect</h3>
      <p class="dormant">A sect has not yet taken notice of your progress.</p>
    </section>

    <template v-else>
      <section v-if="!sect.joined" class="panel">
        <h3>Choose Your Sect</h3>
        <p class="pick-prompt">A sect shapes your techniques and your Dao. Choose carefully — this is permanent.</p>
        <div class="archetype-grid">
          <button
            v-for="arch in archetypes"
            :key="arch.key"
            class="archetype-card"
            @click="onJoin(arch.key)"
          >
            <span class="arch-name">{{ arch.name }}</span>
            <span class="arch-element">Element: {{ arch.element }}</span>
            <span class="arch-discount">{{ format(arch.latticeDiscount * 100) }}% lattice discount ({{ arch.element }})</span>
          </button>
        </div>
      </section>

      <template v-else>
        <section class="panel">
          <h3>{{ archetypes.find(a => a.key === sect.archetype)?.name }}</h3>
          <p>Contribution: <b>{{ format(sect.contribution) }}</b></p>
          <p>Best: {{ format(sect.best) }}</p>
          <p>Rate: +{{ format(sect.contributionPerSecond()) }}/s</p>
        </section>

        <section class="panel">
          <h3>Milestones</h3>
          <div v-for="(m, idx) in milestones" :key="m.key" class="milestone-row">
            <span :class="{ earned: sect.hasMilestone(idx) }">
              {{ m.key }} ({{ m.at }} contribution)
            </span>
            <span v-if="!sect.hasMilestone(idx) && m.requires && !milestoneGateMet(m.requires)" class="gated">
              Requires {{ JSON.stringify(m.requires) }}
            </span>
          </div>
        </section>

        <section class="panel">
          <h3>Technique Library</h3>
          <div v-if="visibleTechniques.length === 0" class="dormant">
            No techniques available yet.
          </div>
          <div v-for="{ tech, index } in visibleTechniques" :key="tech.key" class="tech-row">
            <div class="tech-info">
              <span class="tech-name">{{ tech.name }}</span>
              <span class="tech-school">{{ tech.school }} (tier {{ tech.libraryTier }})</span>
              <span class="tech-effect">
                {{ 'qiMult' in tech.effect ? `×${tech.effect.qiMult} Qi` : `×${tech.effect.insightMult} Insight` }}
              </span>
            </div>
            <button
              v-if="!sect.techniqueIsOwned(index)"
              :disabled="!sect.canAffordTechnique(index)"
              @click="sect.buyTechnique(index)"
            >
              {{ format(sect.techniqueCost(index)) }} contribution
            </button>
            <span v-else class="owned">Owned</span>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.sect-tab { display: flex; flex-direction: column; gap: 1rem; }
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.panel h3 { margin: 0 0 0.5rem 0; color: #5aa0c9; }
.dormant { color: #888; font-size: 0.85rem; }
.pick-prompt { color: #aaa; font-size: 0.9rem; margin-bottom: 0.75rem; }
.archetype-grid { display: flex; gap: 0.5rem; }
.archetype-card { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.6rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; cursor: pointer; min-width: 160px; text-align: left; font-family: inherit; color: #dfdfdf; }
.archetype-card:hover { background: #3a3a3a; border-color: #5aa0c9; }
.arch-name { font-weight: bold; color: #5aa0c9; }
.arch-element, .arch-discount { font-size: 0.8rem; color: #888; }
.milestone-row { display: flex; justify-content: space-between; padding: 0.2rem 0; font-size: 0.9rem; }
.earned { color: #5fc9e0; }
.gated { color: #d44; font-size: 0.8rem; }
.tech-row { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; gap: 1rem; }
.tech-info { display: flex; flex-direction: column; gap: 0.15rem; }
.tech-name { font-weight: bold; color: #dfdfdf; }
.tech-school { color: #888; font-size: 0.8rem; }
.tech-effect { color: #5fc9e0; font-size: 0.85rem; }
.owned { color: #5fc9e0; font-size: 0.85rem; }
button { font-family: inherit; font-size: 0.9rem; padding: 0.4rem 0.8rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; cursor: pointer; white-space: nowrap; }
button:hover:not(:disabled) { background: #3a3a3a; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
