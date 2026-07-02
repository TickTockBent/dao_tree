// src/data/index.ts — barrel export of all 15 data tables.
//
// Single import surface for the engine: `import { REALM_DATA, BODY_DATA, ... } from '@/data'`.
// Each table is the single source of truth for its system's tunable numbers.

export { FACTORY_NUMERICS, type FactoryNumerics } from './constants'
export { REALM_DATA, type RealmRow, type RealmSubstage, type SoulAspectRow, type SoulAspectConfig, type FoundationGradeConfig, type FoundationGradeBand, type FoundationGradeWeights, findRealm, realmWithSetpiece, realmWithSoulAspect, substageIndexForLabel, substageLabelAtBest } from './realms'
export { SETPIECE_DATA, type ForgeConfig, type ForgePushOption, type ForgeRefinementConfig, type ForgeGradeRow, type TribulationConfig, type TribWaveRow, type TribPoolConfig, type TribGradeRow, type TribIntensityConfig, type ScarTable, forgeGradeByKey, tribGradeByKey } from './setpieces'
export { LEGACY_DATA, type LegacyConfig, type LegacyActOneConfig, type LegacyWeights, type LegacyDenominators, type LegacyBand, legacyBandByKey } from './legacy'
export { BODY_DATA, type BodyConfig, type BodyBuyableRow, type TemperTierRow, type BodyQiConfig, type BodyGradeSlotConfig, findBodyBuyable, temperTierByKey, temperTierForLevel } from './body'
export { GATE_DATA, type GateData, type GateAchievement, gateAchievementId } from './gates'
export { TREE_DATA, type TreeData, type TreeRow, type LayerScopeEntry } from './trees'
export { KEEP_RULES, type KeepRule } from './keep-rules'
export { LATTICE_DATA, type LatticeConfig, type LatticeNodeRow, type LatticeNodeEffect, type LatticeTierRow, findLatticeNode, latticeRoots } from './lattice'
export { STANCE_DATA, type StanceData, type StanceRow, type StanceModifiers, findStance } from './stances'
export { HINT_DATA, type HintData, type HintRow, type ConditionalHintRow, type CatchAllHintRow } from './hints'
export { AUTOMATION_DATA, type AutomationRow, type Automates, type AutomatesPrestige, type AutomatesBuyable, type MaturityConfig, findAutomation } from './automation'
export { SECT_DATA, type SectConfig, type SectArchetype, type SectMilestone, type SectMilestoneReward, type SectContributionConfig, findSectArchetype, sectMilestoneIndex } from './sect'
export { TECHNIQUE_DATA, type TechniqueRow, type TechniqueEffect, findTechnique, techniqueIndex } from './techniques'
export { JOURNAL_DATA, type JournalData, type JournalEntry, type JournalBonus, findJournalEntry } from './journal'
export { SECRET_REALM_DATA, type SecretRealmData, type SecretRealmSite, type SecretRealmModifier, type SecretRealmRewards, type EssenceModel, findSecretRealmSite } from './secret-realm'
export { ALCHEMY_DATA, type AlchemyData, type RecipeRow, type MaterialRow, type PillEffect, findRecipe } from './alchemy'
export { HEART_DEMON_DATA, type HeartDemonData, type DemonTrialRow, type TrialObjective, type HeartDemonTrialKey, findDemonTrial } from './heart-demons'
export { SECLUSION_DATA, type SeclusionData, type SeclusionRung, findSeclusionRung } from './seclusion'
export { ACCUMULATOR_DATA } from './accumulators'
export { SEVERING_DATA, type SeveringData, type CorpseRow, type SeverableRow, findCorpse, findSeverable } from './severing'
