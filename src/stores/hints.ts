// src/stores/hints.ts — the first-match-wins hint cascade (design §1.5).
//
// Port of the factory's hintEngine. The hint bar shows the FIRST matching hint
// from HINT_DATA (top-down). Later-game states sit above earlier-game states.
// The final row MUST be unconditional (always: true). Uses the same HintState
// snapshot as the journal store.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { HINT_DATA } from '@/data/hints'
import { evaluateHintCondition, type HintState } from '@/engine/meets'
import { buildGameState } from '@/engine/state'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useSectStore } from '@/stores/sect'
import { useTribulationStore } from '@/stores/tribulation'
import { useScarStore } from '@/stores/scar'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import type { LayerId } from '@/engine/types'

export const useHintsStore = defineStore('hints', () => {
  const body = useBodyStore()
  const realm = useRealmStore()
  const sect = useSectStore()
  const trib = useTribulationStore()
  const scar = useScarStore()
  const secretRealm = useSecretRealmStore()
  const heartDemons = useHeartDemonsStore()

  /** Build the HintState snapshot (shared with the journal store). */
  function buildHintState(): HintState {
    const base = buildGameState()
    const unlockedLayers = new Set<LayerId>(['q'])
    if (realm.isUnlocked('f')) unlockedLayers.add('f')
    if (realm.isUnlocked('c')) unlockedLayers.add('c')
    if (realm.isUnlocked('n')) unlockedLayers.add('n')
    if (realm.isUnlocked('s')) unlockedLayers.add('s')
    if (sect.isRevealed()) unlockedLayers.add('sect' as LayerId)

    return {
      ...base,
      unlockedLayers,
      aspectUnchosen: realm.isUnlocked('n') && !body.soulAspectChosen,
      sectUnjoined: sect.isRevealed() && !sect.joined,
      tribulationReady: trib.tribulationIsReady,
      scarActive: scar.scarIsActive,
      tribulationPassed: trib.tribulationPassed,
      scarHealed: body.scarHealedDepth > 0,
      secretRealmUnexplored: secretRealm.isRevealed() && secretRealm.totalClears === 0,
      demonTrialActive: heartDemons.trialIsActive,
    }
  }

  /** The first matching hint row, or the catch-all. */
  const currentHint = computed(() => {
    const state = buildHintState()
    for (const hint of HINT_DATA.hints) {
      if ('always' in hint && hint.always) return hint
      if ('when' in hint && hint.when) {
        if (evaluateHintCondition(hint.when, state)) return hint
      }
    }
    return HINT_DATA.hints[HINT_DATA.hints.length - 1]!
  })

  /** The current hint's display text. */
  const hintText = computed(() => currentHint.value.text)

  function update(_diff: number): void {
    // Hints are pure computed reads — no per-tick work.
  }

  return { currentHint, hintText, update }
})
