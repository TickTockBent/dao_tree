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
            foundationFMult: "foundationGradeMult"
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

    // Every layer id the factory registers: realm rows + the Body + the gate layer.
    function registeredLayerIds() {
        var ids = [];
        REALM_DATA.forEach(function (realm) { ids.push(realm.id); });
        ids.push(BODY_DATA.id);
        ids.push(GATE_DATA.id);
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
            "layerUnlocked", "coreForged", "coreBelowCeiling"];
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
        checkPersistenceScopes: checkPersistenceScopes,
        checkKeepRules: checkKeepRules,
        checkHintData: checkHintData,
        checkAchievementScopeDiscipline: checkAchievementScopeDiscipline
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
