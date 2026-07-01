<script setup lang="ts">
// AlchemyTab.vue — Alchemy profession (slice 7, §7.6): pick the Act I slot,
// gather materials from Secret Realm expeditions, craft and burn pills.

import { computed } from 'vue'
import { useAlchemyStore } from '@/stores/alchemy'
import { ALCHEMY_DATA } from '@/data/alchemy'
import { format, formatTime } from '@/engine/format'
import type { MaterialKey, ProfessionKey } from '@/engine/types'

const alchemy = useAlchemyStore()

const materials = ALCHEMY_DATA.materials
const recipes = ALCHEMY_DATA.recipes

// The Act I profession slot. Alchemy is pickable in v1; Artifice and Formations
// are sealed until later acts (design §7.6: slots open one per act).
const professionSlots: readonly {
  key: ProfessionKey
  name: string
  blurb: string
  pickable: boolean
}[] = [
  {
    key: 'alchemy',
    name: 'Alchemy',
    blurb: 'Refine Secret Realm spoils into pills: a Qi surge, a breakthrough aid, a warding pill.',
    pickable: true,
  },
  {
    key: 'artifice',
    name: 'Artifice',
    blurb: 'Forge spirit tools and talismans.',
    pickable: false,
  },
  {
    key: 'formations',
    name: 'Formations',
    blurb: 'Array-craft to bend a field of Qi.',
    pickable: false,
  },
]

const unlockedRecipes = computed(() => recipes.filter((r) => alchemy.recipeUnlocked(r.key)))
const lockedRecipes = computed(() => recipes.filter((r) => !alchemy.recipeUnlocked(r.key)))

/** A held pill's usage note, resolved off the discriminated effect (no template narrowing). */
function pillNote(effect: (typeof recipes)[number]['effect']): string {
  if (effect.type === 'timedQiMult') {
    return `Burn one: ×${format(effect.mult)} Qi for ${formatTime(effect.durationSeconds)}.`
  }
  if (effect.type === 'breakthroughAid') {
    return 'Held: consumed automatically at the next eligible breakthrough.'
  }
  return 'Held: consumed automatically when a tribulation begins.'
}

/** Held pills (count > 0), with their recipe row + resolved display, in table order. */
const heldPills = computed(() =>
  recipes
    .filter((r) => alchemy.pillCount(r.key) > 0)
    .map((r) => ({
      recipe: r,
      count: alchemy.pillCount(r.key),
      note: pillNote(r.effect),
      activatable: r.effect.type === 'timedQiMult',
    })),
)

const activePillName = computed(() => {
  const active = alchemy.activePill
  if (!active) return ''
  return recipes.find((r) => r.key === active.key)?.name ?? ''
})

function onChoose(key: ProfessionKey): void {
  if (!confirm(`Take up ${key} as your profession? This is a permanent choice for this life.`)) return
  alchemy.chooseProfession(key)
}

function costEntries(cost: Readonly<Partial<Record<MaterialKey, number>>>) {
  return (Object.entries(cost) as [MaterialKey, number][]).map(([key, amount]) => ({
    key,
    amount,
    name: materials.find((m) => m.key === key)?.name ?? key,
    held: alchemy.materialCount(key),
  }))
}
</script>

<template>
  <div class="alchemy-tab">
    <section v-if="!alchemy.isRevealed()" class="panel">
      <h3>Alchemy</h3>
      <p class="dormant">The cauldron sits cold. Forge a core to open a profession.</p>
    </section>

    <template v-else>
      <!-- Pre-choice: the Act I profession slot. -->
      <section v-if="!alchemy.professionChosen" class="panel">
        <h3>Choose a Profession</h3>
        <p class="pick-prompt">
          The Act I slot opens with your forged core. This is a permanent choice for this life.
        </p>
        <div class="slot-grid">
          <button
            v-for="slot in professionSlots"
            :key="slot.key"
            class="slot-card"
            :class="{ sealed: !slot.pickable }"
            :disabled="!slot.pickable"
            @click="slot.pickable && onChoose(slot.key)"
          >
            <span class="slot-name">{{ slot.name }}</span>
            <span class="slot-blurb">{{ slot.blurb }}</span>
            <span v-if="!slot.pickable" class="slot-seal">Opens in a later act</span>
          </button>
        </div>
      </section>

      <!-- Post-choice: inventory, recipes, held pills. -->
      <template v-else>
        <section class="panel">
          <h3>Materials</h3>
          <div v-if="materials.length === 0" class="dormant">No materials known.</div>
          <div v-for="mat in materials" :key="mat.key" class="material-row">
            <span class="material-name">{{ mat.name }}</span>
            <span class="material-source">{{ mat.sourceHint }}</span>
            <span class="material-count">{{ alchemy.materialCount(mat.key) }}</span>
          </div>
        </section>

        <section class="panel">
          <h3>Recipes</h3>
          <div v-if="unlockedRecipes.length === 0" class="dormant">
            No recipes learned yet — climb further to unlock them.
          </div>
          <div v-for="recipe in unlockedRecipes" :key="recipe.key" class="recipe-card">
            <div class="recipe-head">
              <span class="recipe-name">{{ recipe.name }}</span>
              <span class="recipe-held">held: {{ alchemy.pillCount(recipe.key) }}</span>
            </div>
            <p class="recipe-desc">{{ recipe.description }}</p>
            <div class="recipe-cost">
              <span
                v-for="c in costEntries(recipe.cost)"
                :key="c.key"
                class="cost-chip"
                :class="{ short: c.held < c.amount }"
              >
                {{ c.name }} {{ c.held }}/{{ c.amount }}
              </span>
            </div>
            <button :disabled="!alchemy.canCraft(recipe.key)" @click="alchemy.craft(recipe.key)">
              Craft
            </button>
          </div>
          <div v-for="recipe in lockedRecipes" :key="recipe.key" class="recipe-locked">
            <span class="lock-name">{{ recipe.name }}</span>
            <span class="lock-hint">Not yet learned.</span>
          </div>
        </section>

        <section class="panel">
          <h3>Pills Held</h3>
          <div v-if="alchemy.activePill" class="active-pill">
            <span class="active-name">{{ activePillName }} active</span>
            <span class="active-time">{{ formatTime(alchemy.activePill.remaining) }} left</span>
          </div>
          <div v-if="heldPills.length === 0" class="dormant">No pills in hand.</div>
          <div v-for="{ recipe, count, note, activatable } in heldPills" :key="recipe.key" class="held-row">
            <div class="held-info">
              <span class="held-name">{{ recipe.name }} ×{{ count }}</span>
              <span class="held-note">{{ note }}</span>
            </div>
            <button v-if="activatable" @click="alchemy.activatePill(recipe.key)">Swallow</button>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.alchemy-tab { display: flex; flex-direction: column; gap: 1rem; }
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
.panel h3 { margin: 0 0 0.5rem 0; color: #b98adf; }
.dormant { color: #888; font-size: 0.85rem; }
.pick-prompt { color: #aaa; font-size: 0.9rem; margin-bottom: 0.75rem; }
.slot-grid { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.slot-card { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.6rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; cursor: pointer; min-width: 180px; text-align: left; font-family: inherit; color: #dfdfdf; }
.slot-card:hover:not(:disabled) { background: #3a3a3a; border-color: #b98adf; }
.slot-card.sealed { opacity: 0.45; cursor: not-allowed; }
.slot-name { font-weight: bold; color: #b98adf; }
.slot-blurb { font-size: 0.8rem; color: #aaa; }
.slot-seal { font-size: 0.75rem; color: #777; font-style: italic; }
.material-row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; padding: 0.2rem 0; font-size: 0.9rem; }
.material-name { color: #dfdfdf; font-weight: bold; }
.material-source { color: #888; font-size: 0.8rem; flex: 1; }
.material-count { color: #5fc9e0; font-variant-numeric: tabular-nums; }
.recipe-card { border-top: 1px solid #333; padding: 0.6rem 0; }
.recipe-card:first-of-type { border-top: none; }
.recipe-head { display: flex; justify-content: space-between; align-items: baseline; }
.recipe-name { font-weight: bold; color: #b98adf; }
.recipe-held { color: #888; font-size: 0.8rem; }
.recipe-desc { color: #aaa; font-size: 0.85rem; margin: 0.3rem 0; }
.recipe-cost { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.cost-chip { font-size: 0.8rem; padding: 0.15rem 0.4rem; background: #222; border: 1px solid #444; border-radius: 3px; color: #cfcfcf; font-variant-numeric: tabular-nums; }
.cost-chip.short { color: #d88; border-color: #663333; }
.recipe-locked { display: flex; justify-content: space-between; padding: 0.2rem 0; opacity: 0.5; font-size: 0.85rem; }
.lock-name { color: #aaa; }
.lock-hint { color: #777; font-size: 0.8rem; font-style: italic; }
.active-pill { display: flex; justify-content: space-between; padding: 0.3rem 0.5rem; margin-bottom: 0.5rem; background: #241a2e; border: 1px solid #4a3560; border-radius: 4px; font-size: 0.85rem; }
.active-name { color: #b98adf; font-weight: bold; }
.active-time { color: #5fc9e0; font-variant-numeric: tabular-nums; }
.held-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.4rem 0; }
.held-info { display: flex; flex-direction: column; gap: 0.15rem; }
.held-name { font-weight: bold; color: #dfdfdf; }
.held-note { color: #888; font-size: 0.8rem; }
button { font-family: inherit; font-size: 0.9rem; padding: 0.4rem 0.8rem; background: #2a2a2a; color: #dfdfdf; border: 1px solid #444; border-radius: 4px; cursor: pointer; white-space: nowrap; }
button:hover:not(:disabled) { background: #3a3a3a; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
