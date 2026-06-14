// js/build/lint-node.js — node-runnable harness for the cultivation linter (§9/§11).
//
// Usage:  node js/build/lint-node.js
//
// Loads the plain-JS data globals and the linter into a sandboxed context (the
// same globals the browser would define), reads the js/build/*.js source for the
// "no numeric literal in generated code" scan, runs runCultivationLinter, prints
// the result, and exits non-zero on failure so CI / pre-commit can gate on it.

"use strict";

const fs = require("fs");
const path = require("path");
const nodeBoot = require("./node-boot.js");

const projectRoot = nodeBoot.projectRoot;
const dataDir = path.join(projectRoot, "js", "data");
const buildDir = path.join(projectRoot, "js", "build");

// Files that define the data globals + the linter, loaded in dependency order.
// trees.js / keep-rules.js / hints.js reference nothing at load; they sit with
// their data siblings before linter.js so the new §8.1/§8.2/§8.5 checks can read them.
// Required data files: these MUST exist for the linter to run.
const dataFiles = nodeBoot.DATA_FILES;
// Slice-5 data files: loaded when present (the other agent delivers these in the same slice).
// When absent, the linter runs against the pre-sect data set — it still validates all prior
// invariants. The files are listed here so they are loaded in dependency order once present.
const optionalDataFiles = nodeBoot.OPTIONAL_DATA_FILES;
const linterFile = "linter.js";

// js/build/*.js files subject to the no-numeric-literal scan (generated/factory
// surface). hintEngine.js is part of that surface; lint-node.js and the fixture
// harness are harnesses, not generated code, so they are excluded from the scan.
const scannedBuildFiles = nodeBoot.SCANNED_BUILD_FILES;

function fail(message) {
    console.error("LINT HARNESS ERROR: " + message);
    process.exit(1);
}

// Minimal sandbox: the linter only touches the data globals (no Decimal/player
// needed for the data-table checks). globalThis maps to the sandbox itself.
const sandbox = nodeBoot.createMinimalSandbox();
const context = require("vm").createContext(sandbox);

nodeBoot.loadFilesInto(context, dataFiles.map(function (file) { return path.join(dataDir, file); }), {
    optional: false,
    filenameFull: true,
    onFail: fail,
    missingMessage: function (full) { return "missing data file: " + full; }
});

// Load optional slice-5 files if present; warn but do not fail when absent.
nodeBoot.loadFilesInto(context, optionalDataFiles.map(function (file) { return path.join(dataDir, file); }), {
    optional: true,
    filenameFull: true,
    onFail: fail,
    onMissing: function (relative) {
        console.warn("LINT NOTE: optional data file not yet present (expected once slice 5 lands): " + path.basename(relative));
    }
});

const linterFull = path.join(buildDir, linterFile);
nodeBoot.loadFilesInto(context, [linterFull], {
    optional: false,
    filenameFull: true,
    onFail: fail,
    missingMessage: function (full) { return "missing linter: " + full; }
});

if (typeof sandbox.runCultivationLinter !== "function") {
    fail("runCultivationLinter was not defined after loading linter.js");
}

// Gather the build source for the numeric-literal scan.
const sourceTexts = {};
scannedBuildFiles.forEach(function (file) {
    const full = path.join(buildDir, file);
    if (!fs.existsSync(full)) fail("missing build file for scan: " + full);
    sourceTexts[file] = fs.readFileSync(full, "utf8");
});

const result = sandbox.runCultivationLinter(sourceTexts);

console.log("Cultivation linter checks: " + JSON.stringify(result.checks));
if (result.ok) {
    console.log("PASS — all spec §9 invariants hold over the data tables.");
    process.exit(0);
} else {
    console.error("FAIL — " + result.errors.length + " invariant violation(s):");
    result.errors.forEach(function (line) { console.error("  - " + line); });
    process.exit(1);
}
