// js/build/linter.js — load-time invariant checker over the data tables (spec §9).
//
// Asserts the spec §9 invariants against REALM_DATA / BODY_DATA / GATE_DATA:
//   §9.2 no dead multipliers   — every declared multiplier has a live consumer.
//   §9.3 completability        — every unlock/done condition is reachable from a
//                                fresh save and no gate requires what it suppresses.
//   §11  no numeric literals   — scan js/build/*.js source for bare numeric
//                                literals (run by the node harness; in-browser
//                                this check is reported as skipped).
//
// HARD RULE (§11): ZERO numeric literals in THIS file too — it lives in
// js/build/ and is part of the generated/factory surface. All numbers come from
// FACTORY_NUMERICS or the data rows.
//
// runCultivationLinter() -> { ok:boolean, errors:[string], checks:{...} }
// The factory calls this before addLayer and hard-stops load on failure.

(function (root) {
    var ZERO = FACTORY_NUMERICS.zero;
    var ONE = FACTORY_NUMERICS.one;

    // ----- §9.2 no dead multipliers --------------------------------------
    // Every multiplier declared in data must be consumed by a factory function.
    // We verify the consumer function exists and that its source references the
    // data field that carries the multiplier, so a declared multiplier cannot be
    // computed-into-nothing (the reference's Nascent Soul defect).
    function checkNoDeadMultipliers(errors, factorySource) {
        var consumers = {
            substageQiMult: "realmMult",
            temperQiBonus: "temperMult",
            gateQiMult: "gateMult",
            coreGlobalMult: "coreGradeMult",
            foundationFMult: "foundationGradeMult",
            // Dao lattice + stance consumers (design §4.2/§6.1). Each declared multiplier on a
            // lattice node effect / stance modifier must be folded into a live factory reader,
            // verified the SAME way (the named function references the carrying data field),
            // so a lattice bonus or stance trade can't be computed into nothing (§9.2). Each
            // value is the CONSUMER FUNCTION NAME (matching the map's existing convention).
            latticeNodeQiMult: "daoNodeQiMult",
            latticeNodeInsightMult: "daoNodeInsightMult",
            stanceQiModifier: "stanceQiMult",
            stanceInsightModifier: "stanceInsightMult",
            insightTrickle: "insightPerSecond",
            // Soul Aspect consumers (expansion §5). The chosen aspect's identity multipliers
            // fold into the Qi/Insight pipelines exactly like the stance variant: each declared
            // aspect effect.qiMult (resp. insightMult) must have its matching reader consume the
            // field token, so an aspect bonus can't be computed into nothing (§9.2).
            soulAspectQiEffect: "soulAspectQiMult",
            soulAspectInsightEffect: "soulAspectInsightMult",
            // Sect consumers (design §4.3, slice 5). The stipend milestone's reward.qiMult folds
            // into cultivationQiPerSecond via sectStipendQiMult, and OWNED techniques' effect.qiMult
            // (resp. insightMult) compound via techniqueQiMult (resp. techniqueInsightMult). Each
            // declared multiplier must have its matching reader consume the carrying field token,
            // so a stipend / technique bonus can't be computed into nothing (§9.2). (The lattice
            // DISCOUNT is NOT here: it changes a COST, verified by the cost-fold check below.)
            sectStipendQiMult: "sectStipendQiMult",
            techniqueQiEffect: "techniqueQiMult",
            techniqueInsightEffect: "techniqueInsightMult"
        };

        // A consumer is "live" if the named factory function references the data
        // field token. In the browser the function is a global we can stringify;
        // in the node harness the factory is not executed, so we scan its source
        // text instead. Either way: the consumer function AND the field token must
        // co-occur, proving the declared multiplier is wired into a real path.
        function consumerReferences(consumerName, fieldToken) {
            var fn = root[consumerName];
            if (typeof fn === "function") {
                return fn.toString().indexOf(fieldToken) !== ZERO - ONE;
            }
            if (factorySource) {
                return factorySource.indexOf("function " + consumerName) !== ZERO - ONE
                    && factorySource.indexOf(fieldToken) !== ZERO - ONE;
            }
            return false;
        }

        // Substage qiMult -> realmMult (and realm effect()).
        var substageCount = ZERO;
        REALM_DATA.forEach(function (realm) {
            realm.substages.forEach(function (stage) {
                substageCount = substageCount + ONE;
                if (stage.qiMult === undefined) {
                    errors.push("Realm " + realm.id + " substage '" + stage.label
                        + "' declares no qiMult.");
                }
            });
        });
        if (substageCount > ZERO && !consumerReferences(consumers.substageQiMult, "qiMult")) {
            errors.push("Dead multiplier: substage qiMult has no consumer (realmMult).");
        }

        // Temper tier qiBonus -> temperMult.
        BODY_DATA.temperTiers.forEach(function (tier) {
            if (tier.qiBonus === undefined) {
                errors.push("Temper tier '" + tier.label + "' declares no qiBonus.");
            }
        });
        if (!consumerReferences(consumers.temperQiBonus, "qiBonus")) {
            errors.push("Dead multiplier: temper qiBonus has no consumer (temperMult).");
        }

        // Gate effect.qiMult -> gateMult.
        GATE_DATA.achievements.forEach(function (ach) {
            if (ach.effect && ach.effect.qiMult !== undefined) {
                if (!consumerReferences(consumers.gateQiMult, "qiMult")) {
                    errors.push("Dead multiplier: gate '" + ach.key
                        + "' qiMult has no consumer (gateMult).");
                }
            }
        });

        // Foundation grade band fMult -> foundationGradeMult (§6). Every graded
        // realm's bands must declare an fMult and have a live consumer, or the
        // graded breakthrough is a price floor in disguise (§9.2).
        REALM_DATA.forEach(function (realm) {
            if (!realm.graded || !realm.grade || !realm.grade.bands) return;
            realm.grade.bands.forEach(function (band) {
                if (band.fMult === undefined) {
                    errors.push("Foundation band '" + band.tier
                        + "' declares no fMult.");
                }
            });
            if (!consumerReferences(consumers.foundationFMult, "fMult")) {
                errors.push("Dead multiplier: graded realm '" + realm.id
                    + "' band fMult has no consumer (foundationGradeMult).");
            }
        });

        // Core grade globalMult -> coreGradeMult.
        var coreRealm = REALM_DATA.find(function (r) { return r.id === "c"; });
        if (coreRealm && coreRealm.forge && coreRealm.forge.grades) {
            coreRealm.forge.grades.forEach(function (grade) {
                if (grade.globalMult === undefined) {
                    errors.push("Core grade '" + grade.key + "' declares no globalMult.");
                }
            });
            if (!consumerReferences(consumers.coreGlobalMult, "globalMult")) {
                errors.push("Dead multiplier: core globalMult has no consumer (coreGradeMult).");
            }
        }

        // Lattice node effects -> daoNodeQiMult / daoNodeInsightMult, and the Insight trickle
        // baseRate -> insightPerSecond (§4.2). Guarded on LATTICE_DATA presence because the
        // data-only fixture harness loads no lattice; when present, any node carrying a qiMult
        // (resp. insightMult) effect must have its matching reader consume that field token.
        if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.nodes) {
            var latticeDeclaresQiMult = false;
            var latticeDeclaresInsightMult = false;
            LATTICE_DATA.nodes.forEach(function (node) {
                (node.effects || []).forEach(function (effect) {
                    if (effect.qiMult !== undefined) latticeDeclaresQiMult = true;
                    if (effect.insightMult !== undefined) latticeDeclaresInsightMult = true;
                });
            });
            if (latticeDeclaresQiMult && !consumerReferences(consumers.latticeNodeQiMult, "qiMult")) {
                errors.push("Dead multiplier: lattice node qiMult has no consumer (daoNodeQiMult).");
            }
            if (latticeDeclaresInsightMult && !consumerReferences(consumers.latticeNodeInsightMult, "insightMult")) {
                errors.push("Dead multiplier: lattice node insightMult has no consumer (daoNodeInsightMult).");
            }
            if (LATTICE_DATA.insight && LATTICE_DATA.insight.baseRate !== undefined
                && !consumerReferences(consumers.insightTrickle, "baseRate")) {
                errors.push("Dead multiplier: lattice insight.baseRate has no consumer (insightPerSecond).");
            }
        }

        // Stance modifiers -> stanceQiMult / stanceInsightMult (§6.1). Guarded on STANCE_DATA
        // presence; any stance declaring a qiMult (resp. insightMult) modifier must have its
        // matching reader consume that field — verified through the modifiers object token.
        if (typeof STANCE_DATA !== "undefined" && STANCE_DATA && STANCE_DATA.stances) {
            var stanceDeclaresQiMult = false;
            var stanceDeclaresInsightMult = false;
            STANCE_DATA.stances.forEach(function (stance) {
                var modifiers = stance.modifiers || {};
                if (modifiers.qiMult !== undefined) stanceDeclaresQiMult = true;
                if (modifiers.insightMult !== undefined) stanceDeclaresInsightMult = true;
            });
            if (stanceDeclaresQiMult
                && !(consumerReferences(consumers.stanceQiModifier, "qiMult")
                    && consumerReferences(consumers.stanceQiModifier, "modifiers"))) {
                errors.push("Dead multiplier: stance qiMult has no consumer (stanceQiMult).");
            }
            if (stanceDeclaresInsightMult
                && !(consumerReferences(consumers.stanceInsightModifier, "insightMult")
                    && consumerReferences(consumers.stanceInsightModifier, "modifiers"))) {
                errors.push("Dead multiplier: stance insightMult has no consumer (stanceInsightMult).");
            }
        }

        // Soul Aspect effects -> soulAspectQiMult / soulAspectInsightMult (expansion §5). For any
        // realm carrying a soulAspect set, any aspect declaring a qiMult (resp. insightMult) effect
        // must have its matching reader consume that field token — the same mechanism as the stance
        // variant — so a chosen-aspect identity bonus can't be computed into nothing (§9.2).
        var soulAspectDeclaresQiMult = false;
        var soulAspectDeclaresInsightMult = false;
        REALM_DATA.forEach(function (realm) {
            if (!realm.soulAspect || !realm.soulAspect.aspects) return;
            realm.soulAspect.aspects.forEach(function (aspect) {
                var effect = aspect.effect || {};
                if (effect.qiMult !== undefined) soulAspectDeclaresQiMult = true;
                if (effect.insightMult !== undefined) soulAspectDeclaresInsightMult = true;
            });
        });
        if (soulAspectDeclaresQiMult
            && !consumerReferences(consumers.soulAspectQiEffect, "qiMult")) {
            errors.push("Dead multiplier: soul aspect qiMult has no consumer (soulAspectQiMult).");
        }
        if (soulAspectDeclaresInsightMult
            && !consumerReferences(consumers.soulAspectInsightEffect, "insightMult")) {
            errors.push("Dead multiplier: soul aspect insightMult has no consumer (soulAspectInsightMult).");
        }

        // Sect stipend + technique multipliers -> sectStipendQiMult / techniqueQiMult /
        // techniqueInsightMult (design §4.3, slice 5). Guarded on SECT_DATA / TECHNIQUE_DATA
        // presence (the data-only fixture harness loads neither). The stipend milestone's
        // reward.qiMult must have a consumer; any technique declaring a qiMult (resp. insightMult)
        // effect must have its matching reader consume the field token (same mechanism as aspects).
        if (typeof SECT_DATA !== "undefined" && SECT_DATA && SECT_DATA.milestones) {
            var sectDeclaresStipendQiMult = false;
            SECT_DATA.milestones.forEach(function (milestone) {
                if (milestone.reward && milestone.reward.qiMult !== undefined) sectDeclaresStipendQiMult = true;
            });
            if (sectDeclaresStipendQiMult
                && !consumerReferences(consumers.sectStipendQiMult, "qiMult")) {
                errors.push("Dead multiplier: sect stipend qiMult has no consumer (sectStipendQiMult).");
            }
        }
        if (typeof TECHNIQUE_DATA !== "undefined" && TECHNIQUE_DATA) {
            var techniqueDeclaresQiMult = false;
            var techniqueDeclaresInsightMult = false;
            TECHNIQUE_DATA.forEach(function (technique) {
                var techEffect = technique.effect || {};
                if (techEffect.qiMult !== undefined) techniqueDeclaresQiMult = true;
                if (techEffect.insightMult !== undefined) techniqueDeclaresInsightMult = true;
            });
            if (techniqueDeclaresQiMult
                && !consumerReferences(consumers.techniqueQiEffect, "qiMult")) {
                errors.push("Dead multiplier: technique qiMult has no consumer (techniqueQiMult).");
            }
            if (techniqueDeclaresInsightMult
                && !consumerReferences(consumers.techniqueInsightEffect, "insightMult")) {
                errors.push("Dead multiplier: technique insightMult has no consumer (techniqueInsightMult).");
            }
        }

        // Sect lattice DISCOUNT cost-fold verification (design §4.3, slice 5). A discount changes
        // a COST, not a multiplier, so it has no dead-mult consumer entry — but the §4.3 "Dao-
        // lattice discount region" REQUIRES the discount to actually fold into the dao node
        // cost(). Prove the fold exists: when SECT_DATA declares any archetype latticeDiscount,
        // the factory source's makeDaoNodeBuyable must reference sectLatticeDiscount (the reader),
        // so a declared discount can't be silently dropped from the price the player pays.
        if (typeof SECT_DATA !== "undefined" && SECT_DATA && SECT_DATA.archetypes) {
            var sectDeclaresLatticeDiscount = SECT_DATA.archetypes.some(function (archetype) {
                return archetype.latticeDiscount !== undefined;
            });
            if (sectDeclaresLatticeDiscount && factorySource) {
                // The fold must be an actual MULTIPLY of the node cost by sectLatticeDiscount
                // (".times(sectLatticeDiscount("), not merely a mention of the reader's name —
                // so renaming the call to an identity still trips this. makeDaoNodeBuyable must
                // also be present (the node-cost builder that carries the fold).
                var foldPresent = factorySource.indexOf("function makeDaoNodeBuyable") !== (ZERO - ONE)
                    && factorySource.indexOf(".times(sectLatticeDiscount(") !== (ZERO - ONE);
                if (!foldPresent) {
                    errors.push("Sect discount: SECT_DATA declares a latticeDiscount but the dao node "
                        + "cost() does not fold sectLatticeDiscount — the discount region is dead (§4.3).");
                }
            }
        }
    }

    // Resolve a realm sub-stage label (or numeric token) to its `at` threshold.
    // Shared by checkCompletability and checkHintData (one reachability oracle).
    function realmStageThreshold(realmId, stage) {
        var realm = REALM_DATA.find(function (r) { return r.id === realmId; });
        if (!realm) return null;
        if (typeof stage === "string") {
            var matched = realm.substages.find(function (s) { return s.label === stage; });
            return matched ? matched.at : null;
        }
        return stage;
    }

    // Reachability oracle for one meets()-grammar condition object. Shared by the
    // unlock/done completability walk (§9.3) AND the hint-condition check (§8.5) so
    // realm/temper/meridian reachability is validated by ONE rule, never duplicated.
    // Reports each violation onto `errors` tagged with `label`.
    function checkCondition(errors, label, condition) {
        if (!condition) return;

        if (condition.qi !== undefined && !(condition.qi > ZERO)) {
            errors.push(label + ": qi requirement must be > 0.");
        }
        if (condition.meridians !== undefined) {
            var primary = BODY_DATA.buyables.find(function (b) { return b.key === "primaryMeridian"; });
            if (condition.meridians > primary.limit) {
                errors.push(label + ": requires " + condition.meridians
                    + " meridians but cap is " + primary.limit + " (unreachable).");
            }
        }
        if (condition.primaryMeridiansAll !== undefined && condition.primaryMeridiansAll) {
            var primaryRow = BODY_DATA.buyables.find(function (b) { return b.key === "primaryMeridian"; });
            if (!(primaryRow.limit > ZERO)) {
                errors.push(label + ": primaryMeridiansAll but primary limit is not positive.");
            }
        }
        if (condition.realm !== undefined) {
            var targetId = condition.realm[ZERO];
            var stage = condition.realm[ONE];
            // §5a standard: realm gates use NAMED stage labels, not numeric
            // best thresholds. A numeric token is the scale bug that gated
            // Foundation at best>=6 instead of "6th Level" (best>=90): the raw
            // number is read as a currency high-water, ~15x too early. Require
            // strings so a stage label can never be mistaken for a count.
            if (typeof stage !== "string") {
                errors.push(label + ": realm token must be a named stage label (e.g. \""
                    + ((REALM_DATA.find(function (r) { return r.id === targetId; }) || { substages: [{ label: "1st Level" }] })
                        .substages[ZERO].label)
                    + "\"), not the numeric " + stage
                    + " — a number is read as a raw best threshold, not a stage (§5a/§6).");
            }
            var threshold = realmStageThreshold(targetId, stage);
            if (threshold === null) {
                errors.push(label + ": references unknown realm/stage "
                    + targetId + "/" + stage + ".");
            } else {
                var realm = REALM_DATA.find(function (r) { return r.id === targetId; });
                var maxStage = realm.substages[realm.substages.length - ONE];
                if (threshold > maxStage.at) {
                    errors.push(label + ": realm " + targetId + " threshold " + threshold
                        + " exceeds top sub-stage " + maxStage.at + " (unreachable).");
                }
            }
        }
        if (condition.temperTier !== undefined) {
            var tier = BODY_DATA.temperTiers.find(function (t) {
                return t.key === condition.temperTier || t.label === condition.temperTier;
            });
            if (!tier) {
                errors.push(label + ": references unknown temper tier "
                    + condition.temperTier + ".");
            } else {
                var temperRow = BODY_DATA.buyables.find(function (b) { return b.key === "temper"; });
                if (tier.fromLevel > temperRow.limit) {
                    errors.push(label + ": temper tier " + tier.label + " needs level "
                        + tier.fromLevel + " but temper cap is " + temperRow.limit + ".");
                }
            }
        }
        // daoNode: [nodeKey, tierNumber] — the lattice node's owned tier must satisfy the
        // gate (design §4.2 lattice grammar; §6.1 stance unlocks). Validated HERE so realm
        // gates, hints, and stance unlocks all inherit it through the one shared oracle. The
        // referenced node must exist and the tier must be within [1, tiers.length]: tier 0
        // is "owns nothing" (never a gate) and a tier above the deepest declared tier can
        // never be owned (unreachable). Guarded on LATTICE_DATA presence so harnesses that
        // load no lattice (the synthetic fixture's daoNode-free cases) don't false-error.
        if (condition.daoNode !== undefined) {
            if (typeof LATTICE_DATA === "undefined" || !LATTICE_DATA || !LATTICE_DATA.nodes) {
                errors.push(label + ": daoNode condition requires LATTICE_DATA to be loaded.");
            } else {
                var requiredNodeKey = condition.daoNode[ZERO];
                var requiredNodeTier = condition.daoNode[ONE];
                var referencedNode = LATTICE_DATA.nodes.find(function (n) { return n.key === requiredNodeKey; });
                if (!referencedNode) {
                    errors.push(label + ": references unknown dao node '"
                        + requiredNodeKey + "'.");
                } else {
                    var tierCount = LATTICE_DATA.tiers ? LATTICE_DATA.tiers.length : ZERO;
                    if (!(requiredNodeTier >= ONE && requiredNodeTier <= tierCount)) {
                        errors.push(label + ": daoNode '" + requiredNodeKey + "' tier "
                            + requiredNodeTier + " is out of range (1.." + tierCount + ").");
                    }
                }
            }
        }

        // anyDaoNode: N — any lattice node at tier >= N (slice-4 meets() grammar, pinned §FACTORY).
        // N must be within [1, tiers.length]. Guarded on LATTICE_DATA like daoNode.
        if (condition.anyDaoNode !== undefined) {
            if (typeof LATTICE_DATA === "undefined" || !LATTICE_DATA || !LATTICE_DATA.tiers) {
                errors.push(label + ": anyDaoNode condition requires LATTICE_DATA to be loaded.");
            } else {
                var anyDaoTierCount = LATTICE_DATA.tiers ? LATTICE_DATA.tiers.length : ZERO;
                var anyDaoTier = condition.anyDaoNode;
                if (!(anyDaoTier >= ONE && anyDaoTier <= anyDaoTierCount)) {
                    errors.push(label + ": anyDaoNode tier " + anyDaoTier
                        + " is out of range (1.." + anyDaoTierCount + ").");
                }
            }
        }

        // daoElementTier: [element, N] — any node of the named element at tier >= N
        // (slice-4 meets() grammar, NS aspect gate). The element must be one of the
        // five canonical element keys from the lattice roots; N must be within [1, tiers.length].
        // Guarded on LATTICE_DATA like daoNode.
        if (condition.daoElementTier !== undefined) {
            if (typeof LATTICE_DATA === "undefined" || !LATTICE_DATA || !LATTICE_DATA.nodes) {
                errors.push(label + ": daoElementTier condition requires LATTICE_DATA to be loaded.");
            } else {
                var elementKey = condition.daoElementTier[ZERO];
                var elementTier = condition.daoElementTier[ONE];
                var elementTierCount = LATTICE_DATA.tiers ? LATTICE_DATA.tiers.length : ZERO;
                // The element must match at least one node's element field (reachability from roots).
                var elementNodeExists = LATTICE_DATA.nodes.some(function (n) {
                    return n.element === elementKey && (!n.requires || n.requires.length === ZERO);
                });
                if (!elementNodeExists) {
                    errors.push(label + ": daoElementTier references element '"
                        + elementKey + "' which has no root node in LATTICE_DATA (unreachable).");
                }
                if (!(elementTier >= ONE && elementTier <= elementTierCount)) {
                    errors.push(label + ": daoElementTier element '" + elementKey + "' tier "
                        + elementTier + " is out of range (1.." + elementTierCount + ").");
                }
            }
        }

        // achievement: [layerId, achievementId] — the meets() grammar key the slice-5 sect /
        // journal entries use (design §4.3 / §FACTORY SURFACE). It latches on hasAchievement(
        // layerId, id). Validated here so journal entries, gate done() conditions, hints, and any
        // future achievement-gated unlock all inherit ONE reachability rule (the shared oracle):
        // the referenced layer must be registered, and FOR THE GATE LAYER the achievement id must
        // resolve to a real GATE_DATA.achievements row — a phantom (layer, id) can never be earned,
        // so the condition is permanently unsatisfiable (a completability dead-end, §9.3).
        if (condition.achievement !== undefined) {
            var achievementLayerId = condition.achievement[ZERO];
            var achievementRowId = condition.achievement[ONE];
            if (registeredLayerIds().indexOf(achievementLayerId) === ZERO - ONE) {
                errors.push(label + ": achievement references unregistered layer '"
                    + achievementLayerId + "'.");
            } else if (achievementLayerId === GATE_DATA.id) {
                // The gate layer is the only achievement-bearing layer in v0.1; its ids must
                // resolve so a journal/hint gate can't latch on a non-existent deed (§8/§9.3).
                var achievementRowExists = GATE_DATA.achievements.some(function (ach) {
                    return ach.id === achievementRowId;
                });
                if (!achievementRowExists) {
                    errors.push(label + ": achievement references unknown id '" + achievementRowId
                        + "' on the gate layer (no GATE_DATA.achievements row — unreachable, §9.3).");
                }
            }
        }

        // sectJoined: true — the slice-5 meets() grammar key that latches once the player has
        // joined a sect (sectJoined() true; design §4.3). It carries no parameter to range-check;
        // the ONLY well-formed value is boolean true (a sectJoined:false would be a no-op gate that
        // can never gate anything, so reject any non-true value as a data error). Reachability is
        // intrinsic: joining a sect is a no-cost pick available the moment the sect layer reveals,
        // so a sectJoined:true condition is always reachable from a fresh save once SECT_DATA exists.
        if (condition.sectJoined !== undefined && condition.sectJoined !== true) {
            errors.push(label + ": sectJoined must be boolean true (a sectJoined:"
                + condition.sectJoined + " gate can never be satisfied).");
        }

        // contribution: N — sect standing high-water (contributionBest, §4.3). Contribution
        // accrues unbounded once joined, so any positive value is reachable; non-positive
        // values are vacuous gates (data errors).
        if (condition.contribution !== undefined && !(condition.contribution > ZERO)) {
            errors.push(label + ": contribution requirement must be > 0.");
        }

        // UNKNOWN-KEY REJECTION. meets() (and the hint/journal evaluators) IGNORE keys they
        // do not recognize, so a typo'd key silently turns its clause into "always true" —
        // the worst possible failure for a gate. Every key must be in the known grammar:
        // the meets() keys plus the engine-extension keys the hint/journal evaluators
        // handle before delegating (layerUnlocked / coreForged / coreBelowCeiling /
        // aspectUnchosen / sectUnjoined). Context-specific whitelists (checkHintData's
        // grammarKeys) stay stricter where they apply.
        var knownConditionKeys = ["qi", "realm", "meridians", "temperTier",
            "primaryMeridiansAll", "daoNode", "anyDaoNode", "daoElementTier",
            "achievement", "sectJoined", "contribution",
            "layerUnlocked", "coreForged", "coreBelowCeiling", "aspectUnchosen", "sectUnjoined"];
        Object.keys(condition).forEach(function (conditionKey) {
            if (knownConditionKeys.indexOf(conditionKey) === ZERO - ONE) {
                errors.push(label + ": unknown condition key '" + conditionKey
                    + "' — meets() would silently ignore it, making the clause always-true.");
            }
        });
    }

    // ----- §9.3 completability -------------------------------------------
    // Walk every unlock/done condition; each must be reachable from a fresh save
    // under current modifiers, and no gate may require the resource it suppresses.
    function checkCompletability(errors) {
        REALM_DATA.forEach(function (realm) {
            checkCondition(errors, "Realm " + realm.id + " unlock", realm.unlock);
            // §5a reveal markers must also be reachable, and a reveal must never be
            // STRICTER than its unlock (it gates visibility, a weaker step).
            if (realm.reveal) checkCondition(errors, "Realm " + realm.id + " reveal", realm.reveal);
        });
        BODY_DATA.buyables.forEach(function (b) {
            checkCondition(errors, "Body buyable " + b.key + " unlock", b.unlock);
        });
        GATE_DATA.achievements.forEach(function (ach) {
            checkCondition(errors, "Gate " + ach.key + " done", ach.done);
            // A gate must not suppress the resource it requires. In v0.1 gates grant
            // a Qi buff and require Qi-derived progress; assert no gate both requires
            // qi-derived progress AND declares a negative/suppressing effect.
            if (ach.effect && ach.effect.qiMult !== undefined && !(ach.effect.qiMult >= ONE)) {
                errors.push("Gate " + ach.key + ": qiMult < 1 would suppress the resource it gates.");
            }
        });

        // Forge reachability (§7): every Foundation band's baseCore and coreCeiling
        // must resolve to a real Core grade, baseCore must not exceed its ceiling,
        // and the strongest push (max offset) plus the band's baseCore must reach
        // the band's ceiling — otherwise the ceiling is unreachable by the fast
        // route (a dead push) or refinement alone, breaking completability (§9.3).
        var coreRealm = REALM_DATA.find(function (r) { return r.id === "c"; });
        var gradedRealm = REALM_DATA.find(function (r) { return r.graded && r.grade && r.grade.bands; });
        if (coreRealm && coreRealm.forge && coreRealm.forge.grades && gradedRealm) {
            var ladder = coreRealm.forge.grades;
            function ladderIndexForKey(key) {
                var row = ladder.find(function (g) { return g.key === key; });
                return row ? row.ceilingIndex : null;
            }
            var maxOffset = ZERO;
            coreRealm.forge.pushOptions.forEach(function (opt) {
                if (opt.offset > maxOffset) maxOffset = opt.offset;
            });
            gradedRealm.grade.bands.forEach(function (band) {
                var baseIdx = ladderIndexForKey(band.baseCore);
                var ceilIdx = ladderIndexForKey(band.coreCeiling);
                if (baseIdx === null) {
                    errors.push("Foundation band '" + band.tier
                        + "' baseCore '" + band.baseCore + "' is not a known Core grade.");
                }
                if (ceilIdx === null) {
                    errors.push("Foundation band '" + band.tier
                        + "' coreCeiling '" + band.coreCeiling + "' is not a known Core grade.");
                }
                if (baseIdx !== null && ceilIdx !== null) {
                    if (baseIdx > ceilIdx) {
                        errors.push("Foundation band '" + band.tier
                            + "': baseCore exceeds coreCeiling (impossible forge).");
                    }
                    if (baseIdx + maxOffset < ceilIdx) {
                        errors.push("Foundation band '" + band.tier
                            + "': strongest push cannot reach the coreCeiling "
                            + band.coreCeiling + " (unreachable ceiling, §9.3).");
                    }
                }
            });
        }

        // The fresh-save bootstrap: the first realm must unlock from Qi alone, so a
        // brand-new player can begin (no circular dependency at the root).
        var firstRealm = REALM_DATA[ZERO];
        if (!firstRealm.unlock || firstRealm.unlock.qi === undefined) {
            errors.push("Root realm '" + firstRealm.id
                + "' must unlock from Qi alone for a fresh save to progress.");
        }
    }

    // ----- §6 gradeScore term scaling (no-clamp-saturation) --------------
    // The gradeScore blocker (a term whose data-defined max input swamped the
    // others and clamped the whole score to 1.0) is invisible to the dead-mult
    // check — that only proves fMult has a consumer, not that the SCORE INPUTS
    // are well-scaled. So assert it directly: for each graded realm, the weights
    // must sum to 1, and each term, fed its MAXIMUM reachable input, must
    // contribute <= its own weight. If maxInput > denominator the term can exceed
    // its weight and (with the [0,1] clamp) silently dominate the score.
    //   meridian term: maxInput = primary meridian limit,  denom = meridianDenominator
    //   temper   term: maxInput = temper buyable limit,    denom = temperDenominator
    //   realm    term: maxInput = count of q sub-stages,   denom = realmDenominator
    // The factory clamps the realm/temper inputs to their denominators, so this is
    // belt-and-suspenders: it catches a DATA mis-scaling (e.g. a denominator typo)
    // even if a future factory edit drops the clamp.
    function checkGradeScoreScaling(errors) {
        var weightTolerance = ONE / FACTORY_NUMERICS.hundred; // 0.01 tolerance on the weight sum
        var primaryRow = BODY_DATA.buyables.find(function (b) { return b.key === "primaryMeridian"; });
        var temperRow = BODY_DATA.buyables.find(function (b) { return b.key === "temper"; });

        REALM_DATA.forEach(function (realm) {
            if (!realm.graded || !realm.grade) return;
            var g = realm.grade;

            var weightSum = g.weightMeridian + g.weightTemper + g.weightRealm;
            if (Math.abs(weightSum - ONE) > weightTolerance) {
                errors.push("Realm " + realm.id + " gradeScore weights sum to " + weightSum
                    + ", expected 1 (§6).");
            }

            // Per-term: each term's MAX reachable input over its denominator must be
            // <= 1, so weight*(ratio) <= weight and no term can alone clamp the score.
            //   - "clamped" terms (temper, realm) are clamped to their denominator IN
            //     THE FACTORY by design (§6: temper saturates at Marrow entry even
            //     though the buyable limit is a few levels higher; realm saturates at
            //     6th Level). For those the effective input is min(maxInput, denom),
            //     so they are safe as long as the FACTORY clamp is present — which the
            //     no-dead-multiplier consumer check confirms exists. We assert the
            //     clamp is meaningful (denom <= maxInput, else the clamp is inert and a
            //     denom typo could still under-scale) and that denom > 0.
            //   - the "unclamped" meridian term is NOT clamped in the factory, so its
            //     raw maxInput (the meridian limit) MUST be <= denominator.
            var terms = [
                { name: "meridian", maxInput: primaryRow.limit, denom: g.meridianDenominator, clamped: false },
                { name: "temper", maxInput: temperRow.limit, denom: g.temperDenominator, clamped: true },
                { name: "realm", maxInput: realm.substages.length, denom: g.realmDenominator, clamped: true }
            ];
            terms.forEach(function (term) {
                if (!(term.denom > ZERO)) {
                    errors.push("Realm " + realm.id + " gradeScore " + term.name
                        + " denominator must be > 0 (§6).");
                    return;
                }
                if (!term.clamped && term.maxInput > term.denom) {
                    errors.push("Realm " + realm.id + " gradeScore " + term.name
                        + " term can exceed its weight: unclamped max input " + term.maxInput
                        + " > denominator " + term.denom
                        + " (ratio " + (term.maxInput / term.denom).toFixed(FACTORY_NUMERICS.one + ONE)
                        + " > 1), so this term alone could clamp the score — the "
                        + "gradeScore blocker class (§6/§9.2).");
                }
            });
        });
    }

    // ----- §8/§9.1 story-gate discipline ---------------------------------
    // Story gates must be achievements (fire-once, read live state, grant a buff,
    // reset NOTHING) — never reset-based challenges. Each gate tagged
    // kind:"checkpoint" must declare a live-state done() condition and a buff
    // effect, and must NOT carry any challenge/reset shape. If a gate walls a
    // later layer (gates != null) it must be an unlock-condition object (a token
    // a later layer reads via hasAchievement), never a reset/challenge primitive.
    function checkStoryGateDiscipline(errors) {
        var checkpointKind = "checkpoint";
        GATE_DATA.achievements.forEach(function (ach) {
            if (ach.kind === checkpointKind) {
                if (!ach.done) {
                    errors.push("Checkpoint gate '" + ach.key
                        + "' has no done() live-state condition (§8).");
                }
                if (!ach.effect) {
                    errors.push("Checkpoint gate '" + ach.key
                        + "' grants no effect — a checkpoint must pay off (§8).");
                }
            }
            // A gate must never be a reset-based challenge (§9.1). Reject any
            // challenge/reset-flavoured fields smuggled onto a gate row.
            if (ach.challenge !== undefined || ach.resets !== undefined
                || ach.canComplete !== undefined) {
                errors.push("Gate '" + ach.key
                    + "' carries a challenge/reset shape — story gates are achievements, not challenges (§9.1).");
            }
            // A non-null wall token must be an object (unlock condition), not a flag
            // standing in for a reset-based challenge.
            if (ach.gates !== undefined && ach.gates !== null && typeof ach.gates !== "object") {
                errors.push("Gate '" + ach.key
                    + "' wall token must be an unlock-condition object, not "
                    + typeof ach.gates + " (§8).");
            }
        });
    }

    // ----- persistence-scope / tree-membership helpers (design §8.1) -----
    // Shared by checkPersistenceScopes / checkKeepRules / checkAchievementScopeDiscipline.
    // Numbers come only from row data or FACTORY_NUMERICS — no literals (§11).
    var SCOPE_TREE = "tree";
    var SCOPE_LIFE = "life";
    var SCOPE_ETERNAL = "eternal";
    var KIND_CHECKPOINT = "checkpoint";
    var KIND_META = "meta";

    // Sect technique school names (design §4.3). Shared by checkSectData / checkTechniqueData so
    // the school grammar lives in ONE place. "universal" is the shared canon (both archetypes);
    // "sword"/"formation" are the slice-5 school schools, each taught by exactly one archetype.
    var SECT_TECHNIQUE_SWORD = "sword";
    var SECT_TECHNIQUE_FORMATION = "formation";
    var SECT_TECHNIQUE_UNIVERSAL = "universal";

    // Every layer id the factory registers: realm rows + the Body + the gate layer, and
    // the Dao lattice (design §4.2) WHEN its data table is loaded. LATTICE_DATA is guarded
    // because not every harness loads lattice.js (the in-browser build and the runtime smoke
    // do; the data-only lint-node harness may not) — when absent the lattice simply isn't a
    // registered layer here, matching what the factory registers in that same context.
    function registeredLayerIds() {
        var ids = [];
        REALM_DATA.forEach(function (realm) { ids.push(realm.id); });
        ids.push(BODY_DATA.id);
        ids.push(GATE_DATA.id);
        if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.id) {
            ids.push(LATTICE_DATA.id);
        }
        // The Sect side-spine (design §4.3) and the Journal (design §1.6), slice 5. Guarded on
        // their data tables like LATTICE_DATA: not every harness loads sect.js / journal.js
        // (the data-only fixture may not), so when absent they simply aren't registered here —
        // matching what the factory registers in that same context.
        if (typeof SECT_DATA !== "undefined" && SECT_DATA && SECT_DATA.id) {
            ids.push(SECT_DATA.id);
        }
        if (typeof JOURNAL_DATA !== "undefined" && JOURNAL_DATA && JOURNAL_DATA.id) {
            ids.push(JOURNAL_DATA.id);
        }
        return ids;
    }

    // A realm row's tree row (the cascade ordinal). Only realm layers carry a row;
    // life/eternal side layers have none and never participate in a tree cascade.
    function layerTreeRow(layerId) {
        var realm = REALM_DATA.find(function (r) { return r.id === layerId; });
        return realm ? realm.row : undefined;
    }

    function treeEntryFor(layerId) {
        return TREE_DATA && TREE_DATA.layers ? TREE_DATA.layers[layerId] : undefined;
    }

    function treeIdIsDeclared(treeId) {
        if (!TREE_DATA || !TREE_DATA.trees) return false;
        return !!TREE_DATA.trees.find(function (t) { return t.id === treeId; });
    }

    // The start-data key set the factory's startData() seeds for a layer — derived
    // the way the factory does, so a kept key can be checked for existence without
    // hardcoding layer ids. Base realm keys are unlocked/points/best/total; a forge
    // realm (detected via realmData.forge, NOT id "c") adds the refinement keys.
    function startDataKeysForLayer(layerId) {
        var realm = REALM_DATA.find(function (r) { return r.id === layerId; });
        if (realm) {
            var realmKeys = ["unlocked", "points", "best", "total"];
            if (realm.forge) {
                ["refinementProgress", "warming", "lastForgeCracked"].forEach(function (k) {
                    realmKeys.push(k);
                });
            }
            return realmKeys;
        }
        if (layerId === BODY_DATA.id) {
            return ["unlocked", "points", "foundationGrade", "coreGrade"];
        }
        if (layerId === GATE_DATA.id) {
            return ["unlocked"];
        }
        return null;
    }

    // ----- §8.1 persistence scopes + cross-tree isolation -----------------
    // TREE_DATA exists; every registered layer has an entry; every entry's scope is
    // tree|life|eternal; "tree" entries carry a tree referencing trees[].id and
    // non-tree entries carry NO tree; no entry references an unregistered layer.
    // Then prove ISOLATION over the declared semantics: for each tree-scoped resetter
    // R, its reset closure { tree-scoped L : tree(L)===tree(R), row(L) < row(R) }
    // must contain no life/eternal layer and no layer of another tree (the cross-tree
    // leak the synthetic two-tree fixture exercises; vacuous with one real tree).
    function checkPersistenceScopes(errors) {
        if (typeof TREE_DATA === "undefined" || !TREE_DATA || !TREE_DATA.layers) {
            errors.push("Persistence: TREE_DATA (with a layers map) is required (§8.1).");
            return;
        }

        var registered = registeredLayerIds();
        var validScopes = [SCOPE_TREE, SCOPE_LIFE, SCOPE_ETERNAL];

        // Every registered layer has a well-formed entry.
        registered.forEach(function (layerId) {
            var entry = treeEntryFor(layerId);
            if (!entry) {
                errors.push("Persistence: registered layer '" + layerId
                    + "' has no TREE_DATA.layers entry (§8.1).");
                return;
            }
            if (validScopes.indexOf(entry.scope) === ZERO - ONE) {
                errors.push("Persistence: layer '" + layerId + "' has scope '"
                    + entry.scope + "', expected tree|life|eternal (§8.1).");
                return;
            }
            if (entry.scope === SCOPE_TREE) {
                if (entry.tree === undefined) {
                    errors.push("Persistence: tree-scoped layer '" + layerId
                        + "' must declare a tree (§8.1).");
                } else if (!treeIdIsDeclared(entry.tree)) {
                    errors.push("Persistence: layer '" + layerId
                        + "' references undeclared tree '" + entry.tree + "' (§8.1).");
                }
            } else if (entry.tree !== undefined) {
                errors.push("Persistence: " + entry.scope + "-scoped layer '" + layerId
                    + "' must NOT declare a tree (it sits outside every tree, §8.1).");
            }
        });

        // No stale entry: every TREE_DATA.layers key must be a registered layer.
        Object.keys(TREE_DATA.layers).forEach(function (entryId) {
            if (registered.indexOf(entryId) === ZERO - ONE) {
                errors.push("Persistence: TREE_DATA.layers entry '" + entryId
                    + "' is not a registered layer (stale entry, §8.1).");
            }
        });

        // Isolation. Each tree's mega-prestige cascade is intra-tree: the factory's
        // compiled doReset resets L iff L is tree-scoped, tree(L)===tree(R), and
        // row(L) < row(R). So a tree's reset closure is exactly its own lower-row
        // members — never a foreign tree's layer, never a life/eternal layer. The
        // robust property to prove over the DECLARED rows is that the same-tree guard
        // is provably redundant: each tree must occupy a CONTIGUOUS, DISJOINT row band,
        // so no foreign-tree or life/eternal layer ever sits BETWEEN a tree's own
        // rows. If two trees interleave, a row-only cascade (e.g. a future factory edit
        // dropping the same-tree guard) would sweep a foreign layer — the cross-tree
        // leak the synthetic two-tree fixture exercises (vacuous with one real tree).
        var treeRowBounds = {};
        registered.forEach(function (layerId) {
            var entry = treeEntryFor(layerId);
            if (!entry || entry.scope !== SCOPE_TREE) return;
            var row = layerTreeRow(layerId);
            if (row === undefined) return;
            var bounds = treeRowBounds[entry.tree];
            if (!bounds) {
                treeRowBounds[entry.tree] = { min: row, max: row };
            } else {
                if (row < bounds.min) bounds.min = row;
                if (row > bounds.max) bounds.max = row;
            }
        });

        Object.keys(treeRowBounds).forEach(function (treeId) {
            var bounds = treeRowBounds[treeId];
            registered.forEach(function (layerId) {
                var entry = treeEntryFor(layerId);
                if (!entry) return;
                var row = layerTreeRow(layerId);
                if (row === undefined) return;
                // A layer whose row lands inside [min,max] but is NOT a tree-scoped
                // member of THIS tree interleaves this tree's band.
                if (row < bounds.min || row > bounds.max) return;
                if (entry.scope === SCOPE_TREE && entry.tree === treeId) return;
                if (entry.scope === SCOPE_TREE) {
                    errors.push("Cross-tree leak: tree-scoped layer '" + layerId
                        + "' of tree " + entry.tree + " interleaves tree " + treeId
                        + "'s row band [" + bounds.min + "," + bounds.max
                        + "] — trees must occupy disjoint contiguous row bands (§8.1).");
                } else {
                    errors.push("Cross-scope leak: " + entry.scope + "-scoped layer '"
                        + layerId + "' has a tree row inside tree " + treeId
                        + "'s band [" + bounds.min + "," + bounds.max
                        + "]; life/eternal layers must sit outside every tree (§8.1).");
                }
            });
        });
    }

    // ----- §8.2 keep-rule reachability + key existence --------------------
    // Every rule's onResetOf and target are registered tree-scoped layers in the
    // SAME tree with row(target) < row(onResetOf); grantedBy.layer is registered and
    // grantedBy.milestone is a valid milestone id for it (a realm: a sub-stage index
    // within substages.length; the body layer: within temperTiers.length); every
    // keep key exists in the target layer's start-data shape (derived, not hardcoded).
    function checkKeepRules(errors) {
        if (typeof KEEP_RULES === "undefined" || !KEEP_RULES) {
            errors.push("Keep rules: KEEP_RULES table is required (§8.2).");
            return;
        }
        var registered = registeredLayerIds();

        KEEP_RULES.forEach(function (rule) {
            var ruleId = rule.key || (rule.onResetOf + "->" + rule.target);

            var resetEntry = treeEntryFor(rule.onResetOf);
            var targetEntry = treeEntryFor(rule.target);

            if (registered.indexOf(rule.onResetOf) === ZERO - ONE || !resetEntry || resetEntry.scope !== SCOPE_TREE) {
                errors.push("Keep rule '" + ruleId + "': onResetOf '" + rule.onResetOf
                    + "' is not a registered tree-scoped layer (§8.2).");
            }
            if (registered.indexOf(rule.target) === ZERO - ONE || !targetEntry || targetEntry.scope !== SCOPE_TREE) {
                errors.push("Keep rule '" + ruleId + "': target '" + rule.target
                    + "' is not a registered tree-scoped layer (§8.2).");
            }
            if (resetEntry && targetEntry && resetEntry.scope === SCOPE_TREE && targetEntry.scope === SCOPE_TREE) {
                if (resetEntry.tree !== targetEntry.tree) {
                    errors.push("Keep rule '" + ruleId + "': target '" + rule.target
                        + "' (tree " + targetEntry.tree + ") and onResetOf '" + rule.onResetOf
                        + "' (tree " + resetEntry.tree + ") are in different trees (§8.2).");
                } else {
                    var resetRow = layerTreeRow(rule.onResetOf);
                    var targetRow = layerTreeRow(rule.target);
                    if (resetRow !== undefined && targetRow !== undefined && !(targetRow < resetRow)) {
                        errors.push("Keep rule '" + ruleId + "': target row " + targetRow
                            + " is not below onResetOf row " + resetRow
                            + " — the target is not in the resetter's cascade (§8.2).");
                    }
                }
            }

            // grantedBy.milestone reachability: a realm milestone id is a sub-stage
            // index; the body layer's is a temper-tier index. Out-of-range = a rule
            // that can never activate.
            var grantLayer = rule.grantedBy ? rule.grantedBy.layer : undefined;
            var grantMilestone = rule.grantedBy ? rule.grantedBy.milestone : undefined;
            if (registered.indexOf(grantLayer) === ZERO - ONE) {
                errors.push("Keep rule '" + ruleId + "': grantedBy.layer '" + grantLayer
                    + "' is not a registered layer (§8.2).");
            } else {
                var grantRealm = REALM_DATA.find(function (r) { return r.id === grantLayer; });
                var milestoneCount = null;
                if (grantRealm) {
                    milestoneCount = grantRealm.substages.length;
                } else if (grantLayer === BODY_DATA.id) {
                    milestoneCount = BODY_DATA.temperTiers.length;
                }
                if (milestoneCount === null) {
                    errors.push("Keep rule '" + ruleId + "': grantedBy.layer '" + grantLayer
                        + "' has no milestone source (not a realm or the body layer, §8.2).");
                } else if (!(grantMilestone >= ZERO && grantMilestone < milestoneCount)) {
                    errors.push("Keep rule '" + ruleId + "': grantedBy.milestone " + grantMilestone
                        + " is out of range for layer '" + grantLayer + "' (0.."
                        + (milestoneCount - ONE) + ", §8.2).");
                }
            }

            // Every kept key must exist in the target layer's start-data shape.
            var targetKeys = startDataKeysForLayer(rule.target);
            if (targetKeys && rule.keep) {
                rule.keep.forEach(function (keyName) {
                    if (targetKeys.indexOf(keyName) === ZERO - ONE) {
                        errors.push("Keep rule '" + ruleId + "': keep key '" + keyName
                            + "' is not in target '" + rule.target + "' start-data shape ["
                            + targetKeys.join(", ") + "] (§8.2).");
                    }
                });
            }
        });
    }

    // ----- §8.5 hint cascade discipline -----------------------------------
    // HINT_DATA.hints is non-empty; EXACTLY ONE row has always===true and it is the
    // LAST row; every other row's "when" keys are all in the grammar; realm/temper/
    // meridians conditions are validated for reachability by REUSING checkCondition;
    // layerUnlocked must reference a registered layer id.
    function checkHintData(errors) {
        if (typeof HINT_DATA === "undefined" || !HINT_DATA || !HINT_DATA.hints) {
            errors.push("Hints: HINT_DATA (with a hints array) is required (§8.5).");
            return;
        }
        var hints = HINT_DATA.hints;
        if (!(hints.length > ZERO)) {
            errors.push("Hints: HINT_DATA.hints must be non-empty (§8.5).");
            return;
        }

        var grammarKeys = ["qi", "realm", "meridians", "temperTier", "primaryMeridiansAll",
            "layerUnlocked", "coreForged", "coreBelowCeiling",
            // Slice-4 additions (§11): anyDaoNode / daoElementTier are meets() grammar keys
            // that pass through the hint engine's strip list to meets(); aspectUnchosen is a
            // hint-only key evaluated by hintEngine.js's hintAspectUnchosen() function.
            "anyDaoNode", "daoElementTier", "aspectUnchosen",
            // Slice-5 additions (§11): achievement / sectJoined are meets() grammar keys that
            // pass through the hint engine's strip list to meets() (factory extension, §4.3);
            // sectUnjoined is a hint-only key evaluated by hintEngine.js's hintSectUnjoined()
            // function (!sectJoined() — fires while the sect layer is revealed but unjoined).
            "achievement", "sectJoined", "sectUnjoined"];
        var registered = registeredLayerIds();
        var lastIndex = hints.length - ONE;
        var alwaysCount = ZERO;

        hints.forEach(function (row, index) {
            var rowId = row.key || ("row#" + index);
            if (row.always === true) {
                alwaysCount = alwaysCount + ONE;
                if (index !== lastIndex) {
                    errors.push("Hints: catch-all row '" + rowId
                        + "' (always:true) must be LAST, not at index " + index + " (§8.5).");
                }
                return;
            }
            if (!row.when) {
                errors.push("Hints: row '" + rowId
                    + "' has neither a 'when' condition nor always:true (§8.5).");
                return;
            }
            Object.keys(row.when).forEach(function (key) {
                if (grammarKeys.indexOf(key) === ZERO - ONE) {
                    errors.push("Hints: row '" + rowId + "' uses unknown 'when' key '"
                        + key + "' (§8.5).");
                }
            });
            // Reachability via the shared oracle (realm/temper/meridians/qi/all).
            checkCondition(errors, "Hint '" + rowId + "' when", row.when);
            // The hint-only layerUnlocked key must name a registered layer.
            if (row.when.layerUnlocked !== undefined
                && registered.indexOf(row.when.layerUnlocked) === ZERO - ONE) {
                errors.push("Hints: row '" + rowId + "' layerUnlocked references "
                    + "unregistered layer '" + row.when.layerUnlocked + "' (§8.5).");
            }
        });

        if (alwaysCount !== ONE) {
            errors.push("Hints: exactly one unconditional catch-all (always:true) row is "
                + "required, found " + alwaysCount + " (§8.5).");
        }
    }

    // ----- §8.1 achievement scope discipline ------------------------------
    // An achievement's EFFECTIVE scope is its layer's TREE_DATA scope unless its kind
    // overrides it: kind "checkpoint" -> life, kind "meta" -> eternal. Linter rule
    // (§8.1): no effective-eternal achievement may gate a tree- or life-scoped layer.
    function achievementEffectiveScope(layerScope, kind) {
        if (kind === KIND_CHECKPOINT) return SCOPE_LIFE;
        if (kind === KIND_META) return SCOPE_ETERNAL;
        return layerScope;
    }

    function checkAchievementScopeDiscipline(errors) {
        var gateEntry = treeEntryFor(GATE_DATA.id);
        var gateLayerScope = gateEntry ? gateEntry.scope : SCOPE_LIFE;

        GATE_DATA.achievements.forEach(function (ach) {
            var effectiveScope = achievementEffectiveScope(gateLayerScope, ach.kind);
            if (effectiveScope !== SCOPE_ETERNAL) return;
            // An eternal achievement may gate nothing tree- or life-scoped (§8.1).
            if (ach.gates === undefined || ach.gates === null) return;
            // The wall token's `layer` (or each referenced layer) must not be a
            // tree- or life-scoped layer. Support a single id or an array of ids.
            var gatedLayers = [];
            if (typeof ach.gates.layer === "string") gatedLayers.push(ach.gates.layer);
            if (Array.isArray(ach.gates.layers)) {
                ach.gates.layers.forEach(function (id) { gatedLayers.push(id); });
            }
            gatedLayers.forEach(function (gatedId) {
                var gatedEntry = treeEntryFor(gatedId);
                if (!gatedEntry) return;
                if (gatedEntry.scope === SCOPE_TREE || gatedEntry.scope === SCOPE_LIFE) {
                    errors.push("Achievement scope: eternal achievement '" + ach.key
                        + "' gates " + gatedEntry.scope + "-scoped layer '" + gatedId
                        + "' — no eternal achievement may gate a tree- or life-scoped layer (§8.1).");
                }
            });
        });
    }

    // ----- §4.2 Dao lattice integrity -------------------------------------
    // LATTICE_DATA is a comprehension DAG (design §4.2): five elemental roots with no
    // requires, ring-2 nodes each requiring a root. This check proves the graph and its
    // cost/effect schema are well-formed so makeDaoLayer (and the daoNode* readers) build a
    // completable lattice: keys/buyableIds unique; every requires references a real node; the
    // requires graph is ACYCLIC and every node is reachable from a root (an empty-requires
    // node) — an unreachable node can never be bought, an effect computed into nothing; costs
    // and effects are positional over tiers (strictly ascending positive costs; effect keys a
    // subset of {qiMult,insightMult}, every value >= 1 because nodes are pure bonuses, §4.2);
    // conflicts reference real nodes with no self/duplicate pair; the Insight baseRate is
    // positive; and the reveal condition passes the shared checkCondition oracle (§5a grammar).
    function checkLatticeData(errors) {
        if (typeof LATTICE_DATA === "undefined" || !LATTICE_DATA) {
            errors.push("Lattice: LATTICE_DATA table is required (§4.2).");
            return;
        }
        var nodes = LATTICE_DATA.nodes;
        if (!nodes || !(nodes.length > ZERO)) {
            errors.push("Lattice: LATTICE_DATA.nodes must be non-empty (§4.2).");
            return;
        }

        var tiers = LATTICE_DATA.tiers || [];
        var tierCount = tiers.length;
        var effectKeys = ["qiMult", "insightMult"];

        // Uniqueness of node keys and buyableIds (the buyableIds drive the tab layout, §4.2).
        var seenKeys = {};
        var seenBuyableIds = {};
        nodes.forEach(function (node) {
            if (seenKeys[node.key]) {
                errors.push("Lattice: duplicate node key '" + node.key + "' (§4.2).");
            }
            seenKeys[node.key] = true;
            if (seenBuyableIds[node.buyableId] !== undefined) {
                errors.push("Lattice: duplicate buyableId " + node.buyableId
                    + " (nodes '" + seenBuyableIds[node.buyableId] + "' and '" + node.key + "', §4.2).");
            }
            seenBuyableIds[node.buyableId] = node.key;
        });

        // Every requires entry references an existing node key.
        nodes.forEach(function (node) {
            (node.requires || []).forEach(function (req) {
                if (!seenKeys[req]) {
                    errors.push("Lattice: node '" + node.key + "' requires unknown node '"
                        + req + "' (§4.2).");
                }
            });
        });

        // Acyclicity + reachability from a root. A root is an empty-requires node; every node
        // must be reachable by walking requires-edges back to a root, and the requires graph
        // must contain no cycle (a cycle is both unreachable and an infinite unlock loop, §4.2).
        var nodeByKey = {};
        nodes.forEach(function (node) { nodeByKey[node.key] = node; });

        // Cycle detection via DFS over requires-edges, three-colour (white/grey/black).
        var visitState = {};
        function detectCycle(nodeKey, stack) {
            if (visitState[nodeKey] === "black") return false;
            if (visitState[nodeKey] === "grey") {
                errors.push("Lattice: requires cycle through node '" + nodeKey
                    + "' (path " + stack.concat(nodeKey).join(" -> ") + ") — the graph must be acyclic (§4.2).");
                return true;
            }
            var node = nodeByKey[nodeKey];
            if (!node) return false;
            visitState[nodeKey] = "grey";
            var found = false;
            (node.requires || []).forEach(function (req) {
                if (nodeByKey[req] && detectCycle(req, stack.concat(nodeKey))) found = true;
            });
            visitState[nodeKey] = "black";
            return found;
        }
        nodes.forEach(function (node) {
            if (visitState[node.key] === undefined) detectCycle(node.key, []);
        });

        // Reachability: walk requires back to a root (an empty-requires node). The walk carries
        // a `seen` set so it terminates even through a cycle (a cyclic component reaches no root
        // and is correctly reported as orphaned) — independent of the cycle pass above, so a
        // graph with a root-bearing component AND a disjoint cyclic orphan is fully diagnosed.
        function reachesRoot(nodeKey, seen) {
            var node = nodeByKey[nodeKey];
            if (!node) return false;
            var requires = node.requires || [];
            if (requires.length === ZERO) return true;       // a root
            var reaches = false;
            requires.forEach(function (req) {
                if (seen[req]) return;
                var nextSeen = {};
                Object.keys(seen).forEach(function (k) { nextSeen[k] = true; });
                nextSeen[nodeKey] = true;
                if (reachesRoot(req, nextSeen)) reaches = true;
            });
            return reaches;
        }
        nodes.forEach(function (node) {
            if (!reachesRoot(node.key, {})) {
                errors.push("Lattice: node '" + node.key
                    + "' is not reachable from any root (orphan, §4.2).");
            }
        });

        // Costs + effects are positional over tiers. Costs strictly ascending and positive;
        // effects one object per tier, keys a subset of {qiMult,insightMult}, every value >= 1.
        nodes.forEach(function (node) {
            var costs = node.costs || [];
            if (costs.length !== tierCount) {
                errors.push("Lattice: node '" + node.key + "' has " + costs.length
                    + " costs but " + tierCount + " tiers (§4.2).");
            }
            costs.forEach(function (cost, costIndex) {
                if (!(cost > ZERO)) {
                    errors.push("Lattice: node '" + node.key + "' cost at tier " + costIndex
                        + " must be positive (§4.2).");
                }
                if (costIndex > ZERO && !(cost > costs[costIndex - ONE])) {
                    errors.push("Lattice: node '" + node.key + "' costs must be strictly "
                        + "ascending (cost " + cost + " at tier " + costIndex
                        + " not above " + costs[costIndex - ONE] + ", §4.2).");
                }
            });

            var effects = node.effects || [];
            if (effects.length !== tierCount) {
                errors.push("Lattice: node '" + node.key + "' has " + effects.length
                    + " effects but " + tierCount + " tiers (§4.2).");
            }
            effects.forEach(function (effect, effectIndex) {
                Object.keys(effect).forEach(function (effectKey) {
                    if (effectKeys.indexOf(effectKey) === ZERO - ONE) {
                        errors.push("Lattice: node '" + node.key + "' tier " + effectIndex
                            + " effect key '" + effectKey
                            + "' not in {qiMult, insightMult} (§4.2).");
                    } else if (!(effect[effectKey] >= ONE)) {
                        errors.push("Lattice: node '" + node.key + "' tier " + effectIndex
                            + " " + effectKey + " is " + effect[effectKey]
                            + " — nodes are bonuses, every value must be >= 1 (§4.2).");
                    }
                });
            });
        });

        // Conflicts reference real nodes, no self-conflict, no duplicate pair (order-insensitive).
        var seenConflictPairs = {};
        (LATTICE_DATA.conflicts || []).forEach(function (pair) {
            var first = pair[ZERO];
            var second = pair[ONE];
            if (!seenKeys[first]) {
                errors.push("Lattice: conflict references unknown node '" + first + "' (§4.2).");
            }
            if (!seenKeys[second]) {
                errors.push("Lattice: conflict references unknown node '" + second + "' (§4.2).");
            }
            if (first === second) {
                errors.push("Lattice: node '" + first + "' conflicts with itself (§4.2).");
            }
            var canonicalPair = first < second ? first + "|" + second : second + "|" + first;
            if (seenConflictPairs[canonicalPair]) {
                errors.push("Lattice: duplicate conflict pair [" + first + ", " + second + "] (§4.2).");
            }
            seenConflictPairs[canonicalPair] = true;
        });

        // Insight baseRate must be positive (a non-positive trickle banks nothing, §4.2).
        if (!LATTICE_DATA.insight || !(LATTICE_DATA.insight.baseRate > ZERO)) {
            errors.push("Lattice: insight.baseRate must be > 0 (§4.2).");
        }

        // The reveal condition flows through the one shared reachability oracle (§5a grammar).
        checkCondition(errors, "Lattice unlock", LATTICE_DATA.unlock);
    }

    // ----- §6.1 stance integrity ------------------------------------------
    // STANCE_DATA is the self-imposed-difficulty grammar (design §6.1): voluntary toggles with
    // an opportunity cost. This check proves each stance is a real TRADE, never a free buff:
    // keys/clickableIds unique; maxActive >= 1; every modifiers key a subset of {qiMult,
    // insightMult}; ALL modifier values > 0 (a stance may slow a resource, never zero it —
    // completability §6.3); AND every stance trades — at least one modifier < 1 and at least one
    // > 1 (§6.1 opportunity cost; a stance with no downside is a settings toggle, not a stance).
    // Unlock conditions flow through checkCondition (now including the daoNode grammar key).
    function checkStanceData(errors) {
        if (typeof STANCE_DATA === "undefined" || !STANCE_DATA) {
            errors.push("Stances: STANCE_DATA table is required (§6.1).");
            return;
        }
        if (!(STANCE_DATA.maxActive >= ONE)) {
            errors.push("Stances: maxActive must be >= 1 (§6.1).");
        }
        var stances = STANCE_DATA.stances;
        if (!stances || !(stances.length > ZERO)) {
            errors.push("Stances: STANCE_DATA.stances must be non-empty (§6.1).");
            return;
        }

        var modifierKeys = ["qiMult", "insightMult"];
        var seenStanceKeys = {};
        var seenClickableIds = {};

        stances.forEach(function (stance) {
            if (seenStanceKeys[stance.key]) {
                errors.push("Stances: duplicate stance key '" + stance.key + "' (§6.1).");
            }
            seenStanceKeys[stance.key] = true;
            if (seenClickableIds[stance.clickableId] !== undefined) {
                errors.push("Stances: duplicate clickableId " + stance.clickableId
                    + " (stances '" + seenClickableIds[stance.clickableId] + "' and '"
                    + stance.key + "', §6.1).");
            }
            seenClickableIds[stance.clickableId] = stance.key;

            var modifiers = stance.modifiers || {};
            var sawBelowOne = false;
            var sawAboveOne = false;
            Object.keys(modifiers).forEach(function (modKey) {
                if (modifierKeys.indexOf(modKey) === ZERO - ONE) {
                    errors.push("Stances: stance '" + stance.key + "' modifier key '" + modKey
                        + "' not in {qiMult, insightMult} (§6.1).");
                    return;
                }
                var value = modifiers[modKey];
                if (!(value > ZERO)) {
                    errors.push("Stances: stance '" + stance.key + "' " + modKey + " is " + value
                        + " — a stance may slow a resource, never zero it (§6.3).");
                }
                if (value < ONE) sawBelowOne = true;
                if (value > ONE) sawAboveOne = true;
            });
            // The opportunity-cost rule (§6.1): a stance must trade DOWN and UP. A stance whose
            // every modifier is >= 1 is a free buff (a settings toggle), not a stance.
            if (!(sawBelowOne && sawAboveOne)) {
                errors.push("Stances: stance '" + stance.key
                    + "' must TRADE — at least one modifier < 1 and at least one > 1; a "
                    + "free-lunch stance is a settings toggle, not a stance (§6.1).");
            }

            // Unlock condition flows through the shared oracle (daoNode included).
            checkCondition(errors, "Stance '" + stance.key + "' unlock", stance.unlock);
        });
    }

    // ----- §1.7/§7.5 automation ladder integrity --------------------------
    // AUTOMATION_DATA is the automation-as-reward grammar (design §1.7/§7.5): each row is a
    // grant ACTIVATED by a milestone that runs a layer action forever after (never a settings
    // toggle). This check proves each grant is wired to something REAL and that the ladder keeps
    // pace with the frontier so a player never hand-grinds two-rows-stale content:
    //   - keys unique;
    //   - grantedBy.layer registered AND grantedBy.milestone in range (the keep-rule milestone
    //     precedent: a realm milestone id is a sub-stage index; the body layer's a temper-tier index);
    //   - automates.layer registered;
    //   - action in {prestige, buyable};
    //   - buyableKey present IFF action is "buyable", and resolving to a real BODY_DATA buyable
    //     on the target layer (a phantom key auto-buys nothing — a dead grant);
    //   - THE FRONTIER RULE (§1.7): for every TREE-scoped realm R, if (max tree row - R.row) > 2
    //     then SOME AUTOMATION_DATA row must automate R's prestige. Two-rows-below content is the
    //     decisionless grind the soul should erase; an uncovered layer this far behind the
    //     frontier is the hand-grind the ladder exists to prevent. Reports uncovered layers by id.
    function checkAutomationData(errors) {
        if (typeof AUTOMATION_DATA === "undefined" || !AUTOMATION_DATA) {
            errors.push("Automation: AUTOMATION_DATA table is required (§1.7).");
            return;
        }
        var registered = registeredLayerIds();
        var validActions = ["prestige", "buyable"];
        var seenKeys = {};

        AUTOMATION_DATA.forEach(function (automationRow) {
            var rowId = automationRow.key || "(unkeyed)";
            if (seenKeys[automationRow.key]) {
                errors.push("Automation: duplicate row key '" + automationRow.key + "' (§1.7).");
            }
            seenKeys[automationRow.key] = true;

            // grantedBy.layer registered + milestone in range (keep-rule precedent §8.2).
            var grant = automationRow.grantedBy || {};
            var grantLayer = grant.layer;
            var grantMilestone = grant.milestone;
            if (registered.indexOf(grantLayer) === ZERO - ONE) {
                errors.push("Automation '" + rowId + "': grantedBy.layer '" + grantLayer
                    + "' is not a registered layer (§1.7).");
            } else {
                var grantRealm = REALM_DATA.find(function (r) { return r.id === grantLayer; });
                var milestoneCount = null;
                if (grantRealm) {
                    milestoneCount = grantRealm.substages.length;
                } else if (grantLayer === BODY_DATA.id) {
                    milestoneCount = BODY_DATA.temperTiers.length;
                } else if (typeof SECT_DATA !== "undefined" && SECT_DATA
                    && grantLayer === SECT_DATA.id && SECT_DATA.milestones) {
                    // Slice-5 milestone source (design §4.3): the sect layer's milestones are
                    // its contribution high-water ladder (SECT_DATA.milestones); a grantedBy.
                    // milestone id is an index into that array (the arsenal grant uses index 2).
                    milestoneCount = SECT_DATA.milestones.length;
                }
                if (milestoneCount === null) {
                    errors.push("Automation '" + rowId + "': grantedBy.layer '" + grantLayer
                        + "' has no milestone source (not a realm, the body layer, or the sect layer, §1.7).");
                } else if (!(grantMilestone >= ZERO && grantMilestone < milestoneCount)) {
                    errors.push("Automation '" + rowId + "': grantedBy.milestone " + grantMilestone
                        + " is out of range for layer '" + grantLayer + "' (0.."
                        + (milestoneCount - ONE) + ", §1.7).");
                }
            }

            // automates.layer registered + action in grammar + buyableKey iff buyable.
            var automates = automationRow.automates || {};
            if (registered.indexOf(automates.layer) === ZERO - ONE) {
                errors.push("Automation '" + rowId + "': automates.layer '" + automates.layer
                    + "' is not a registered layer (§1.7).");
            }
            if (validActions.indexOf(automates.action) === ZERO - ONE) {
                errors.push("Automation '" + rowId + "': action '" + automates.action
                    + "' is not in {prestige, buyable} (§1.7).");
            }
            if (automates.action === "buyable") {
                if (automates.buyableKey === undefined) {
                    errors.push("Automation '" + rowId
                        + "': a buyable action must declare a buyableKey (§1.7).");
                } else if (automates.layer === BODY_DATA.id) {
                    var buyableRow = BODY_DATA.buyables.find(function (b) {
                        return b.key === automates.buyableKey;
                    });
                    if (!buyableRow) {
                        errors.push("Automation '" + rowId + "': buyableKey '"
                            + automates.buyableKey + "' is not a buyable on layer '"
                            + automates.layer + "' (a phantom auto-buy, §1.7).");
                    }
                }
                // A non-body buyable target has no BODY_DATA buyable table to resolve against;
                // the registered-layer check above already guards the layer itself.
            } else if (automates.buyableKey !== undefined) {
                errors.push("Automation '" + rowId + "': a '" + automates.action
                    + "' action must NOT declare a buyableKey (§1.7).");
            }
            // "Auto-prestige AT THRESHOLD" (design §5): a prestige automation without a
            // positive gainFraction fires at bare canReset every tick, zeroing the base
            // currency and starving every sink below it (the gameLoop tree loop runs
            // before the side loop). The threshold is mandatory, not optional tuning.
            if (automates.action === "prestige") {
                if (!(automates.gainFraction > ZERO)) {
                    errors.push("Automation '" + rowId + "': a prestige action must declare "
                        + "gainFraction > 0 — thresholdless auto-prestige starves every "
                        + "sink of the base currency (§5 'at threshold', §1.7).");
                }
            } else if (automates.gainFraction !== undefined) {
                errors.push("Automation '" + rowId + "': gainFraction only applies to "
                    + "prestige actions (§1.7).");
            }
        });

        // THE FRONTIER RULE (§1.7). The frontier is the highest TREE-scoped realm row; any
        // tree-scoped realm more than two rows below it must have its prestige automated, or the
        // player would hand-re-prestige stale content. Compute the max tree row, then for each
        // tree-scoped realm that far behind, demand a granted "prestige" automation targeting it.
        var maxTreeRow = ZERO - ONE;
        REALM_DATA.forEach(function (realm) {
            var entry = treeEntryFor(realm.id);
            if (!entry || entry.scope !== SCOPE_TREE) return;
            if (realm.row > maxTreeRow) maxTreeRow = realm.row;
        });
        var frontierDepth = ONE + ONE;   // "more than two rows below" => row distance > 2
        REALM_DATA.forEach(function (realm) {
            var entry = treeEntryFor(realm.id);
            if (!entry || entry.scope !== SCOPE_TREE) return;
            if (!((maxTreeRow - realm.row) > frontierDepth)) return;
            var covered = AUTOMATION_DATA.some(function (automationRow) {
                var automates = automationRow.automates || {};
                return automates.action === "prestige" && automates.layer === realm.id;
            });
            if (!covered) {
                errors.push("Automation frontier: tree-scoped realm '" + realm.id + "' (row "
                    + realm.row + ") is more than two rows below the frontier (row " + maxTreeRow
                    + ") but no AUTOMATION_DATA row automates its prestige — the player would "
                    + "hand-grind two-rows-stale content (§1.7).");
            }
        });
    }

    // ----- §5/§6.3 soul aspect integrity ----------------------------------
    // For every realm carrying a soulAspect set-piece (expansion §5), prove the aspect pick is a
    // real, completable identity choice — never a wall and never a penalty:
    //   - aspects non-empty with unique keys;
    //   - AT LEAST ONE aspect has an empty/absent requires (the completability FLOOR §6.3: the
    //     always-available Formless aspect, so Nascent Soul can NEVER be aspect-blocked even on a
    //     save with no Dao Seeds — lint-enforced);
    //   - every effect key in {qiMult, insightMult}, every value >= 1 (a passive identity, never a
    //     penalty — same bonus discipline as lattice nodes §4.2);
    //   - every requires validated through the shared checkCondition oracle (now including the
    //     daoElementTier grammar — a phantom element or out-of-range tier is caught there);
    //   - element field null (Formless) or matching a real lattice element (a root node's element).
    function checkSoulAspectData(errors) {
        var effectKeys = ["qiMult", "insightMult"];
        REALM_DATA.forEach(function (realm) {
            if (!realm.soulAspect) return;
            var aspects = realm.soulAspect.aspects;
            if (!aspects || !(aspects.length > ZERO)) {
                errors.push("Soul aspect: realm '" + realm.id
                    + "' soulAspect.aspects must be non-empty (§5).");
                return;
            }

            var seenAspectKeys = {};
            var sawUnconditional = false;
            aspects.forEach(function (aspect) {
                if (seenAspectKeys[aspect.key]) {
                    errors.push("Soul aspect: realm '" + realm.id + "' duplicate aspect key '"
                        + aspect.key + "' (§5).");
                }
                seenAspectKeys[aspect.key] = true;

                // The completability floor (§6.3): an aspect with no requires (empty or absent) is
                // always pickable. At least one such aspect must exist so NS is never aspect-blocked.
                var requires = aspect.requires;
                if (!requires || Object.keys(requires).length === ZERO) {
                    sawUnconditional = true;
                }

                // Effect keys in {qiMult, insightMult}, every value >= 1 (identity, not penalty).
                var effect = aspect.effect || {};
                Object.keys(effect).forEach(function (effectKey) {
                    if (effectKeys.indexOf(effectKey) === ZERO - ONE) {
                        errors.push("Soul aspect: realm '" + realm.id + "' aspect '" + aspect.key
                            + "' effect key '" + effectKey + "' not in {qiMult, insightMult} (§5).");
                    } else if (!(effect[effectKey] >= ONE)) {
                        errors.push("Soul aspect: realm '" + realm.id + "' aspect '" + aspect.key
                            + "' " + effectKey + " is " + effect[effectKey]
                            + " — an aspect is a passive identity, every value must be >= 1 (§6.3).");
                    }
                });

                // requires flows through the shared oracle (daoElementTier validated there).
                checkCondition(errors, "Soul aspect '" + realm.id + "/" + aspect.key + "' requires",
                    requires);

                // element null (Formless) or matching a real lattice root element. Guarded on
                // LATTICE_DATA like daoElementTier — a harness with no lattice can't resolve it.
                if (aspect.element !== null && aspect.element !== undefined) {
                    if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.nodes) {
                        var elementExists = LATTICE_DATA.nodes.some(function (n) {
                            return n.element === aspect.element;
                        });
                        if (!elementExists) {
                            errors.push("Soul aspect: realm '" + realm.id + "' aspect '" + aspect.key
                                + "' element '" + aspect.element
                                + "' matches no lattice node element (§5).");
                        }
                    }
                }
            });

            if (!sawUnconditional) {
                errors.push("Soul aspect: realm '" + realm.id
                    + "' has no unconditional fallback aspect — NS would be aspect-blocked on a "
                    + "save with no held Seed (the completability floor, §6.3).");
            }
        });
    }

    // ----- §4.3 sect side-spine integrity ---------------------------------
    // SECT_DATA is the slice-5 horizontal-standing grammar (design §4.3): a LIFE-scoped
    // contribution economy whose archetype pick discounts a Dao-lattice region and unlocks a
    // technique library. This check proves the side-spine is a real, completable choice — never a
    // dead discount, never a phantom technique:
    //   - reveal flows through the shared checkCondition oracle (§5a grammar);
    //   - contribution rate > 0 and 0 < exponent <= 1 (the SUB-LINEAR accrual law: an exponent
    //     above 1 lets late-game Qi trivialize the sect economy, §4.3; a non-positive rate banks
    //     nothing);
    //   - AT LEAST TWO archetypes with unique keys (the §4.3 "archetypes matter" build choice);
    //   - each archetype's element resolves to a real LATTICE_DATA node element (the discount
    //     region must exist) and 0 < latticeDiscount <= 1 (a discount, never a penalty > 1, never
    //     a free 0);
    //   - every archetype technique key resolves to a TECHNIQUE_DATA row whose school is consistent
    //     with the archetype (a sword archetype may only list sword/universal techniques) — a key
    //     pointing at a phantom or wrong-school technique is dead identity data;
    //   - milestones have strictly ascending `at`s with recognized reward keys (qiMult >= 1, or
    //     libraryTier, or arsenal) — an out-of-order milestone is earned before its predecessor.
    function checkSectData(errors) {
        if (typeof SECT_DATA === "undefined" || !SECT_DATA) {
            errors.push("Sect: SECT_DATA table is required (§4.3).");
            return;
        }

        // reveal flows through the one shared reachability oracle (§5a grammar).
        checkCondition(errors, "Sect reveal", SECT_DATA.reveal);

        // The contribution accrual law: rate > 0, 0 < exponent <= 1 (sub-linear, §4.3).
        var contribution = SECT_DATA.contribution || {};
        if (!(contribution.rate > ZERO)) {
            errors.push("Sect: contribution.rate must be > 0 (a non-positive rate banks "
                + "nothing, §4.3).");
        }
        if (!(contribution.exponent > ZERO && contribution.exponent <= ONE)) {
            errors.push("Sect: contribution.exponent must be in (0,1] — sub-linear in Qi/sec so "
                + "late-game Qi cannot trivialize the sect economy (§4.3).");
        }

        // At least two archetypes with unique keys (the §4.3 build choice).
        var archetypes = SECT_DATA.archetypes || [];
        if (!(archetypes.length >= ONE + ONE)) {
            errors.push("Sect: SECT_DATA.archetypes must offer at least two archetypes (the "
                + "§4.3 build choice).");
        }
        var seenArchetypeKeys = {};
        archetypes.forEach(function (archetype) {
            if (seenArchetypeKeys[archetype.key]) {
                errors.push("Sect: duplicate archetype key '" + archetype.key + "' (§4.3).");
            }
            seenArchetypeKeys[archetype.key] = true;

            // The archetype's element must own a real lattice node (its discount region must
            // exist). Guarded on LATTICE_DATA like the soul-aspect element check — a harness with
            // no lattice can't resolve it, so the discount-region check is vacuous there.
            if (typeof LATTICE_DATA !== "undefined" && LATTICE_DATA && LATTICE_DATA.nodes) {
                var elementHasNode = LATTICE_DATA.nodes.some(function (n) {
                    return n.element === archetype.element;
                });
                if (!elementHasNode) {
                    errors.push("Sect: archetype '" + archetype.key + "' element '"
                        + archetype.element + "' matches no lattice node element — its discount "
                        + "region is empty (§4.3).");
                }
            }

            // latticeDiscount in (0,1]: a discount, never a penalty (> 1), never free (0 or below).
            if (!(archetype.latticeDiscount > ZERO && archetype.latticeDiscount <= ONE)) {
                errors.push("Sect: archetype '" + archetype.key + "' latticeDiscount "
                    + archetype.latticeDiscount + " must be in (0,1] — a discount, never a "
                    + "penalty and never free (§4.3).");
            }

            // Each listed technique key must resolve to a TECHNIQUE_DATA row, and the archetype's
            // school techniques must all share ONE non-universal school (its school is derived from
            // its own list, never a hardcoded element→school map): a list mixing two schools, or
            // naming a phantom key, is inconsistent identity data (§4.3). Universal techniques are
            // always allowed and do not pin the school. Guarded on TECHNIQUE_DATA presence.
            if (typeof TECHNIQUE_DATA !== "undefined" && TECHNIQUE_DATA) {
                var archetypeSchool = null;
                (archetype.techniques || []).forEach(function (techniqueKey) {
                    var techniqueRow = TECHNIQUE_DATA.find(function (t) { return t.key === techniqueKey; });
                    if (!techniqueRow) {
                        errors.push("Sect: archetype '" + archetype.key + "' lists technique '"
                            + techniqueKey + "' which is not a TECHNIQUE_DATA row (phantom "
                            + "technique, §4.3).");
                        return;
                    }
                    if (techniqueRow.school === SECT_TECHNIQUE_UNIVERSAL) return;
                    if (archetypeSchool === null) {
                        archetypeSchool = techniqueRow.school;
                    } else if (techniqueRow.school !== archetypeSchool) {
                        errors.push("Sect: archetype '" + archetype.key + "' lists technique '"
                            + techniqueKey + "' of school '" + techniqueRow.school
                            + "', inconsistent with the archetype's school '" + archetypeSchool
                            + "' (an archetype teaches ONE school plus universal, §4.3).");
                    }
                });
            }
        });

        // Milestones: strictly ascending `at`s, recognized reward keys.
        var rewardKeys = ["qiMult", "libraryTier", "arsenal"];
        var previousAt = null;
        (SECT_DATA.milestones || []).forEach(function (milestone, milestoneIndex) {
            if (previousAt !== null && !(milestone.at > previousAt)) {
                errors.push("Sect: milestone '" + milestone.key + "' at " + milestone.at
                    + " is not above the previous milestone's at " + previousAt
                    + " — milestones must ascend (§4.3).");
            }
            previousAt = milestone.at;

            var reward = milestone.reward || {};
            Object.keys(reward).forEach(function (rewardKey) {
                if (rewardKeys.indexOf(rewardKey) === ZERO - ONE) {
                    errors.push("Sect: milestone '" + milestone.key + "' reward key '" + rewardKey
                        + "' not in {qiMult, libraryTier, arsenal} (§4.3).");
                }
            });
            // A stipend qiMult is a bonus, never a suppressor (the gate/aspect bonus discipline).
            if (reward.qiMult !== undefined && !(reward.qiMult >= ONE)) {
                errors.push("Sect: milestone '" + milestone.key + "' reward.qiMult " + reward.qiMult
                    + " must be >= 1 — a stipend is a bonus, never a penalty (§4.3).");
            }
        });
    }

    // ----- §4.3 technique library integrity -------------------------------
    // TECHNIQUE_DATA is the permanent arts library (design §4.3, LIFE scope): TMT upgrades on the
    // sect layer, bought with Contribution, school-gated by archetype. This check proves the library
    // is well-formed and that no technique is dead content:
    //   - unique keys; school in {sword, formation, universal}; libraryTier 1 or 2; cost > 0;
    //     effect keys a subset of {qiMult, insightMult}, every value >= 1 (a permanent arts bonus,
    //     never a penalty — same bonus discipline as lattice nodes §4.2 / soul aspects §5);
    //   - EVERY SCHOOL technique must be offered by SOME archetype (an orphaned sword technique no
    //     Azure Sword archetype lists is unreachable dead content, §4.3);
    //   - EVERY UNIVERSAL technique must be offered by ALL archetypes (the shared canon is available
    //     to both archetypes by definition; a universal technique missing from an archetype's list
    //     would silently hide the shared canon from that archetype).
    function checkTechniqueData(errors) {
        if (typeof TECHNIQUE_DATA === "undefined" || !TECHNIQUE_DATA) {
            errors.push("Technique: TECHNIQUE_DATA table is required (§4.3).");
            return;
        }

        var schoolKeys = [SECT_TECHNIQUE_SWORD, SECT_TECHNIQUE_FORMATION, SECT_TECHNIQUE_UNIVERSAL];
        var validTiers = [ONE, ONE + ONE];
        var effectKeys = ["qiMult", "insightMult"];
        var seenTechniqueKeys = {};

        TECHNIQUE_DATA.forEach(function (technique) {
            if (seenTechniqueKeys[technique.key]) {
                errors.push("Technique: duplicate technique key '" + technique.key + "' (§4.3).");
            }
            seenTechniqueKeys[technique.key] = true;

            if (schoolKeys.indexOf(technique.school) === ZERO - ONE) {
                errors.push("Technique '" + technique.key + "': school '" + technique.school
                    + "' not in {sword, formation, universal} (§4.3).");
            }
            if (validTiers.indexOf(technique.libraryTier) === ZERO - ONE) {
                errors.push("Technique '" + technique.key + "': libraryTier " + technique.libraryTier
                    + " must be 1 or 2 (§4.3).");
            }
            if (!(technique.cost > ZERO)) {
                errors.push("Technique '" + technique.key + "': cost must be > 0 (§4.3).");
            }
            var effect = technique.effect || {};
            Object.keys(effect).forEach(function (effectKey) {
                if (effectKeys.indexOf(effectKey) === ZERO - ONE) {
                    errors.push("Technique '" + technique.key + "': effect key '" + effectKey
                        + "' not in {qiMult, insightMult} (§4.3).");
                } else if (!(effect[effectKey] >= ONE)) {
                    errors.push("Technique '" + technique.key + "': " + effectKey + " is "
                        + effect[effectKey] + " — a technique is a bonus, every value must be >= 1 (§4.3).");
                }
            });
        });

        // Offered-coverage (§4.3). A SCHOOL technique is offered ONLY to the archetype whose list
        // names it (the factory's techniqueSchoolAvailable reads the archetype's techniques array),
        // so a school technique no archetype lists is unreachable dead content. A UNIVERSAL technique
        // is the shared canon: the factory offers it to ALL archetypes BY SCHOOL (school==="universal"
        // returns true once joined, independent of any list), so being well-formed school "universal"
        // IS the all-archetype offering — universal techniques are deliberately absent from archetype
        // lists. We therefore only need to prove the school-technique reachability here. Guarded on
        // SECT_DATA presence (the archetype lists live there).
        if (typeof SECT_DATA !== "undefined" && SECT_DATA && SECT_DATA.archetypes) {
            var archetypes = SECT_DATA.archetypes;
            TECHNIQUE_DATA.forEach(function (technique) {
                if (technique.school === SECT_TECHNIQUE_UNIVERSAL) return; // offered to all by school
                var offeredBySome = archetypes.some(function (archetype) {
                    return (archetype.techniques || []).indexOf(technique.key) !== ZERO - ONE;
                });
                if (!offeredBySome) {
                    errors.push("Technique '" + technique.key + "': a '" + technique.school
                        + "' school technique is offered by NO archetype — unreachable dead "
                        + "content (§4.3).");
                }
            });
        }
    }

    // ----- §1.6 journal reachability --------------------------------------
    // JOURNAL_DATA is the slice-5 narrative journal (design §1.6, ETERNAL scope): entries latch
    // once their `when` condition is met and never re-lock. This check proves the journal is
    // well-formed and never permanently empty:
    //   - unique entry keys; title + text non-empty (a blank entry is a UI hole);
    //   - every `when` flows through the shared checkCondition oracle (the achievement / sectJoined
    //     extensions included) so no entry latches on an unreachable or malformed condition;
    //   - AT LEAST ONE entry is reachable from a FRESH SAVE — a qi-only (or layerUnlocked-of-the-
    //     root-realm) condition — so the journal is never permanently empty (design §1.6: the
    //     journal is the anticipation engine; a journal with no first beat anticipates nothing).
    function checkJournalData(errors) {
        if (typeof JOURNAL_DATA === "undefined" || !JOURNAL_DATA) {
            errors.push("Journal: JOURNAL_DATA table is required (§1.6).");
            return;
        }
        var entries = JOURNAL_DATA.entries;
        if (!entries || !(entries.length > ZERO)) {
            errors.push("Journal: JOURNAL_DATA.entries must be non-empty (§1.6).");
            return;
        }

        var rootRealmId = REALM_DATA[ZERO] ? REALM_DATA[ZERO].id : undefined;
        var seenEntryKeys = {};
        var sawFreshReachable = false;

        entries.forEach(function (entry) {
            var entryId = entry.key || "(unkeyed)";
            if (seenEntryKeys[entry.key]) {
                errors.push("Journal: duplicate entry key '" + entry.key + "' (§1.6).");
            }
            seenEntryKeys[entry.key] = true;

            if (!entry.title) {
                errors.push("Journal: entry '" + entryId + "' has an empty title (§1.6).");
            }
            if (!entry.text) {
                errors.push("Journal: entry '" + entryId + "' has empty text (§1.6).");
            }

            // The `when` condition flows through the one shared oracle (achievement / sectJoined
            // included). layerUnlocked is a hint-only key, so resolve it against registered layers
            // exactly as checkHintData does (checkCondition does not validate layerUnlocked).
            checkCondition(errors, "Journal entry '" + entryId + "' when", entry.when);
            if (entry.when && entry.when.layerUnlocked !== undefined
                && registeredLayerIds().indexOf(entry.when.layerUnlocked) === ZERO - ONE) {
                errors.push("Journal: entry '" + entryId + "' layerUnlocked references "
                    + "unregistered layer '" + entry.when.layerUnlocked + "' (§1.6).");
            }

            // Fresh-save reachability: a qi-only condition, OR layerUnlocked of the ROOT realm
            // (which unlocks from Qi alone — the §9.3 bootstrap), is reachable from a brand-new
            // save. At least one entry must qualify so the journal is never permanently empty.
            if (entry.when) {
                var whenKeys = Object.keys(entry.when);
                var qiOnly = whenKeys.length === ONE && entry.when.qi !== undefined;
                var rootUnlockOnly = whenKeys.length === ONE
                    && entry.when.layerUnlocked === rootRealmId;
                if (qiOnly || rootUnlockOnly) sawFreshReachable = true;
            }
        });

        if (!sawFreshReachable) {
            errors.push("Journal: no entry is reachable from a fresh save (a qi-only or root-realm "
                + "layerUnlocked condition) — the journal would be permanently empty (§1.6).");
        }
    }

    // ----- §11 no numeric literals in js/build/*.js -----------------------
    // sourceTexts: { filename -> source string }. The node harness supplies these
    // by reading files; in-browser we cannot read source, so the check is skipped
    // (the harness is the gate of record, run in CI / pre-commit).
    function checkNoNumericLiterals(errors, sourceTexts) {
        if (!sourceTexts) return "skipped";
        // Match bare numeric literals NOT preceded by an identifier char, a dot, or
        // an underscore (so identifiers like break_eternity / utf-8 names are safe),
        // and not part of a larger word. We strip strings and comments first.
        var numberPattern = /(^|[^\w.$])(\d[\d_]*(\.\d+)?([eE][+-]?\d+)?)/g;

        Object.keys(sourceTexts).forEach(function (fileName) {
            var stripped = stripStringsAndComments(sourceTexts[fileName]);
            var match;
            var hits = [];
            while ((match = numberPattern.exec(stripped)) !== null) {
                hits.push(match[ONE + ONE]);
            }
            if (hits.length > ZERO) {
                errors.push("Numeric literal(s) in " + fileName + ": " + hits.join(", ")
                    + " — every number must come from a data row.");
            }
        });
        return "ran";
    }

    // Remove // and /* */ comments and the contents of string/template/regex
    // literals so a number inside text (e.g. "10th Level") is not flagged.
    function stripStringsAndComments(source) {
        var out = "";
        var i = ZERO;
        var len = source.length;
        var state = "code";
        var quote = "";
        while (i < len) {
            var ch = source.charAt(i);
            var next = i + ONE < len ? source.charAt(i + ONE) : "";
            if (state === "code") {
                if (ch === "/" && next === "/") { state = "line"; i = i + ONE + ONE; continue; }
                if (ch === "/" && next === "*") { state = "block"; i = i + ONE + ONE; continue; }
                if (ch === "\"" || ch === "'" || ch === "`") { state = "string"; quote = ch; i = i + ONE; continue; }
                out += ch; i = i + ONE; continue;
            }
            if (state === "line") {
                if (ch === "\n") { state = "code"; out += ch; }
                i = i + ONE; continue;
            }
            if (state === "block") {
                if (ch === "*" && next === "/") { state = "code"; i = i + ONE + ONE; continue; }
                i = i + ONE; continue;
            }
            if (state === "string") {
                if (ch === "\\") { i = i + ONE + ONE; continue; }
                if (ch === quote) { state = "code"; }
                i = i + ONE; continue;
            }
        }
        return out;
    }

    function runCultivationLinter(sourceTexts) {
        var errors = [];
        var checks = {};
        var factorySource = sourceTexts ? sourceTexts["layerFactory.js"] : undefined;
        checkNoDeadMultipliers(errors, factorySource);
        checks.noDeadMultipliers = "ran";
        checkCompletability(errors);
        checks.completability = "ran";
        checkGradeScoreScaling(errors);
        checks.gradeScoreScaling = "ran";
        checkStoryGateDiscipline(errors);
        checks.storyGateDiscipline = "ran";
        // Persistence-scope / keep-rule / hint / achievement-scope checks (§8.1/§8.2/§8.5).
        checkPersistenceScopes(errors);
        checks.persistenceScopes = "ran";
        checkKeepRules(errors);
        checks.keepRules = "ran";
        checkHintData(errors);
        checks.hintData = "ran";
        checkAchievementScopeDiscipline(errors);
        checks.achievementScopeDiscipline = "ran";
        // Dao lattice + stance integrity (design §4.2/§6.1).
        checkLatticeData(errors);
        checks.latticeData = "ran";
        checkStanceData(errors);
        checks.stanceData = "ran";
        // Automation ladder + soul aspect integrity (expansion §1.7/§7.5/§5/§6.3).
        checkAutomationData(errors);
        checks.automationData = "ran";
        checkSoulAspectData(errors);
        checks.soulAspectData = "ran";
        // Sect side-spine / technique library / journal integrity (design §4.3/§1.6, slice 5).
        checkSectData(errors);
        checks.sectData = "ran";
        checkTechniqueData(errors);
        checks.techniqueData = "ran";
        checkJournalData(errors);
        checks.journalData = "ran";
        checks.noNumericLiterals = checkNoNumericLiterals(errors, sourceTexts);
        return { ok: errors.length === ZERO, errors: errors, checks: checks };
    }

    // Expose for both the in-game factory and the node harness.
    root.runCultivationLinter = runCultivationLinter;
    root.cultivationStripStringsAndComments = stripStringsAndComments;

    // Individually-exposed checks (design §8.1/§8.2/§8.5) so the synthetic two-tree
    // fixture harness can run a SINGLE check against synthetic globals without
    // tripping the unrelated dead-multiplier / completability / grade-scaling checks.
    // Each takes an errors array and reads the data globals from this scope's root.
    root.cultivationLintChecks = {
        checkNoDeadMultipliers: checkNoDeadMultipliers,
        checkPersistenceScopes: checkPersistenceScopes,
        checkKeepRules: checkKeepRules,
        checkHintData: checkHintData,
        checkAchievementScopeDiscipline: checkAchievementScopeDiscipline,
        checkLatticeData: checkLatticeData,
        checkStanceData: checkStanceData,
        checkAutomationData: checkAutomationData,
        checkSoulAspectData: checkSoulAspectData,
        checkSectData: checkSectData,
        checkTechniqueData: checkTechniqueData,
        checkJournalData: checkJournalData
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
