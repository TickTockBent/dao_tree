// js/build/layerFactory.js — the config -> layer factory (spec §11 keystone)
//
// Consumes the plain-JS data globals (FACTORY_NUMERICS, REALM_DATA, BODY_DATA,
// GATE_DATA) and registers TMT layers via addLayer(...). One parameterized path
// per concern (realm / body / buyable / milestone / gate) so wiring is uniform
// and centralized — no per-layer hand assembly that could silently drop a
// multiplier (the reference's root defect, §9.2/§9.5).
//
// HARD RULE (§11): ZERO numeric literals in this file. Every number comes from a
// data row or FACTORY_NUMERICS. The linter (js/build/linter.js) scans this file
// and fails the build on any bare numeric literal.

// ---------------------------------------------------------------------------
// Shared numeric primitives (read from data, never written as literals).
// ---------------------------------------------------------------------------
var FACTORY_ZERO = FACTORY_NUMERICS.zero;
var FACTORY_ONE = FACTORY_NUMERICS.one;
var FACTORY_HUNDRED = FACTORY_NUMERICS.hundred;

function factoryDecimalOne() { return new Decimal(FACTORY_ONE); }
function factoryDecimalZero() { return new Decimal(FACTORY_ZERO); }

// The "tree" persistence scope token (design §8.1). Only tree-scoped layers reset
// via the compiled doReset; life/eternal layers get no doReset (their immunity is
// topological). A string token, not a number — the §11 scan is for numeric literals.
var TREE_SCOPE_TREE = "tree";

// ---------------------------------------------------------------------------
// Data lookups (resolve a realm/body row by id without literals).
// ---------------------------------------------------------------------------
function findRealmData(realmId) {
    return REALM_DATA.find(function (row) { return row.id === realmId; });
}

// Resolve a realm's set-piece config (design §6.2 / slice 6): realmData.setpiece is a
// key into SETPIECE_DATA (the forge config generalized — "forge" instance 1, tribulation
// instance 2). Returns the config object or null when the realm carries no set-piece, so the
// factory's set-piece augmentation keys on realmData.setpiece exactly as it once keyed on the
// inline realmData.forge — same skeleton, the config now lives in one shared table. Defensive
// when SETPIECE_DATA is absent (a data-only harness may not load it) so the lookup never throws.
function setpieceFor(realmData) {
    if (!realmData || !realmData.setpiece) return null;
    if (typeof SETPIECE_DATA === "undefined" || !SETPIECE_DATA) return null;
    return SETPIECE_DATA[realmData.setpiece] || null;
}

// The realm row carrying a given set-piece key (the inverse of setpieceFor). Used to find the
// forge realm / the tribulation realm without hardcoding an id — a realm declares which set-piece
// it mounts, so the factory asks "which realm mounts 'forge'?" rather than assuming "c".
function realmWithSetpiece(setpieceKey) {
    return REALM_DATA.find(function (realmData) { return realmData.setpiece === setpieceKey; }) || null;
}

// Realm node REVEAL condition (§5a): a realm becomes VISIBLE on this (weaker) gate,
// distinct from `unlock` (§5b) which gates the actual breakthrough. Falls back to
// the full unlock when a realm declares no separate reveal, so "6th Level reveals
// Foundation; 4 meridians unlocks it" is expressible purely as data.
function realmRevealCondition(realmData) {
    return realmData.reveal ? realmData.reveal : realmData.unlock;
}

// Plain-language description of an unlock condition for a revealed-but-locked realm
// node tooltip (§5a UX). Every number comes from the condition row (data, §11).
function describeUnlockCondition(condition) {
    var requirementParts = [];
    if (condition.realm !== undefined) {
        var targetRealm = findRealmData(condition.realm[FACTORY_ZERO]);
        var stageToken = condition.realm[FACTORY_ONE];
        var stageText = (typeof stageToken === "string") ? stageToken : (targetRealm.resource + " " + stageToken);
        requirementParts.push("reach " + targetRealm.name + " " + stageText);
    }
    if (condition.meridians !== undefined) {
        requirementParts.push("open " + condition.meridians + " meridians");
    }
    if (condition.primaryMeridiansAll) {
        requirementParts.push("open all primary meridians");
    }
    if (condition.temperTier !== undefined) {
        requirementParts.push("temper your body to " + condition.temperTier);
    }
    if (condition.qi !== undefined) {
        requirementParts.push("gather " + condition.qi + " Qi");
    }
    return requirementParts.join(" and ");
}

function bodyBuyableByKey(key) {
    return BODY_DATA.buyables.find(function (row) { return row.key === key; });
}

// ---------------------------------------------------------------------------
// Tree-scope reset compilation (design §8.1/§8.2). One data-driven decision
// replaces the reference's per-layer reset guards: TREE_DATA declares scope +
// membership, KEEP_RULES declares which keys survive a prestige, and the factory
// compiles a doReset from both. ZERO numeric literals — row comparisons read the
// REALM_DATA `row` field, milestone ids read KEEP_RULES, never bare numbers (§11).
// ---------------------------------------------------------------------------
function treeLayerEntry(layerId) {
    return TREE_DATA.layers[layerId];
}

// Row of a layer, read from its REALM_DATA row field (data, never a literal).
// Side/life layers (Body, gate) have no realm row; they never reset via this path
// and so never need a comparable row.
function layerRow(layerId) {
    var realmData = findRealmData(layerId);
    return realmData ? realmData.row : undefined;
}

// Pure decision: when `resettingLayerId` prestiges, should `thisLayerId` reset, and
// if so with which keep keys? Returns null to mean "do NOT reset this layer"; an
// array (possibly empty) to mean "reset, preserving these player[thisLayerId] keys".
//
// Reset ONLY IF the resetter is tree-scoped, in the SAME tree, and its row is
// STRICTLY greater than this layer's row. rowReset invokes doReset on the resetting
// layer itself and on equal-row siblings, so self and equal/lower rows are no-ops —
// preserving the default cascade byte-for-byte when no keep rule is earned.
function treeResetKeepKeys(thisLayerId, resettingLayerId) {
    var thisEntry = treeLayerEntry(thisLayerId);
    var resetterEntry = treeLayerEntry(resettingLayerId);
    if (!thisEntry || !resetterEntry) return null;

    var treeScope = TREE_SCOPE_TREE;
    if (thisEntry.scope !== treeScope || resetterEntry.scope !== treeScope) return null;
    if (thisEntry.tree !== resetterEntry.tree) return null;

    var resetterRow = layerRow(resettingLayerId);
    var thisLayerRowValue = layerRow(thisLayerId);
    if (resetterRow === undefined || thisLayerRowValue === undefined) return null;
    if (!(resetterRow > thisLayerRowValue)) return null;

    // Collect keep keys from every earned rule targeting this layer on this reset.
    var keepKeys = [];
    KEEP_RULES.forEach(function (rule) {
        if (rule.onResetOf !== resettingLayerId || rule.target !== thisLayerId) return;
        if (!hasMilestone(rule.grantedBy.layer, rule.grantedBy.milestone)) return;
        rule.keep.forEach(function (keyName) { keepKeys.push(keyName); });
    });
    return keepKeys;
}

// Compile the doReset for a tree-scoped layer. Bound to layers[thisLayerId] by
// game.js run(), so `this.layer` is the layer being reset; the argument is the
// resetting layer id. layerDataReset performs the actual reset with the keep array.
function makeTreeDoReset() {
    return function (resettingLayerId) {
        var keepKeys = treeResetKeepKeys(this.layer, resettingLayerId);
        if (keepKeys === null) return;
        layerDataReset(this.layer, keepKeys);
    };
}

// Current temper tier index reached for a given temper level (or -1 / below first).
function temperTierIndexForLevel(temperLevel) {
    var reachedIndex = FACTORY_ZERO - FACTORY_ONE; // sentinel "no tier"
    BODY_DATA.temperTiers.forEach(function (tier, index) {
        if (temperLevel.gte(tier.fromLevel)) reachedIndex = index;
    });
    return reachedIndex;
}

function temperTierIndexByKey(tierKey) {
    var foundIndex = FACTORY_ZERO - FACTORY_ONE;
    BODY_DATA.temperTiers.forEach(function (tier, index) {
        if (tier.key === tierKey || tier.label === tierKey) foundIndex = index;
    });
    return foundIndex;
}

// ---------------------------------------------------------------------------
// Live cross-layer state readers (guarded — layers may not exist yet).
// ---------------------------------------------------------------------------
function bodyLayerId() { return BODY_DATA.id; }

function primaryMeridianRow() { return bodyBuyableByKey("primaryMeridian"); }
function extraordinaryMeridianRow() { return bodyBuyableByKey("extraordinaryMeridian"); }
function temperRow() { return bodyBuyableByKey("temper"); }

function bodyExists() {
    return !!(player[bodyLayerId()] && player[bodyLayerId()].unlocked);
}

function meridiansOpened() {
    if (!bodyExists()) return factoryDecimalZero();
    return getBuyableAmount(bodyLayerId(), primaryMeridianRow().id);
}

function temperLevel() {
    if (!bodyExists()) return factoryDecimalZero();
    return getBuyableAmount(bodyLayerId(), temperRow().id);
}

function realmBest(realmId) {
    if (player[realmId] && player[realmId].unlocked) return player[realmId].best;
    return factoryDecimalZero();
}

// Count the realm's reached sub-stage LEVELS (sub-stages whose `at` threshold
// the realm's high-water `best` meets) — i.e. the small level index (~6 at 6th
// Level), NOT the raw prestige currency `best`. This is the §6 realm-term input:
// the realm's sub-stage progress, so the gradeScore realm term measures "how
// deep into the realm" rather than "how much currency banked" (the blocker fix —
// raw q.best climbs into the dozens/hundreds and would saturate the score alone).
function realmReachedSubstageCount(realmId) {
    var realmData = findRealmData(realmId);
    var best = realmBest(realmId);
    var reached = factoryDecimalZero();
    realmData.substages.forEach(function (stage) {
        if (best.gte(stage.at)) reached = reached.add(FACTORY_ONE);
    });
    return reached;
}

// Resolve a sub-stage label to its `at` threshold for a realm.
function substageThreshold(realmId, label) {
    var realmData = findRealmData(realmId);
    var matched = realmData.substages.find(function (stage) { return stage.label === label; });
    return matched ? matched.at : FACTORY_ZERO;
}

// ---------------------------------------------------------------------------
// Dao lattice live readers (design §4.2). The dao layer is LIFE-scoped and may
// not exist yet in player (revealed mid-Qi-Condensation), so every reader is
// defensive like the Body readers (daoExists() mirrors bodyExists()). The
// lattice's currency is Insight (player.dao.points); nodes are buyables whose
// owned amount is the highest tier owned (Glimpse=1, Seed=2).
// ---------------------------------------------------------------------------
function daoLayerId() { return LATTICE_DATA.id; }

function daoExists() {
    return !!(player[daoLayerId()] && player[daoLayerId()].unlocked);
}

// True once the reveal gate (LATTICE_DATA.unlock) has been met. Latched on the dao
// layer's `revealed` flag so the layer stays shown once seen (§4.2 never resets / the
// realm reveal-latch pattern) — Insight accrues only while this is true (no banking).
function daoIsRevealed() {
    if (daoExists() && player[daoLayerId()].revealed) return true;
    return meets(LATTICE_DATA.unlock);
}

function daoNodeByKey(nodeKey) {
    return LATTICE_DATA.nodes.find(function (node) { return node.key === nodeKey; });
}

// Owned tier of a lattice node = its buyable amount (0 none, 1 Glimpse, 2 Seed).
function daoNodeTierOwned(nodeKey) {
    if (!daoExists()) return factoryDecimalZero();
    var node = daoNodeByKey(nodeKey);
    if (!node) return factoryDecimalZero();
    return getBuyableAmount(daoLayerId(), node.buyableId);
}

// Product of every owned node tier's qiMult effect (design §4.2 lattice→Qi coupling).
// Each node carries one effect object per tier; a tier contributes only its qiMult (the
// insightMult-flavoured nodes are identity here). No dead mult: folded into
// cultivationQiPerSecond() (§9.2).
function daoNodeQiMult() {
    var product = factoryDecimalOne();
    if (!daoExists()) return product;
    LATTICE_DATA.nodes.forEach(function (node) {
        var owned = getBuyableAmount(daoLayerId(), node.buyableId);
        node.effects.forEach(function (effect, tierIndex) {
            if (effect.qiMult !== undefined && owned.gte(tierIndex + FACTORY_ONE)) {
                product = product.times(effect.qiMult);
            }
        });
    });
    return product;
}

// Product of every owned node tier's insightMult effect — compounds the Insight trickle.
function daoNodeInsightMult() {
    var product = factoryDecimalOne();
    if (!daoExists()) return product;
    LATTICE_DATA.nodes.forEach(function (node) {
        var owned = getBuyableAmount(daoLayerId(), node.buyableId);
        node.effects.forEach(function (effect, tierIndex) {
            if (effect.insightMult !== undefined && owned.gte(tierIndex + FACTORY_ONE)) {
                product = product.times(effect.insightMult);
            }
        });
    });
    return product;
}

// The currently-active stance row (design §6.1), or null when none. The active stance is
// stored as player.dao.activeStance (a key string; "" = none).
function activeStanceRow() {
    if (!daoExists()) return null;
    var activeKey = player[daoLayerId()].activeStance;
    if (!activeKey) return null;
    var matchedStance = STANCE_DATA.stances.find(function (stance) { return stance.key === activeKey; }) || null;
    // A stance modifier must never outlive its unlock gate: if a future slice ever
    // resets the gating state (lattice nodes are life-scoped today, but reincarnation
    // will reset them), self-heal by deactivating rather than applying a hidden stance.
    if (matchedStance && !meets(matchedStance.unlock)) {
        player[daoLayerId()].activeStance = "";
        return null;
    }
    return matchedStance;
}

// Active stance's qiMult (identity when none) — folded into cultivationQiPerSecond().
function stanceQiMult() {
    var stance = activeStanceRow();
    if (!stance || stance.modifiers.qiMult === undefined) return factoryDecimalOne();
    return new Decimal(stance.modifiers.qiMult);
}

// Active stance's insightMult (identity when none) — compounds the Insight trickle.
function stanceInsightMult() {
    var stance = activeStanceRow();
    if (!stance || stance.modifiers.insightMult === undefined) return factoryDecimalOne();
    return new Decimal(stance.modifiers.insightMult);
}

// Insight/sec (design §4.2): baseRate x daoNodeInsightMult() x stanceInsightMult(), zero
// until the lattice is revealed (no pre-unlock banking). The dao layer's update() accrues
// this each tick; the tab displays the breakdown.
function insightPerSecond() {
    if (!daoIsRevealed()) return factoryDecimalZero();
    return new Decimal(LATTICE_DATA.insight.baseRate)
        .times(daoNodeInsightMult())
        .times(stanceInsightMult())
        .times(soulAspectInsightMult())
        // Owned-technique Insight bonus (design §4.3, slice 5). Product of every OWNED
        // technique's insightMult — identity until a technique with an insightMult effect is
        // bought, so a pre-slice-5 / no-technique save reads byte-identical (no dead mult §9.2).
        .times(techniqueInsightMult());
}

// ---------------------------------------------------------------------------
// meets(condition) — uniform unlock / done evaluator over a condition object.
// Keys combine with AND. Supports: qi, realm:[id, numberOrLabel], meridians,
// temperTier, primaryMeridiansAll, daoNode:[nodeKey, tier], anyDaoNode:tier,
// daoElementTier:[element, tier], achievement:[layerId, achievementId],
// sectJoined:true, contribution:N (sect standing high-water). (§5 unlock / §8 done.)
// ---------------------------------------------------------------------------
function meets(condition) {
    if (!condition) return true;
    var satisfied = true;

    if (condition.qi !== undefined) {
        if (player.points.lt(condition.qi)) satisfied = false;
    }

    if (condition.realm !== undefined) {
        var targetRealmId = condition.realm[FACTORY_ZERO];
        var targetStage = condition.realm[FACTORY_ONE];
        var threshold;
        if (typeof targetStage === "string") {
            threshold = substageThreshold(targetRealmId, targetStage);
        } else {
            threshold = targetStage;
        }
        if (realmBest(targetRealmId).lt(threshold)) satisfied = false;
    }

    if (condition.meridians !== undefined) {
        if (meridiansOpened().lt(condition.meridians)) satisfied = false;
    }

    if (condition.temperTier !== undefined) {
        var requiredTierIndex = temperTierIndexByKey(condition.temperTier);
        if (temperTierIndexForLevel(temperLevel()) < requiredTierIndex) satisfied = false;
    }

    if (condition.primaryMeridiansAll !== undefined && condition.primaryMeridiansAll) {
        if (meridiansOpened().lt(primaryMeridianRow().limit)) satisfied = false;
    }

    // daoNode: [nodeKey, tierNumber] — the lattice node's owned tier (its buyable amount)
    // must be >= tierNumber (design §4.2; pinned grammar). Guards the dao layer existing in
    // player (defensive like the bodyExists cross-layer readers) so a pre-reveal save where
    // player.dao is unseeded simply fails the condition rather than throwing.
    if (condition.daoNode !== undefined) {
        var requiredNodeKey = condition.daoNode[FACTORY_ZERO];
        var requiredNodeTier = condition.daoNode[FACTORY_ONE];
        if (daoNodeTierOwned(requiredNodeKey).lt(requiredNodeTier)) satisfied = false;
    }

    // anyDaoNode: N — ANY lattice node owns tier >= N (expansion §5 grammar; pinned).
    // Distinct from daoNode (a SPECIFIC node): this is the "held a Seed of anything"
    // signal. Defensive when the dao layer is absent (daoNodeTierOwned returns zero
    // pre-reveal, the existing cross-layer pattern), so a pre-lattice save fails it.
    if (condition.anyDaoNode !== undefined) {
        var anyNodeMet = false;
        if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.nodes) {
            LATTICE_DATA.nodes.forEach(function (node) {
                if (daoNodeTierOwned(node.key).gte(condition.anyDaoNode)) anyNodeMet = true;
            });
        }
        if (!anyNodeMet) satisfied = false;
    }

    // daoElementTier: [element, N] — ANY node of that element owns tier >= N
    // (expansion §5 grammar; pinned). The Soul Aspect element gates read this: a
    // "metal" aspect needs a held Seed (tier 2) of ANY metal-element node. Defensive
    // on LATTICE_DATA / the dao layer absence exactly like daoNode/anyDaoNode.
    if (condition.daoElementTier !== undefined) {
        var requiredElement = condition.daoElementTier[FACTORY_ZERO];
        var requiredElementTier = condition.daoElementTier[FACTORY_ONE];
        var elementMet = false;
        if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.nodes) {
            LATTICE_DATA.nodes.forEach(function (node) {
                if (node.element === requiredElement
                    && daoNodeTierOwned(node.key).gte(requiredElementTier)) elementMet = true;
            });
        }
        if (!elementMet) satisfied = false;
    }

    // achievement: [layerId, achievementId] — the achievement must be earned. Evaluates via
    // hasAchievement(layerId, id) exactly as the gate layer's done() reads it, so the same
    // live-state achievement check works in meets()-gated journal entries, hints, and any
    // future unlock condition referencing an earned checkpoint (design §4.3 / slice 5).
    // Guarded defensively: if hasAchievement is absent (pre-engine environments like lint
    // sandbox) returns false rather than crashing — the condition simply fails safely.
    if (condition.achievement !== undefined) {
        var achievementLayerId = condition.achievement[FACTORY_ZERO];
        var achievementRowId = condition.achievement[FACTORY_ONE];
        if (typeof hasAchievement !== "function") {
            satisfied = false;
        } else if (!hasAchievement(achievementLayerId, achievementRowId)) {
            satisfied = false;
        }
    }

    // sectJoined: true — the player must have chosen a sect archetype this life. Evaluates
    // via the sectJoined() factory accessor (defined in the slice-5 sect factory surface).
    // Guarded defensively: if sectJoined() is absent (pre-slice-5) returns false so any
    // sectJoined-gated condition simply fails safely without crashing. (design §4.3 / slice 5)
    if (condition.sectJoined === true) {
        if (typeof sectJoined !== "function") {
            satisfied = false;
        } else if (!sectJoined()) {
            satisfied = false;
        }
    }

    // contribution: N — the sect contribution HIGH-WATER (player.sect.best) must be >= N.
    // Used by the Inner Disciple checkpoint (gates.js): a sect rank is earned by building
    // standing, not by a momentary balance, so it reads the high-water (which never falls)
    // exactly like a realm gate reads realmBest. Defensive when the sect layer is absent /
    // unseeded (contributionBest returns zero), so a pre-slice-5 save fails it safely (§4.3).
    if (condition.contribution !== undefined) {
        if (contributionBest().lt(condition.contribution)) satisfied = false;
    }

    return satisfied;
}

// ---------------------------------------------------------------------------
// Qi/sec — getPointGen factors (§2). Read by the rewritten global getPointGen
// in mod.js. Returns a single multiplier built from live state, never literals.
//   Qi/sec = baseRate x meridianMult x temperMult x realmMult x gateMult x coreMult
// ---------------------------------------------------------------------------
function qiBaseRate() { return new Decimal(BODY_DATA.qi.baseRate); }

function meridianMult() {
    if (!bodyExists()) return factoryDecimalOne();
    var product = factoryDecimalOne();
    [primaryMeridianRow(), extraordinaryMeridianRow()].forEach(function (row) {
        var amount = getBuyableAmount(bodyLayerId(), row.id);
        product = product.times(Decimal.pow(row.effectBase, amount));
    });
    return product;
}

// Per-tier +5% Qi/sec, applied via milestones on the Body layer (§4b).
function temperMult() {
    if (!bodyExists()) return factoryDecimalOne();
    var product = factoryDecimalOne();
    BODY_DATA.temperTiers.forEach(function (tier, index) {
        if (hasMilestone(bodyLayerId(), index)) product = product.times(tier.qiBonus);
    });
    return product;
}

// Realm multiplier — product of every reached sub-stage's qiMult across realms (§5).
function realmMult() {
    var product = factoryDecimalOne();
    REALM_DATA.forEach(function (realmData) {
        realmData.substages.forEach(function (stage, index) {
            if (player[realmData.id] && player[realmData.id].unlocked &&
                hasMilestone(realmData.id, index)) {
                product = product.times(stage.qiMult);
            }
        });
    });
    return product;
}

// Story-gate buff (Outer Disciple +25%, §8). Reads achievement effects.
function gateMult() {
    var product = factoryDecimalOne();
    if (!(player[GATE_DATA.id] && player[GATE_DATA.id].unlocked)) return product;
    GATE_DATA.achievements.forEach(function (ach) {
        if (ach.effect && ach.effect.qiMult !== undefined && hasAchievement(GATE_DATA.id, ach.id)) {
            product = product.times(ach.effect.qiMult);
        }
    });
    return product;
}

// Core Grade global multiplier (§7). Reads the stored grade index off the Body layer.
function coreGradeMult() {
    if (!bodyExists()) return factoryDecimalOne();
    var storedIndex = player[bodyLayerId()].coreGrade;
    if (storedIndex < FACTORY_ZERO) return factoryDecimalOne();
    var coreGrades = coreForgeData().grades;
    var matched = coreGrades.find(function (grade) { return grade.ceilingIndex === storedIndex; });
    if (!matched) return factoryDecimalOne();
    return new Decimal(matched.globalMult);
}

// ---------------------------------------------------------------------------
// Soul Aspect readers (expansion §5). The chosen aspect (player.b.soulAspect) is a
// run-long passive identity: its effect multipliers fold into the Qi and Insight
// pipelines once exactly each. Defensive when unchosen / no body — both readers
// return identity, so a pre-NS save is byte-for-byte the prior product (no dead
// mult §9.2). The realm row carrying the aspect set is REALM_DATA(n).soulAspect.
// ---------------------------------------------------------------------------
function soulAspectRealmData() {
    return REALM_DATA.find(function (realmData) { return !!realmData.soulAspect; });
}

// The data row of the currently-chosen aspect, or null (unchosen / no body / no
// aspect realm registered). The single key<->row crossing for the Soul Aspect.
function soulAspectRow() {
    var aspectKey = getSoulAspectKey();
    if (!aspectKey) return null;
    var realmData = soulAspectRealmData();
    if (!realmData) return null;
    return realmData.soulAspect.aspects.find(function (aspect) {
        return aspect.key === aspectKey;
    }) || null;
}

// Chosen aspect's qiMult (identity when unchosen / the aspect declares none) —
// folded into cultivationQiPerSecond().
function soulAspectQiMult() {
    var aspect = soulAspectRow();
    if (!aspect || aspect.effect.qiMult === undefined) return factoryDecimalOne();
    return new Decimal(aspect.effect.qiMult);
}

// Chosen aspect's insightMult (identity when unchosen / the aspect declares none) —
// folded into insightPerSecond().
function soulAspectInsightMult() {
    var aspect = soulAspectRow();
    if (!aspect || aspect.effect.insightMult === undefined) return factoryDecimalOne();
    return new Decimal(aspect.effect.insightMult);
}

// The one public entry the rewritten getPointGen multiplies into baseRate. The Dao
// lattice (daoNodeQiMult, design §4.2), the active stance (stanceQiMult, §6.1), and
// the chosen Soul Aspect (soulAspectQiMult, expansion §5) join the pipeline here —
// all identity until the lattice is revealed / a stance is active / an aspect is
// chosen, so this is byte-for-byte the prior product for a pre-NS save (no dead mult §9.2).
function cultivationQiPerSecond() {
    return qiBaseRate()
        .times(meridianMult())
        .times(temperMult())
        .times(realmMult())
        .times(gateMult())
        .times(coreGradeMult())
        .times(daoNodeQiMult())
        .times(stanceQiMult())
        .times(soulAspectQiMult())
        // Sect folds (design §4.3, slice 5). The sect STIPEND milestone grants a permanent
        // Qi/sec bonus (sectStipendQiMult), and OWNED techniques' qiMult effects compound
        // (techniqueQiMult). Both are identity until the stipend is earned / a qiMult
        // technique is owned, so a pre-slice-5 save is byte-for-byte the prior product
        // (no dead mult §9.2).
        .times(sectStipendQiMult())
        .times(techniqueQiMult())
        // Slice-6 folds (design §1.3/§6.2/§5/§8.1). The active failure-Scar DEBUFF (scarQiMult,
        // < 1 while a scar depth is un-healed), the permanent "Tempered by Ruin" BUFF from healed
        // depths (temperedQiMult, >= 1), and the eternal Act I Legacy Grade's qiMult (legacyQiMult,
        // >= 1 once earned). Each is identity until its state exists (no active scar / no healed
        // depth / no legacy grade), so a pre-tribulation save is byte-for-byte the prior product
        // (no dead mult §9.2) — and each is folded EXACTLY ONCE here, the single Qi pipeline.
        .times(scarQiMult())
        .times(temperedQiMult())
        .times(legacyQiMult());
}

// ---------------------------------------------------------------------------
// Stored-grade read/write helpers (§6). Grades live on the never-reset Body
// layer's startData as plain integer indices. PUBLIC CONTRACT for later phases.
// ---------------------------------------------------------------------------
function getFoundationGradeIndex() {
    if (!bodyExists()) return BODY_DATA.grades.foundationGrade.startIndex;
    return player[bodyLayerId()].foundationGrade;
}
function setFoundationGradeIndex(index) {
    player[bodyLayerId()].foundationGrade = index;
}
function getCoreGradeIndex() {
    if (!bodyExists()) return BODY_DATA.grades.coreGrade.startIndex;
    return player[bodyLayerId()].coreGrade;
}
function setCoreGradeIndex(index) {
    player[bodyLayerId()].coreGrade = index;
}

// Soul Aspect store (expansion §5). The chosen aspect key lives LIFE-scoped on the
// never-reset Body layer (player.b.soulAspect), the grade-storage precedent — so it
// survives every realm breakthrough. "" = unchosen (the BODY_DATA.soulAspect.startKey).
function getSoulAspectKey() {
    if (!bodyExists()) return BODY_DATA.soulAspect.startKey;
    return player[bodyLayerId()].soulAspect;
}
function setSoulAspectKey(aspectKey) {
    player[bodyLayerId()].soulAspect = aspectKey;
}

// ---------------------------------------------------------------------------
// Foundation Grade computation (§6). Computed ONCE at the Foundation
// breakthrough (onPrestige on f), then stored on the reset-immune Body layer
// via setFoundationGradeIndex. gradeScore is a weighted blend of meridians,
// temper level (saturating at the temper denominator), and q.best (vs. the
// q.best required to reach Foundation), clamped to [0,1] and mapped to a band.
// EVERY number resolves from REALM_DATA(f).grade or FACTORY_NUMERICS — the
// band fMult is consumed live in foundationGradeMult() (no dead mult §9.2).
// ---------------------------------------------------------------------------
function clampUnitInterval(value) {
    var lowerBound = new Decimal(FACTORY_ZERO);
    var upperBound = new Decimal(FACTORY_ONE);
    if (value.lt(lowerBound)) return lowerBound;
    if (value.gt(upperBound)) return upperBound;
    return value;
}

// gradeScore = clamp( wMer*(meridians/merDen) + wTemper*(min(temper,tempDen)/tempDen)
//                     + wRealm*(q.best/realmDen), 0, 1 ).  All weights/denominators
// from REALM_DATA(f).grade. Returns a Decimal in [0,1].
function foundationGradeScore() {
    var grade = findRealmData("f").grade;

    var meridianTerm = meridiansOpened()
        .div(grade.meridianDenominator)
        .times(grade.weightMeridian);

    var temperDenominator = new Decimal(grade.temperDenominator);
    var temperCapped = temperLevel();
    if (temperCapped.gt(temperDenominator)) temperCapped = temperDenominator;
    var temperTerm = temperCapped
        .div(temperDenominator)
        .times(grade.weightTemper);

    // §6 realm term: the realm's reached sub-stage level count (small index, ~6
    // at 6th Level) over the denominator (the 6th-Level milestone), NOT raw
    // q.best. Clamped to the denominator (like the temper term) so progress past
    // 6th Level does not keep adding grade — the term saturates at its weight, so
    // no single term can clamp the whole score (the blocker fix, §6/§9.2).
    var realmDenominator = new Decimal(grade.realmDenominator);
    var realmReached = realmReachedSubstageCount("q");
    if (realmReached.gt(realmDenominator)) realmReached = realmDenominator;
    var realmTerm = realmReached
        .div(realmDenominator)
        .times(grade.weightRealm);

    return clampUnitInterval(meridianTerm.add(temperTerm).add(realmTerm));
}

// Highest band index whose inclusive floor the score meets. Bands are ordered
// ascending by floor in data, so we walk and keep the last satisfied one.
function foundationBandIndexForScore(score) {
    var bands = findRealmData("f").grade.bands;
    var chosenIndex = FACTORY_ZERO - FACTORY_ONE;
    bands.forEach(function (band, index) {
        if (score.gte(band.floor)) chosenIndex = index;
    });
    return chosenIndex;
}

// Live consumer of the stored Foundation band's fMult — multiplies f prestige
// gain. index < 0 (no breakthrough yet) yields identity, so the very first
// breakthrough is ungraded by construction and later ones compound the bonus.
function foundationGradeMult() {
    var storedIndex = getFoundationGradeIndex();
    if (storedIndex < FACTORY_ZERO) return factoryDecimalOne();
    var bands = findRealmData("f").grade.bands;
    var band = bands[storedIndex];
    if (!band) return factoryDecimalOne();
    return new Decimal(band.fMult);
}

// Compute the Foundation Grade at breakthrough and store the BEST band reached
// on the Body layer (never downgrade a higher grade on a later weaker run).
function computeAndStoreFoundationGrade() {
    var score = foundationGradeScore();
    var bandIndex = foundationBandIndexForScore(score);
    if (bandIndex > getFoundationGradeIndex()) setFoundationGradeIndex(bandIndex);
    return getFoundationGradeIndex();
}

// ---------------------------------------------------------------------------
// Core forge + refinement (§7). The Core grade is a single stored integer INDEX
// on the reset-immune Body layer (player.b.coreGrade), set at the one-time forge
// (§7a) and raised by the slow refinement loop (§7b). All thresholds, offsets,
// crack chances, fuel costs and the Foundation->Core baseCore mapping come from
// REALM_DATA — zero numeric literals here (§11). Decimal helpers come from
// FACTORY_NUMERICS via factoryDecimal*.
// ---------------------------------------------------------------------------
function coreRealmData() { return findRealmData("c"); }
// coreForgeData() NOW reads SETPIECE_DATA.forge (the forge migration, slice 6) — a
// compatibility accessor: the forge config moved from the c row to SETPIECE_DATA.forge
// VERBATIM, so this returns the identical object it always returned and every other forge
// function (performForge, refinementTick, coreGradeLadder, forgeFuelCost ...) keeps its name
// and math untouched. Resolved via SETPIECE_DATA.forge directly (the forge is the canonical
// instance-1 set-piece); defensive when SETPIECE_DATA is absent (a data-only harness).
function coreForgeData() {
    if (typeof SETPIECE_DATA !== "undefined" && SETPIECE_DATA && SETPIECE_DATA.forge) {
        return SETPIECE_DATA.forge;
    }
    return null;
}
function coreGradeLadder() { return coreForgeData().grades; }

// Resolve a core-grade key ("cracked".."perfect") to its ordered ladder index
// (ceilingIndex). Keys live in data; this is the only place key<->index crosses.
function coreGradeIndexForKey(gradeKey) {
    var matched = coreGradeLadder().find(function (grade) { return grade.key === gradeKey; });
    return matched ? matched.ceilingIndex : (FACTORY_ZERO - FACTORY_ONE);
}

// Resolve a stored ladder index back to its data row (or null if none/sentinel).
function coreGradeRowForIndex(storedIndex) {
    return coreGradeLadder().find(function (grade) { return grade.ceilingIndex === storedIndex; }) || null;
}

// The Foundation Grade band currently stored on the Body layer (or null if the
// player has not yet established a Foundation).
function storedFoundationBand() {
    var bandIndex = getFoundationGradeIndex();
    if (bandIndex < FACTORY_ZERO) return null;
    var bands = findRealmData("f").grade.bands;
    return bands[bandIndex] || null;
}

// baseCore index: the STARTING core grade the forge produces before any push
// offset, mapped from the stored Foundation Grade band's baseCore key (§7a data).
function coreBaseGradeIndex() {
    var band = storedFoundationBand();
    if (!band) return FACTORY_ZERO - FACTORY_ONE;
    return coreGradeIndexForKey(band.baseCore);
}

// coreCeiling index: the hard cap a forged core can reach, from the stored
// Foundation band's coreCeiling key (push offset + refinement both clamp here).
function coreCeilingGradeIndex() {
    var band = storedFoundationBand();
    if (!band) return FACTORY_ZERO - FACTORY_ONE;
    return coreGradeIndexForKey(band.coreCeiling);
}

// Has a core already been forged? (stored index at/above the first ladder grade.)
function coreIsForged() {
    return getCoreGradeIndex() >= FACTORY_ZERO;
}

// Fuel (f.points) a given push option spends: fuelBase * fuelMult, as a Decimal.
function forgeFuelCost(pushOption) {
    return new Decimal(coreForgeData().fuelBase).times(pushOption.fuelMult);
}

// Is the forge OPEN? Core Formation unlocked + Foundation fuel >= forgeReq, and not
// already forged. Reads f.points live (the Foundation prestige currency = fuel, §7a).
function forgeIsAvailable() {
    if (coreIsForged()) return false;
    if (!(player[coreRealmData().id] && player[coreRealmData().id].unlocked)) return false;
    return realmBest(coreRealmData().id) !== undefined
        && player.f !== undefined
        && player.f.points.gte(coreForgeData().forgeReq);
}

// Can a SPECIFIC push option be afforded right now (its own fuel cost)?
function canAffordForgePush(pushOption) {
    if (coreIsForged()) return false;
    if (player.f === undefined) return false;
    return player.f.points.gte(forgeFuelCost(pushOption));
}

// Execute a one-time forge with the chosen push option (§7a). Spends the fuel,
// computes finalGrade = min(baseCore + offset (minus crackTierDrop on a crack
// roll), foundationCeiling), clamps to the Cracked floor, and stores the index on
// the Body layer. Returns the resolved core-grade data row.
function performForge(pushOption) {
    var fuelCost = forgeFuelCost(pushOption);
    player.f.points = player.f.points.sub(fuelCost).max(factoryDecimalZero());

    var producedIndex = coreBaseGradeIndex() + pushOption.offset;

    // Crack roll: a crack drops exactly crackTierDrop tier(s); never destroyed,
    // never a hard wall (invariant §9.3). crackChance/crackTierDrop are data.
    var cracked = false;
    if (Math.random() < pushOption.crackChance) {
        cracked = true;
        producedIndex = producedIndex - coreForgeData().crackTierDrop;
    }

    // Clamp to [Cracked floor, Foundation ceiling]. Floor is the first ladder
    // index; ceiling is the stored Foundation band's coreCeiling.
    var floorIndex = coreGradeLadder()[FACTORY_ZERO].ceilingIndex;
    var ceilingIndex = coreCeilingGradeIndex();
    if (producedIndex < floorIndex) producedIndex = floorIndex;
    if (producedIndex > ceilingIndex) producedIndex = ceilingIndex;

    setCoreGradeIndex(producedIndex);
    player[coreRealmData().id].lastForgeCracked = cracked;
    return coreGradeRowForIndex(producedIndex);
}

// ---- Refinement (§7b): slow/safe accrual that raises the grade one tier per
// full bar, capped at the Foundation ceiling. Progress + warming toggle live on
// the never-reset c layer's startData.
function refinementData() { return coreForgeData().refinement; }

function refinementProgress() {
    var realmId = coreRealmData().id;
    if (player[realmId] && player[realmId].refinementProgress !== undefined) {
        return player[realmId].refinementProgress;
    }
    return factoryDecimalZero();
}

function refinementIsWarming() {
    var realmId = coreRealmData().id;
    return !!(player[realmId] && player[realmId].warming);
}

// True once the core is forged but below its Foundation ceiling — i.e. there is
// still a tier to gain. At the ceiling, refinement is inert (no dead progress).
function refinementCanProgress() {
    if (!coreIsForged()) return false;
    return getCoreGradeIndex() < coreCeilingGradeIndex();
}

// Fraction [0,1] of the current refinement bar, for the bar's progress().
function refinementBarFraction() {
    var fraction = refinementProgress().div(refinementData().goal);
    if (fraction.lt(factoryDecimalZero())) return factoryDecimalZero();
    if (fraction.gt(factoryDecimalOne())) return factoryDecimalOne();
    return fraction;
}

// Per-tick accrual (called from the c layer's update(diff)). Accrues only while
// warming AND a tier remains; on a full bar raises the grade one tier (tierStep),
// capped at the Foundation ceiling, and carries the remainder.
function refinementTick(diff) {
    if (!refinementIsWarming() || !refinementCanProgress()) return;
    var realmId = coreRealmData().id;
    var goal = new Decimal(refinementData().goal);
    var gained = new Decimal(refinementData().ratePerSecond).times(diff);
    var progress = refinementProgress().add(gained);

    while (progress.gte(goal) && refinementCanProgress()) {
        progress = progress.sub(goal);
        var raised = getCoreGradeIndex() + refinementData().tierStep;
        var ceilingIndex = coreCeilingGradeIndex();
        if (raised > ceilingIndex) raised = ceilingIndex;
        setCoreGradeIndex(raised);
    }
    // At the ceiling, drain any leftover so the bar reads full-and-done, not stuck.
    if (!refinementCanProgress()) progress = factoryDecimalZero();
    player[realmId].refinementProgress = progress;
}

// ---------------------------------------------------------------------------
// The First Tribulation set-piece (design §6.2; SETPIECE_DATA.firstTribulation). INSTANCE 2
// of the set-piece config type — the forge's skeleton generalized to a timed, multi-wave bar
// drained against a PREPARED POOL. Mounted on the Soul Formation (s) realm via realmData.
// setpiece, exactly as the forge mounts on c. The run-state lives on player.s (seeded in s
// startData): tribActive / tribElapsed / tribPool / tribPoolMax / tribWaveIndex / tribGrade
// (-1 = none / not yet resolved) / tribCooldownUntil. No mid-run actions in v1 (pills /
// talismans arrive in slice 7+, design §7.6 ⟨design⟩); banked Qi is consumed as fuel at trigger.
// ALL numbers resolve from SETPIECE_DATA.firstTribulation / FACTORY_NUMERICS — zero literals (§11).
// ---------------------------------------------------------------------------
function tribulationRealmData() { return realmWithSetpiece("firstTribulation"); }
function tribulationConfig() { return setpieceFor(tribulationRealmData()); }

// True once the tribulation realm exists in player (defensive — s may be unseeded on an old save).
function tribulationRealmExists() {
    var realmData = tribulationRealmData();
    if (!realmData) return false;
    return !!(player[realmData.id] && player[realmData.id].unlocked);
}

// The stored tribulation grade index on player.s (-1 = unresolved / no run finished). Defensive.
function tribulationGradeIndex() {
    var realmData = tribulationRealmData();
    if (!realmData || player[realmData.id] === undefined
        || player[realmData.id].tribGrade === undefined) return FACTORY_ZERO - FACTORY_ONE;
    return player[realmData.id].tribGrade;
}

// The tribulation grade data row for the stored index, or null (unresolved / failed-unstored).
function tribulationGradeRow() {
    var index = tribulationGradeIndex();
    if (index < FACTORY_ZERO) return null;
    var config = tribulationConfig();
    if (!config) return null;
    return config.grades[index] || null;
}

// tribulationPassed() — the stored grade resolves to a PASSING grade (§6.2). A passing grade has
// passes:true; Failed (index 0) has passes:false. Defensive: an unresolved/absent grade is not a pass.
function tribulationPassed() {
    var row = tribulationGradeRow();
    return !!(row && row.passes);
}

// Fraction [0,1] of the tribulation pool remaining (current pool / starting max). Zero when no
// run is active or the starting pool was empty. Drives the bar's progress() and display().
function tribulationPoolFraction() {
    var realmData = tribulationRealmData();
    if (!realmData || player[realmData.id] === undefined) return factoryDecimalZero();
    if (!player[realmData.id].tribActive) return factoryDecimalZero();
    var poolMax = new Decimal(player[realmData.id].tribPoolMax);
    if (poolMax.lte(factoryDecimalZero())) return factoryDecimalZero();
    var fraction = new Decimal(player[realmData.id].tribPool).div(poolMax);
    if (fraction.lt(factoryDecimalZero())) return factoryDecimalZero();
    if (fraction.gt(factoryDecimalOne())) return factoryDecimalOne();
    return fraction;
}

// A run is in progress (the timed bar is draining). Read off player.s.tribActive.
function tribulationIsActive() {
    var realmData = tribulationRealmData();
    if (!realmData || player[realmData.id] === undefined) return false;
    return !!player[realmData.id].tribActive;
}

// The REMAINING retry-cooldown seconds stored after a Failed (counted DOWN in tribulationTick
// using game-time diff, so it respects offline/tick semantics); 0 = no cooldown. A remaining-
// seconds counter rather than a wall-clock timestamp keeps the model literal-free (no ms
// conversion) and tied to the engine's own diff clock.
function tribulationCooldownUntil() {
    var realmData = tribulationRealmData();
    if (!realmData || player[realmData.id] === undefined
        || player[realmData.id].tribCooldownUntil === undefined) return FACTORY_ZERO;
    return player[realmData.id].tribCooldownUntil;
}

// True once the post-Failed retry cooldown has elapsed (the remaining counter has reached zero).
// A zero/absent counter (no prior failure) is trivially elapsed.
function tribulationCooldownElapsed() {
    var remaining = new Decimal(tribulationCooldownUntil());
    return remaining.lte(factoryDecimalZero());
}

// tribulationIsReady() — the trigger condition is met, the tribulation has not yet PASSED, no run
// is active, and any retry cooldown has elapsed (§6.2 "player chooses when to trigger"). Re-trigger
// after a pass is impossible (tribulationPassed gate). Defensive when the realm is unseeded.
function tribulationIsReady() {
    var realmData = tribulationRealmData();
    if (!realmData) return false;
    if (!tribulationRealmExists()) return false;
    if (tribulationPassed()) return false;          // once passed, never re-trigger
    if (tribulationIsActive()) return false;        // a run is already in progress
    if (!tribulationCooldownElapsed()) return false; // re-prep beat after a Failed
    var config = tribulationConfig();
    if (!config) return false;
    return meets(config.trigger);
}

// Count of OWNED techniques (design §4.3) — a tribulation-pool input. Defensive when the sect
// layer is absent (techniqueIsOwned guards it): a pre-sect save contributes zero techniques.
function ownedTechniqueCount() {
    var count = factoryDecimalZero();
    if (typeof TECHNIQUE_DATA === "undefined" || !TECHNIQUE_DATA) return count;
    TECHNIQUE_DATA.forEach(function (technique, index) {
        if (techniqueIsOwned(index)) count = count.add(FACTORY_ONE);
    });
    return count;
}

// Held Dao-Seed count (any node owned at the Seed tier, the deepest lattice tier in Act I) — a
// pool/legacy input. Reads the lattice's owned tiers defensively (zero pre-reveal). The Seed tier
// is the lattice tier count (Glimpse=1, Seed=2), so "owns >= tierCount" is "holds a Seed".
function heldDaoSeedCount() {
    var count = factoryDecimalZero();
    if (!daoExists()) return count;
    if (typeof LATTICE_DATA === "undefined" || !LATTICE_DATA || !LATTICE_DATA.nodes) return count;
    var seedTier = LATTICE_DATA.tiers.length;   // the deepest tier (Seed) — owning it = a held Seed
    LATTICE_DATA.nodes.forEach(function (node) {
        if (daoNodeTierOwned(node.key).gte(seedTier)) count = count.add(FACTORY_ONE);
    });
    return count;
}

// A single normalized [0,1] term: min(value, denominator) / denominator, as a Decimal. The
// saturation pattern the gradeScore terms use (§6) — caps each contribution at its weight.
function normalizedTerm(value, denominator) {
    var denom = new Decimal(denominator);
    var capped = new Decimal(value);
    if (capped.gt(denom)) capped = denom;
    if (denom.lte(factoryDecimalZero())) return factoryDecimalZero();
    return capped.div(denom);
}

// tribulationPreparednessPool() — the prepared pool (§6.2): a WEIGHTED SUM of what Act I built,
// PLUS banked Qi as fuel, returned as a Decimal. Each term is normalized to [0,1] by its
// denominator then scaled by its weight; the banked-Qi term is log-normalized (log10(qi)/denom)
// so banked Qi HELPS but cannot SOLO the pool (a rushed entry with a huge bank still risks Failed,
// §6.2 tension). Reads live temper / meridians / core ceiling / techniques / qi — all defensive.
function tribulationPreparednessPool() {
    var config = tribulationConfig();
    if (!config) return factoryDecimalZero();
    var pool = config.pool;

    var temperTerm = normalizedTerm(temperLevel(), pool.temperDenominator)
        .times(pool.weightTemper);
    var meridianTerm = normalizedTerm(meridiansOpened(), pool.meridianDenominator)
        .times(pool.weightMeridians);
    // Core grade term: the forged core's ceiling index over the ladder top index (the carried
    // artifact dominates the pool). Below-zero (unforged) contributes nothing.
    var coreIndex = getCoreGradeIndex();
    var coreTop = coreGradeLadder()[coreGradeLadder().length - FACTORY_ONE].ceilingIndex;
    var coreFraction = coreIndex < FACTORY_ZERO
        ? factoryDecimalZero()
        : normalizedTerm(new Decimal(coreIndex), coreTop);
    var coreTerm = coreFraction.times(pool.weightCoreGrade);
    var techniqueTerm = normalizedTerm(ownedTechniqueCount(), pool.techniqueDenominator)
        .times(pool.weightTechniques);

    // Banked-Qi fuel: log10(max(qi,1)) / qiFuelDenominator, clamped to [0,1], x weight. The max(1)
    // floors log10 at 0 so an empty bank contributes nothing (never a negative log).
    var bankedQi = player.points;
    var qiForLog = bankedQi.lt(factoryDecimalOne()) ? factoryDecimalOne() : bankedQi;
    var qiLog = qiForLog.log10();
    var qiFraction = normalizedTerm(qiLog, pool.qiFuelDenominator);
    var qiFuelTerm = qiFraction.times(pool.qiFuelWeight);

    return temperTerm.add(meridianTerm).add(coreTerm).add(techniqueTerm).add(qiFuelTerm);
}

// The total intensity multiplier on wave damage (§6.2 "Intensity = f(power) in v1"). base +
// perBest x s.best: a deeper Soul Formation draws a heavier tribulation (heaven weighs the climb).
// The karma term (§6.2) arrives with Samsara ⟨design §7.2⟩ — not built in v1.
function tribulationIntensity() {
    var config = tribulationConfig();
    if (!config) return factoryDecimalOne();
    var realmData = tribulationRealmData();
    var best = realmData ? realmBest(realmData.id) : factoryDecimalZero();
    return new Decimal(config.intensity.base).add(best.times(config.intensity.perBest));
}

// How many waves have CROSSED their scheduled moment at the given elapsed seconds. Waves are
// spaced evenly across durationSeconds: wave i (0-indexed) fires at (i+1)/waveCount x duration.
function tribulationWavesCrossed(elapsedSeconds, config) {
    var waveCount = config.waves.length;
    var duration = new Decimal(config.durationSeconds);
    var crossed = FACTORY_ZERO;
    config.waves.forEach(function (wave, index) {
        var scheduledAt = duration.times(index + FACTORY_ONE).div(waveCount);
        if (new Decimal(elapsedSeconds).gte(scheduledAt)) crossed = crossed + FACTORY_ONE;
    });
    return crossed;
}

// Resolve the grade index for a remaining-pool fraction (§6.2 rank order Flawless > Scarred >
// Shaken > Failed). Walks the passing bands (those carrying a floor) ascending and keeps the
// highest whose floor the fraction meets; a fraction at/below zero (pool emptied) is Failed (0).
function tribulationGradeForFraction(fraction, config) {
    if (fraction.lte(factoryDecimalZero())) return FACTORY_ZERO;   // pool emptied = Failed (index 0)
    var chosenIndex = FACTORY_ZERO;   // default Failed until a passing band's floor is met
    config.grades.forEach(function (grade, index) {
        if (grade.floor !== undefined && fraction.gte(grade.floor)) chosenIndex = index;
    });
    return chosenIndex;
}

// Begin a tribulation run (the Begin clickable's action). Consumes the banked Qi as fuel (the
// gamble, §6.2), seeds the run-state on player.s, and starts the timed bar. The starting pool is
// the preparedness pool computed AT trigger time (so the consumed Qi's fuel term is baked in
// before the Qi is spent). Idempotent-guarded: does nothing if a run is already active or the
// tribulation is not ready.
function beginTribulation() {
    if (!tribulationIsReady()) return;
    var realmData = tribulationRealmData();
    var startingPool = tribulationPreparednessPool();
    // Consume banked Qi as fuel (the only cost — §6.2: failure destroys nothing else). The fuel
    // term is already folded into startingPool above; spending it now is the gamble made concrete.
    player.points = factoryDecimalZero();
    player[realmData.id].tribActive = true;
    player[realmData.id].tribElapsed = FACTORY_ZERO;
    player[realmData.id].tribPool = startingPool;
    player[realmData.id].tribPoolMax = startingPool;
    player[realmData.id].tribWaveIndex = FACTORY_ZERO;
    player[realmData.id].tribGrade = FACTORY_ZERO - FACTORY_ONE;   // unresolved until the run ends
}

// Resolve a finished run: latch the grade, fire the Act I Legacy Grade on a pass, deepen the scar
// on a scarring grade, set the retry cooldown on a Failed (§6.2). Called by tribulationTick when
// the last wave resolves or the pool empties. gradeIndex is the resolved band index.
function resolveTribulation(gradeIndex) {
    var realmData = tribulationRealmData();
    var config = tribulationConfig();
    var gradeRow = config.grades[gradeIndex];

    player[realmData.id].tribActive = false;

    if (gradeRow.passes) {
        // Latch the passing grade; NEVER downgrade a higher grade earned on a prior pass (the
        // tribulation is once-per-life, but guard the latch the way the grade stores do).
        if (gradeIndex > tribulationGradeIndex()) player[realmData.id].tribGrade = gradeIndex;
        // The Act I Legacy Grade is computed ONCE on the first pass (eternal store, §8.1).
        computeAndStoreActOneLegacy();
        // A Scarred pass still marks the soul (§6.2): deepen the scar slot.
        if (gradeRow.scars) deepenScar();
    } else {
        // Failed (§6.2): deepen the scar, set the retry cooldown (remaining seconds, counted down
        // in tribulationTick), destroy nothing else. tribGrade stays at the unresolved sentinel so
        // tribulationPassed() is false and the run can re-trigger once the cooldown drains.
        deepenScar();
        player[realmData.id].tribCooldownUntil = new Decimal(config.retryCooldownSeconds);
    }
}

// tribulationTick(diff) — the per-tick wave-drain accrual (the refinementTick precedent), called
// from the s layer's update(). Advances elapsed time, drains the pool for each newly-crossed wave
// (damage x intensity), and resolves the grade when the LAST wave crosses or the pool empties.
function tribulationTick(diff) {
    var realmData = tribulationRealmData();
    if (!realmData || player[realmData.id] === undefined) return;

    // While NOT active, drain any pending retry cooldown (the post-Failed re-prep beat). Counting
    // it down here ties the cooldown to the engine's diff clock and keeps the model literal-free.
    if (!tribulationIsActive()) {
        var remaining = new Decimal(tribulationCooldownUntil());
        if (remaining.gt(factoryDecimalZero())) {
            remaining = remaining.sub(diff);
            if (remaining.lt(factoryDecimalZero())) remaining = factoryDecimalZero();
            player[realmData.id].tribCooldownUntil = remaining;
        }
        return;
    }

    var config = tribulationConfig();
    var intensity = tribulationIntensity();

    var elapsed = new Decimal(player[realmData.id].tribElapsed).add(diff);
    player[realmData.id].tribElapsed = elapsed;

    // Drain the pool for every wave whose scheduled moment has now been crossed but not yet
    // applied (tribWaveIndex tracks how many have been applied).
    var crossed = tribulationWavesCrossed(elapsed, config);
    var applied = player[realmData.id].tribWaveIndex;
    var pool = new Decimal(player[realmData.id].tribPool);
    while (applied < crossed) {
        var wave = config.waves[applied];
        pool = pool.sub(new Decimal(wave.damage).times(intensity));
        applied = applied + FACTORY_ONE;
    }
    if (pool.lt(factoryDecimalZero())) pool = factoryDecimalZero();
    player[realmData.id].tribPool = pool;
    player[realmData.id].tribWaveIndex = applied;

    // Resolve when the pool empties mid-run (Failed) or every wave has been applied (graded by the
    // remaining pool fraction). tribPoolMax is the starting pool; fraction = remaining / max.
    var poolMax = new Decimal(player[realmData.id].tribPoolMax);
    var emptied = pool.lte(factoryDecimalZero());
    var allWavesDone = applied >= config.waves.length;
    if (emptied || allWavesDone) {
        var fraction = poolMax.lte(factoryDecimalZero())
            ? factoryDecimalZero()
            : pool.div(poolMax);
        var gradeIndex = emptied ? FACTORY_ZERO : tribulationGradeForFraction(fraction, config);
        resolveTribulation(gradeIndex);
    }
}

// ---------------------------------------------------------------------------
// The failure-Scar slot (design §1.3 / §6.2 / §10.9; SETPIECE_DATA.scar; stored on the Body
// layer's player.b.scar*). ONE slot that DEEPENS (never stacks): a debuff while active, a heal
// arc that converts each depth into a permanent "Tempered by Ruin" buff. All three consumers fold
// into cultivationQiPerSecond() exactly once; identity when inactive/unhealed (no dead mult §9.2).
// ALL numbers resolve from SETPIECE_DATA.scar / FACTORY_NUMERICS — zero literals (§11).
// ---------------------------------------------------------------------------
function scarConfig() {
    if (typeof SETPIECE_DATA === "undefined" || !SETPIECE_DATA) return null;
    return SETPIECE_DATA.scar || null;
}

// Current scar depth (player.b.scarDepth; 0 = unscarred). Defensive when the body is unseeded.
function scarDepth() {
    if (!bodyExists()) return FACTORY_ZERO;
    return player[bodyLayerId()].scarDepth;
}

// How many scar depths have been HEALED (player.b.scarHealedDepth). Defensive.
function scarHealedDepth() {
    if (!bodyExists()) return FACTORY_ZERO;
    return player[bodyLayerId()].scarHealedDepth;
}

// Accrued heal progress toward converting the next depth (player.b.scarHealProgress). Defensive.
function scarHealProgress() {
    if (!bodyExists()) return factoryDecimalZero();
    var stored = player[bodyLayerId()].scarHealProgress;
    return stored === undefined ? factoryDecimalZero() : new Decimal(stored);
}

// The scar is ACTIVE while its depth exceeds the healed depth — there is an un-healed depth still
// applying its debuff. When depth === healedDepth the scar is fully healed (only the buff remains).
function scarIsActive() {
    return scarDepth() > scarHealedDepth();
}

// Deepen the scar one step, capped at maxDepth (§6.2 "deepens instead of multiplying"; §10.9
// ceiling). Called on a Failed or Scarred tribulation result. Resets the in-flight heal progress
// toward the NEW (deeper) depth so a partially-healed arc restarts against the deeper wound.
function deepenScar() {
    if (!bodyExists()) return;
    var config = scarConfig();
    if (!config) return;
    var current = player[bodyLayerId()].scarDepth;
    if (current < config.maxDepth) {
        player[bodyLayerId()].scarDepth = current + FACTORY_ONE;
        player[bodyLayerId()].scarHealProgress = FACTORY_ZERO;
    }
}

// The ACTIVE-DEPTH count: how many depths are still un-healed (debuff applies to these). The
// debuff is debuffQiMultPerDepth ^ activeDepth (a value < 1 per depth, never reaching zero).
function scarActiveDepth() {
    var active = scarDepth() - scarHealedDepth();
    return active > FACTORY_ZERO ? active : FACTORY_ZERO;
}

// scarQiMult() — the active scar debuff folded into cultivationQiPerSecond(): debuffQiMultPerDepth
// ^ activeDepth. Identity (1) when no active depth (unscarred or fully healed). Never zero — a
// scarred ascent stays completable (§6.3 / §1.3 "the scarred state is the tuned baseline").
//
// DESIGN INTENT (§6.3 completability) — the scar is a Qi-accrual debuff ONLY. It does NOT enter
// tribulationPreparednessPool(). This is deliberate: a scarred cultivator rebuilds slower (Qi/sec
// is lower so banking fuel back up takes longer) but is NEVER structurally locked out (the pool
// reflects what they BUILT — temper, meridians, core, techniques — not how fast they currently
// farm). If you "fix" this by subtracting the scar from the pool, a max-depth-scarred cultivator
// gains negative pool weight and can approach a state where the tribulation becomes unpassable
// regardless of preparation — a death spiral. The smoke harness pins this invariant:
// tribulationPreparednessPool() must return EQUAL values at depth 0 and depth maxDepth when all
// other inputs are identical (runtime-smoke-node.js block 40, added for slice 6.5 D4 review).
function scarQiMult() {
    var config = scarConfig();
    if (!config) return factoryDecimalOne();
    var active = scarActiveDepth();
    if (active <= FACTORY_ZERO) return factoryDecimalOne();
    return Decimal.pow(config.debuffQiMultPerDepth, active);
}

// temperedQiMult() — the permanent "Tempered by Ruin" buff folded into cultivationQiPerSecond():
// temperedQiMultPerDepth ^ healedDepth (§1.3 "healing converts it into a permanent buff"). Identity
// (1) until a depth is healed; compounds as more depths heal.
function temperedQiMult() {
    var config = scarConfig();
    if (!config) return factoryDecimalOne();
    var healed = scarHealedDepth();
    if (healed <= FACTORY_ZERO) return factoryDecimalOne();
    return Decimal.pow(config.temperedQiMultPerDepth, healed);
}

// The heal goal for the current (next-to-heal) depth: healGoalPerDepth x the active depth being
// healed (deeper wounds take longer to heal, §1.3 heal-arc-scales-with-depth). The depth being
// healed is healedDepth + 1 (the next un-healed depth).
function scarHealGoal() {
    var config = scarConfig();
    if (!config) return factoryDecimalZero();
    var depthBeingHealed = scarHealedDepth() + FACTORY_ONE;
    return new Decimal(config.healGoalPerDepth).times(depthBeingHealed);
}

// Fraction [0,1] of the current heal bar, for the heal bar's progress().
function scarHealBarFraction() {
    var goal = scarHealGoal();
    if (goal.lte(factoryDecimalZero())) return factoryDecimalZero();
    var fraction = scarHealProgress().div(goal);
    if (fraction.lt(factoryDecimalZero())) return factoryDecimalZero();
    if (fraction.gt(factoryDecimalOne())) return factoryDecimalOne();
    return fraction;
}

// scarHealTick(diff) — passive heal accrual (the warm-the-core pattern), called from the Body
// layer's automate/update path. Accrues only while the scar is active; a full heal bar converts
// ONE depth to healedDepth (the §1.3 heal arc) and carries the remainder toward the next depth.
function scarHealTick(diff) {
    if (!bodyExists() || !scarIsActive()) return;
    var config = scarConfig();
    if (!config) return;
    var gained = new Decimal(config.healRatePerSecond).times(diff);
    var progress = scarHealProgress().add(gained);

    while (scarIsActive() && progress.gte(scarHealGoal())) {
        progress = progress.sub(scarHealGoal());
        player[bodyLayerId()].scarHealedDepth = scarHealedDepth() + FACTORY_ONE;
    }
    // Fully healed: drain any leftover so the bar reads done, not stuck.
    if (!scarIsActive()) progress = factoryDecimalZero();
    player[bodyLayerId()].scarHealProgress = progress;
}

// ---------------------------------------------------------------------------
// The eternal Act I Legacy Grade (design §8.1 "Legacy Grades are eternal"; §5 "Act I Legacy
// Grade = f(core grade, aspect, Dao Seeds, sect standing, tribulation grade)"; LEGACY_DATA).
// Computed ONCE on the first tribulation pass, stored on player.legacy.actOneGrade (eternal),
// NEVER downgraded. legacyQiMult() folds the stored band's qiMult into cultivationQiPerSecond()
// (the live consumer — a grade that grants nothing is a dead stat, §9.2). ALL numbers resolve
// from LEGACY_DATA / FACTORY_NUMERICS — zero literals (§11).
// ---------------------------------------------------------------------------
function legacyLayerId() {
    return (typeof LEGACY_DATA !== "undefined" && LEGACY_DATA) ? LEGACY_DATA.id : "legacy";
}

function legacyExists() {
    return !!(player[legacyLayerId()] && player[legacyLayerId()].unlocked);
}

// The stored Act I Legacy band index (player.legacy.actOneGrade; -1 = no grade earned). Defensive.
function actOneLegacyIndex() {
    if (typeof LEGACY_DATA === "undefined" || !LEGACY_DATA) return FACTORY_ZERO - FACTORY_ONE;
    if (!legacyExists() || player[legacyLayerId()].actOneGrade === undefined) {
        return FACTORY_ZERO - FACTORY_ONE;
    }
    return player[legacyLayerId()].actOneGrade;
}

// The chosen Soul Aspect's legacy "depth": none = 0, formless = 1, element aspect = 2. Reads the
// chosen aspect row (soulAspectRow) — an element aspect (non-null element) is the deepest.
function aspectLegacyDepth() {
    var aspect = soulAspectRow();
    if (!aspect) return factoryDecimalZero();
    if (aspect.element !== null && aspect.element !== undefined) return new Decimal(FACTORY_ONE + FACTORY_ONE);
    return factoryDecimalOne();   // formless: chosen, but no element
}

// The deeds checkpoint standing: how many gate checkpoints are earned (Outer / Inner Disciple).
// Reads hasAchievement over the GATE_DATA checkpoint achievements — the horizontal-standing axis.
function deedsCheckpointsEarned() {
    var count = factoryDecimalZero();
    if (!(player[GATE_DATA.id] && player[GATE_DATA.id].unlocked)) return count;
    GATE_DATA.achievements.forEach(function (ach) {
        if (typeof hasAchievement === "function" && hasAchievement(GATE_DATA.id, ach.id)) {
            count = count.add(FACTORY_ONE);
        }
    });
    return count;
}

// actOneLegacyScore() — the weighted [0,1] blend (§5). coreGrade / aspect / daoSeeds / sectStanding
// / tribulation, each normalized by its denominator and scaled by its weight, summed and clamped.
function actOneLegacyScore() {
    var config = LEGACY_DATA.actOne;
    var weights = config.weights;
    var denominators = config.denominators;

    var coreIndex = getCoreGradeIndex();
    var coreValue = coreIndex < FACTORY_ZERO ? factoryDecimalZero() : new Decimal(coreIndex);
    var coreTerm = normalizedTerm(coreValue, denominators.coreGrade).times(weights.coreGrade);
    var aspectTerm = normalizedTerm(aspectLegacyDepth(), denominators.aspect).times(weights.aspect);
    var daoTerm = normalizedTerm(heldDaoSeedCount(), denominators.daoSeeds).times(weights.daoSeeds);
    var sectTerm = normalizedTerm(deedsCheckpointsEarned(), denominators.sectStanding)
        .times(weights.sectStanding);
    // Tribulation term: the resolved grade index over its top (Flawless = top). At Legacy-compute
    // time the grade is already latched (the pass fired this), so tribGrade is a valid passing index.
    var tribIndex = tribulationGradeIndex();
    var tribValue = tribIndex < FACTORY_ZERO ? factoryDecimalZero() : new Decimal(tribIndex);
    var tribTerm = normalizedTerm(tribValue, denominators.tribulation).times(weights.tribulation);

    return clampUnitInterval(coreTerm.add(aspectTerm).add(daoTerm).add(sectTerm).add(tribTerm));
}

// The highest legacy band index whose floor the score meets (bands ascending by floor in data).
function actOneLegacyBandForScore(score) {
    var bands = LEGACY_DATA.actOne.bands;
    var chosenIndex = FACTORY_ZERO;   // the lowest band (Faint) is the floor — always reachable
    bands.forEach(function (band, index) {
        if (score.gte(band.floor)) chosenIndex = index;
    });
    return chosenIndex;
}

// computeAndStoreActOneLegacy() — compute the weighted score, map to a band, and store the BEST
// band on the eternal Legacy layer (never downgrade). Called ONCE on the first tribulation pass;
// idempotent and monotone, so a re-fire (defensive) can only raise the stored grade.
function computeAndStoreActOneLegacy() {
    if (typeof LEGACY_DATA === "undefined" || !LEGACY_DATA) return;
    if (!legacyExists()) return;
    var score = actOneLegacyScore();
    var bandIndex = actOneLegacyBandForScore(score);
    if (bandIndex > actOneLegacyIndex()) player[legacyLayerId()].actOneGrade = bandIndex;
}

// The stored Act I Legacy band row, or null (no grade earned yet).
function actOneLegacyBand() {
    var index = actOneLegacyIndex();
    if (index < FACTORY_ZERO) return null;
    return LEGACY_DATA.actOne.bands[index] || null;
}

// legacyQiMult() — the stored Act I Legacy band's qiMult folded into cultivationQiPerSecond().
// Identity (1) until a grade is earned, so a pre-tribulation save is byte-for-byte the prior
// product (no dead mult §9.2). The eternal payoff of the life's legacy.
function legacyQiMult() {
    var band = actOneLegacyBand();
    if (!band || band.qiMult === undefined) return factoryDecimalOne();
    return new Decimal(band.qiMult);
}

// ---------------------------------------------------------------------------
// Automation ladder (design §1.7/§7.5; AUTOMATION_DATA). Automation is a REWARD,
// never a settings toggle: a row is ACTIVE the instant its grantedBy milestone is
// earned (hasMilestone) and stays on forever — there is no user-facing on/off. The
// readers below decide "is this grant live", and the wiring (q autoPrestige + the
// Body automate() autobuy) consults them each tick.
// ---------------------------------------------------------------------------

// True once the automation row's grantedBy milestone is held. Defensive when the
// granting layer is not yet in player (a milestone of an unregistered/unseeded layer
// is simply not held) — mirrors the cross-layer reader discipline.
function automationGranted(automationRow) {
    var grant = automationRow.grantedBy;
    if (!grant) return false;
    if (!(player[grant.layer] && player[grant.layer].unlocked)) return false;
    return hasMilestone(grant.layer, grant.milestone);
}

// Is the prestige of `layerId` automated? True iff any granted "prestige" row
// targets it. Read as the layer's tmp.autoPrestige (game.js gameLoop consumes it:
// `if (autoPrestige && canReset) doReset(layer)` — the engine's own prestige path).
function layerPrestigeAutomated(layerId) {
    if (typeof AUTOMATION_DATA === "undefined" || !AUTOMATION_DATA) return false;
    var automated = false;
    AUTOMATION_DATA.forEach(function (automationRow) {
        var auto = automationRow.automates;
        if (auto.action !== "prestige" || auto.layer !== layerId) return;
        if (!automationGranted(automationRow)) return;
        if (!prestigeGainWorthwhile(layerId, auto.gainFraction)) return;
        automated = true;
    });
    return automated;
}

// "Auto-prestige AT THRESHOLD" (design §5): the automated breakthrough fires only
// when the pending gain is at least gainFraction of the layer's current currency.
// gameLoop runs the tree loop (where auto-prestige zeroes Qi) BEFORE the side loop
// (where meridian autobuy spends it); without this gate, a granted q auto-prestige
// would reset at bare canReset every tick and starve every Qi sink in the game.
// The fraction is data (the automation row); the gain reads the engine's own
// getResetGain so the automated decision matches what a manual click would earn.
function prestigeGainWorthwhile(layerId, gainFraction) {
    if (typeof getResetGain !== "function") return true; // engine absent (lint sandbox)
    var currentPoints = player[layerId].points;
    var pendingGain = getResetGain(layerId);
    return pendingGain.gte(currentPoints.times(gainFraction));
}

// Run every granted "buyable" autobuy targeting `layerId`. Called from that layer's
// automate() tick hook (game.js calls layers[layer].automate() each loop). Auto-buys
// while affordable, respecting the buyable's own unlocked flag + purchaseLimit EXACTLY
// as a manual click would (it routes through buyBuyable, the same path the UI uses, so
// canBuy — which folds unlocked + canAfford + the purchase limit — gates every buy).
function runBuyableAutomationFor(layerId) {
    if (typeof AUTOMATION_DATA === "undefined" || !AUTOMATION_DATA) return;
    AUTOMATION_DATA.forEach(function (automationRow) {
        var auto = automationRow.automates;
        if (auto.action !== "buyable" || auto.layer !== layerId) return;
        if (!automationGranted(automationRow)) return;
        var buyableRow = bodyBuyableByKey(auto.buyableKey);
        if (!buyableRow) return;
        // Buy while the engine reports the buyable buyable. tmp[layer].buyables[id].canBuy
        // is true only when unlocked AND affordable AND below purchaseLimit (TMT's own
        // composite), so this loop terminates at the cap or when Qi runs out — identical
        // to the player holding the buy button (no automation-only fast path, §1.7).
        var safetyBound = new Decimal(buyableRow.limit);
        var guardCount = factoryDecimalZero();
        while (tmp[layerId] && tmp[layerId].buyables && tmp[layerId].buyables[buyableRow.id]
            && tmp[layerId].buyables[buyableRow.id].canBuy
            && guardCount.lte(safetyBound)) {
            buyBuyable(layerId, buyableRow.id);
            guardCount = guardCount.add(FACTORY_ONE);
        }
    });
}

// The current cultivation frontier endgame (expansion §5; consumed by mod.js
// isEndgame()). The "demo complete" beat moves from the v0.1 forged-core to the
// Nascent Soul frontier: the game is endgame once the HIGHEST-row realm's LAST
// sub-stage is reached on its high-water best. Reads the top realm by row from
// REALM_DATA (data-driven — adding a higher realm row automatically advances the
// frontier), defensive when that realm is unseeded (realmBest returns zero).
function cultivationEndgameReached() {
    var topRealm = REALM_DATA[FACTORY_ZERO];
    REALM_DATA.forEach(function (realmData) {
        if (realmData.row > topRealm.row) topRealm = realmData;
    });
    var lastSubstage = topRealm.substages[topRealm.substages.length - FACTORY_ONE];
    if (realmBest(topRealm.id).lt(lastSubstage.at)) return false;
    // Generic capstone extension (slice 6, design §5/§6.2): when the highest-row realm carries a
    // TRIBULATION set-piece, reaching its last sub-stage is not enough — the tribulation must also
    // be PASSED (the Act I capstone is the tribulation, not the climb to it). A realm whose
    // set-piece is the forge (or none) needs only the climb, so future acts inherit this generically:
    // the endgame is "top realm maxed AND its capstone tribulation, if any, passed".
    var config = setpieceFor(topRealm);
    if (config && config.kind === "tribulation") return tribulationPassed();
    return true;
}

// ---------------------------------------------------------------------------
// makeBuyable(row) — one parameterized buyable (§4a/§4b).
//   cost(x)   = costBase * costRatio^x
//   effect(x) = effectBase^x
//   purchaseLimit = limit (caps purchasability rather than the curve)
// ---------------------------------------------------------------------------
function makeBuyable(row) {
    return {
        title: row.title,
        cost: function (x) {
            return new Decimal(row.costBase).times(Decimal.pow(row.costRatio, x)).floor();
        },
        effect: function (x) {
            return Decimal.pow(row.effectBase, x);
        },
        purchaseLimit: new Decimal(row.limit),
        unlocked: function () {
            return meets(row.unlock);
        },
        canAfford: function () {
            return player.points.gte(tmp[this.layer].buyables[this.id].cost);
        },
        buy: function () {
            var cost = tmp[this.layer].buyables[this.id].cost;
            player.points = player.points.sub(cost);
            setBuyableAmount(this.layer, this.id, getBuyableAmount(this.layer, this.id).add(FACTORY_ONE));
        },
        display: function () {
            var data = tmp[this.layer].buyables[this.id];
            var amount = getBuyableAmount(this.layer, this.id);
            var line = row.title + "<br>Amount: " + formatWhole(amount) + " / " + formatWhole(row.limit);
            line += "<br>Cost: " + format(data.cost) + " Qi";
            line += "<br>Effect: x" + format(data.effect) + " " + row.resourceWord;
            return line;
        }
    };
}

// ---------------------------------------------------------------------------
// makeTemperMilestones() — one milestone per temper tier (§4b). done() reads the
// live temper level vs. the tier's fromLevel; the +5% is applied in temperMult().
// ---------------------------------------------------------------------------
function makeTemperMilestones() {
    var milestones = {};
    var percentGain = new Decimal(FACTORY_HUNDRED);
    BODY_DATA.temperTiers.forEach(function (tier, index) {
        var bonusPercent = new Decimal(tier.qiBonus).times(percentGain).sub(percentGain);
        milestones[index] = {
            requirementDescription: "Temper Body to " + tier.label + " (level " + tier.fromLevel + ")",
            effectDescription: function () { return "+" + format(bonusPercent) + "% Qi/sec and a step toward Foundation Grade"; },
            done: function () {
                return getBuyableAmount(BODY_DATA.id, BODY_DATA.temperBuyableId).gte(tier.fromLevel);
            }
        };
    });
    return milestones;
}

// ---------------------------------------------------------------------------
// makeBodyLayer() — the reset-immune row:"side" Body layer (§3/§4/§6).
// Fully wired NOW: two meridian buyables + temper buyable, per-tier milestones,
// stored grade slots. NO doReset -> never auto-reset by a realm prestige.
// ---------------------------------------------------------------------------
function makeBodyLayer() {
    var buyablesObject = {};
    BODY_DATA.buyables.forEach(function (row) {
        buyablesObject[row.id] = makeBuyable(row);
    });

    return {
        name: BODY_DATA.name,
        symbol: BODY_DATA.symbol,
        color: BODY_DATA.color,
        row: "side",
        type: "none", // container layer: meridians/temper are buyables, no prestige resource line
        resource: BODY_DATA.resource,
        startData: function () {
            return {
                unlocked: true,
                points: factoryDecimalZero(),
                foundationGrade: BODY_DATA.grades.foundationGrade.startIndex,
                coreGrade: BODY_DATA.grades.coreGrade.startIndex,
                // Chosen Soul Aspect key (expansion §5), life-scoped here so it
                // survives every realm reset. "" = unchosen (BODY_DATA.soulAspect.startKey).
                soulAspect: BODY_DATA.soulAspect.startKey,
                // The failure-Scar slot (design §1.3/§6.2/§10.9), life-scoped here so the scar and
                // its heal arc span resets within a life. scarDepth deepens on a Failed/Scarred
                // tribulation; scarHealProgress is the heal arc; scarHealedDepth tracks converted
                // (permanently-buffed) depths. All seeded from BODY_DATA.scar.start*.
                scarDepth: BODY_DATA.scar.startDepth,
                scarHealProgress: BODY_DATA.scar.startHealProgress,
                scarHealedDepth: BODY_DATA.scar.startHealedDepth
            };
        },
        tooltip: function () { return BODY_DATA.name + " — permanent cultivation (never resets)"; },
        buyables: buyablesObject,
        milestones: makeTemperMilestones(),
        // Automation tick hook (design §1.7/§7.5): game.js calls layers[b].automate()
        // each loop. The meridian buyables (primary + extraordinary) auto-open here once
        // their AUTOMATION_DATA grants are live — Temper is DELIBERATELY excluded (a grade
        // decision, not hands, §4b), so it is never auto-bought. No-op until granted.
        automate: function () { runBuyableAutomationFor(BODY_DATA.id); },
        // Per-tick passive scar healing (design §1.3 heal arc; the warm-the-core pattern). The
        // scar is life-scoped on this never-reset Body layer, so the heal accrual lives here.
        // No-op (identity) until a scar is active (no dead path) — a full bar converts one depth
        // to a permanent "Tempered by Ruin" buff (scarHealTick).
        update: function (diff) { scarHealTick(diff); },
        // No doReset: a row:"side" layer with no doReset is reset-immune (rowReset's
        // auto-reset branch requires !isNaN(row), which is false for "side").
        layerShown: function () { return true; },
        tabFormat: [
            ["display-text", function () {
                return "Permanent body cultivation. Open meridians for faster Qi gathering; "
                    + "temper your body to raise your Foundation ceiling. These never reset.";
            }],
            "blank",
            "milestones",
            "blank",
            "buyables"
        ]
    };
}

// ---------------------------------------------------------------------------
// makeMilestones(substages) — realm sub-stage milestones (§5). Re-derive from
// best, so they reset with the realm by design (§10.3).
// ---------------------------------------------------------------------------
function makeMilestones(realmData) {
    var milestones = {};
    realmData.substages.forEach(function (stage, index) {
        var revealText = "";
        if (realmData.reveals && realmData.reveals[stage.label]) {
            revealText = " (reveals " + realmData.reveals[stage.label] + ")";
        }
        var percentGain = new Decimal(FACTORY_HUNDRED);
        var stageBonus = new Decimal(stage.qiMult).times(percentGain).sub(percentGain);
        milestones[index] = {
            requirementDescription: stage.label + " (" + stage.at + " "
                + realmData.resource + ")" + revealText,
            effectDescription: function () { return "+" + format(stageBonus) + "% Qi/sec"; },
            done: function () {
                return player[realmData.id].best.gte(stage.at);
            }
        };
    });
    return milestones;
}

// ---------------------------------------------------------------------------
// Forge UI builders (§7). One clickable per push option (Steady/Forceful/
// Reckless): clickables are the right primitive for a discrete, one-time action
// (the doc's anti-pattern is repeated-click bonuses, which this is not). Each
// click confirm()s, then performs the forge. A bar + toggle drive refinement.
// All numbers come from REALM_DATA(c).forge — no literals here (§11).
// ---------------------------------------------------------------------------

// Human label for a stored core-grade index ("—" before forging).
function coreGradeLabelForIndex(storedIndex) {
    var row = coreGradeRowForIndex(storedIndex);
    return row ? row.label : "—";
}

// Build one push-option clickable. id is the option's order in pushOptions.
function makeForgePushClickable(pushOption) {
    var percentBase = new Decimal(FACTORY_HUNDRED);
    return {
        title: pushOption.label,
        display: function () {
            var fuelCost = forgeFuelCost(pushOption);
            var crackPercent = new Decimal(pushOption.crackChance).times(percentBase);
            var offsetSign = pushOption.offset > FACTORY_ZERO ? "+" : "";
            var line = "Push +" + formatWhole(new Decimal(pushOption.offset)) + " grade<br>";
            line += "Fuel: " + format(fuelCost) + " " + coreRealmData().resource + "<br>";
            line += "Crack risk: " + format(crackPercent) + "%";
            return line;
        },
        unlocked: function () { return forgeIsAvailable(); },
        canClick: function () { return canAffordForgePush(pushOption); },
        onClick: function () {
            var fuelCost = forgeFuelCost(pushOption);
            var crackPercent = new Decimal(pushOption.crackChance).times(percentBase);
            var prompt = "Forge with " + pushOption.label + "? Spends " + format(fuelCost)
                + " " + coreRealmData().resource + "; " + format(crackPercent)
                + "% chance to crack and drop one grade. This forges your core once.";
            if (!confirm(prompt)) return;
            var resultRow = performForge(pushOption);
            var cracked = player[coreRealmData().id].lastForgeCracked;
            var resultText = "You forged a " + (resultRow ? resultRow.label : coreGradeLabelForIndex(getCoreGradeIndex()))
                + " core" + (cracked ? " (it cracked under the strain)." : ".");
            if (typeof doPopup === "function") {
                doPopup("none", resultText, "Core Forged", FACTORY_NUMERICS.one, coreRealmData().color);
            }
        }
    };
}

// Build the clickables object for the forge realm: one per push option.
function makeForgeClickables() {
    var clickablesObject = {};
    coreForgeData().pushOptions.forEach(function (pushOption, index) {
        clickablesObject[index] = makeForgePushClickable(pushOption);
    });
    return clickablesObject;
}

// Build the refinement bar ("Warm the Core" progress, §7b).
function makeForgeBars() {
    var refine = refinementData();
    return {
        refinement: {
            direction: RIGHT,
            width: refine.barWidth,
            height: refine.barHeight,
            unlocked: function () { return coreIsForged(); },
            progress: function () {
                if (!refinementCanProgress()) return factoryDecimalOne();
                return refinementBarFraction();
            },
            display: function () {
                if (!refinementCanProgress()) {
                    return "Core at its Foundation ceiling (" + coreGradeLabelForIndex(getCoreGradeIndex()) + ")";
                }
                var pct = refinementBarFraction().times(FACTORY_HUNDRED);
                return "Warming: " + format(pct) + "% to next grade";
            }
        }
    };
}

// The "Warm the Core" toggle (§7b): a dedicated clickable appended after the push
// options. Toggling it starts/pauses slow, safe refinement accrual.
function makeWarmToggleClickable() {
    return {
        title: "Warm the Core",
        display: function () {
            return refinementIsWarming()
                ? "Warming (slow, safe). Click to pause."
                : "Paused. Click to warm the core toward its next grade.";
        },
        unlocked: function () { return refinementCanProgress(); },
        canClick: function () { return true; },
        onClick: function () {
            var realmId = coreRealmData().id;
            player[realmId].warming = !refinementIsWarming();
        }
    };
}

// ---------------------------------------------------------------------------
// Soul Aspect UI builders (expansion §5). The aspect pick is the Nascent Soul's
// set-piece, mounted on the n layer the same way the forge mounts on c — one
// clickable per aspect, keyed off realmData.soulAspect. Pinned pick semantics:
//   - clickables are VISIBLE only after the first n prestige AND while unchosen
//     (player.b.soulAspect === ""); once an aspect is picked they all vanish (the
//     pick is ONCE per life, no respec).
//   - Formless (requires {}) is ALWAYS clickable — the completability floor.
//   - an element aspect's clickable is visible but UNCLICKABLE (canClick false, with
//     its requirement shown) until its daoElementTier gate is met.
//   - picking costs NOTHING; it confirm()s, then stores the key.
// ---------------------------------------------------------------------------

// True once the soul has taken any form (an aspect is chosen this life).
function soulAspectChosen() {
    return getSoulAspectKey() !== BODY_DATA.soulAspect.startKey;
}

// True once Nascent Soul has been broken through at least once this life — the soul
// exists, so it may take a form. realmBest reads the n layer's high-water (defensive
// when n is unseeded). The aspect pick opens "after first n prestige" (pinned).
function nascentSoulBrokenThrough(realmData) {
    return realmBest(realmData.id).gte(realmData.substages[FACTORY_ZERO].at);
}

// Plain-language requirement for a still-locked element aspect's clickable tooltip.
function describeAspectRequirement(aspect) {
    if (!aspect.requires || aspect.requires.daoElementTier === undefined) return "";
    var element = aspect.requires.daoElementTier[FACTORY_ZERO];
    var tierNumber = aspect.requires.daoElementTier[FACTORY_ONE];
    var tierLabel = LATTICE_DATA && LATTICE_DATA.tiers && LATTICE_DATA.tiers[tierNumber - FACTORY_ONE]
        ? LATTICE_DATA.tiers[tierNumber - FACTORY_ONE].label
        : "";
    return "Requires a " + tierLabel + " of a " + element + " Dao node.";
}

// One aspect-pick clickable. `realmData` is the aspect-bearing realm (for the
// visibility gate); `aspect` is the aspect data row.
function makeSoulAspectClickable(realmData, aspect) {
    var percentBase = new Decimal(FACTORY_HUNDRED);
    function effectLine() {
        var parts = [];
        if (aspect.effect.qiMult !== undefined) {
            var qiPercent = new Decimal(aspect.effect.qiMult).times(percentBase).sub(percentBase);
            parts.push("+" + format(qiPercent) + "% Qi/sec");
        }
        if (aspect.effect.insightMult !== undefined) {
            var insightPercent = new Decimal(aspect.effect.insightMult).times(percentBase).sub(percentBase);
            parts.push("+" + format(insightPercent) + "% Insight/sec");
        }
        return parts.join(", ");
    }
    return {
        title: aspect.label,
        display: function () {
            var line = aspect.label + "<br>" + effectLine();
            if (!meets(aspect.requires)) {
                line += "<br><i>" + describeAspectRequirement(aspect) + "</i>";
            } else {
                line += "<br>Click to bind your soul to this aspect (permanent this life).";
            }
            return line;
        },
        // Visible only after first NS breakthrough AND while no aspect is chosen.
        unlocked: function () {
            return nascentSoulBrokenThrough(realmData) && !soulAspectChosen();
        },
        // Formless (requires {}) is always clickable; element aspects gate on their
        // daoElementTier requirement (held Seed of that element).
        canClick: function () {
            return !soulAspectChosen() && meets(aspect.requires);
        },
        onClick: function () {
            if (soulAspectChosen()) return; // once per life (defensive against double-fire)
            // Re-verify the gate at fire time, not just in canClick: a future slice
            // (reincarnation resets lattice Seeds) could otherwise race a cached
            // clickable into storing an aspect whose requirement no longer holds.
            if (!meets(aspect.requires)) return;
            var prompt = "Bind your nascent soul to the " + aspect.label
                + "? This is permanent for this life — the soul takes one form and keeps it.";
            if (!confirm(prompt)) return;
            setSoulAspectKey(aspect.key);
            if (typeof doPopup === "function") {
                doPopup("none", "Your soul takes form: " + aspect.label + ".",
                    "Soul Aspect", FACTORY_NUMERICS.one, realmData.color);
            }
        }
    };
}

// Build the aspect clickables object: one per aspect, id = its order in the set.
function makeSoulAspectClickables(realmData) {
    var clickablesObject = {};
    realmData.soulAspect.aspects.forEach(function (aspect, index) {
        clickablesObject[index] = makeSoulAspectClickable(realmData, aspect);
    });
    return clickablesObject;
}

// ---------------------------------------------------------------------------
// Tribulation UI builders (design §6.2; SETPIECE_DATA.firstTribulation). The Begin clickable +
// the timed multi-wave bar mount on the Soul Formation (s) realm EXACTLY as the forge mounts on
// c — the forge-clickable pattern (confirm()s, shows the prep pool and what feeds it). Pinned
// semantics: the Begin clickable is VISIBLE while the tribulation is ready (trigger met, not
// passed, cooldown elapsed) and CLICKABLE then; banked Qi is consumed as fuel at trigger; the run
// is a TMT bar + update(diff); NO mid-run actions in v1 (pills/talismans arrive in slice 7+,
// design §7.6 ⟨design⟩). On resolve the tick latches the grade and fires the Legacy/scar effects.
// ALL numbers resolve from SETPIECE_DATA.firstTribulation / FACTORY_NUMERICS — zero literals (§11).
// ---------------------------------------------------------------------------

// A human one-line summary of the prepared pool and what feeds it (the Begin display + prompt).
function tribulationPoolSummary() {
    var pool = tribulationPreparednessPool();
    return "Prepared pool: " + format(pool)
        + " (from temper, meridians, your core grade, techniques, and banked Qi as fuel)";
}

// The Begin-tribulation clickable (the forge-push-clickable pattern). One clickable, id 0.
function makeTribulationBeginClickable(realmData) {
    return {
        title: "Face the Tribulation",
        display: function () {
            var config = tribulationConfig();
            if (tribulationPassed()) {
                var passedRow = tribulationGradeRow();
                return "The tribulation is behind you (" + (passedRow ? passedRow.label : "passed") + ").";
            }
            if (tribulationIsActive()) {
                return "The heavens descend — endure.";
            }
            if (!tribulationCooldownElapsed()) {
                return "The heavens recede. Re-prepare before you call them again ("
                    + format(new Decimal(tribulationCooldownUntil())) + "s).";
            }
            var line = tribulationPoolSummary() + "<br>";
            line += "Banked Qi is consumed as fuel when you begin. Failure marks you with a Scar "
                + "but destroys nothing else — re-prepare and try again.<br>";
            line += "<i>No actions mid-run in this life; endure what you prepared for.</i>";
            return line;
        },
        // Visible whenever the tribulation is ready OR a run is active (so the player sees the
        // climax unfold), and during the post-Failed cooldown (so the re-prep timer shows).
        unlocked: function () {
            return tribulationIsReady() || tribulationIsActive()
                || (!tribulationPassed() && !tribulationCooldownElapsed()
                    && meets(tribulationConfig().trigger));
        },
        canClick: function () { return tribulationIsReady(); },
        onClick: function () {
            if (!tribulationIsReady()) return;
            var pool = tribulationPreparednessPool();
            var prompt = "Call down the First Tribulation? Your banked Qi (" + format(player.points)
                + ") is consumed as fuel. " + tribulationPoolSummary()
                + ". A higher remaining pool earns a finer grade; an emptied pool means failure "
                + "(a Scar, but nothing else is lost). Begin?";
            if (!confirm(prompt)) return;
            beginTribulation();
            if (typeof doPopup === "function") {
                doPopup("none", "The heavens darken. The First Tribulation begins.",
                    "Tribulation", FACTORY_NUMERICS.one, realmData.color);
            }
        }
    };
}

function makeTribulationClickables(realmData) {
    var clickablesObject = {};
    clickablesObject[FACTORY_ZERO] = makeTribulationBeginClickable(realmData);
    return clickablesObject;
}

// The tribulation bar (the forge refinement-bar pattern). Shows the draining pool as a fraction
// of its starting max while active; empty/idle otherwise. Bar dimensions reuse the forge's
// refinement bar dimensions (a UI dimension as data, §11) — the set-pieces share a visual size.
function makeTribulationBars() {
    var barConfig = coreForgeData().refinement;   // reuse the forge bar's width/height (data, §11)
    return {
        tribulation: {
            direction: RIGHT,
            width: barConfig.barWidth,
            height: barConfig.barHeight,
            unlocked: function () { return tribulationIsActive() || tribulationPassed(); },
            progress: function () {
                if (!tribulationIsActive()) return tribulationPassed() ? factoryDecimalOne() : factoryDecimalZero();
                return tribulationPoolFraction();
            },
            display: function () {
                if (tribulationPassed()) {
                    var row = tribulationGradeRow();
                    return "Endured: " + (row ? row.label : "passed");
                }
                if (!tribulationIsActive()) return "Awaiting the heavens.";
                var realmData = tribulationRealmData();
                var pct = tribulationPoolFraction().times(FACTORY_HUNDRED);
                var wavesDone = player[realmData.id].tribWaveIndex;
                var waveTotal = tribulationConfig().waves.length;
                return "Pool: " + format(pct) + "% — wave " + formatWhole(new Decimal(wavesDone))
                    + " / " + formatWhole(new Decimal(waveTotal));
            }
        }
    };
}

// ---------------------------------------------------------------------------
// makeRealmLayer(r) — one parameterized realm prestige layer (§5). Numbered rows
// reset the chain below them via the default rowReset cascade. The forge realm
// (carrying realmData.forge) additionally mounts the one-time forge clickables,
// the refinement bar + warm toggle, refinement state, and an update() accruer.
// ---------------------------------------------------------------------------
function makeRealmLayer(realmData) {
    var layerData = {
        name: realmData.name,
        symbol: realmData.symbol,
        color: realmData.color,
        row: realmData.row,
        resource: realmData.resource,
        baseResource: function () { return modInfo.pointsName; },
        baseAmount: function () { return player.points; },
        type: "normal",
        requires: function () { return new Decimal(realmData.reqBase); },
        exponent: realmData.gainExp,
        // Graded realms (Foundation, §6) multiply prestige gain by the stored
        // Foundation grade's fMult; ungraded realms gain the identity. This is the
        // live consumer of grade.bands[].fMult — no dead multiplier (§9.2).
        gainMult: function () {
            if (realmData.graded) return foundationGradeMult();
            return factoryDecimalOne();
        },
        gainExp: function () { return factoryDecimalOne(); },
        // Graded breakthrough (§6): at the Foundation reset, compute gradeScore
        // from live meridian / temper / q.best state and store the band index on
        // the reset-immune Body layer. Runs before the gain is applied and before
        // the row cascade resets q (game.js doReset order), so inputs are intact.
        onPrestige: function () {
            if (realmData.graded) computeAndStoreFoundationGrade();
        },
        // Base prestige-layer state. getStartLayerData (save.js) does NOT seed
        // points and defaults unlocked->true, so every normal realm must declare
        // its own: points (the prestige currency, read as player[id].points) and
        // unlocked:false so the realm starts gated (layerShown reveals it via the
        // unlock condition). The forge realm (c) overrides this below with its
        // richer refinement state. All values resolve from FACTORY_NUMERICS (§11).
        startData: function () {
            return {
                unlocked: false,
                points: factoryDecimalZero(),
                best: factoryDecimalZero(),
                total: factoryDecimalZero()
            };
        },
        milestones: makeMilestones(realmData),
        unlocked: function () {
            if (player[this.layer].unlocked) return true;
            return meets(realmData.unlock);
        },
        layerShown: function () {
            // §5a reveal: show the node on the (weaker) reveal gate so the next realm
            // visibly appears, while the breakthrough stays gated below.
            return player[this.layer].unlocked || meets(realmRevealCondition(realmData));
        },
        // §5b breakthrough gate: the first prestige needs the FULL unlock (e.g. 6th
        // Level AND >=4 meridians); afterwards the unlock is latched (game.js sets
        // player[layer].unlocked on first reset) and the realm prestiges on its Qi
        // requirement alone. Without this a revealed realm would prestige early —
        // game.js canReset gates the reset; `unlocked` does not.
        canReset: function () {
            if (!player[this.layer].unlocked && !meets(realmData.unlock)) return false;
            return player.points.gte(new Decimal(realmData.reqBase));
        },
        // Tooltip on the revealed-but-locked node: state exactly what the breakthrough
        // still needs (the feedback a bare reveal would otherwise omit).
        tooltipLocked: function () {
            return "Locked — " + describeUnlockCondition(realmData.unlock)
                + ", then gather " + format(new Decimal(realmData.reqBase)) + " " + modInfo.pointsName + ".";
        },
        // Automation (design §1.7/§7.5): a realm auto-prestiges once an AUTOMATION_DATA
        // "prestige" row targeting it is granted. game.js's gameLoop reads tmp[id].
        // autoPrestige and runs `if (autoPrestige && canReset) doReset(id)` — the
        // engine's own prestige path, so the automated breakthrough is identical to a
        // manual one (same canReset gate, same gain). Identity (false) until granted,
        // so a pre-Nascent-Soul save behaves exactly as before (no auto-prestige).
        autoPrestige: function () { return layerPrestigeAutomated(realmData.id); },
        // effect() exposes the realm's reached-substage Qi multiplier so it is
        // observable in tmp[id].effect (no dead multiplier §9.2).
        effect: function () {
            var product = factoryDecimalOne();
            realmData.substages.forEach(function (stage, index) {
                if (hasMilestone(realmData.id, index)) product = product.times(stage.qiMult);
            });
            return product;
        }
    };

    // Compiled doReset (design §8.1/§8.2): attached ONLY to tree-scoped layers, so
    // a higher-row tree layer prestiging resets lower-row tree layers in the same
    // tree (the default cascade), now carrying earned KEEP_RULES keys. Life/eternal
    // layers get NO doReset — their reset immunity stays topological (rowReset's
    // auto-branch requires !isNaN(row), false for row:"side"). With no keep rule
    // earned this behaves byte-for-byte like the prior default cascade.
    // NOTE: carrying a doReset also opts the layer into rowReset's
    // activeChallenge-clear branch (game.js), which the default branch skips. Benign
    // while realms declare no challenges; a future realm-with-challenge inherits
    // clear-on-cascade semantics intentionally.
    var thisTreeEntry = treeLayerEntry(realmData.id);
    if (thisTreeEntry && thisTreeEntry.scope === TREE_SCOPE_TREE) {
        layerData.doReset = makeTreeDoReset();
    }

    // Forge realm augmentation (§7): the one-time forge + refinement loop. Only the
    // realm carrying the "forge" set-piece (Core Formation) gets these; the math/UI all
    // resolve from SETPIECE_DATA.forge (via coreForgeData), so no other realm is touched.
    // Keyed on realmData.setpiece === "forge" (the migration, slice 6) — once it keyed on
    // the inline realmData.forge; the skeleton is identical, the config moved to one table.
    if (realmData.setpiece === "forge") {
        var warmToggleId = coreForgeData().pushOptions.length;
        var forgeClickables = makeForgeClickables();
        forgeClickables[warmToggleId] = makeWarmToggleClickable();

        layerData.clickables = forgeClickables;
        layerData.bars = makeForgeBars();

        // Refinement state on the never-reset top realm: progress toward the next
        // tier and whether the player is actively warming the core.
        layerData.startData = function () {
            return {
                unlocked: false,
                points: factoryDecimalZero(),
                best: factoryDecimalZero(),
                total: factoryDecimalZero(),
                refinementProgress: factoryDecimalZero(),
                warming: false,
                lastForgeCracked: false
            };
        };

        // Accrue refinement each tick while warming and below the ceiling (§7b).
        layerData.update = function (diff) { refinementTick(diff); };

        layerData.tabFormat = [
            "main-display",
            "prestige-button",
            "resource-display",
            "blank",
            "milestones",
            "blank",
            ["display-text", function () {
                if (!coreIsForged()) {
                    var band = storedFoundationBand();
                    var baseLabel = band ? coreGradeLabelForIndex(coreBaseGradeIndex()) : "—";
                    var ceilingLabel = band ? coreGradeLabelForIndex(coreCeilingGradeIndex()) : "—";
                    return "Forge your Golden Core. Your " + (band ? band.tier : "—")
                        + " Foundation yields a base " + baseLabel
                        + " core (ceiling: " + ceilingLabel
                        + "). Push harder for a higher grade at the risk of a crack.";
                }
                return "Your core is forged: <b>" + coreGradeLabelForIndex(getCoreGradeIndex())
                    + "</b> (ceiling " + coreGradeLabelForIndex(coreCeilingGradeIndex())
                    + "). Warm it slowly to climb toward the ceiling without risk.";
            }],
            "blank",
            "clickables",
            "blank",
            ["bar", "refinement"]
        ];
    }

    // Soul Aspect realm augmentation (expansion §5): the Nascent Soul realm carries a
    // soulAspect set-piece config, mounted EXACTLY like the forge augmentation above —
    // keyed on realmData.soulAspect, so no other realm is touched. Mounts the aspect-
    // pick clickables (the soul takes a form on first breakthrough) and seeds the
    // realm tab with the pick. The chosen aspect is stored on the Body layer, so this
    // realm needs no extra startData (its base realm state above is unchanged).
    if (realmData.soulAspect) {
        layerData.clickables = makeSoulAspectClickables(realmData);
        layerData.tabFormat = [
            "main-display",
            "prestige-button",
            "resource-display",
            "blank",
            "milestones",
            "blank",
            ["display-text", function () {
                if (!nascentSoulBrokenThrough(realmData)) {
                    return "Break through to Nascent Soul. On your first breakthrough the "
                        + "soul takes a form — choose an aspect to shape its run-long identity.";
                }
                if (!soulAspectChosen()) {
                    return "Your nascent soul awaits a form. Choose its aspect — Formless is "
                        + "always open; an elemental aspect needs a held Seed of that element.";
                }
                var chosen = soulAspectRow();
                return "Your soul has taken form: <b>" + (chosen ? chosen.label : "—")
                    + "</b>. This identity holds for the rest of this life.";
            }],
            "blank",
            "clickables"
        ];
    }

    // Tribulation realm augmentation (design §6.2; SETPIECE_DATA.firstTribulation). The Soul
    // Formation realm carries the "firstTribulation" set-piece — mounted EXACTLY like the forge
    // augmentation, keyed on realmData.setpiece, so no other realm is touched. Mounts the Begin
    // clickable + the timed wave bar, seeds the run-state on player.s, and accrues the run each
    // tick via tribulationTick (the refinementTick precedent). The s prestige itself stays an
    // ordinary realm prestige (above); the tribulation is the capstone the realm builds toward.
    if (realmData.setpiece === "firstTribulation") {
        layerData.clickables = makeTribulationClickables(realmData);
        layerData.bars = makeTribulationBars();

        // Tribulation run-state on the s layer (design §FACTORY SURFACE pinned names): all seeded
        // here so a fresh s save has a well-defined run-state, and the smoke harness reads them by
        // these exact names. tribGrade -1 = unresolved; tribCooldownUntil = remaining cooldown secs.
        layerData.startData = function () {
            return {
                unlocked: false,
                points: factoryDecimalZero(),
                best: factoryDecimalZero(),
                total: factoryDecimalZero(),
                tribActive: false,
                tribElapsed: FACTORY_ZERO,
                tribPool: factoryDecimalZero(),
                tribPoolMax: factoryDecimalZero(),
                tribWaveIndex: FACTORY_ZERO,
                tribGrade: FACTORY_ZERO - FACTORY_ONE,
                tribCooldownUntil: FACTORY_ZERO
            };
        };

        // Accrue the tribulation run (and drain any retry cooldown) each tick (§6.2).
        layerData.update = function (diff) { tribulationTick(diff); };

        layerData.tabFormat = [
            "main-display",
            "prestige-button",
            "resource-display",
            "blank",
            "milestones",
            "blank",
            ["display-text", function () {
                if (tribulationPassed()) {
                    var passedRow = tribulationGradeRow();
                    var band = actOneLegacyBand();
                    var legacyText = band ? (" Your life's record stands as a <b>" + band.label + "</b>.") : "";
                    return "You endured the First Tribulation (<b>" + (passedRow ? passedRow.label : "passed")
                        + "</b>)." + legacyText + " The mortal road is complete.";
                }
                if (tribulationIsActive()) {
                    return "The heavens have descended. Endure the waves — what remains of your "
                        + "prepared pool when the last wave breaks decides your grade.";
                }
                if (!tribulationIsReady() && !meets(tribulationConfig().trigger)) {
                    return "Climb Soul Formation to its Great Circle, then call down the First "
                        + "Tribulation when you are prepared — the capstone of the mortal road.";
                }
                return "You stand at the edge of the mortal road. Prepare your pool — temper, "
                    + "meridians, your core grade, techniques, and banked Qi as fuel — then face "
                    + "the First Tribulation when ready. Failure marks you, but never walls you.";
            }],
            "blank",
            "clickables",
            "blank",
            ["bar", "tribulation"]
        ];
    }

    return layerData;
}

// ---------------------------------------------------------------------------
// makeGateLayer() — the row:"side" story-gate achievements layer (§8). Each gate
// is an achievement: done() reads live cross-layer state via meets(); the
// permanent global buff is applied in gateMult(). Resets nothing.
// ---------------------------------------------------------------------------
function makeGateLayer() {
    var achievementsObject = {};
    GATE_DATA.achievements.forEach(function (ach) {
        var percentGain = new Decimal(FACTORY_HUNDRED);
        var qiMultBonusPercent = null;
        if (ach.effect && ach.effect.qiMult !== undefined) {
            qiMultBonusPercent = new Decimal(ach.effect.qiMult).times(percentGain).sub(percentGain);
        }
        achievementsObject[ach.id] = {
            name: ach.name,
            done: function () { return meets(ach.done); },
            tooltip: function () { return qiMultBonusPercent === null ? "" : "+" + format(qiMultBonusPercent) + "% Qi/sec"; }
        };
    });

    return {
        name: GATE_DATA.name,
        symbol: GATE_DATA.symbol,
        color: GATE_DATA.color,
        row: "side",
        type: "none", // story-gate achievements only; no prestige resource line
        startData: function () { return { unlocked: true }; },
        tooltip: function () { return GATE_DATA.name + " — milestones grant permanent boons"; },
        achievements: achievementsObject,
        layerShown: function () { return true; },
        tabFormat: [
            ["display-text", function () {
                return "The record of your deeds. Milestones recognised here grant permanent "
                    + "boons and never reset — your sect, and its standing, live on the Sect tab.";
            }],
            "blank",
            "achievements"
        ]
    };
}

// ---------------------------------------------------------------------------
// makeDaoLayer() — the LIFE-scoped row:"side" Dao lattice container (design §4.2/§6.1).
// type:"none" container (like Body): Insight is player.dao.points, but the lattice has no
// prestige resource line — nodes are buyables, stances are clickable toggles. Revealed
// mid-Qi-Condensation and never reset within a life. ALL numbers resolve from LATTICE_DATA /
// STANCE_DATA / FACTORY_NUMERICS — zero literals (§11).
// ---------------------------------------------------------------------------

// One lattice node buyable (design §4.2). purchaseLimit = the tier count, so a node tops
// out at Seed; cost(x) reads costs[x]; unlocked when every prerequisite node owns tier >= 1
// (Glimpse). Buying spends Insight (player.dao.points).
function makeDaoNodeBuyable(node) {
    var tierCount = LATTICE_DATA.tiers.length;
    return {
        title: node.name,
        cost: function (x) {
            // x is the NEXT tier index (0 Glimpse, 1 Seed); cost is positional over costs[].
            // Slice-5 fold (design §4.3 "Dao-lattice discount region"): the joined sect's
            // archetype discounts ITS element's lattice nodes — costs[x] x sectLatticeDiscount
            // (node.element). The discount is IDENTITY (1) when unjoined or when the node's
            // element is not the archetype's, so a lattice-before-sect / pre-slice-5 save reads
            // byte-identical to costs[x] (no behavioural change off the discount region). The
            // floor() matches the meridian/buyable cost convention so the displayed price is integral.
            // max(1): a future cheap node (cost 1-3) discounted then floored could read 0 —
            // a free Dao node. A comprehension is never free (§4.2 scarcity).
            return new Decimal(node.costs[x]).times(sectLatticeDiscount(node.element))
                .floor().max(factoryDecimalOne());
        },
        effect: function (x) {
            // Effect of the tier just past (x), surfaced in tmp for the display (no dead mult).
            var tierIndex = x > FACTORY_ZERO ? x - FACTORY_ONE : FACTORY_ZERO;
            return node.effects[tierIndex];
        },
        purchaseLimit: new Decimal(tierCount),
        unlocked: function () {
            // A node reveals once all its prerequisites own at least a Glimpse (tier >= 1).
            var allMet = true;
            node.requires.forEach(function (prereqKey) {
                if (daoNodeTierOwned(prereqKey).lt(FACTORY_ONE)) allMet = false;
            });
            return allMet;
        },
        canAfford: function () {
            return player[this.layer].points.gte(tmp[this.layer].buyables[this.id].cost);
        },
        buy: function () {
            var cost = tmp[this.layer].buyables[this.id].cost;
            player[this.layer].points = player[this.layer].points.sub(cost);
            setBuyableAmount(this.layer, this.id, getBuyableAmount(this.layer, this.id).add(FACTORY_ONE));
        },
        display: function () {
            var owned = getBuyableAmount(this.layer, this.id);
            var ownedWhole = owned.toNumber();
            var nextTierIndex = ownedWhole;
            var ownedTierLabel = ownedWhole > FACTORY_ZERO
                ? LATTICE_DATA.tiers[ownedWhole - FACTORY_ONE].label
                : "—";
            var line = node.name + "<br>Owned: " + ownedTierLabel
                + " (" + formatWhole(owned) + " / " + formatWhole(new Decimal(tierCount)) + ")";
            if (nextTierIndex < tierCount) {
                var nextTier = LATTICE_DATA.tiers[nextTierIndex];
                var nextEffect = node.effects[nextTierIndex];
                var effectWord = nextEffect.qiMult !== undefined ? "Qi/sec" : "Insight/sec";
                var effectValue = nextEffect.qiMult !== undefined ? nextEffect.qiMult : nextEffect.insightMult;
                line += "<br>Next: " + nextTier.label + " — x" + format(new Decimal(effectValue))
                    + " " + effectWord;
                // Show the DISCOUNTED price (the sect fold), so the display matches what cost()
                // actually charges (§4.3). Identity when unjoined / off the discount region.
                var discountedNextCost = new Decimal(node.costs[nextTierIndex])
                    .times(sectLatticeDiscount(node.element)).floor().max(factoryDecimalOne());
                line += "<br>Cost: " + format(discountedNextCost) + " "
                    + LATTICE_DATA.insight.resource;
            } else {
                line += "<br>Fully comprehended.";
            }
            return line;
        }
    };
}

function makeDaoNodeBuyables() {
    var buyablesObject = {};
    LATTICE_DATA.nodes.forEach(function (node) {
        buyablesObject[node.buyableId] = makeDaoNodeBuyable(node);
    });
    return buyablesObject;
}

// One stance toggle clickable (design §6.1). Pinned semantics: clicking an inactive stance
// activates it and (maxActive 1) deactivates any other; clicking the active stance turns it
// off. Free, costless, instant — no resource, no reset. Display shows the modifiers as
// percentages and the active state.
function makeStanceClickable(stance) {
    var percentBase = new Decimal(FACTORY_HUNDRED);
    function modifierLine() {
        var parts = [];
        if (stance.modifiers.qiMult !== undefined) {
            var qiPercent = new Decimal(stance.modifiers.qiMult).times(percentBase);
            parts.push("Qi/sec " + format(qiPercent) + "%");
        }
        if (stance.modifiers.insightMult !== undefined) {
            var insightPercent = new Decimal(stance.modifiers.insightMult).times(percentBase);
            parts.push("Insight/sec " + format(insightPercent) + "%");
        }
        return parts.join(", ");
    }
    return {
        title: stance.name,
        display: function () {
            var isActive = player[this.layer].activeStance === stance.key;
            var line = stance.name + (isActive ? " — ACTIVE" : "") + "<br>" + modifierLine();
            line += isActive ? "<br>Click to release." : "<br>Click to enter this stance.";
            return line;
        },
        unlocked: function () { return meets(stance.unlock); },
        canClick: function () { return true; },
        onClick: function () {
            // Toggle exclusivity (maxActive 1, §6.1): same stance -> off; otherwise -> this one.
            if (player[this.layer].activeStance === stance.key) {
                player[this.layer].activeStance = "";
            } else {
                player[this.layer].activeStance = stance.key;
            }
        }
    };
}

function makeStanceClickables() {
    var clickablesObject = {};
    STANCE_DATA.stances.forEach(function (stance) {
        clickablesObject[stance.clickableId] = makeStanceClickable(stance);
    });
    return clickablesObject;
}

function makeDaoLayer() {
    return {
        name: LATTICE_DATA.name,
        symbol: LATTICE_DATA.symbol,
        color: LATTICE_DATA.color,
        row: "side",
        type: "none", // container layer: Insight is the resource, but nodes/stances drive it
        resource: LATTICE_DATA.insight.resource,
        startData: function () {
            return {
                unlocked: true,
                revealed: false,        // latched true once the reveal gate is first met (§4.2)
                points: factoryDecimalZero(),  // Insight
                activeStance: ""        // "" = no stance active (§6.1)
            };
        },
        tooltip: function () {
            return LATTICE_DATA.name + " — comprehension (never resets this life)";
        },
        buyables: makeDaoNodeBuyables(),
        clickables: makeStanceClickables(),
        // §4.2 reveal: hidden until q 4th Level, then latched shown for the rest of the life.
        layerShown: function () {
            if (player[this.layer].revealed) return true;
            return daoIsRevealed();
        },
        // Accrue Insight only while revealed (no pre-unlock banking, §4.2). Latch the
        // revealed flag the first tick the gate is met so layerShown/insightPerSecond
        // stay stable even if the player later resets a realm below the reveal gate.
        update: function (diff) {
            if (!player[this.layer].revealed && daoIsRevealed()) {
                player[this.layer].revealed = true;
            }
            if (!player[this.layer].revealed) return;
            player[this.layer].points = player[this.layer].points.add(insightPerSecond().times(diff));
        },
        tabFormat: [
            ["display-text", function () {
                var perSecond = insightPerSecond();
                var nodeFactor = daoNodeInsightMult();
                var stanceFactor = stanceInsightMult();
                var line = "Comprehension trickles in as <b>Insight</b>, the second cultivation grammar. "
                    + "Spend it on lattice nodes (permanent Qi / Insight bonuses) and enter stances "
                    + "(free toggles that trade one resource for another).<br><br>";
                line += LATTICE_DATA.insight.resource + ": <b>" + format(player[this.layer].points) + "</b><br>";
                line += LATTICE_DATA.insight.resource + "/sec: <b>" + format(perSecond) + "</b> "
                    + "(base " + format(new Decimal(LATTICE_DATA.insight.baseRate))
                    + " x nodes " + format(nodeFactor)
                    + " x stance " + format(stanceFactor) + ")";
                return line;
            }],
            "blank",
            ["display-text", function () { return "<b>Lattice nodes</b>"; }],
            "buyables",
            "blank",
            ["display-text", function () { return "<b>Stances</b>"; }],
            "clickables"
        ]
    };
}

// ---------------------------------------------------------------------------
// Sect side-spine readers (design §4.3, slice 5). The sect is the THIRD grammar:
// a LIFE-scoped row:"side" type:"none" container whose currency (player.sect.points)
// is CONTRIBUTION. Every reader is defensive like the Body/Dao readers (the sect
// layer may be unseeded on a pre-slice-5 save), so each returns an identity / zero
// when the layer is absent — a pre-sect save is byte-for-byte the prior product.
// ALL numbers resolve from SECT_DATA / TECHNIQUE_DATA / FACTORY_NUMERICS (§11).
// ---------------------------------------------------------------------------
function sectLayerId() { return SECT_DATA.id; }

function sectExists() {
    return !!(player[sectLayerId()] && player[sectLayerId()].unlocked);
}

// True once the reveal gate (SECT_DATA.reveal) has been met. Latched on the sect layer's
// `revealed` flag so the tab stays shown once seen (§5a reveal-latch, the dao precedent) —
// the archetype pick and contribution accrual open only while this is true.
function sectIsRevealed() {
    if (sectExists() && player[sectLayerId()].revealed) return true;
    return meets(SECT_DATA.reveal);
}

// PINNED SURFACE: an archetype has been chosen (player.sect.archetype !== ""). Defensive
// when the sect layer is unseeded (a pre-slice-5 save has no player.sect) — returns false.
function sectJoined() {
    if (!sectExists()) return false;
    return player[sectLayerId()].archetype !== "";
}

// PINNED SURFACE: the chosen archetype's data row, or null when none / unseeded.
function sectArchetypeRow() {
    if (!sectJoined()) return null;
    var chosenKey = player[sectLayerId()].archetype;
    return SECT_DATA.archetypes.find(function (archetype) {
        return archetype.key === chosenKey;
    }) || null;
}

// The sect contribution high-water (player.sect.best), or zero (unseeded). Used by the
// Inner Disciple contribution gate (never falls) and the milestone done() checks. The
// engine's OTHER_LAYERS sweep keeps best = max(best, points) each tick (game.js), so this
// is the never-falling standing the §4.3 horizontal spine wants.
function contributionBest() {
    if (!sectExists()) return factoryDecimalZero();
    return player[sectLayerId()].best;
}

// PINNED SURFACE: contribution/sec = rate x (qi/sec)^exponent while joined, zero otherwise.
// Sub-linear in Qi/sec (exponent < 1, §4.3) so late-game Qi does not trivialize the sect
// economy. Reads the live cultivationQiPerSecond() as the (qi/sec) base. Zero until JOINED
// (no pre-join banking), mirroring the dao layer's reveal-gated Insight trickle.
function contributionPerSecond() {
    if (!sectJoined()) return factoryDecimalZero();
    var qiPerSecond = cultivationQiPerSecond();
    var contributionRate = new Decimal(SECT_DATA.contribution.rate);
    var contributionExponent = new Decimal(SECT_DATA.contribution.exponent);
    return contributionRate.times(qiPerSecond.pow(contributionExponent));
}

// Resolve a sect milestone array index by its key (the milestone id IS the array index, the
// TMT-milestone convention). Returns the index, or the no-tier sentinel when absent.
function sectMilestoneIndexForKey(milestoneKey) {
    var foundIndex = FACTORY_ZERO - FACTORY_ONE;
    SECT_DATA.milestones.forEach(function (milestone, index) {
        if (milestone.key === milestoneKey) foundIndex = index;
    });
    return foundIndex;
}

// True once a named sect milestone is held (hasMilestone on the sect layer). Defensive when
// the sect layer is unseeded (a milestone of an unregistered layer is simply not held).
function sectMilestoneEarned(milestoneKey) {
    if (!sectExists()) return false;
    var milestoneIndex = sectMilestoneIndexForKey(milestoneKey);
    if (milestoneIndex < FACTORY_ZERO) return false;
    return hasMilestone(sectLayerId(), milestoneIndex);
}

// The sect milestone row carrying the stipend reward (the qiMult-bearing milestone).
function sectStipendMilestoneRow() {
    return SECT_DATA.milestones.find(function (milestone) {
        return milestone.reward && milestone.reward.qiMult !== undefined;
    }) || null;
}

// PINNED SURFACE: the stipend milestone's Qi/sec reward (identity until earned) -> folded
// into cultivationQiPerSecond(). Reads the milestone's reward.qiMult; identity (1) until the
// stipend high-water is met, so a pre-stipend save is byte-identical (no dead mult §9.2).
function sectStipendQiMult() {
    var stipendRow = sectStipendMilestoneRow();
    if (!stipendRow) return factoryDecimalOne();
    if (!sectMilestoneEarned(stipendRow.key)) return factoryDecimalOne();
    return new Decimal(stipendRow.reward.qiMult);
}

// The library milestone row (the milestone whose reward carries libraryTier).
function sectLibraryMilestoneRow() {
    return SECT_DATA.milestones.find(function (milestone) {
        return milestone.reward && milestone.reward.libraryTier !== undefined;
    }) || null;
}

// True once the LIBRARY milestone is held — the gate that opens tier-2 technique rows (§4.3).
function sectLibraryUnlocked() {
    var libraryRow = sectLibraryMilestoneRow();
    if (!libraryRow) return false;
    return sectMilestoneEarned(libraryRow.key);
}

// PINNED SURFACE: the joined archetype's latticeDiscount for ITS element; identity (1) for
// every other element and when unjoined. A discount changes a COST (folded into the dao node
// cost(), §4.3 "Dao-lattice discount region"), so it is NOT a dead-mult entry — but the
// linter verifies the cost fold references this reader.
function sectLatticeDiscount(element) {
    var archetypeRow = sectArchetypeRow();
    if (!archetypeRow) return factoryDecimalOne();
    if (archetypeRow.element !== element) return factoryDecimalOne();
    return new Decimal(archetypeRow.latticeDiscount);
}

// ---- Techniques (TMT upgrades on the sect layer, design §4.3). A technique's TMT upgrade id
// is its index in TECHNIQUE_DATA (positional). A technique is OWNED iff hasUpgrade(sect, index).
function techniqueIsOwned(techniqueIndex) {
    if (!sectExists()) return false;
    return hasUpgrade(sectLayerId(), techniqueIndex);
}

// A technique's school is available iff: school "universal" (always, once joined), or the
// joined archetype teaches it (the technique's key is in the archetype's techniques list).
function techniqueSchoolAvailable(technique) {
    if (!sectJoined()) return false;
    if (technique.school === "universal") return true;
    var archetypeRow = sectArchetypeRow();
    if (!archetypeRow) return false;
    return archetypeRow.techniques.indexOf(technique.key) !== (FACTORY_ZERO - FACTORY_ONE);
}

// A technique's TIER is unlocked iff tier 1 (always, once its school is available) or tier 2
// with the library milestone earned. The deepest gated tier is the library reward.libraryTier.
function techniqueTierUnlocked(technique) {
    var tierOne = FACTORY_ONE;
    if (technique.libraryTier <= tierOne) return true;
    var libraryRow = sectLibraryMilestoneRow();
    if (!libraryRow) return false;
    if (technique.libraryTier <= libraryRow.reward.libraryTier) return sectLibraryUnlocked();
    return false;
}

// A technique upgrade is VISIBLE/BUYABLE iff its school AND its tier are unlocked (§4.3).
function techniqueVisible(technique) {
    return techniqueSchoolAvailable(technique) && techniqueTierUnlocked(technique);
}

// PINNED SURFACE: product of OWNED techniques' qiMult -> cultivationQiPerSecond(). Identity
// until a qiMult technique is owned (no dead mult §9.2).
function techniqueQiMult() {
    var product = factoryDecimalOne();
    if (!sectExists()) return product;
    TECHNIQUE_DATA.forEach(function (technique, index) {
        if (technique.effect.qiMult !== undefined && techniqueIsOwned(index)) {
            product = product.times(technique.effect.qiMult);
        }
    });
    return product;
}

// PINNED SURFACE: product of OWNED techniques' insightMult -> insightPerSecond(). Identity
// until an insightMult technique is owned (no dead mult §9.2).
function techniqueInsightMult() {
    var product = factoryDecimalOne();
    if (!sectExists()) return product;
    TECHNIQUE_DATA.forEach(function (technique, index) {
        if (technique.effect.insightMult !== undefined && techniqueIsOwned(index)) {
            product = product.times(technique.effect.insightMult);
        }
    });
    return product;
}

// ---------------------------------------------------------------------------
// Sect archetype-pick clickables (design §4.3). The soul-aspect clickable pattern
// VERBATIM: visible while the sect layer is revealed AND unjoined; once an archetype is
// picked they all vanish (the pick is ONCE per life). Picking costs NOTHING, confirm()s,
// then stores player.sect.archetype. Both archetypes are ALWAYS pickable (no gates), and
// the gate is re-verified at click time (defensive against a double-fire).
// ---------------------------------------------------------------------------
function makeSectArchetypeClickable(archetype) {
    function archetypeSummary() {
        var percentBase = new Decimal(FACTORY_HUNDRED);
        var discountPercent = percentBase.sub(new Decimal(archetype.latticeDiscount).times(percentBase));
        return archetype.name + " — " + archetype.element + " school; "
            + format(discountPercent) + "% off " + archetype.element + " Dao nodes.";
    }
    return {
        title: archetype.name,
        display: function () {
            return archetypeSummary()
                + "<br>Click to JOIN this sect (permanent this life).";
        },
        // Visible only while the sect is revealed AND no archetype is chosen yet.
        unlocked: function () { return sectIsRevealed() && !sectJoined(); },
        canClick: function () { return !sectJoined(); },
        onClick: function () {
            if (sectJoined()) return; // once per life (defensive against double-fire)
            var prompt = "Join the " + archetype.name
                + "? This is permanent for this life — you take one sect's path and keep it.";
            if (!confirm(prompt)) return;
            player[sectLayerId()].archetype = archetype.key;
            if (typeof doPopup === "function") {
                doPopup("none", "You have joined the " + archetype.name + ".",
                    "Sect Joined", FACTORY_NUMERICS.one, SECT_DATA.color);
            }
        }
    };
}

function makeSectArchetypeClickables() {
    var clickablesObject = {};
    SECT_DATA.archetypes.forEach(function (archetype, index) {
        clickablesObject[index] = makeSectArchetypeClickable(archetype);
    });
    return clickablesObject;
}

// ---------------------------------------------------------------------------
// Technique UPGRADES (design §4.3). One TMT upgrade per TECHNIQUE_DATA row (id = its index).
// cost is in Contribution (player.sect.points), so the default buyUpg path deducts it from
// player.sect.points and persists the purchase in player.sect.upgrades (LIFE-scoped, never
// reset this slice). The upgrade is unlocked() only while its school + tier are available.
// ---------------------------------------------------------------------------
function makeSectTechniqueUpgrade(technique) {
    var percentBase = new Decimal(FACTORY_HUNDRED);
    function effectLine() {
        var parts = [];
        if (technique.effect.qiMult !== undefined) {
            var qiPercent = new Decimal(technique.effect.qiMult).times(percentBase).sub(percentBase);
            parts.push("+" + format(qiPercent) + "% Qi/sec");
        }
        if (technique.effect.insightMult !== undefined) {
            var insightPercent = new Decimal(technique.effect.insightMult).times(percentBase).sub(percentBase);
            parts.push("+" + format(insightPercent) + "% Insight/sec");
        }
        return parts.join(", ");
    }
    return {
        title: technique.name,
        cost: new Decimal(technique.cost),
        // unlocked gates BOTH visibility and purchasability (buyUpg checks tmp.upgrades[id].
        // unlocked). School + tier availability drive it; tier-2 needs the library milestone.
        unlocked: function () { return techniqueVisible(technique); },
        // description is a FUNCTION (lazy): effectLine() calls format(), which is an engine
        // global not yet defined at layer-build time — evaluate it per-render, not at build.
        description: function () { return technique.name + " — " + effectLine() + ". " + technique.flavor; },
        effect: function () { return technique.effect; }
    };
}

function makeSectTechniqueUpgrades() {
    var upgradesObject = {};
    TECHNIQUE_DATA.forEach(function (technique, index) {
        upgradesObject[index] = makeSectTechniqueUpgrade(technique);
    });
    return upgradesObject;
}

// ---------------------------------------------------------------------------
// Sect contribution milestones (design §4.3). One milestone per SECT_DATA.milestones row
// (id = its index). done() reads the contribution high-water (player.sect.best) vs the row's
// `at`, so each latches once earned and never un-earns (the realm-milestone precedent). The
// rewards are consumed live elsewhere (stipend -> sectStipendQiMult; library -> the technique
// tier gate; arsenal -> the AUTOMATION_DATA sectFoundationBell grant) — no dead mult (§9.2).
// ---------------------------------------------------------------------------
function sectMilestoneRewardDescription(milestone) {
    if (milestone.reward.qiMult !== undefined) {
        var percentBase = new Decimal(FACTORY_HUNDRED);
        var qiPercent = new Decimal(milestone.reward.qiMult).times(percentBase).sub(percentBase);
        return "Sect stipend: +" + format(qiPercent) + "% Qi/sec";
    }
    if (milestone.reward.libraryTier !== undefined) {
        return "Library access: unlocks tier-2 techniques";
    }
    return "Arsenal: auto-prestige Foundation at threshold";
}

function makeSectMilestones() {
    var milestones = {};
    SECT_DATA.milestones.forEach(function (milestone, index) {
        milestones[index] = {
            // requirementDescription is rendered raw from tmp (NOT run() as a function, unlike
            // effectDescription), so it must be a plain string — built at make-time from the
            // data value (milestone.at), the temper-milestone precedent (no format() call).
            requirementDescription: milestone.at + " " + SECT_DATA.contribution.resource,
            // effectDescription IS run() per-render, so it may call format() lazily.
            effectDescription: function () { return sectMilestoneRewardDescription(milestone); },
            done: function () {
                return contributionBest().gte(milestone.at);
            }
        };
    });
    return milestones;
}

// ---------------------------------------------------------------------------
// makeSectLayer() — the LIFE-scoped row:"side" type:"none" Sect container (design §4.3).
// Contribution is player.sect.points; the archetype pick is clickables, techniques are
// upgrades, the contribution high-water drives the milestones, and update() accrues
// contribution + latches the reveal flag. NO doReset -> the sect is reset-immune by
// topology (life scope), so the joined sect / techniques survive every realm breakthrough.
// ---------------------------------------------------------------------------
function makeSectLayer() {
    return {
        name: SECT_DATA.name,
        symbol: SECT_DATA.symbol,
        color: SECT_DATA.color,
        row: "side",
        type: "none", // container: Contribution is the resource, but pick/techniques drive it
        resource: SECT_DATA.contribution.resource,
        startData: function () {
            return {
                unlocked: true,
                revealed: false,                // latched true once the reveal gate is first met (§5a)
                points: factoryDecimalZero(),   // Contribution
                best: factoryDecimalZero(),     // contribution high-water (drives milestones + the gate)
                archetype: ""                   // "" = unjoined; the chosen archetype key once joined (§4.3)
            };
        },
        tooltip: function () {
            var archetypeRow = sectArchetypeRow();
            return (archetypeRow ? archetypeRow.name : SECT_DATA.name)
                + " — sect standing (never resets this life)";
        },
        // The display name becomes the joined sect's name after the pick (pinned §4.3).
        getName: function () {
            var archetypeRow = sectArchetypeRow();
            return archetypeRow ? archetypeRow.name : SECT_DATA.name;
        },
        clickables: makeSectArchetypeClickables(),
        upgrades: makeSectTechniqueUpgrades(),
        milestones: makeSectMilestones(),
        // §5a reveal: hidden until q 2nd Level, then latched shown for the rest of the life.
        layerShown: function () {
            if (player[this.layer].revealed) return true;
            return sectIsRevealed();
        },
        // Accrue Contribution only while JOINED (no pre-join banking, §4.3). Latch the reveal
        // flag the first tick the reveal gate is met; the engine's OTHER_LAYERS sweep keeps
        // best = max(best, points), so the never-falling standing is maintained for us.
        update: function (diff) {
            if (!player[this.layer].revealed && sectIsRevealed()) {
                player[this.layer].revealed = true;
            }
            if (!sectJoined()) return;
            player[this.layer].points = player[this.layer].points.add(contributionPerSecond().times(diff));
            if (player[this.layer].points.gt(player[this.layer].best)) {
                player[this.layer].best = player[this.layer].points;
            }
        },
        // No doReset: a row:"side" life-scoped layer is reset-immune by topology (§4.3 / §8.1).
        tabFormat: [
            ["display-text", function () {
                var archetypeRow = sectArchetypeRow();
                if (!sectJoined()) {
                    return "A sect has taken notice of your progress. Choose an archetype below to "
                        + "JOIN — the choice shapes your technique library and discounts your "
                        + "sect's Dao element. The pick is permanent for this life.";
                }
                var perSecond = contributionPerSecond();
                var line = "You are a disciple of the <b>" + archetypeRow.name + "</b> ("
                    + archetypeRow.element + " school).<br>";
                line += SECT_DATA.contribution.resource + ": <b>"
                    + format(player[this.layer].points) + "</b> (best "
                    + format(player[this.layer].best) + ")<br>";
                line += SECT_DATA.contribution.resource + "/sec: <b>" + format(perSecond)
                    + "</b> (" + format(new Decimal(SECT_DATA.contribution.rate))
                    + " x (Qi/sec)^" + format(new Decimal(SECT_DATA.contribution.exponent)) + ")";
                return line;
            }],
            "blank",
            ["display-text", function () {
                return sectJoined() ? "" : "<b>Choose your sect</b>";
            }],
            "clickables",
            "blank",
            "milestones",
            "blank",
            ["display-text", function () {
                return sectJoined()
                    ? "<b>Techniques</b> (bought with " + SECT_DATA.contribution.resource + ")"
                    : "";
            }],
            "upgrades"
        ]
    };
}

// ---------------------------------------------------------------------------
// Journal layer (design §1.6, ETERNAL scope). Narrative entries LATCH into
// player.journal.unlocked (the array of entry keys) via update() once their `when`
// condition is met, and NEVER re-lock. player.journal.read tracks viewed keys; the layer
// glows (shouldNotify) while there are unlocked entries not yet read; a "Reflect" clickable
// marks all read. The tab renders unlocked entries chronologically (data order), unread
// bolded. No doReset — the journal is the eternal record, untouched by any reset (§8.1).
//
// NOTE on `unlocked`: the pinned contract stores entry keys in player.journal.unlocked. An
// empty array is truthy in JS, so it doubles as the engine's layer-unlocked flag (game.js
// only tests truthiness of player[layer].unlocked), and getStartLayerData leaves a defined
// `unlocked` untouched — so `unlocked: []` is both the entry-key store AND a valid "layer
// is unlocked" flag, with no separate boolean needed.
// ---------------------------------------------------------------------------
function journalLayerId() { return JOURNAL_DATA.id; }

function journalExists() {
    return !!(player[journalLayerId()] && player[journalLayerId()].unlocked);
}

// The latched entry-key array (player.journal.unlocked), defensively defaulting to empty.
function journalUnlockedKeys() {
    if (!journalExists()) return [];
    var unlockedKeys = player[journalLayerId()].unlocked;
    return Array.isArray(unlockedKeys) ? unlockedKeys : [];
}

// The read-key array (player.journal.read), defensively defaulting to empty.
function journalReadKeys() {
    if (!journalExists()) return [];
    var readKeys = player[journalLayerId()].read;
    return Array.isArray(readKeys) ? readKeys : [];
}

// Evaluate one journal entry's `when`. The prose entries use the standard meets() grammar
// PLUS the hint-only keys meets() does not know — layerUnlocked, and the slice-6 set-piece keys
// (tribulationReady / scarActive / tribulationPassed) — so handle those here, then delegate the
// remainder to meets(). Stripping the hint-only keys before delegation is the SAFETY the §FACTORY
// unknown-key discipline demands: meets() silently IGNORES keys it does not know (an always-true
// clause), so any key meets() cannot evaluate MUST be consumed and stripped here, never passed
// through. Defensive: an absent meets() (lint sandbox) fails the entry safely rather than crashing.
function journalEntryConditionMet(when) {
    if (!when) return true;
    if (when.layerUnlocked !== undefined) {
        if (!(player[when.layerUnlocked] && player[when.layerUnlocked].unlocked)) return false;
    }
    // Slice-6 hint-only keys (design §6.2/§1.3): evaluate via the pinned factory readers, the same
    // defensive typeof pattern hintEngine.js uses. A pre-slice-6 environment (reader absent) fails
    // the clause safely. These keys are NOT meets() grammar, so they are stripped below.
    if (when.tribulationReady === true) {
        if (typeof tribulationIsReady !== "function" || !tribulationIsReady()) return false;
    }
    if (when.scarActive === true) {
        if (typeof scarIsActive !== "function" || !scarIsActive()) return false;
    }
    if (when.tribulationPassed === true) {
        if (typeof tribulationPassed !== "function" || !tribulationPassed()) return false;
    }
    if (when.scarHealed === true) {
        if (typeof scarHealedDepth !== "function" || !(scarHealedDepth() > FACTORY_ZERO)) return false;
    }
    // Build the meets()-only subset (strip every hint-only key handled above) and delegate.
    var hintOnlyKeys = ["layerUnlocked", "tribulationReady", "scarActive", "tribulationPassed", "scarHealed"];
    var meetableCondition = {};
    var hasMeetable = false;
    Object.keys(when).forEach(function (conditionKey) {
        if (hintOnlyKeys.indexOf(conditionKey) !== (FACTORY_ZERO - FACTORY_ONE)) return;
        meetableCondition[conditionKey] = when[conditionKey];
        hasMeetable = true;
    });
    if (!hasMeetable) return true;
    if (typeof meets !== "function") return false;
    return meets(meetableCondition);
}

// True iff the entry key is already latched into player.journal.unlocked.
function journalEntryUnlocked(entryKey) {
    return journalUnlockedKeys().indexOf(entryKey) !== (FACTORY_ZERO - FACTORY_ONE);
}

// True iff the entry key has been marked read.
function journalEntryRead(entryKey) {
    return journalReadKeys().indexOf(entryKey) !== (FACTORY_ZERO - FACTORY_ONE);
}

// Count of unlocked-but-unread entries (drives the new-entry glow, §1.6).
function journalUnreadCount() {
    var unreadCount = FACTORY_ZERO;
    JOURNAL_DATA.entries.forEach(function (entry) {
        if (journalEntryUnlocked(entry.key) && !journalEntryRead(entry.key)) {
            unreadCount = unreadCount + FACTORY_ONE;
        }
    });
    return unreadCount;
}

// The "Reflect" clickable: marks every unlocked entry read (clears the glow, §1.6).
function makeJournalReflectClickable() {
    return {
        title: "Reflect",
        display: function () {
            var unread = journalUnreadCount();
            if (unread > FACTORY_ZERO) {
                return "Reflect on " + format(new Decimal(unread)) + " new entr"
                    + (unread === FACTORY_ONE ? "y" : "ies") + " — mark all read.";
            }
            return "Nothing new to reflect on.";
        },
        unlocked: function () { return true; },
        canClick: function () { return journalUnreadCount() > FACTORY_ZERO; },
        onClick: function () {
            JOURNAL_DATA.entries.forEach(function (entry) {
                if (journalEntryUnlocked(entry.key) && !journalEntryRead(entry.key)) {
                    player[journalLayerId()].read.push(entry.key);
                }
            });
        }
    };
}

// The journal's single clickable object: id FACTORY_ZERO -> the Reflect clickable
// (no numeric-literal key, §11).
function makeJournalClickables() {
    var clickablesObject = {};
    clickablesObject[FACTORY_ZERO] = makeJournalReflectClickable();
    return clickablesObject;
}

function makeJournalLayer() {
    return {
        name: JOURNAL_DATA.name,
        symbol: JOURNAL_DATA.symbol,
        color: JOURNAL_DATA.color,
        row: "side",
        type: "none", // pure narrative side layer: no resource, no prestige
        startData: function () {
            return {
                // player.journal.unlocked is the latched entry-key array (pinned §1.6). An
                // empty array is truthy, so it also satisfies the engine's layer-unlocked
                // truthiness test — no separate boolean flag needed.
                unlocked: [],
                read: []                        // viewed entry keys (the new-entry glow clears these)
            };
        },
        tooltip: function () { return JOURNAL_DATA.name + " — your record of the road (never resets)"; },
        // One clickable: Reflect (marks all read). The id is FACTORY_ZERO (no numeric literal §11).
        clickables: makeJournalClickables(),
        // Latch newly-met entries into player.journal.unlocked each tick; once in, an entry is
        // never re-evaluated (it stays unlocked forever, even across reincarnation — §1.6/§8.1).
        update: function () {
            var journalState = player[this.layer];
            if (!Array.isArray(journalState.unlocked)) journalState.unlocked = [];
            if (!Array.isArray(journalState.read)) journalState.read = [];
            JOURNAL_DATA.entries.forEach(function (entry) {
                if (journalState.unlocked.indexOf(entry.key) !== (FACTORY_ZERO - FACTORY_ONE)) {
                    return; // already latched — never re-evaluate
                }
                if (journalEntryConditionMet(entry.when)) {
                    journalState.unlocked.push(entry.key);
                }
            });
        },
        // Glow while there are unlocked entries not yet read (the new-entry glow, §1.6).
        shouldNotify: function () { return journalUnreadCount() > FACTORY_ZERO; },
        layerShown: function () { return true; },
        tabFormat: [
            ["display-text", function () {
                return "Your journal — the quiet record of the road so far. New entries unlock as "
                    + "you progress; reflect on them to clear the mark.";
            }],
            "blank",
            "clickables",
            "blank",
            ["display-text", function () {
                if (journalUnlockedKeys().length === FACTORY_ZERO) {
                    return "<i>No entries yet. Your story begins with your first breath of qi.</i>";
                }
                var lines = [];
                JOURNAL_DATA.entries.forEach(function (entry) {
                    if (!journalEntryUnlocked(entry.key)) return;
                    var unread = !journalEntryRead(entry.key);
                    var title = unread ? "<b>" + entry.title + "</b>" : entry.title;
                    var body = unread ? "<b>" + entry.text + "</b>" : entry.text;
                    lines.push(title + "<br>" + body);
                });
                return lines.join("<br><br>");
            }]
        ]
    };
}

// ---------------------------------------------------------------------------
// makeLegacyLayer() — the ETERNAL Legacy Grade layer (design §8.1; LEGACY_DATA). A row:"side"
// type:"none" container like the journal: no prestige resource, no buyables — it simply DISPLAYS
// the stored Act I Legacy Grade and its band flavor. The grade is computed/stored by
// computeAndStoreActOneLegacy on the first tribulation pass; the layer is shown once any act
// grade exists (layerShown: once actOneLegacyIndex >= 0). NO doReset — eternal scope is
// topological (a row:"side" layer with no doReset is reset-immune). Its qiMult is the LIVE
// consumer via legacyQiMult (no dead mult §9.2). Zero literals (§11).
// ---------------------------------------------------------------------------
function makeLegacyLayer() {
    return {
        name: LEGACY_DATA.name,
        symbol: LEGACY_DATA.symbol,
        color: LEGACY_DATA.color,
        row: "side",
        type: "none", // pure display side layer: the eternal grade record, no resource/prestige
        startData: function () {
            return {
                // Truthy unlocked flag (the engine only tests truthiness); actOneGrade -1 = no
                // Act I Legacy Grade earned yet (the sentinel below the first band index).
                unlocked: true,
                actOneGrade: FACTORY_ZERO - FACTORY_ONE
            };
        },
        tooltip: function () { return LEGACY_DATA.name + " — the eternal record of your lives"; },
        // Shown once any act grade exists (Act I for now; future acts add their own grades).
        layerShown: function () { return actOneLegacyIndex() >= FACTORY_ZERO; },
        tabFormat: [
            ["display-text", function () {
                var band = actOneLegacyBand();
                if (!band) {
                    return "Your legacy is unwritten. Endure the First Tribulation to inscribe the "
                        + "Act I Legacy Grade — the eternal measure of the life you led.";
                }
                var percentBase = new Decimal(FACTORY_HUNDRED);
                var qiPercent = new Decimal(band.qiMult).times(percentBase).sub(percentBase);
                var line = "<h3>Act I — Mortal Road</h3>";
                line += "Legacy Grade: <b>" + band.label + "</b><br>";
                line += "This life echoes: +" + format(qiPercent) + "% Qi/sec, forever.<br><br>";
                line += "<i>Your core grade, the soul's chosen aspect, the Daos you comprehended, "
                    + "your sect standing, and the tribulation you endured — all weighed into this "
                    + "one measure. It survives even death.</i>";
                return line;
            }]
        ]
    };
}

// ---------------------------------------------------------------------------
// Registration. Run the linter first; on failure it hard-stops load (§11).
// ---------------------------------------------------------------------------
function registerCultivationLayers() {
    if (typeof runCultivationLinter === "function") {
        var lintResult = runCultivationLinter();
        if (!lintResult.ok) {
            console.error("CULTIVATION LINT FAILED — refusing to load broken economy:\n"
                + lintResult.errors.join("\n"));
            throw new Error("Cultivation data-table lint failed; see console.");
        }
    }

    // Defense in depth ahead of the linter (design §8.1): every registered layer
    // MUST declare a TREE_DATA.layers entry (its persistence scope). A missing entry
    // means the compiled doReset cannot decide the layer's reset closure, so refuse
    // to load rather than register a layer with undefined reset topology.
    function requireTreeEntry(layerId) {
        if (!treeLayerEntry(layerId)) {
            throw new Error("Cultivation registration: layer '" + layerId
                + "' has no TREE_DATA.layers scope entry; refusing to register.");
        }
    }

    requireTreeEntry(BODY_DATA.id);
    addLayer(BODY_DATA.id, makeBodyLayer());
    requireTreeEntry(GATE_DATA.id);
    addLayer(GATE_DATA.id, makeGateLayer());
    requireTreeEntry(LATTICE_DATA.id);
    addLayer(LATTICE_DATA.id, makeDaoLayer());
    // The Sect side-spine (design §4.3) and the Journal (design §1.6), slice 5. Both are
    // non-tree layers (sect life-scoped, journal eternal-scoped) — requireTreeEntry proves
    // their TREE_DATA scope entry exists before registering (defense in depth ahead of the linter).
    requireTreeEntry(SECT_DATA.id);
    addLayer(SECT_DATA.id, makeSectLayer());
    requireTreeEntry(JOURNAL_DATA.id);
    addLayer(JOURNAL_DATA.id, makeJournalLayer());
    // The Legacy store (design §8.1, slice 6): the second eternal-scoped layer. Guarded on
    // LEGACY_DATA presence (a pre-slice-6 save / harness may not load it), exactly like the
    // sect/journal registration guard — requireTreeEntry proves its TREE_DATA scope entry exists.
    if (typeof LEGACY_DATA !== "undefined" && LEGACY_DATA && LEGACY_DATA.id) {
        requireTreeEntry(LEGACY_DATA.id);
        addLayer(LEGACY_DATA.id, makeLegacyLayer());
    }
    REALM_DATA.forEach(function (realmData) {
        requireTreeEntry(realmData.id);
        addLayer(realmData.id, makeRealmLayer(realmData));
    });
}

registerCultivationLayers();
