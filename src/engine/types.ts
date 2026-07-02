// src/engine/types.ts — vocabularies and shared engine types
//
// The closed-set vocabularies referenced across the data tables. These replace
// the implicit string-keyed lookups of the TMT factory with compile-checked
// unions. Any data table that references a realm id, an element, a scope, etc.
// is typed against these unions, so a typo fails at compile time rather than
// being silently ignored at runtime (the §5a scale-bug class).

// ---- Realm + layer registry ------------------------------------------------

/** The five Act I realm layer ids, in climb order. */
export type RealmId = 'q' | 'f' | 'c' | 'n' | 's'

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

/** The 15 Dao lattice node keys (5 roots + 5 ring-2 + 5 ring-2b). */
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

/** Dao lattice tier keys. Slice 3 ships Glimpse + Seed; Manifestation/Law deferred. */
export type LatticeTierKey = 'glimpse' | 'seed'

// ---- Persistence scopes ----------------------------------------------------

export type Scope = 'tree' | 'life' | 'eternal'

/** Tree ids (acts). Currently only Act I. */
export type TreeId = 'act1'

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
export type AutomationKey =
  | 'nascentQiPrestige'
  | 'nascentPrimaryMeridians'
  | 'nascentExtraordinaryMeridians'
  | 'sectFoundationBell'
export type HintKey =
  | 'actComplete'
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

// ---- Set-pieces ------------------------------------------------------------

export type SetpieceKey = 'forge' | 'firstTribulation' | 'scar'
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
