// src/engine/state.ts — builds the pure GameState snapshot for meets().
//
// `meets()` is a pure function over a GameState snapshot (not over store
// globals), so it's testable and headless-runnable. This module builds that
// snapshot by reading from all the system stores. Called whenever meets() is
// evaluated (unlock checks, hint cascade, journal latches) — cheap, just a
// handful of scalar reads.
//
// Circular-import note: this module imports the stores, and the stores import
// `meets` + `buildGameState` for their own unlock checks. ES modules tolerate
// this because all usage is deferred to runtime (inside functions), never at
// module-eval time.

import Decimal from 'break_eternity.js'
import type { GameState } from './meets'
import type { Element, LatticeNodeKey, RealmId, TemperTierKey } from './types'
import { REALM_DATA, substageLabelAtBest, findRealm } from '@/data/realms'
import { LATTICE_DATA } from '@/data/lattice'
import { BODY_DATA, temperTierForLevel } from '@/data/body'
import { SETPIECE_DATA } from '@/data/setpieces'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useRealmStore } from '@/stores/realm'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { useGateStore } from '@/stores/gate'
import { useForgeStore } from '@/stores/forge'
import { useSecretRealmStore } from '@/stores/secretRealm'
import { useAlchemyStore } from '@/stores/alchemy'
import { useHeartDemonsStore } from '@/stores/heartDemons'
import { useSeclusionStore } from '@/stores/seclusion'
import { useTribulationStore } from '@/stores/tribulation'
import { useSoulStore } from '@/stores/soul'

/** Build the GameState snapshot consumed by meets(). */
export function buildGameState(): GameState {
  const game = useGameStore()
  const body = useBodyStore()
  const realm = useRealmStore()
  const dao = useDaoStore()
  const sect = useSectStore()
  const gate = useGateStore()
  const forge = useForgeStore()
  const secretRealm = useSecretRealmStore()
  const alchemy = useAlchemyStore()
  const heartDemons = useHeartDemonsStore()
  const seclusion = useSeclusionStore()
  const tribulation = useTribulationStore()
  const soul = useSoulStore()

  // Realm bests + sub-stage labels + substage thresholds.
  const realmBest = {} as Record<RealmId, Decimal>
  const realmSubstageLabel = {} as Record<RealmId, string | null>
  const realmSubstageThresholds = {} as Record<RealmId, Record<string, number>>
  for (const r of REALM_DATA) {
    const best = realm.realmBest(r.id)
    realmBest[r.id] = best
    realmSubstageLabel[r.id] = substageLabelAtBest(r, best.toNumber())
    const labelMap: Record<string, number> = {}
    for (const s of r.substages) labelMap[s.label] = s.at
    realmSubstageThresholds[r.id] = labelMap
  }

  // Dao node tiers (0/1/2) per node key + element max tiers.
  const daoNodeTier = {} as Record<LatticeNodeKey, number>
  const daoElementMaxTier = {
    metal: 0,
    wood: 0,
    water: 0,
    fire: 0,
    earth: 0,
  } as Record<Element, number>
  let daoAnyNodeMaxTier = 0
  for (const node of LATTICE_DATA.nodes) {
    const tier = dao.nodeTierOwned(node.key)
    daoNodeTier[node.key] = tier
    if (tier > (daoElementMaxTier[node.element] ?? 0)) daoElementMaxTier[node.element] = tier
    if (tier > daoAnyNodeMaxTier) daoAnyNodeMaxTier = tier
  }

  // Temper tier key (current).
  const temperTier: TemperTierKey | null = temperTierForLevel(body.temperLevel)?.key ?? null

  // Core grade index + ceiling.
  const coreGradeIndex = body.coreGrade
  const coreCeilingIndex = forge.coreCeilingGradeIndex

  // Achievements per layer (gate achievements).
  const achievements: Record<string, Set<number>> = {}
  achievements['gate'] = gate.earnedIds

  return {
    qi: game.points,
    primaryMeridians: body.primaryMeridians,
    primaryMeridiansAll: body.primaryMeridians >= BODY_DATA.buyables[0]!.limit,
    temperTier,
    realmBest,
    realmSubstageLabel,
    realmSubstageThresholds,
    daoNodeTier,
    daoElementMaxTier,
    daoAnyNodeMaxTier,
    coreGradeIndex,
    coreCeilingIndex,
    sectJoined: sect.joined,
    contributionBest: sect.contributionBestDecimal,
    achievements,
    secretRealmClears: secretRealm.totalClears,
    professionChosen: alchemy.professionChosen,
    corruption: heartDemons.corruption,
    daoHeartStacks: heartDemons.daoHeartStacks,
    seclusionRungs: seclusion.rungsPurchased,
    tribulationPassed: tribulation.tribulationPassed,
    // Slice 10 / D37: reads soul.rebirths (0 until the step-4 crossing).
    rebirths: soul.rebirths,
    // Slice 10 / D39: reads soul.transcended.length (0 until the third-life cut).
    transcendences: soul.transcended.length,
  }
}

/** Convenience: evaluate a condition against the current game state. */
export function meetsNow(condition: import('./meets').Condition): boolean {
  return meets(condition, buildGameState())
}

// Local import to avoid a cycle at module top-level (meets imports nothing from
// stores; this just re-exports the pure function).
import { meets } from './meets'

/** Realm reached sub-stage count (the small index used by gradeScore + meets). */
export function realmReachedSubstageCount(realmId: RealmId): number {
  const realm = useRealmStore()
  const best = realm.realmBest(realmId).toNumber()
  const r = findRealm(realmId)
  let count = 0
  for (const s of r.substages) {
    if (best >= s.at) count++
    else break
  }
  return count
}

/** Resolve a sub-stage label to its `at` threshold on a realm. */
export function substageThreshold(realmId: RealmId, label: string): number {
  const r = findRealm(realmId)
  const matched = r.substages.find((s) => s.label === label)
  return matched ? matched.at : 0
}

// Re-export Decimal for convenience in stores that need it.
export { Decimal }
export { SETPIECE_DATA }
