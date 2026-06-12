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
//
// Defensive contract: if HINT_DATA or the factory globals are not yet defined
// (e.g. evaluated before layerFactory.js has run), return the catch-all row so
// the UI receives something valid rather than crashing.
//
// HARD RULE (§11): ZERO numeric literals — every number resolves from
// FACTORY_NUMERICS. This file lives in js/build/ and is included in the lint scan.

// ---------------------------------------------------------------------------
// Hint-only condition keys evaluated here (not delegated to meets()).
// ---------------------------------------------------------------------------

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

    // Build a stripped condition containing only the meets()-compatible keys so
    // we can delegate without passing hint-only keys through. anyDaoNode and
    // daoElementTier ARE meets() keys (factory grammar, slice 4) — they pass
    // through to meets() exactly like realm/meridians/qi. The hint-only keys
    // (layerUnlocked, coreForged, coreBelowCeiling, aspectUnchosen) are consumed
    // above and excluded from the meetable set so meets() never sees them.
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
