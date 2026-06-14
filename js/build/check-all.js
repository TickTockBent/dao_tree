// js/build/check-all.js — run-all harness for the cultivation gate suite.
//
// Usage:
//   node js/build/check-all.js          run all four harnesses (lint, fixture, smoke, sim)
//   node js/build/check-all.js --quick  skip the pacing sim (inner-loop use)
//
// npm test is the convention; this script is the substance (spec §E3).
//
// Runs lint-node -> fixture-test-node -> runtime-smoke-node -> pacing-sim in sequence.
// Fail-fast: on the first harness failure it prints the child output, shows the summary
// table so far, and exits nonzero. Total wall budget: under 60s on current data.

"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const quick = process.argv.includes("--quick");

// Harness descriptors: name + script path relative to build dir.
const buildDir = path.resolve(__dirname);

const harnesses = [
    { name: "lint",    script: path.join(buildDir, "lint-node.js") },
    { name: "fixture", script: path.join(buildDir, "fixture-test-node.js") },
    { name: "smoke",   script: path.join(buildDir, "runtime-smoke-node.js") },
    { name: "sim",     script: path.join(buildDir, "pacing-sim.js"), skippable: true }
];

// Column widths for the summary table.
const COL_NAME   = 9;   // "fixture  "
const COL_RESULT = 7;   // "SKIPPED"
const COL_MS     = 10;  // "  9999 ms"

function pad(str, width) {
    const s = String(str);
    return s + " ".repeat(Math.max(0, width - s.length));
}

function rightPad(str, width) {
    const s = String(str);
    return " ".repeat(Math.max(0, width - s.length)) + s;
}

// Separator line.
const separatorWidth = COL_NAME + 2 + COL_RESULT + 2 + COL_MS;
const separator = "-".repeat(separatorWidth);

console.log(separator);
console.log(pad("harness", COL_NAME) + "  " + pad("result", COL_RESULT) + "  " + "wall ms");
console.log(separator);

const rows = [];
let totalMs = 0;
let anyFailed = false;

for (let i = 0; i < harnesses.length; i++) {
    const h = harnesses[i];

    if (h.skippable && quick) {
        const row = { name: h.name, result: "SKIPPED", ms: null };
        rows.push(row);
        console.log(pad(h.name, COL_NAME) + "  " + pad(row.result, COL_RESULT) + "  " + "(skipped)");
        continue;
    }

    const start = Date.now();
    const result = spawnSync(process.execPath, [h.script], {
        encoding: "utf8",
        timeout: 60000   // 60s guard per harness (total budget 60s)
    });
    const ms = Date.now() - start;
    totalMs += ms;

    const passed = result.status === 0 && !result.error;
    const status = passed ? "PASS" : "FAIL";
    const row = { name: h.name, result: status, ms: ms };
    rows.push(row);

    if (passed) {
        // Quiet on success: suppress child stdout.
        console.log(pad(h.name, COL_NAME) + "  " + pad(status, COL_RESULT) + "  " + rightPad(ms + " ms", COL_MS));
    } else {
        // Full child output on failure.
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.error) console.error("spawn error: " + result.error.message);
        console.log(pad(h.name, COL_NAME) + "  " + pad(status, COL_RESULT) + "  " + rightPad(ms + " ms", COL_MS));

        anyFailed = true;
        // Fail-fast: print summary so far and exit.
        console.log(separator);
        console.log("total                         " + rightPad(totalMs + " ms", COL_MS));
        console.log(separator);
        console.error("\nGATE FAILED — " + h.name + " harness did not pass.");
        process.exit(1);
    }
}

console.log(separator);
console.log(pad("total", COL_NAME) + "  " + pad("", COL_RESULT) + "  " + rightPad(totalMs + " ms", COL_MS));
console.log(separator);

if (!anyFailed) {
    console.log("\nAll harnesses passed.");
    process.exit(0);
} else {
    process.exit(1);
}
