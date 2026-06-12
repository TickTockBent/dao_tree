// js/build/hintEngine.js — hint cascade evaluator (design doc §1.5 / §8.5)
//
// Consumes HINT_DATA (js/data/hints.js) and exposes two globals:
//   cultivationCurrentHint()  — first matching HINT_DATA row, or the catch-all.
//   cultivationHintText()     — matched row's text, or "" if data is absent.
//
// Evaluation order: rows are walked top-down; FIRST MATCH wins. A row matches if
// always === true (unconditional catch-all) OR every key in "when" holds:
//   - qi / realm / meridians / temperTier / primaryMeridiansAll: delegated to
//     meets() (factory global defined in layerFactory.js, loaded before this file).
//   - anyDaoNode: N — delegated to meets(); matches when ANY lattice node is owned
//     at tier >= N (design §4.2 "any-node" grammar; new in slice 4).
//   - daoElementTier: [element, N] — delegated to meets(); matches when ANY node
//     of the named element is owned at tier >= N (NS aspect gate grammar, slice 4).
//   - layerUnlocked: player[id] exists AND player[id].unlocked is true.
//   - coreForged: getCoreGradeIndex() (factory global) >= FACTORY_NUMERICS.zero.
//   - coreBelowCeiling: getCoreGradeIndex() < coreCeilingGradeIndex() (factory global).
//   - aspectUnchosen: true — matches when the n layer is unlocked AND the Soul Aspect
//     has not yet been chosen (player.b.soulAspect === "" via soulAspectRow() accessor).
//     Evaluated here because it reads through the factory's soul-aspect accessor with
//     the same defensive typeof pattern used for getCoreGradeIndex (§8.5).
//   - tribulationReady: true — matches when tribulationIsReady() (factory global) is
//     true: the trigger condition met, not yet passed, not yet active, cooldown elapsed.
//     Backed by the pinned factory surface (tribulationIsReady). New in slice 6.
//   - scarActive: true — matches when scarIsActive() (factory global) is true:
//     the failure-scar slot has active depth (depth > healedDepth). Backed by the
//     pinned factory surface (scarIsActive). New in slice 6.
//   - tribulationPassed: true — matches when tribulationPassed() (factory global) is
//     true: tribGrade resolves to a passing grade row (passes:true). Backed by the
//     pinned factory surface (tribulationPassed). New in slice 6.
//
// Defensive contract: if HINT_DATA or the factory globals are not yet defined
// (e.g. evaluated before layerFactory.js has run), return the catch-all row so
// the UI receives something valid rather than crashing.
//
// HARD RULE (§11): ZERO numeric literals — every number resolves from
// FACTORY_NUMERICS. This file lives in js/build/ and is included in the lint scan.
//
// Slice-6 hint-only keys (tribulationReady / scarActive / tribulationPassed /
// scarHealed) are FULLY wired: evaluators here, linter knownConditionKeys +
// checkHintData grammarKeys, and the journal evaluator's strip list in
// layerFactory.js. Data rows in hints.js / journal.js use the real keys.

// ---------------------------------------------------------------------------
// Hint-only condition keys evaluated here (not delegated to meets()).
// ---------------------------------------------------------------------------

// True when the sect layer is revealed (player.sect exists and is unlocked) AND
// the player has not yet chosen an archetype (player.sect.archetype === "").
// Evaluated here as a hint-only key because: (a) the grammar has no negation so we
// cannot express "sect shown AND !sectJoined()" through meets() directly; (b) this
// key only needs to exist in the hint cascade, not in the full meets() grammar; and
// (c) we use the sectJoined() factory accessor (defined in layerFactory.js's sect
// extension, slice 5) defensively — when the sect factory surface is absent (pre-
// slice-5 saves), this returns false so the joinSect row never fires early. (§4.3)
function hintSectUnjoined() {
    if (typeof sectJoined !== "function") return false;
    // The sect layer must be REVEALED (the §5a reveal gate met), not merely loaded — the
    // sect layer's `unlocked` engine flag is always true (the tab is active from boot), so
    // checking it would fire this hint on a fresh save before the sect is even visible. The
    // sectIsRevealed() factory accessor is the authoritative reveal latch (player.sect.revealed
    // || meets(SECT_DATA.reveal)); guard it defensively so a pre-slice-5 save (no sect factory)
    // never fires the joinSect row early.
    if (typeof sectIsRevealed !== "function") return false;
    if (!sectIsRevealed()) return false;
    return !sectJoined();
}

// True when a core has been forged: stored grade index is at or above zero.
// Mirrors coreIsForged() logic in layerFactory.js but reads through
// getCoreGradeIndex() so the single grade store is authoritative.
function hintCoreIsForged() {
    if (typeof getCoreGradeIndex !== "function") return false;
    return getCoreGradeIndex() >= FACTORY_NUMERICS.zero;
}

// True when a forged core's current grade is strictly below its Foundation
// ceiling — i.e. there is still a tier the player can warm toward (§7b).
function hintCoreBelowCeiling() {
    if (typeof getCoreGradeIndex !== "function") return false;
    if (typeof coreCeilingGradeIndex !== "function") return false;
    return getCoreGradeIndex() < coreCeilingGradeIndex();
}

// True when player[layerId] exists and its unlocked flag is set.
function hintLayerUnlocked(layerId) {
    if (typeof player === "undefined") return false;
    return !!(player[layerId] && player[layerId].unlocked);
}

// True when the n (Nascent Soul) layer is unlocked AND the Soul Aspect has not
// yet been chosen. The aspect key is stored life-scoped on player.b.soulAspect
// (design §6 grade-storage precedent); "" = unchosen. The soulAspectRow() factory
// accessor is called defensively (typeof guard) — if it is absent (e.g. before
// the n realm's factory surface is registered), this returns false so the hint
// simply does not fire early rather than crashing (§8.5 defensive contract).
function hintAspectUnchosen() {
    if (!hintLayerUnlocked("n")) return false;
    if (typeof soulAspectRow !== "function") return false;
    return soulAspectRow() === null;
}

// True when the First Tribulation is ready to trigger: the trigger substage
// has been reached on the s (Soul Formation) layer, the tribulation has not
// yet been passed, and it is not currently active, and the retry cooldown has
// elapsed. Backed by the tribulationIsReady() factory surface (pinned, slice 6).
// Evaluated here as a hint-only key because tribulationIsReady() reads through
// several Body/s-layer state fields that have no meets()-grammar equivalent —
// the same defensive typeof pattern as other hint-only factory readers (§8.5).
function hintTribulationReady() {
    if (typeof tribulationIsReady !== "function") return false;
    return tribulationIsReady();
}

// True when the failure-scar slot is active: player.b.scarDepth > player.b.scarHealedDepth.
// Backed by the scarIsActive() factory surface (pinned, slice 6). Defensive when the
// Body layer is absent or the scar reader is not yet defined — returns false rather than
// crashing, so a pre-slice-6 save never fires the healScar hint early (§8.5).
function hintScarActive() {
    if (typeof scarIsActive !== "function") return false;
    return scarIsActive();
}

// True when the First Tribulation has been resolved with a passing grade: tribGrade
// resolves to a grade row with passes:true. Backed by the tribulationPassed() factory
// surface (pinned, slice 6). Defensive when the factory surface is absent — returns
// false so the actComplete hint never fires before the tribulation system is wired (§8.5).
function hintTribulationPassed() {
    if (typeof tribulationPassed !== "function") return false;
    return tribulationPassed();
}

// True when at least one scar depth has been HEALED (the §1.3 heal arc completed at
// least once — the "Tempered by Ruin" state). Backed by the scarHealedDepth() factory
// reader; defensive like the other slice-6 readers (§8.5).
function hintScarHealed() {
    if (typeof scarHealedDepth !== "function") return false;
    return scarHealedDepth() > FACTORY_NUMERICS.zero;
}

// ---------------------------------------------------------------------------
// hintRowMatches(row) — returns true iff the row's condition is satisfied.
// ---------------------------------------------------------------------------
function hintRowMatches(row) {
    // Unconditional catch-all: always matches.
    if (row.always === true) return true;

    var condition = row.when;
    if (!condition) return false;

    // Evaluate the hint-only keys first, before delegating to meets().
    if (condition.layerUnlocked !== undefined) {
        if (!hintLayerUnlocked(condition.layerUnlocked)) return false;
    }
    if (condition.coreForged === true) {
        if (!hintCoreIsForged()) return false;
    }
    if (condition.coreBelowCeiling === true) {
        if (!hintCoreBelowCeiling()) return false;
    }
    // aspectUnchosen: hint-only key (n layer unlocked AND soul aspect not yet picked).
    // Evaluated here; does NOT pass through to meets() (§8.5 strip list).
    if (condition.aspectUnchosen === true) {
        if (!hintAspectUnchosen()) return false;
    }
    // sectUnjoined: hint-only key (sect layer revealed AND archetype not yet chosen).
    // Evaluated here via hintSectUnjoined(); does NOT pass through to meets() because
    // meets() has no negation and we need "revealed AND NOT joined" (§4.3 / slice 5).
    if (condition.sectUnjoined === true) {
        if (!hintSectUnjoined()) return false;
    }
    // tribulationReady: hint-only key (tribulationIsReady() — trigger substage met,
    // not yet passed, not active, cooldown elapsed). Evaluated here via
    // hintTribulationReady(); does NOT pass through to meets() — the trigger state
    // depends on several Body/s-layer fields that have no meets()-grammar equivalent.
    // New in slice 6; backed by the tribulationIsReady() factory surface.
    if (condition.tribulationReady === true) {
        if (!hintTribulationReady()) return false;
    }
    // scarActive: hint-only key (scarIsActive() — player.b.scarDepth > scarHealedDepth).
    // Evaluated here via hintScarActive(); does NOT pass through to meets() — the scar
    // state is stored on the Body layer with no meets()-grammar equivalent (§8.5).
    // New in slice 6; backed by the scarIsActive() factory surface.
    if (condition.scarActive === true) {
        if (!hintScarActive()) return false;
    }
    // tribulationPassed: hint-only key (tribulationPassed() — tribGrade resolves to a
    // passing grade row with passes:true). Evaluated here via hintTribulationPassed();
    // does NOT pass through to meets() — tribGrade is s-layer state, no grammar equivalent.
    // New in slice 6; backed by the tribulationPassed() factory surface.
    if (condition.tribulationPassed === true) {
        if (!hintTribulationPassed()) return false;
    }
    // scarHealed: hint-only key (scarHealedDepth() > 0 — at least one heal arc completed).
    // Evaluated here via hintScarHealed(); Body state, no grammar equivalent. Slice 6.
    if (condition.scarHealed === true) {
        if (!hintScarHealed()) return false;
    }

    // Build a stripped condition containing only the meets()-compatible keys so
    // we can delegate without passing hint-only keys through. anyDaoNode,
    // daoElementTier, achievement, and sectJoined ARE meets() keys (factory
    // grammar, slice 4/5) — they pass through to meets() exactly like
    // realm/meridians/qi. The hint-only keys (layerUnlocked, coreForged,
    // coreBelowCeiling, aspectUnchosen, sectUnjoined, tribulationReady,
    // scarActive, tribulationPassed) are consumed above and excluded from the
    // meetable set so meets() never sees them (slice 5/6 hint-only grammar).
    var meetableCondition = {};
    var hasMeetableKeys = false;

    if (condition.qi !== undefined) {
        meetableCondition.qi = condition.qi;
        hasMeetableKeys = true;
    }
    if (condition.realm !== undefined) {
        meetableCondition.realm = condition.realm;
        hasMeetableKeys = true;
    }
    if (condition.meridians !== undefined) {
        meetableCondition.meridians = condition.meridians;
        hasMeetableKeys = true;
    }
    if (condition.temperTier !== undefined) {
        meetableCondition.temperTier = condition.temperTier;
        hasMeetableKeys = true;
    }
    if (condition.primaryMeridiansAll !== undefined) {
        meetableCondition.primaryMeridiansAll = condition.primaryMeridiansAll;
        hasMeetableKeys = true;
    }
    // anyDaoNode: N — passes through to meets() (factory grammar, §4.2 slice 4).
    // matches when ANY lattice node is owned at tier >= N.
    if (condition.anyDaoNode !== undefined) {
        meetableCondition.anyDaoNode = condition.anyDaoNode;
        hasMeetableKeys = true;
    }
    // daoElementTier: [element, N] — passes through to meets() (factory grammar, slice 4).
    // matches when ANY node of the named element is owned at tier >= N.
    if (condition.daoElementTier !== undefined) {
        meetableCondition.daoElementTier = condition.daoElementTier;
        hasMeetableKeys = true;
    }
    // achievement: [layerId, achievementId] — passes through to meets() (factory grammar,
    // slice 5). matches when hasAchievement(layerId, achievementId) is true. The factory's
    // meets() extension handles the actual evaluation so the hint engine delegates cleanly.
    if (condition.achievement !== undefined) {
        meetableCondition.achievement = condition.achievement;
        hasMeetableKeys = true;
    }
    // sectJoined: true — passes through to meets() (factory grammar, slice 5).
    // matches when sectJoined() returns true (an archetype has been chosen this life).
    if (condition.sectJoined !== undefined) {
        meetableCondition.sectJoined = condition.sectJoined;
        hasMeetableKeys = true;
    }
    // contribution: N — passes through to meets() (factory grammar, slice 5):
    // sect standing high-water (contributionBest), used by gate/journal conditions.
    if (condition.contribution !== undefined) {
        meetableCondition.contribution = condition.contribution;
        hasMeetableKeys = true;
    }

    // Delegate the factory-grammar keys to meets() if any are present.
    // meets() is a factory global; guard against it not being loaded yet.
    if (hasMeetableKeys) {
        if (typeof meets !== "function") return false;
        if (!meets(meetableCondition)) return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// cultivationCurrentHint() — top-level evaluator exposed as a global.
// Returns the first matching HINT_DATA row. If HINT_DATA is missing or the
// factory globals are absent, returns the catch-all row (or null if absent).
// ---------------------------------------------------------------------------
function cultivationCurrentHint() {
    if (typeof HINT_DATA === "undefined" || !HINT_DATA || !HINT_DATA.hints) {
        return null;
    }

    var hints = HINT_DATA.hints;
    var hintCount = hints.length;
    var catchAllRow = null;

    // Locate the catch-all in advance so we can return it on any failure path.
    // The catch-all must be the last row (lint-enforced), so walk from the end.
    var lastIndex = hintCount - FACTORY_NUMERICS.one;
    if (lastIndex >= FACTORY_NUMERICS.zero && hints[lastIndex].always === true) {
        catchAllRow = hints[lastIndex];
    }

    // Guard: if factory globals are not ready, fall back to the catch-all.
    if (typeof getCoreGradeIndex !== "function" || typeof meets !== "function") {
        return catchAllRow;
    }

    // Walk top-down; first match wins.
    for (var rowIndex = FACTORY_NUMERICS.zero; rowIndex < hintCount; rowIndex = rowIndex + FACTORY_NUMERICS.one) {
        var candidateRow = hints[rowIndex];
        if (hintRowMatches(candidateRow)) {
            return candidateRow;
        }
    }

    // No match found — return catch-all (should not be reachable if data is
    // correct, because the catch-all always matches, but guard defensively).
    return catchAllRow;
}

// ---------------------------------------------------------------------------
// cultivationHintText() — returns the matched row's text, or "" when absent.
// ---------------------------------------------------------------------------
function cultivationHintText() {
    if (typeof HINT_DATA === "undefined" || !HINT_DATA) return "";
    var matched = cultivationCurrentHint();
    if (!matched || !matched.text) return "";
    return matched.text;
}
