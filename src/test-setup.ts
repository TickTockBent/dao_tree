// src/test-setup.ts — test helper that wires stores like main.ts (without Vue/loop).

import { setActivePinia, createPinia } from 'pinia'
import { registerDecimalPaths } from '@/engine/save'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { useGateStore } from '@/stores/gate'
import { useForgeStore } from '@/stores/forge'
import { useTribulationStore } from '@/stores/tribulation'
import { useScarStore } from '@/stores/scar'
import { useLegacyStore } from '@/stores/legacy'
import { useJournalStore } from '@/stores/journal'
import { useHintsStore } from '@/stores/hints'
import { useAutomationStore } from '@/stores/automation'
import { usePipelinesStore } from '@/stores/pipelines'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { useSeclusionStore } from '@/stores/seclusion'
import { useAchievementsStore } from '@/stores/achievements'
import { useSoulStore } from '@/stores/soul'
import { useSeveringStore } from '@/stores/severing'
import { useRootsStore } from '@/stores/roots'
import { useKarmaStore } from '@/stores/karma'
import { useChronicleStore } from '@/stores/chronicle'

/** Boot a fresh Pinia + register all stores (like main.ts, without Vue/loop). */
export function bootTestStores(): void {
  setActivePinia(createPinia())

  const game = useGameStore()
  const body = useBodyStore()
  const realm = useRealmStore()
  const dao = useDaoStore()
  const sect = useSectStore()
  const gate = useGateStore()
  const forge = useForgeStore()
  const trib = useTribulationStore()
  const scar = useScarStore()
  const legacy = useLegacyStore()
  const journal = useJournalStore()
  const hints = useHintsStore()
  const automation = useAutomationStore()
  const pipelines = usePipelinesStore()
  const secretRealm = useSecretRealmStore()
  const alchemy = useAlchemyStore()
  const heartDemons = useHeartDemonsStore()
  const seclusion = useSeclusionStore()
  const achievements = useAchievementsStore()
  const soul = useSoulStore()
  const severing = useSeveringStore()
  const roots = useRootsStore()
  const karma = useKarmaStore()
  const chronicle = useChronicleStore()

  game.registerSliceProvider({ id: 'b', save: body.save, load: body.load, fresh: body.fresh })
  game.registerSliceProvider({ id: 'realms', save: realm.save, load: realm.load, fresh: realm.fresh })
  game.registerSliceProvider({ id: 'dao', save: dao.save, load: dao.load, fresh: dao.fresh })
  game.registerSliceProvider({ id: 'sect', save: sect.save, load: sect.load, fresh: sect.fresh })
  game.registerSliceProvider({ id: 'gate', save: gate.save, load: gate.load, fresh: gate.fresh })
  game.registerSliceProvider({ id: 'forge', save: forge.save, load: forge.load, fresh: forge.fresh })
  game.registerSliceProvider({ id: 'trib', save: trib.save, load: trib.load, fresh: trib.fresh })
  game.registerSliceProvider({ id: 'legacy', save: legacy.save, load: legacy.load, fresh: legacy.fresh })
  game.registerSliceProvider({ id: 'journal', save: journal.save, load: journal.load, fresh: journal.fresh })
  game.registerSliceProvider({ id: 'secret', save: secretRealm.save, load: secretRealm.load, fresh: secretRealm.fresh })
  game.registerSliceProvider({ id: 'alchemy', save: alchemy.save, load: alchemy.load, fresh: alchemy.fresh })
  game.registerSliceProvider({ id: 'demons', save: heartDemons.save, load: heartDemons.load, fresh: heartDemons.fresh })
  game.registerSliceProvider({ id: 'seclusion', save: seclusion.save, load: seclusion.load, fresh: seclusion.fresh })
  game.registerSliceProvider({ id: 'ach', save: achievements.save, load: achievements.load, fresh: achievements.fresh })
  game.registerSliceProvider({ id: 'soul', save: soul.save, load: soul.load, fresh: soul.fresh })
  game.registerSliceProvider({ id: 'severing', save: severing.save, load: severing.load, fresh: severing.fresh })
  game.registerSliceProvider({ id: 'roots', save: roots.save, load: roots.load, fresh: roots.fresh })
  game.registerSliceProvider({ id: 'karma', save: karma.save, load: karma.load, fresh: karma.fresh })
  game.registerSliceProvider({ id: 'chronicle', save: chronicle.save, load: chronicle.load, fresh: chronicle.fresh })

  game.registerUpdater({ id: 'body', update: body.update })
  game.registerUpdater({ id: 'dao', update: dao.update })
  game.registerUpdater({ id: 'sect', update: sect.update })
  game.registerUpdater({ id: 'gate', update: gate.update })
  game.registerUpdater({ id: 'realm', update: realm.update })
  game.registerUpdater({ id: 'forge', update: forge.update })
  game.registerUpdater({ id: 'trib', update: trib.update })
  game.registerUpdater({ id: 'scar', update: scar.update })
  game.registerUpdater({ id: 'legacy', update: legacy.update })
  game.registerUpdater({ id: 'journal', update: journal.update })
  game.registerUpdater({ id: 'hints', update: hints.update })
  game.registerUpdater({ id: 'automation', update: automation.update })
  game.registerUpdater({ id: 'secretRealm', update: secretRealm.update })
  game.registerUpdater({ id: 'alchemy', update: alchemy.update })
  game.registerUpdater({ id: 'heartDemons', update: heartDemons.update })
  game.registerUpdater({ id: 'achievements', update: achievements.update })
  game.registerUpdater({ id: 'severing', update: severing.update })

  game.registerAutomation({ id: 'automation', automate: automation.automate })

  game.setQiPerSecondFn(() => pipelines.qiPerSecond)
  game.setOfflineCapFn(() => seclusion.offlineCapSeconds)

  registerDecimalPaths([
    'realms.q.points', 'realms.q.best', 'realms.q.total',
    'realms.f.points', 'realms.f.best', 'realms.f.total',
    'realms.c.points', 'realms.c.best', 'realms.c.total',
    'realms.n.points', 'realms.n.best', 'realms.n.total',
    'realms.s.points', 'realms.s.best', 'realms.s.total',
    'realms.x.points', 'realms.x.best', 'realms.x.total',
    'dao.insight',
    'sect.contribution', 'sect.best',
    'forge.refinementProgress',
    'trib.tribPool', 'trib.tribPoolMax',
    'legacy.actOneGrade',
  ])
}
