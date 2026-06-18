<script setup lang="ts">
// JournalView.vue — chronological entries with unread glow + Reflect.

import { useJournalStore } from '@/stores/journal'
import { format } from '@/engine/format'

const journal = useJournalStore()
</script>

<template>
  <div class="journal-view">
    <section class="panel">
      <h3>Journal</h3>
      <p class="stage">Current stage: <b>{{ journal.currentCultivationStage() }}</b></p>
      <div v-if="journal.latchedEntries.length === 0" class="empty">
        No entries yet. Your journey begins.
      </div>
      <div v-for="entry in journal.latchedEntries" :key="entry.key" class="journal-entry">
        <h4>{{ entry.title }}</h4>
        <p>{{ entry.text }}</p>
        <button
          v-if="entry.bonus && !journal.reflected.has(entry.key)"
          @click="journal.reflect(entry.key)"
        >
          Reflect
          <span v-if="'qi' in entry.bonus">(+{{ format(entry.bonus.qi) }} Qi)</span>
        </button>
        <span v-else-if="entry.bonus && journal.reflected.has(entry.key)" class="reflected">Reflected</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.journal-view { display: flex; flex-direction: column; gap: 1rem; }
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.panel h3 { margin: 0 0 0.5rem 0; color: #8ab87a; }
.stage { color: #888; font-size: 0.85rem; margin-bottom: 1rem; }
.empty { color: #888; font-style: italic; }
.journal-entry { padding: 0.75rem 0; border-bottom: 1px solid #2a2a2a; }
.journal-entry:last-child { border-bottom: none; }
.journal-entry h4 { margin: 0 0 0.3rem 0; color: #8ab87a; }
.journal-entry p { margin: 0 0 0.5rem 0; color: #bbb; font-size: 0.9rem; line-height: 1.4; }
button { font-family: inherit; font-size: 0.85rem; padding: 0.3rem 0.6rem; background: #2a2a2a; color: #8ab87a; border: 1px solid #444; border-radius: 4px; cursor: pointer; }
button:hover { background: #3a3a3a; }
.reflected { color: #555; font-size: 0.8rem; }
</style>
