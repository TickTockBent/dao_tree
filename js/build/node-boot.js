// js/build/node-boot.js — shared headless boot shim for the node harnesses.
//
// This is a HARNESS support module, NOT generated/factory code: it is NOT
// subject to the §11 zero-numeric-literal rule and is NOT added to
// scannedBuildFiles. It factors out the engine-boot path the runtime smoke
// harness already performed (data loads, factory load, player/temp shims,
// Decimal availability) so lint-node.js, fixture-test-node.js,
// runtime-smoke-node.js, and pacing-sim.js can all consume one boot surface
// without re-implementing it (spec slice 6.5 Phase A).
//
// The surface is intentionally COMPOSABLE rather than a single bootEngine():
//   - the fixture harness must stay synthetic (linter only, no real data files),
//     so it builds a minimal sandbox and loads only the linter itself;
//   - the lint harness loads the data globals + linter but no engine/Decimal;
//   - the smoke harness (and the sim) need the full browser-stub engine boot.
// Each harness composes the pieces it needs; nothing forces the full engine
// boot onto the harnesses that must not have it.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Repo root, resolved from this file's location (js/build/node-boot.js -> repo).
const projectRoot = path.resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// File lists (verbatim from the harnesses they were extracted from).
// ---------------------------------------------------------------------------

// lint path: data globals + linter, loaded in dependency order.
const DATA_FILES = ["constants.js", "realms.js", "setpieces.js", "legacy.js", "body.js", "gates.js",
    "trees.js", "keep-rules.js", "lattice.js", "stances.js", "hints.js", "automation.js"];
const OPTIONAL_DATA_FILES = ["sect.js", "techniques.js", "journal.js"];

// js/build/*.js subject to the no-numeric-literal scan (the lint path reads these as source text).
const SCANNED_BUILD_FILES = ["layerFactory.js", "linter.js", "hintEngine.js"];

// smoke/sim path: the full engine, in index.html order minus render-only files.
const ENGINE_FILES = [
    "js/technical/break_eternity.js",
    "js/technical/layerSupport.js",
    "js/data/constants.js",
    "js/data/realms.js",
    "js/data/setpieces.js",
    "js/data/legacy.js",
    "js/data/body.js",
    "js/data/gates.js",
    "js/data/trees.js",
    "js/data/keep-rules.js",
    "js/data/lattice.js",
    "js/data/stances.js",
    "js/data/hints.js",
    "js/data/automation.js",
    "js/build/linter.js",
    "js/build/layerFactory.js",
    "js/build/hintEngine.js",
    "js/mod.js",
    "js/layers.js",
    "js/tree.js",
    "js/technical/temp.js",
    "js/game.js",
    "js/utils.js",
    "js/utils/easyAccess.js",
    "js/utils/NumberFormating.js",
    "js/utils/options.js",
    "js/utils/save.js"
];

// Slice-5 optional engine data files: loaded BEFORE ENGINE_FILES (preserve this quirk).
const OPTIONAL_ENGINE_FILES = [
    "js/data/sect.js",
    "js/data/techniques.js",
    "js/data/journal.js"
];

// ---------------------------------------------------------------------------
// Sandboxes.
// ---------------------------------------------------------------------------

// Console-only sandbox (the lint and fixture paths). opts.factoryNumerics=true
// presets FACTORY_NUMERICS so linter.js's load-time IIFE can capture it
// (the fixture path); the lint path leaves it absent (matches prior behavior).
function createMinimalSandbox(opts) {
    const options = opts || {};
    const sandbox = {};
    sandbox.globalThis = sandbox;
    sandbox.console = console;
    if (options.factoryNumerics) {
        sandbox.FACTORY_NUMERICS = { zero: 0, one: 1, hundred: 100 };
    }
    return sandbox;
}

// Full browser-stub sandbox (the smoke/sim path), verbatim from runtime-smoke-node.js.
function createBrowserSandbox() {
    const sandbox = {};
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.console = console;
    sandbox.setInterval = function () { return 0; };
    sandbox.clearInterval = function () {};
    sandbox.setTimeout = function () { return 0; };
    sandbox.navigator = { userAgent: "node-smoke" };
    sandbox.document = {
        getElementById: function () { return null; },
        createElement: function () { return { style: {} }; },
        body: { appendChild: function () {}, removeChild: function () {} },
        title: ""
    };
    sandbox.localStorage = {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
    };
    sandbox.Vue = {
        set: function (target, key, value) { target[key] = value; },
        delete: function (target, key) { delete target[key]; }
    };
    sandbox.confirm = function () { return true; };
    sandbox.prompt = function () { return null; };
    sandbox.alert = function () {};
    sandbox.doPopup = function () {};
    // Render-side functions referenced by the engine (canvas.js / Vue app are not loaded).
    sandbox.updateWidth = function () {};
    sandbox.resizeCanvas = function () {};
    sandbox.drawTree = function () {};
    return sandbox;
}

// ---------------------------------------------------------------------------
// File loading. Each harness historically had its own fail/warn strings and
// path resolution (relative-to-root vs filename-as-full-path); the options
// preserve those exactly so the rewired harnesses stay byte-identical.
// ---------------------------------------------------------------------------

// Run each file in relativePaths into context.
//   opts.optional    : when true, a missing file warns (via opts.onMissing) and is skipped
//                      instead of failing via opts.onFail.
//   opts.onFail(msg) : called for a missing required file or a load-time throw.
//   opts.onMissing(relative, full) : called for a missing optional file (warn + skip).
//   opts.filenameFull: when true, vm filename is the absolute path (lint path); otherwise
//                      the relative path string (smoke path). Default false.
//   opts.missingMessage(full): message for a missing required file passed to onFail.
//   opts.errorMessage(relative, err): message for a load throw passed to onFail.
function loadFilesInto(context, relativePaths, opts) {
    const options = opts || {};
    const onFail = options.onFail || function (msg) { throw new Error(msg); };
    relativePaths.forEach(function (relative) {
        const full = path.isAbsolute(relative) ? relative : path.join(projectRoot, relative);
        if (!fs.existsSync(full)) {
            if (options.optional) {
                if (options.onMissing) options.onMissing(relative, full);
                return;
            }
            onFail(options.missingMessage ? options.missingMessage(full) : ("missing file: " + full));
            return;
        }
        try {
            vm.runInContext(fs.readFileSync(full, "utf8"), context,
                { filename: options.filenameFull ? full : relative });
        } catch (loadError) {
            onFail(options.errorMessage
                ? options.errorMessage(relative, loadError)
                : ("loading " + relative + " threw: " + loadError.stack));
        }
    });
}

// Load the full engine into context, preserving the optional-BEFORE-engine
// load-order quirk exactly. onFail is the smoke harness's fail().
function loadEngine(context, onFail) {
    loadFilesInto(context, OPTIONAL_ENGINE_FILES, {
        optional: true,
        onFail: onFail,
        onMissing: function (relative) {
            console.warn("SMOKE NOTE: optional file not yet present (expected slice 5): " + relative);
        },
        errorMessage: function (relative, loadError) {
            return "loading optional " + relative + " threw: " + loadError.stack;
        }
    });
    loadFilesInto(context, ENGINE_FILES, {
        optional: false,
        onFail: onFail,
        missingMessage: function (full) { return "missing engine file: " + full; },
        errorMessage: function (relative, loadError) {
            return "loading " + relative + " threw: " + loadError.stack;
        }
    });
}

// ---------------------------------------------------------------------------
// Full engine boot: browser sandbox + engine load + the save.js load() mirror.
// Returns { sandbox, context, boot } where boot(expr) is the fail-on-throw
// vm.runInContext helper. The player/temp shims have already been run.
// ---------------------------------------------------------------------------
function bootEngine(opts) {
    const options = opts || {};
    const onFail = options.onFail || function (message) {
        console.error("NODE-BOOT ERROR: " + message);
        process.exit(1);
    };
    const sandbox = createBrowserSandbox();
    const context = vm.createContext(sandbox);
    loadEngine(context, onFail);

    function boot(expression) {
        try {
            return vm.runInContext(expression, context);
        } catch (runError) {
            onFail("evaluating `" + expression + "` threw: " + runError.stack);
        }
    }

    // Mirror save.js load(): back-reference pass, fresh player, temp build.
    boot("updateLayers()");
    boot("player = getStartPlayer()");
    boot("options = getStartOptions ? getStartOptions() : {}");
    boot("needCanvasUpdate = false");
    boot("setupTemp(); updateTemp(); updateTemp();");

    return { sandbox: sandbox, context: context, boot: boot };
}

module.exports = {
    projectRoot: projectRoot,
    DATA_FILES: DATA_FILES,
    OPTIONAL_DATA_FILES: OPTIONAL_DATA_FILES,
    SCANNED_BUILD_FILES: SCANNED_BUILD_FILES,
    ENGINE_FILES: ENGINE_FILES,
    OPTIONAL_ENGINE_FILES: OPTIONAL_ENGINE_FILES,
    createMinimalSandbox: createMinimalSandbox,
    createBrowserSandbox: createBrowserSandbox,
    loadFilesInto: loadFilesInto,
    loadEngine: loadEngine,
    bootEngine: bootEngine
};
