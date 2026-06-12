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
// meets(condition) — uniform unlock / done evaluator over a condition object.
// Keys combine with AND. Supports: qi, realm:[id, numberOrLabel], meridians,
// temperTier, primaryMeridiansAll. (§5 unlock / §8 done.)
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
    var coreGrades = findRealmData("c").forge.grades;
    var matched = coreGrades.find(function (grade) { return grade.ceilingIndex === storedIndex; });
    if (!matched) return factoryDecimalOne();
    return new Decimal(matched.globalMult);
}

// The one public entry the rewritten getPointGen multiplies into baseRate.
function cultivationQiPerSecond() {
    return qiBaseRate()
        .times(meridianMult())
        .times(temperMult())
        .times(realmMult())
        .times(gateMult())
        .times(coreGradeMult());
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
function coreForgeData() { return coreRealmData().forge; }
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
                coreGrade: BODY_DATA.grades.coreGrade.startIndex
            };
        },
        tooltip: function () { return BODY_DATA.name + " — permanent cultivation (never resets)"; },
        buyables: buyablesObject,
        milestones: makeTemperMilestones(),
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
    // realm carrying a forge config (Core Formation) gets these; the math/UI all
    // resolve from REALM_DATA(c).forge, so no other realm is touched.
    if (realmData.forge) {
        var warmToggleId = realmData.forge.pushOptions.length;
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
                return "Your standing in the sect. Milestones recognised here grant permanent "
                    + "boons and never reset.";
            }],
            "blank",
            "achievements"
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
    REALM_DATA.forEach(function (realmData) {
        requireTreeEntry(realmData.id);
        addLayer(realmData.id, makeRealmLayer(realmData));
    });
}

registerCultivationLayers();
