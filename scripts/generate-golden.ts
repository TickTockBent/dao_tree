// scripts/generate-golden.ts — golden-save fixture generator.
//
// Usage: npx tsx scripts/generate-golden.ts <version> > src/save/goldens/<version>.json
//
// Boots the full store stack headlessly (bootTestStores, same wiring as the
// app), drives a DETERMINISTIC scripted progression through the real store
// APIs to a representative mid/late-Act-I state, then prints the fixture JSON
// (format: src/save/goldens/README.md) to stdout. Run this against HEAD right
// before tagging a release; for backfills, copy it into a worktree at the tag
// and adapt to that tag's store APIs.
//
// The progression script is:
//   - deterministic — no Date.now/Math.random feeds anything captured. The
//     save's time stamp is wall-clock (unavoidable, excluded from `expect`s),
//     and the forge crack roll only exists on the Steady path at crackChance 0
//     (the roll can never change the outcome). Everything else is analytic:
//     Qi advances by qiPerSecond × dt, systems tick in the harness order.
//   - representative — every 0.4.x slice is exercised: q/f climbed with
//     milestones, meridians + temper bought, sect joined with contribution,
//     lattice Seeds, a rushed Flawed breakthrough (heart-demon corruption),
//     the forge set-piece (Steady, then refined to the Foundation ceiling),
//     a secret-realm clear, a crafted pill, seclusion rungs, and the 'ach'
//     slice latched.
//   - cheap — event-stepped like src/sim/pacing.ts (analytic dt between
//     decisions, ticked in bounded chunks), so it runs in seconds.

import Decimal from 'break_eternity.js'
import { bootTestStores } from '@/test-setup'
import { exportSave, SAVE_VERSION } from '@/engine/save'
import { useGameStore } from '@/stores/game'
import { useBodyStore } from '@/stores/body'
import { useDaoStore } from '@/stores/dao'
import { useSectStore } from '@/stores/sect'
import { useGateStore } from '@/stores/gate'
import { useRealmStore } from '@/stores/realm'
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
import { findRealm } from '@/data/realms'
import { findSeclusionRung } from '@/data/seclusion'
import { findSecretRealmSite } from '@/data/secret-realm'
import type { BodyBuyableKey, LatticeNodeKey, RealmId } from '@/engine/types'

// ---- Fixture shape (mirrors golden-saves.test.ts) ---------------------------

interface GoldenExpect {
  path: string
  gte?: number
  equals?: unknown
}

interface GoldenFixture {
  version: string
  note: string
  save: Record<string, unknown>
  expect: GoldenExpect[]
}

// ---- Drive constants (script policy, not game data) -------------------------

/** Re-sample rates + tick systems at least this often across a wait. */
const MAX_EVENT_STEP_SECONDS = 600
/** Loud-failure cap for every drive loop (a stall is a script bug). */
const ITERATION_GUARD = 5000

// Progression targets (data-derived where the data names them).
const Q_SIXTH_LEVEL_AT = findRealm('q').substages.find((s) => s.label === '6th Level')!.at
const F_GREAT_CIRCLE_AT = findRealm('f').substages.find((s) => s.label === 'Great Circle')!.at
const C_TOP_SUBSTAGE_AT = findRealm('c').substages[findRealm('c').substages.length - 1]!.at
const MERIDIAN_TARGET = 12
const TEMPER_TARGET = 20 // Marrow
const F_UNLOCK_MERIDIANS = 4
const SECT_ARCHETYPE = 'azureSword' as const
const EXPEDITION_SITE = 'verdantHollow' as const

// ---- Tick + advance helpers -------------------------------------------------

/** Tick every registered system, mirroring main.ts's updater order (the same
 * order golden-saves.test.ts uses). Automation's reverse-pass `automate` is
 * deliberately NOT run — the harness doesn't run it either, and auto-prestige
 * would perturb the scripted state. */
function tickSystems(diffSeconds: number): void {
  useBodyStore().update(diffSeconds)
  useDaoStore().update(diffSeconds)
  useSectStore().update(diffSeconds)
  useGateStore().update(diffSeconds)
  useRealmStore().update(diffSeconds)
  useForgeStore().update(diffSeconds)
  useTribulationStore().update(diffSeconds)
  useScarStore().update(diffSeconds)
  useLegacyStore().update(diffSeconds)
  useJournalStore().update(diffSeconds)
  useHintsStore().update(diffSeconds)
  useAutomationStore().update(diffSeconds)
  useSecretRealmStore().update(diffSeconds)
  useAlchemyStore().update(diffSeconds)
  useHeartDemonsStore().update(diffSeconds)
  useAchievementsStore().update(diffSeconds)
}

/** Advance Qi analytically to a target, ticking systems in bounded chunks
 * (the pacing sim's advanceToQiTicking shape). timePlayed advances with it. */
function advanceToQi(targetQi: Decimal): void {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  let guard = 0
  while (game.points.lt(targetQi)) {
    const qiPerSecond = pipelines.qiPerSecond
    if (qiPerSecond.lte(0)) throw new Error('advanceToQi: Qi/sec stalled at zero')
    const remainingSeconds = targetQi.sub(game.points).div(qiPerSecond).toNumber()
    const dt = Math.min(remainingSeconds, MAX_EVENT_STEP_SECONDS)
    if (dt >= remainingSeconds) {
      game.points = targetQi
    } else {
      game.points = game.points.add(qiPerSecond.times(dt))
    }
    game.timePlayed = game.timePlayed + dt
    tickSystems(dt)
    if (++guard > ITERATION_GUARD) throw new Error('advanceToQi exceeded iteration cap')
  }
}

/** Let time pass (Qi accrues, systems tick) — expedition/refinement clocks. */
function waitSeconds(totalSeconds: number): void {
  const game = useGameStore()
  const pipelines = usePipelinesStore()
  let elapsed = 0
  while (elapsed < totalSeconds) {
    const dt = Math.min(MAX_EVENT_STEP_SECONDS, totalSeconds - elapsed)
    game.points = game.points.add(pipelines.qiPerSecond.times(dt))
    game.timePlayed = game.timePlayed + dt
    tickSystems(dt)
    elapsed += dt
  }
}

/** Qi needed for a single prestige to land `gain` points (the nextAt()
 * inversion, same formula the pacing sim uses; no pills are held here so the
 * alchemy aid factor is identity). */
function qiForGain(realmId: RealmId, gain: Decimal): Decimal {
  const realmRow = findRealm(realmId)
  let gainMult = new Decimal(1)
  if (realmRow.graded) {
    const body = useBodyStore()
    const band = body.foundationGrade >= 0 ? realmRow.grade!.bands[body.foundationGrade] : undefined
    if (band) gainMult = gainMult.times(band.fMult)
  }
  return gain.div(gainMult).root(realmRow.gainExp).times(realmRow.reqBase).max(realmRow.reqBase).ceil()
}

/** Climb a realm to a target best with banked prestiges (real realm.prestige
 * calls — cascades, keep rules, and milestones all fire authentically). */
function climbRealmTo(realmId: RealmId, targetBest: number): void {
  const realm = useRealmStore()
  let guard = 0
  while (realm.realmBest(realmId).toNumber() < targetBest) {
    const bankedPoints = new Decimal(realm.stateOf(realmId).points)
    const gainNeeded = new Decimal(targetBest).sub(bankedPoints).max(1)
    advanceToQi(qiForGain(realmId, gainNeeded))
    realm.prestige(realmId)
    if (++guard > ITERATION_GUARD) throw new Error(`climbRealmTo('${realmId}') exceeded iteration cap`)
  }
}

/** Prestige a realm once at its base requirement (minimum-gain breakthrough). */
function prestigeAtBase(realmId: RealmId): void {
  advanceToQi(new Decimal(findRealm(realmId).reqBase))
  useRealmStore().prestige(realmId)
}

/** Buy a body buyable up to a target count, advancing Qi to each cost. */
function buyBodyBuyableTo(key: BodyBuyableKey, targetAmount: number): void {
  const body = useBodyStore()
  while (body.buyableAmount(key) < targetAmount) {
    advanceToQi(body.buyableCost(key, body.buyableAmount(key)))
    if (!body.buyBuyable(key)) throw new Error(`buyBodyBuyableTo('${key}') refused a purchase`)
  }
}

/** Buy a lattice node up to a tier, waiting on the Insight trickle if short. */
function buyLatticeNodeTo(key: LatticeNodeKey, targetTier: number): void {
  const dao = useDaoStore()
  let guard = 0
  while (dao.nodeTierOwned(key) < targetTier) {
    if (dao.canAffordNode(key)) {
      if (!dao.buyNodeTier(key)) throw new Error(`buyLatticeNodeTo('${key}') refused a purchase`)
      continue
    }
    waitSeconds(60) // Insight trickles passively once the lattice is revealed
    if (++guard > ITERATION_GUARD) throw new Error(`buyLatticeNodeTo('${key}') exceeded iteration cap`)
  }
}

/** Purchase a seclusion rung (Qi-only cost by invariant §6.6). */
function purchaseSeclusionRung(realmId: RealmId): void {
  const seclusion = useSeclusionStore()
  advanceToQi(new Decimal(findSeclusionRung(realmId).qiCost))
  if (!seclusion.purchase(realmId)) throw new Error(`seclusion rung '${realmId}' purchase refused`)
}

// ---- The scripted progression ------------------------------------------------

/** Drive a fresh save to a representative mid/late-Act-I state. */
function runProgression(): void {
  const realm = useRealmStore()
  const sect = useSectStore()
  const forge = useForgeStore()
  const body = useBodyStore()
  const alchemy = useAlchemyStore()
  const secretRealm = useSecretRealmStore()
  const heartDemons = useHeartDemonsStore()

  // Phase 1 — Qi Condensation: 4 meridians (the f unlock gate), then climb q
  // to 6th Level. The sect reveals at 2nd Level; join as soon as it has.
  buyBodyBuyableTo('primaryMeridian', F_UNLOCK_MERIDIANS)
  climbRealmTo('q', Q_SIXTH_LEVEL_AT)
  if (!sect.joined && sect.isRevealGateMet()) sect.joinSect(SECT_ARCHETYPE)
  if (!sect.joined) throw new Error('sect join failed — reveal gate unmet at q 6th Level')

  // Phase 2 — a RUSHED first Foundation breakthrough: 4 meridians, no temper
  // → Flawed band → heart-demon corruption through the real onGradedPrestige
  // hook. The corruption bleeds back down across the rest of the run (0.02/s
  // orthodox bleed), but the `touched` latch is permanent.
  prestigeAtBase('f')
  if (!heartDemons.touched || heartDemons.corruption <= 0) {
    throw new Error('rushed Foundation breakthrough added no corruption')
  }

  // Phase 3 — Heaven-grade prep, then the real Foundation. Meridians to 12 and
  // temper to Marrow BEFORE the graded prestige; re-climb q (the rushed f
  // prestige cascade-wiped it) so the grade score's realm term is full. The
  // cheap base prestige stores the Heaven band; the chunked climb to Great
  // Circle then runs at its ×3.5 f-gain.
  buyBodyBuyableTo('primaryMeridian', MERIDIAN_TARGET)
  buyBodyBuyableTo('temper', TEMPER_TARGET)
  climbRealmTo('q', Q_SIXTH_LEVEL_AT)
  prestigeAtBase('f')
  climbRealmTo('f', F_GREAT_CIRCLE_AT)

  // Phase 4 — the forge set-piece: Steady push (crackChance 0 — deterministic),
  // then warm the refinement bar to the Foundation ceiling (upper → perfect,
  // one 100-unit bar at 1/sec).
  const producedCoreGradeIndex = forge.performForge('steady')
  if (producedCoreGradeIndex < 0) throw new Error('forge unavailable — availability gate unmet')
  forge.toggleWarming()
  waitSeconds(150)
  if (body.coreGrade !== forge.coreCeilingGradeIndex) {
    throw new Error('refinement did not reach the Foundation ceiling')
  }

  // Phase 5 — profession + secret realm + alchemy. The forged core reveals
  // both; run one Verdant Hollow expedition (the only unlocked site, so it is
  // always the active rotation) and craft a Qi-Gathering Pill from its herbs.
  if (!alchemy.chooseProfession('alchemy')) throw new Error('profession pick refused')
  if (!secretRealm.enter(EXPEDITION_SITE)) throw new Error('expedition entry refused')
  waitSeconds(findSecretRealmSite(EXPEDITION_SITE).durationSeconds)
  if (secretRealm.clearsOf(EXPEDITION_SITE) < 1) throw new Error('expedition did not resolve')
  if (!alchemy.craft('gatheringPill')) throw new Error('gathering pill craft refused')

  // Phase 6 — Dao lattice: Metal Root to Seed + a Sword Intent Glimpse
  // (azureSword's element, so the sect lattice discount is live).
  buyLatticeNodeTo('metal', 2)
  buyLatticeNodeTo('sword', 1)

  // Phase 7 — Core Formation to Core Tempered, then restore the lower spine
  // (each c prestige cascade-wipes f and q; order matters — f re-climbs first
  // because an f prestige re-wipes q).
  while (realm.realmBest('c').toNumber() < C_TOP_SUBSTAGE_AT) prestigeAtBase('c')
  climbRealmTo('f', F_GREAT_CIRCLE_AT)
  climbRealmTo('q', Q_SIXTH_LEVEL_AT)

  // Phase 8 — seclusion: the first two Deep Meditation rungs.
  purchaseSeclusionRung('q')
  purchaseSeclusionRung('f')

  // Final latch pass (achievements, journal, milestones) before serializing.
  tickSystems(1)
}

// ---- Expect derivation + self-verification -----------------------------------

/** The fixture's assertions, derived from the driven state above. Only fields
 * that are stable under the harness's post-load ticking (nothing that bleeds,
 * expires, or is wall-clock). */
function buildExpectBlock(): GoldenExpect[] {
  return [
    { path: 'realms.q.best', gte: Q_SIXTH_LEVEL_AT },
    { path: 'realms.f.best', gte: F_GREAT_CIRCLE_AT },
    { path: 'realms.c.best', gte: C_TOP_SUBSTAGE_AT },
    { path: 'b.primaryMeridians', equals: MERIDIAN_TARGET },
    { path: 'b.temperLevel', equals: TEMPER_TARGET },
    { path: 'b.coreGrade', equals: 4 }, // perfect — refined to the Heaven-grade ceiling
    { path: 'sect.archetype', equals: SECT_ARCHETYPE },
    { path: 'sect.best', gte: 250 }, // past the stipend milestone
    { path: 'dao.nodeTiers.metal', equals: 2 }, // Metal Root at Seed
    { path: 'secret.clears.verdantHollow', gte: 1 },
    { path: 'alchemy.profession', equals: 'alchemy' },
    { path: 'alchemy.pills.gatheringPill', gte: 1 },
    { path: 'seclusion.purchased.0', equals: 'q' },
    { path: 'demons.touched', equals: true }, // corruption happened (then bled)
    { path: 'ach.earned.length', gte: 3 },
  ]
}

/** Resolve a dotted path against an object (the harness's getPath). */
function getPath(obj: unknown, path: string): unknown {
  let cursor: unknown = obj
  for (const segment of path.split('.')) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}

/** Fail loudly if an emitted expect would not hold — never ship a dead fixture. */
function verifyExpectBlock(save: Record<string, unknown>, checks: GoldenExpect[]): void {
  for (const check of checks) {
    const value = getPath(save, check.path)
    if (check.gte !== undefined && !new Decimal(String(value)).gte(check.gte)) {
      throw new Error(`expect failed: ${check.path} = ${String(value)} should be >= ${check.gte}`)
    }
    if (check.equals !== undefined && JSON.stringify(value) !== JSON.stringify(check.equals)) {
      throw new Error(
        `expect failed: ${check.path} = ${JSON.stringify(value)} should equal ${JSON.stringify(check.equals)}`,
      )
    }
  }
}

// ---- Main ---------------------------------------------------------------------

function main(): void {
  const version = process.argv[2]
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Usage: npx tsx scripts/generate-golden.ts <x.y.z>')
    process.exit(1)
  }

  bootTestStores()
  runProgression()

  // Serialize through the real export path (Decimals → strings), then decode
  // back to the raw JSON object — the exact shape writeSave persists.
  const game = useGameStore()
  const serializedSave = JSON.parse(
    decodeURIComponent(escape(atob(exportSave(game.buildSave())))),
  ) as Record<string, unknown>
  // buildSave stamps both, but the fixture contract requires them — enforce.
  serializedSave.versionType = 'dao-tree'
  serializedSave.saveVersion = SAVE_VERSION

  const expectBlock = buildExpectBlock()
  verifyExpectBlock(serializedSave, expectBlock)

  const fixture: GoldenFixture = {
    version,
    note:
      'Mid/late Act I: Heaven-grade Foundation, perfect core (Steady forge + refined), Core Tempered, ' +
      'azureSword sect, Metal Seed + Sword Glimpse, one Verdant Hollow clear, a crafted gathering pill, ' +
      'two seclusion rungs, corruption touched by a rushed Flawed breakthrough.',
    save: serializedSave,
    expect: expectBlock,
  }

  process.stdout.write(JSON.stringify(fixture, null, 2) + '\n')
}

main()
