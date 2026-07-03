// src/engine/types.ts — vocabularies and shared engine types
//
// The closed-set vocabularies referenced across the data tables. These replace
// the implicit string-keyed lookups of the TMT factory with compile-checked
// unions. Any data table that references a realm id, an element, a scope, etc.
// is typed against these unions, so a typo fails at compile time rather than
// being silently ignored at runtime (the §5a scale-bug class).

// ---- Realm + layer registry ------------------------------------------------

/** The realm layer ids, in climb order: five Act I realms + Spirit Severing (slice 9, Act II). */
export type RealmId = 'q' | 'f' | 'c' | 'n' | 's' | 'x'

/** Every registered system/layer id (the TREE_DATA.layers registry vocabulary). */
export type LayerId =
  | RealmId
  | 'b' // Body
  | 'gate' // Deeds (story-gate achievements)
  | 'dao' // Dao lattice
  | 'sect' // Sect standing
  | 'journal' // Narrative journal (eternal)
  | 'legacy' // Act I Legacy Grade (eternal)
  | 'secret' // Secret Realm expeditions (slice 7; expedition run-state is locally scoped)
  | 'alchemy' // Alchemy profession (slice 7; the Act I profession slot)
  | 'demons' // Heart Demons + Demon Trials (slice 8; the permanent anti-rush tension)
  | 'seclusion' // Deep Meditation offline-cap rungs (slice 8.5; eternal QoL progression)
  | 'soul' // Soul-scoped accumulators (slice 9; eternal until Samsara differentiates scopes — D23/D25)
  | 'severing' // Spirit Severing active severances (slice 9; life-scoped — severed things return next life)

/** All ids that carry a numeric prestige row in the tree (the climb spine). */
export type RealmLayerId = RealmId

// ---- Secret Realms + professions (slice 7) ---------------------------------

/** The three v1 Secret Realm sites (design §6.4). */
export type SecretRealmSiteKey = 'verdantHollow' | 'invertedSpiritLand' | 'shatteredStarVault'

/** Expedition materials — produced by Secret Realms, consumed by professions (§7.6). */
export type MaterialKey = 'spiritHerb' | 'essenceCrystal' | 'beastCore'

/** The profession slots. Act I opens one; only Alchemy is implemented in v1. */
export type ProfessionKey = 'alchemy' | 'artifice' | 'formations'

/** Alchemy v1 recipe/pill keys (recipe and its product share a key). */
export type PillKey = 'gatheringPill' | 'clarityPill' | 'heavenWardingPill'

// ---- Elements + lattice ----------------------------------------------------

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth'

/**
 * The 25 Dao lattice node keys (5 roots + 5 ring-2 + 5 ring-2b + 10 ring-3,
 * slice 9 / D22 medium lattice). Ring-3 extends each ring-2/ring-2b node with
 * one Manifestation-flavored successor per element branch.
 */
export type LatticeNodeKey =
  | 'metal'
  | 'wood'
  | 'water'
  | 'fire'
  | 'earth'
  | 'sword'
  | 'growth'
  | 'flow'
  | 'life'
  | 'mountain'
  | 'edge'
  | 'vitality'
  | 'stillness'
  | 'death'
  | 'endurance'
  // --- Ring 3 (slice 9 / D22): one successor per ring-2 node ---
  | 'severingIntent'
  | 'blossoming'
  | 'riverOfTime'
  | 'undying'
  | 'unmovable'
  // --- Ring 3 (slice 9 / D22): one successor per ring-2b node ---
  | 'soulBlade'
  | 'evergreen'
  | 'eternalStillness'
  | 'rebirth'
  | 'boundless'

/**
 * Dao lattice tier keys. Slice 3 shipped Glimpse + Seed; slice 9 (D22) adds
 * Manifestation — the new severable-grade power (gated behind the passed
 * tribulation, enforced in the dao store's buy path). Law is Act III realm
 * content, not a lattice tier (D22).
 */
export type LatticeTierKey = 'glimpse' | 'seed' | 'manifestation'

// ---- Persistence scopes ----------------------------------------------------

export type Scope = 'tree' | 'life' | 'eternal'

/** Tree ids (acts). Act II opens with Spirit Severing (slice 9). */
export type TreeId = 'act1' | 'act2'

// ---- Accumulators + severing (slice 9) --------------------------------------

/** Typed-accumulator instance keys (docs/architecture.md; both soul-scoped). */
export type AccumulatorKey = 'ascentCounter' | 'severanceRitual'

/**
 * The v1 severable list (D25): real build pieces with a legible, isolatable
 * effect domain. Stance dropped to v2 (probe inversion — no weakness window).
 */
export type SeverableKey =
  | 'soulAspect'
  | 'profession'
  | 'extraordinaryMeridians'
  | 'manifestation'
  | 'flowingForm'

/** The three corpses (canonical three attachments), severed in order. */
export type CorpseKey = 'past' | 'present' | 'future'

// ---- Body / temper ---------------------------------------------------------

export type TemperTierKey = 'skin' | 'flesh' | 'tendon' | 'bone' | 'marrow'

/** Body buyable keys. */
export type BodyBuyableKey = 'primaryMeridian' | 'extraordinaryMeridian' | 'temper'

// ---- Grades ----------------------------------------------------------------

export type CoreGradeKey = 'cracked' | 'lower' | 'middle' | 'upper' | 'perfect'
export type TribGradeKey = 'failed' | 'shaken' | 'scarred' | 'flawless'
export type FoundationBandTier = 'Flawed' | 'Stable' | 'Solid' | 'Heaven-grade'
export type LegacyBandKey = 'faint' | 'steady' | 'radiant' | 'eternal'

// ---- Soul aspect -----------------------------------------------------------

export type SoulAspectKey =
  | 'formless'
  | 'metalSoul'
  | 'woodSoul'
  | 'waterSoul'
  | 'fireSoul'
  | 'earthSoul'

// ---- Stances ---------------------------------------------------------------

export type StanceKey = 'breathingTrance' | 'swordTrance'

// ---- Sect ------------------------------------------------------------------

export type SectArchetypeKey = 'azureSword' | 'stoneFormation'
export type SectMilestoneKey = 'stipend' | 'library' | 'arsenal'
export type TechniqueSchool = 'sword' | 'formation' | 'universal'
export type TechniqueKey =
  | 'azureForm'
  | 'severingArc'
  | 'swordHeart'
  | 'stoneSkin'
  | 'wardLattice'
  | 'mountainHeart'
  | 'breathCanon'
  | 'stillMind'

// ---- Gates / journal / keep / automation -----------------------------------

export type GateAchievementKey = 'outerDisciple' | 'innerDisciple'
export type KeepRuleKey =
  | 'qiInsightSurvivesFoundation'
  | 'foundationSurvivesNascentSoul'
  | 'soulCarriesTheClimb'
/**
 * Slice 9 §5 — CROSS_TREE_KEEPS row keys (src/data/trees.ts). Each key names
 * one declared Act I → Act II read; a future Act II addition that reads Act I
 * (or pre-existing life-scoped) state adds a member here alongside its row.
 */
export type CrossTreeKeepKey =
  | 'realmXTribulationGate'
  | 'daoManifestationGate'
  | 'journalActTwoOpens'
  | 'severingSoulAspectRead'
  | 'severingProfessionRead'
  | 'severingExtraordinaryMeridiansRead'
  | 'severingManifestationRead'
  | 'hintSeverSpiritRead'
  | 'offeringQiCost'
  | 'offeringInsightCost'
  | 'offeringPillDiscount'
  | 'severingFlowingFormRead'
export type AutomationKey =
  | 'nascentQiPrestige'
  | 'nascentPrimaryMeridians'
  | 'nascentExtraordinaryMeridians'
  | 'sectFoundationBell'
export type HintKey =
  | 'actComplete'
  | 'severSpirit' // slice 9: nudge the passed-tribulation player toward Spirit Severing once a Manifestation lands
  | 'faceTribulation'
  | 'faceDemonTrial' // slice 8: a Demon Trial holds the cultivator
  | 'healScar'
  | 'climbSoulFormation'
  | 'chooseAspect'
  | 'climbNascent'
  | 'exploreSecretRealm' // slice 7: nudge toward the Secret Realms once revealed
  | 'warmCore'
  | 'coreComplete'
  | 'chooseForge'
  | 'climbFoundation'
  | 'breakToFoundation'
  | 'openLattice'
  | 'enterTrance'
  | 'joinSect'
  | 'climbQi'
  | 'gatherQi'
export type JournalEntryKey =
  | 'firstBreath'
  | 'firstMeridian'
  | 'foundationReached'
  | 'outerDisciple'
  | 'firstGlimpse'
  | 'coreForged'
  | 'firstExpedition' // slice 7: first Secret Realm expedition clear
  | 'professionChosen' // slice 7: the Act I profession slot is picked
  | 'corruptionTouched' // slice 8: the first heart-demon corruption gained
  | 'firstDaoHeart' // slice 8: first Demon Trial cleared
  | 'deepMeditation' // slice 8.5: the first seclusion rung purchased
  | 'sectJoined'
  | 'nascentSoul'
  | 'aspectChosen'
  | 'lateNascentSoul'
  | 'allMeridians'
  | 'soulFormationEntered'
  | 'tribulationPassed'
  | 'scarTaken'
  | 'scarHealed'
  | 'actOneLegacy'
  | 'actTwoOpens' // slice 9: Act II arrival (tribulationPassed — core meets() grammar)
  | 'firstManifestation' // slice 9: first Dao lattice node reaches Manifestation tier (anyDaoNode: 3)

// ---- Set-pieces ------------------------------------------------------------

export type SetpieceKey = 'forge' | 'firstTribulation' | 'scar' | 'severance'
export type ForgePushKey = 'steady' | 'forceful' | 'reckless'
export type TribWaveKey =
  | 'gale'
  | 'flame'
  | 'frost'
  | 'thunder'
  | 'tribulationLightning'

// ---- Misc ------------------------------------------------------------------

/** A value that may be a Decimal, a number, or a numeric string. */
export type DecimalSource = import('break_eternity.js').default | number | string
