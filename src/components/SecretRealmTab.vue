<!-- src/components/SecretRealmTab.vue — Secret Realm expeditions (slice 7, §6.4).
     SKELETON: replaced wholesale by the slice-7 realm agent. -->
<script setup lang="ts">
import { useSecretRealmStore } from '@/stores/secretRealm'

const secretRealm = useSecretRealmStore()
</script>

<template>
  <div class="panel">
    <h2>Secret Realms</h2>
    <p v-if="!secretRealm.isRevealed()">The world holds its secrets still.</p>
    <p v-else>Expeditions await. (slice 7 in progress)</p>
  </div>
</template>

<style scoped>
.panel { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 1rem; }
</style>
