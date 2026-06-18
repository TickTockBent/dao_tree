<script setup lang="ts">
// SoulAspectPanel.vue — the Soul Aspect pick (one-shot, on realm n).

import { computed } from 'vue'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { realmWithSoulAspect } from '@/data/realms'
import { meets } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { format } from '@/engine/format'
import type { SoulAspectKey } from '@/engine/types'

const body = useBodyStore()
const realm = useRealmStore()

const aspectRealm = computed(() => realmWithSoulAspect())
const aspects = computed(() => aspectRealm.value?.soulAspect?.aspects ?? [])

// The pick is visible only after the first n prestige AND while unchosen.
const panelVisible = computed(() => {
  if (!aspectRealm.value) return false
  if (body.soulAspectChosen) return false
  return realm.realmBest('n').toNumber() >= 1
})

function aspectMeetsRequirement(requires: import('@/engine/meets').Condition): boolean {
  return meets(requires, buildGameState())
}

function effectLine(aspect: (typeof aspects.value)[number]): string {
  const parts: string[] = []
  if (aspect.effect.qiMult !== undefined) {
    parts.push(`+${format((aspect.effect.qiMult - 1) * 100)}% Qi/sec`)
  }
  if (aspect.effect.insightMult !== undefined) {
    parts.push(`+${format((aspect.effect.insightMult - 1) * 100)}% Insight/sec`)
  }
  return parts.join(', ')
}

function onPick(key: SoulAspectKey, requires: import('@/engine/meets').Condition): void {
  if (!aspectMeetsRequirement(requires)) return
  if (!confirm('Bind your soul to this aspect? This is permanent for this life.')) return
  body.setSoulAspect(key, requires)
}

const chosenAspect = computed(() => aspects.value.find((a) => a.key === body.soulAspect))
</script>

<template>
  <section v-if="aspectRealm" class="panel">
    <h3>Soul Aspect</h3>
    <div v-if="body.soulAspectChosen && chosenAspect">
      <p class="chosen-label">
        Your soul has taken form: <b>{{ chosenAspect.label }}</b>
      </p>
      <p class="chosen-effect">{{ effectLine(chosenAspect) }}</p>
    </div>
    <div v-else-if="panelVisible" class="aspect-pick">
      <p class="pick-prompt">Your nascent soul yearns for form. Choose one (permanent this life):</p>
      <div class="aspect-grid">
        <button
          v-for="aspect in aspects"
          :key="aspect.key"
          :class="['aspect-card', { locked: !aspectMeetsRequirement(aspect.requires) }]"
          :disabled="!aspectMeetsRequirement(aspect.requires)"
          @click="onPick(aspect.key, aspect.requires)"
        >
          <span class="aspect-name">{{ aspect.label }}</span>
          <span class="aspect-effect">{{ effectLine(aspect) }}</span>
          <span v-if="!aspectMeetsRequirement(aspect.requires)" class="aspect-locked">
            Requires a Seed of a {{ aspect.element }} Dao node
          </span>
        </button>
      </div>
    </div>
    <p v-else class="dormant">Your soul stirs in its nascent cradle. Break through Nascent Soul to choose an aspect.</p>
  </section>
</template>

<style scoped>
.panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}
.panel h3 {
  margin: 0 0 0.5rem 0;
  color: #b486e0;
}
.chosen-label b {
  color: #b486e0;
}
.chosen-effect {
  color: #5fc9e0;
  font-size: 0.85rem;
}
.pick-prompt {
  color: #aaa;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}
.aspect-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.aspect-card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  min-width: 140px;
  text-align: left;
  font-family: inherit;
  color: #dfdfdf;
}
.aspect-card:hover:not(:disabled) {
  background: #3a3a3a;
  border-color: #b486e0;
}
.aspect-card:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.aspect-name {
  font-weight: bold;
  color: #b486e0;
}
.aspect-effect {
  font-size: 0.8rem;
  color: #5fc9e0;
}
.aspect-locked {
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
}
.dormant {
  color: #888;
  font-size: 0.85rem;
}
</style>
