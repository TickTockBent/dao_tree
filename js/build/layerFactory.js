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

// ---------------------------------------------------------------------------
// Data lookups (resolve a realm/body row by id without literals).
// ---------------------------------------------------------------------------
function findRealmData(realmId) {
    return REALM_DATA.find(function (row) { return row.id === realmId; });
}

function bodyBuyableByKey(key) {
    return BODY_DATA.buyables.find(function (row) { return row.key === key; });
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

    var realmTerm = realmBest("q")
        .div(grade.realmDenominator)
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
            effectDescription: "+" + format(bonusPercent) + "% Qi/sec and a step toward Foundation Grade",
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
        resource: BODY_DATA.resource,
        startData: function () {
            return {
                unlocked: true,
                points: factoryDecimalZero(),
                foundationGrade: BODY_DATA.grades.foundationGrade.startIndex,
                coreGrade: BODY_DATA.grades.coreGrade.startIndex
            };
        },
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
            requirementDescription: stage.label + " (" + formatWhole(new Decimal(stage.at)) + " "
                + realmData.resource + ")" + revealText,
            effectDescription: "+" + format(stageBonus) + "% Qi/sec",
            done: function () {
                return player[realmData.id].best.gte(stage.at);
            }
        };
    });
    return milestones;
}

// ---------------------------------------------------------------------------
// makeRealmLayer(r) — one parameterized realm prestige layer (§5). Numbered rows
// reset the chain below them via the default rowReset cascade. Forge/grade logic
// is stubbed (lands in a later phase) but the layer registers and prestiges now.
// ---------------------------------------------------------------------------
function makeRealmLayer(realmData) {
    return {
        name: realmData.name,
        symbol: realmData.symbol,
        color: realmData.color,
        row: realmData.row,
        resource: realmData.resource,
        baseResource: modInfo.pointsName,
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
        milestones: makeMilestones(realmData),
        unlocked: function () {
            if (player[this.layer].unlocked) return true;
            return meets(realmData.unlock);
        },
        layerShown: function () {
            return player[this.layer].unlocked || meets(realmData.unlock);
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
        var buffText = "";
        if (ach.effect && ach.effect.qiMult !== undefined) {
            var pct = new Decimal(ach.effect.qiMult).times(percentGain).sub(percentGain);
            buffText = "+" + format(pct) + "% Qi/sec";
        }
        achievementsObject[ach.id] = {
            name: ach.name,
            done: function () { return meets(ach.done); },
            tooltip: buffText
        };
    });

    return {
        name: GATE_DATA.name,
        symbol: GATE_DATA.symbol,
        color: GATE_DATA.color,
        row: "side",
        startData: function () { return { unlocked: true }; },
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

    addLayer(BODY_DATA.id, makeBodyLayer());
    addLayer(GATE_DATA.id, makeGateLayer());
    REALM_DATA.forEach(function (realmData) {
        addLayer(realmData.id, makeRealmLayer(realmData));
    });
}

registerCultivationLayers();
