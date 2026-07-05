// src/engine/karmaEvents.ts — the LIVE karma recording seam (slice 10 step 4).
//
// The karma firsts table (data/karma.ts) and the karma store (stores/karma.ts)
// ship the receipt math; this module is the thin bridge that fires recordFirst
// at the real game events, resolving each first's QUALIFIER TUPLE at EVENT TIME
// (D40) — buildMark derived from the live investment snapshot at the moment the
// event lands (finer than the sim's life-end snapshot), rootShape 'rootless'
// (until roots ship, step 5), realmEra the current climb era.
//
// READERLESS BY CONSTRUCTION: every function here only READS non-karma stores
// and WRITES the karma store. Nothing reads karma back into qi/insight/pacing,
// so these calls firing inside the live stores (which the sim exercises) move
// not a single measured byte — the sim's own DYNASTY KARMA settlement reloads a
// fresh ledger before recording its analytic firsts, discarding whatever the
// live run recorded here.
//
// All store lookups are DEFERRED (called inside functions, never at module
// load) so importing this module from a store never closes an import cycle —
// the same idiom realm.ts uses for its cross-store reads.

import { useKarmaStore } from '@/stores/karma'
import { useBodyStore } from '@/stores/body'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { useAlchemyStore } from '@/stores/alchemy'
import { useRealmStore } from '@/stores/realm'
import { deriveBuildMark, type BuildInvestment } from '@/data/karma'
import { LATTICE_DATA } from '@/data/lattice'
import { ALCHEMY_DATA } from '@/data/alchemy'
import type { ResolvedQualifiers } from '@/stores/karma'
import type { RealmId } from '@/engine/types'

/** rootShape is the only vocabulary value pre-roots (step 5 populates the rest). */
const ROOTLESS = 'rootless'

/** The five climb realms, low → high, for resolving the current era. */
const REALM_CLIMB_ORDER: readonly RealmId[] = ['q', 'f', 'c', 'n', 's', 'x']

/**
 * The live build-investment snapshot at the calling instant. Mirrors EXACTLY
 * the shape the sim adapter measures (pacing.ts deriveLifeKarmaFirsts) so the
 * live event-time buildMark and the sim's life-end buildMark use one rule.
 */
function liveBuildInvestment(): BuildInvestment {
  const body = useBodyStore()
  const dao = useDaoStore()
  const sect = useSectStore()
  const alchemy = useAlchemyStore()
  return {
    meridians: body.primaryMeridians + body.extraordinaryMeridians,
    latticeNodes: LATTICE_DATA.nodes.filter((node) => dao.nodeTierOwned(node.key) >= 1).length,
    sectMilestones: sect.milestones.length,
    pillsBrewed: ALCHEMY_DATA.recipes.reduce((sum, recipe) => sum + alchemy.pillCount(recipe.key), 0),
  }
}

/** The milestone qualifier tuple resolved at event time: rootShape + buildMark. */
function liveMilestoneQualifiers(): ResolvedQualifiers {
  return { rootShape: ROOTLESS, buildMark: deriveBuildMark(liveBuildInvestment()) }
}

/** The current realm era: the highest unlocked climb realm at event time. */
export function liveRealmEra(): RealmId {
  const realm = useRealmStore()
  let era: RealmId = 'q'
  for (const id of REALM_CLIMB_ORDER) if (realm.isUnlocked(id)) era = id
  return era
}

/**
 * Record a milestone first (rootShape + buildMark resolved live). Idempotent per
 * life via the store's ledger dedup — safe to call on every latch re-check.
 */
export function recordMilestoneFirst(eventKey: string): void {
  useKarmaStore().recordFirst(eventKey, liveMilestoneQualifiers())
}

/** Record a heart-demon trial endured (deed; realmEra qualifier). */
export function recordTrialDeed(trialKey: string): void {
  useKarmaStore().recordFirst(`endureTrial:${trialKey}`, { realmEra: liveRealmEra() })
}

/** Record a severance performed (deed; headline-only per KARMA_DATA). */
export function recordSeveranceDeed(severableKey: string): void {
  useKarmaStore().recordFirst(`severed:${severableKey}`, {})
}

/** Record a secret-realm site first-clear (encounter; realmEra qualifier). */
export function recordSiteEncounter(siteKey: string): void {
  useKarmaStore().recordFirst(`clearedSite:${siteKey}`, { realmEra: liveRealmEra() })
}

/**
 * Record a grade-delta improvement (pays only on a strict personal best; the
 * store gates and latches on the soul-scoped carried best). `row` is a
 * grade-delta KARMA_DATA key; `gradeIndex` is this life's grade at land time.
 */
export function recordGradeDelta(row: string, gradeIndex: number): void {
  useKarmaStore().recordGradeDelta(row, gradeIndex)
}
