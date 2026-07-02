<!-- src/components/AchievementsPanel.vue — the trophy shelf (eternal record,
     no gameplay effects). Rendered in the Journal tab below JournalView.
     Veil discipline: hidden entries show ??? until earned (mystified horizon);
     every earned achievement is fully legible; unearned visible entries keep
     name AND flavor readable — the current loop is never veiled. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAchievementsStore } from '@/stores/achievements'
import { ACHIEVEMENT_DATA } from '@/data/achievements'
import type { AchievementCategory, AchievementDef } from '@/data/achievements'

const achievements = useAchievementsStore()

/** Category display order + names in the game's voice. */
const CATEGORY_ORDER: readonly AchievementCategory[] = [
  'spine',
  'body',
  'forge',
  'world',
  'heart',
  'mastery',
]
const CATEGORY_NAMES: Record<AchievementCategory, string> = {
  spine: 'The Path',
  body: 'The Vessel',
  forge: 'The Crucible',
  world: 'The World',
  heart: 'The Heart',
  mastery: 'Mastery',
}

/** The mask shown for unearned hidden entries. */
const HIDDEN_MASK = '???'

const groups = computed(() =>
  CATEGORY_ORDER.map((category) => ({
    category,
    name: CATEGORY_NAMES[category],
    entries: ACHIEVEMENT_DATA.filter((def) => def.category === category),
  })).filter((group) => group.entries.length > 0),
)

function isMasked(def: AchievementDef): boolean {
  return def.hidden && !achievements.has(def.key)
}

function displayName(def: AchievementDef): string {
  return isMasked(def) ? HIDDEN_MASK : def.name
}

function displayFlavor(def: AchievementDef): string {
  return isMasked(def) ? HIDDEN_MASK : def.flavor
}
</script>

<template>
  <section class="panel achievements-panel">
    <div class="head">
      <h3>Achievements</h3>
      <span class="count">{{ achievements.progress.earned }} / {{ achievements.progress.total }}</span>
    </div>
    <p class="note">The eternal record. What is earned here is never lost — not to anything.</p>

    <div v-for="group in groups" :key="group.category" class="category">
      <h4>{{ group.name }}</h4>
      <div class="grid">
        <div
          v-for="def in group.entries"
          :key="def.key"
          class="card"
          :class="{ earned: achievements.has(def.key), masked: isMasked(def) }"
        >
          <div class="card-name">{{ displayName(def) }}</div>
          <div class="card-flavor">{{ displayFlavor(def) }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.achievements-panel { border-color: #4a4432; }
.head { display: flex; justify-content: space-between; align-items: baseline; }
.head h3 { margin: 0; color: #d8b25a; }
.count { color: #d8b25a; font-variant-numeric: tabular-nums; font-size: 0.9rem; }
.note { margin: 0.25rem 0 0.75rem 0; font-size: 0.8rem; color: #8a8270; }
.category { margin-top: 0.75rem; border-top: 1px solid #2a2822; padding-top: 0.5rem; }
.category h4 { margin: 0 0 0.5rem 0; color: #b8a878; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; }
.card { background: #202020; border: 1px solid #2e2c26; border-radius: 4px; padding: 0.5rem 0.6rem; opacity: 0.55; }
.card.earned { opacity: 1; background: #24221a; border-color: #6a5c32; }
.card-name { color: #cfc6ae; font-size: 0.9rem; }
.card.earned .card-name { color: #e8cd82; }
.card-flavor { margin-top: 0.2rem; color: #8a8578; font-size: 0.8rem; font-style: italic; line-height: 1.35; }
.card.earned .card-flavor { color: #b0a888; }
.card.masked .card-name,
.card.masked .card-flavor { color: #5a5850; font-style: normal; letter-spacing: 0.15em; }
</style>
