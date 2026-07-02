<!-- src/components/DeepMeditationPanel.vue — Deep Meditation / secluded cultivation
     (slice 8.5). Hosted in BodyTab. Frames the offline cap as what the player
     KEEPS ("your seclusion deepens"), never as a limit imposed on absence. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSeclusionStore } from '@/stores/seclusion'
import { useGameStore } from '@/stores/game'
import { SECLUSION_DATA } from '@/data/seclusion'
import { format, formatTime } from '@/engine/format'

const seclusion = useSeclusionStore()
const game = useGameStore()

/** Rungs currently visible: purchased, or revealed by their realm. */
const visibleRungs = computed(() =>
  SECLUSION_DATA.rungs.filter((r) => seclusion.isPurchased(r.realm) || seclusion.isRevealed(r.realm)),
)

function onPurchase(realm: (typeof SECLUSION_DATA.rungs)[number]['realm']) {
  seclusion.purchase(realm)
}
</script>

<template>
  <section class="panel meditation-panel">
    <h3>Deep Meditation</h3>
    <p class="cap">
      Secluded cultivation banks up to <strong>{{ formatTime(seclusion.offlineCapSeconds) }}</strong>
      of progress while you are away.
    </p>
    <p class="note">
      Deep meditation sustains you behind the closed door. Each discipline mastered deepens the
      seclusion — permanently. It is never lost, not to breakthrough, not to anything.
    </p>

    <div v-for="rung in visibleRungs" :key="rung.realm" class="rung" :class="{ owned: seclusion.isPurchased(rung.realm) }">
      <div class="rung-head">
        <span class="rung-name">{{ rung.name }}</span>
        <span class="rung-bonus">+{{ formatTime(rung.capBonusSeconds) }}</span>
      </div>
      <p class="rung-desc">{{ rung.description }}</p>
      <p v-if="seclusion.isPurchased(rung.realm)" class="owned-mark">Mastered.</p>
      <button
        v-else
        :disabled="!seclusion.canPurchase(rung.realm)"
        @click="onPurchase(rung.realm)"
      >
        {{ game.points.gte(rung.qiCost) ? 'Deepen' : 'Need' }} {{ format(rung.qiCost) }} Qi
      </button>
    </div>
  </section>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.meditation-panel { border-color: #4a6a5a; }
.panel h3 { margin: 0 0 0.5rem 0; color: #7ab093; }
.cap { margin: 0.25rem 0; }
.cap strong { color: #7ab093; }
.note { margin: 0.25rem 0 0.75rem 0; font-size: 0.8rem; color: #7a8a80; }
.rung { border-top: 1px solid #2a3a32; padding: 0.6rem 0 0.35rem 0; }
.rung-head { display: flex; justify-content: space-between; }
.rung-name { color: #dfdfdf; }
.rung-bonus { color: #7ab093; font-variant-numeric: tabular-nums; }
.rung-desc { margin: 0.25rem 0; font-size: 0.85rem; color: #9aa8a0; font-style: italic; }
.owned .rung-name { color: #7ab093; }
.owned-mark { margin: 0.15rem 0 0 0; font-size: 0.85rem; color: #7ab093; }
button { font-family: inherit; font-size: 0.9rem; padding: 0.35rem 0.7rem; background: #24322b; color: #cfe3d8; border: 1px solid #4a6a5a; border-radius: 4px; cursor: pointer; }
button:hover:not(:disabled) { background: #2e4237; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
