<script setup lang="ts">
// AchievementsPanel — the trophy shelf (eternal record, no gameplay effects).
// SKELETON placeholder: renders earned count + a flat list. The real panel
// (grid cards, hidden-as-??? masking, category grouping) replaces this file.
import { useAchievementsStore } from '@/stores/achievements'
import { ACHIEVEMENT_DATA } from '@/data/achievements'

const achievements = useAchievementsStore()
</script>

<template>
  <section class="panel achievements-panel">
    <h3>Achievements ({{ achievements.progress.earned }}/{{ achievements.progress.total }})</h3>
    <ul>
      <li v-for="def in ACHIEVEMENT_DATA" :key="def.key">
        <template v-if="achievements.has(def.key)">
          <strong>{{ def.name }}</strong> — {{ def.flavor }}
        </template>
        <template v-else>
          <span class="unearned">{{ def.hidden ? '???' : def.name }}</span>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.unearned {
  opacity: 0.5;
}
</style>
