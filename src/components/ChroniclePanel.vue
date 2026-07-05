<!-- src/components/ChroniclePanel.vue — the chronicle listing (slice 10 step 7 /
     D8 + D37 §5). The world's record of your lives, read as a book.

     VEIL (D11): the section does not exist until the chronicle has a page — it
     appears only once at least one life has been written (the first crossing).
     Lives read OLDEST-FIRST — it is a dynasty history, not a log; the founding
     era comes first. Each life is rendered per its richness tier (chapters
     visually fuller). A transcendence (D39) — the dynasty's biggest event
     class — is rendered with weight. A quiet current-life line keeps the book
     alive between crossings.

     The modest listing only (D37); the full narrative treatment is the
     narrative-spine pass (D8). Matches the Journal tab's existing panel style. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useChronicleStore } from '@/stores/chronicle'
import { epitaphFor, ordinal } from '@/stores/epitaph'

const chronicle = useChronicleStore()

/** Oldest-first — the book reads from the founding era forward. */
const epitaphs = computed(() => chronicle.lives.map((entry) => epitaphFor(entry)))

/** The life now being lived: one past every completed (recorded) life. */
const currentLifeLabel = computed(() => ordinal(chronicle.lifeCount + 1))
</script>

<template>
  <section v-if="chronicle.lifeCount > 0" class="panel chronicle-panel">
    <div class="head">
      <h3>Chronicle</h3>
      <span class="count">{{ chronicle.lifeCount }} {{ chronicle.lifeCount === 1 ? 'life' : 'lives' }}</span>
    </div>
    <p class="note">The world's record of your lives. It remembers after you are gone.</p>

    <div
      v-for="epitaph in epitaphs"
      :key="epitaph.heading"
      class="entry"
      :class="[`tier-${epitaph.tier}`]"
    >
      <div class="entry-head">{{ epitaph.heading }}</div>
      <p class="account">
        <span
          v-for="(clause, index) in epitaph.clauses"
          :key="index"
          class="clause"
          :class="{ transcendence: clause.transcendence }"
        >{{ clause.text }}<template v-if="index < epitaph.clauses.length - 1">&#32;</template></span>
      </p>
    </div>

    <p class="current-life">The {{ currentLifeLabel }} life is still being written.</p>
  </section>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.chronicle-panel { border-color: #3a3244; }
.head { display: flex; justify-content: space-between; align-items: baseline; }
.head h3 { margin: 0; color: #c2a878; }
.count { color: #c2a878; font-variant-numeric: tabular-nums; font-size: 0.9rem; }
.note { margin: 0.25rem 0 0.85rem 0; font-size: 0.8rem; color: #877e8a; font-style: italic; }

/* Each life is a page. Chapters get the fullest weight; lines the quietest. */
.entry { margin-top: 0.6rem; padding: 0.55rem 0 0.55rem 0.75rem; border-left: 2px solid #2e2a36; }
.entry-head { color: #b8a878; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.2rem; }
.account { margin: 0; color: #b0a8bb; font-size: 0.9rem; line-height: 1.5; }

/* Tier weighting — chapters read full and bright, lines read spare. */
.tier-chapter { border-left-color: #6a5c8a; padding-top: 0.75rem; padding-bottom: 0.75rem; }
.tier-chapter .entry-head { color: #d8c8a2; }
.tier-chapter .account { color: #cfc6d8; }
.tier-summary { border-left-color: #4a4258; }
.tier-line { border-left-color: #2a2830; }
.tier-line .entry-head { color: #8a8578; }
.tier-line .account { color: #8f889a; font-size: 0.85rem; }

/* A transcendence (D39) is the dynasty's biggest event — it carries weight. */
.clause.transcendence { color: #e0c88a; font-style: italic; font-weight: 600; }

.current-life { margin: 0.9rem 0 0 0; padding-top: 0.6rem; border-top: 1px solid #2a2832; color: #6f6878; font-size: 0.82rem; font-style: italic; }
</style>
