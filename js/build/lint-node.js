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
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = path.join(projectRoot, "js", "data");
const buildDir = path.join(projectRoot, "js", "build");

// Files that define the data globals + the linter, loaded in dependency order.
// trees.js / keep-rules.js / hints.js reference nothing at load; they sit with
// their data siblings before linter.js so the new §8.1/§8.2/§8.5 checks can read them.
const dataFiles = ["constants.js", "realms.js", "body.js", "gates.js",
    "trees.js", "keep-rules.js", "lattice.js", "stances.js", "hints.js"];
const linterFile = "linter.js";

// js/build/*.js files subject to the no-numeric-literal scan (generated/factory
// surface). hintEngine.js is part of that surface; lint-node.js and the fixture
// harness are harnesses, not generated code, so they are excluded from the scan.
const scannedBuildFiles = ["layerFactory.js", "linter.js", "hintEngine.js"];

function fail(message) {
    console.error("LINT HARNESS ERROR: " + message);
    process.exit(1);
}

// Minimal sandbox: the linter only touches the data globals (no Decimal/player
// needed for the data-table checks). globalThis maps to the sandbox itself.
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.console = console;
const context = vm.createContext(sandbox);

dataFiles.forEach(function (file) {
    const full = path.join(dataDir, file);
    if (!fs.existsSync(full)) fail("missing data file: " + full);
    vm.runInContext(fs.readFileSync(full, "utf8"), context, { filename: full });
});

const linterFull = path.join(buildDir, linterFile);
if (!fs.existsSync(linterFull)) fail("missing linter: " + linterFull);
vm.runInContext(fs.readFileSync(linterFull, "utf8"), context, { filename: linterFull });

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
