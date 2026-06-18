// Nirvana Shatterer — Nirvana Qi and the Five Heavenly Blights (+ combined trial).

addLayer("nsh", {
    name: "Nirvana Shatterer",
    symbol: "Sh",
    color: "#ff8a6b",
    type: "normal",
    row: 25,
    branches: ["dsn", "cel", "isl"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
        challengeSnapshot: null,
    }},
    resource: "Nirvana Qi",
    baseResource: "triad progress (sum)",
    baseAmount() {
        let sum = new Decimal(0)
        for (const lr of NIRVANA_TRIAD_LAYERS) {
            if (player[lr]) sum = sum.plus(player[lr].best || 0)
        }
        return sum
    },
    requires() {
        const runs = player.nsh.points.toNumber()
        return Decimal.pow(10, 6 + runs * 1.1).div(Decimal.pow(1.7, runs))
    },
    exponent: 0.34,
    gainMult() {
        let mult = new Decimal(1)
        if (hasMilestone("nsh", 0)) mult = mult.times(1.3)
        if (hasMilestone("nsh", 2)) mult = mult.times(1.25)
        if (hasUpgrade("nsh", 11)) mult = mult.times(2)
        return mult.times(nirvanaFalloutMult())
    },
    gainExp() { return new Decimal(1.25) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("nsh")) return false
        if (!player.nsh.unlocked) return false
        if (player.nsh.activeChallenge) return false
        return tmp.nsh.baseAmount.gte(tmp.nsh.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("nsh")
            if (sectMsg) return sectMsg
        }
        if (!player.nsh.unlocked) return "Perfect all three refinements (20 each)"
        if (player.nsh.activeChallenge) return "Finish the active Heavenly Blight trial first"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.nsh.requires)} combined triad progress`
        return "Condense Nirvana Qi"
    },
    resetDescription: "Shatter the old cycle and gain ",
    layerShown() { return typeof nirvanaShattererUnlocked === "function" ? nirvanaShattererUnlocked() : player.nsh.unlocked },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            for (const lr of NIRVANA_TRIAD_LAYERS) layerDataReset(lr, ["milestones", "upgrades"])
            layerDataReset("nc", ["milestones", "upgrades"])
            layerDataReset("ns", ["milestones", "upgrades"])
        }
    },
    challenges: {
        1: {
            name: "Life Slip Blight",
            challengeDescription: "Vitality drains away — scattered qi and liquid qi gains are cut.",
            goalDescription: "Under the blight, reach 30 dantian qi and 80 scattered qi.",
            unlocked() { return player.nsh.unlocked },
            canComplete() { return player.q.best.gte(30) && player.points.gte(80) },
            rewardDescription: "+15% Nirvana Qi gain.",
            style: { "border-color": "#6ee7a8" },
        },
        2: {
            name: "Death Blight",
            challengeDescription: "The death blight weighs on Foundation — liquid qi condenses slowly.",
            goalDescription: "Reach 40 liquid qi while the blight lingers.",
            unlocked() { return maxedChallenge("nsh", 1) },
            canComplete() { return player.f.best.gte(40) },
            rewardDescription: "+12% Nirvana Qi and +10% Yin gain.",
            style: { "border-color": "#9bd47b" },
        },
        3: {
            name: "Karma Blight",
            challengeDescription: "Karmic threads tangle Step 2 — contemplations and enlightenments are halved.",
            goalDescription: "Reach 500 best contemplations and 50 enlightenments.",
            unlocked() { return maxedChallenge("nsh", 2) },
            canComplete() { return player.yin.best.gte(500) && player.yang.best.gte(50) },
            rewardDescription: "+15% Nirvana Qi and +12% Yang gain.",
            style: { "border-color": "#e8c468" },
        },
        4: {
            name: "True Devil Blight",
            challengeDescription: "Devil intent assaults the triad — World and Celestial Qi progress is strained.",
            goalDescription: "Hold 100 World Qi and 25 Celestial Qi (best).",
            unlocked() { return maxedChallenge("nsh", 3) },
            canComplete() { return player.ns.best.gte(100) && player.nc.best.gte(25) },
            rewardDescription: "+18% Nirvana Qi gain.",
            style: { "border-color": "#c8a0ff" },
        },
        5: {
            name: "Fate Blight",
            challengeDescription: "Fate itself resists — triad refinements advance at half speed.",
            goalDescription: "Reach 12 Perception, 12 Body Refinements, and 12 Soul Fragments.",
            unlocked() { return maxedChallenge("nsh", 4) },
            canComplete() {
                return player.dsn.best.gte(12) && player.cel.best.gte(12) && player.isl.best.gte(12)
            },
            rewardDescription: "Unlocks the combined blight trial.",
            style: { "border-color": "#ff8a6b" },
        },
        6: {
            name: "Five Heavenly Blights Together",
            challengeDescription: "All five blights descend at once. Only a prepared cultivator endures.",
            goalDescription: "Complete the combined trial — reach 15 on each triad path in the trial run.",
            unlocked() { return nshAllBlightChallengesMaxed() },
            canEnter() { return nshAllBlightChallengesMaxed() },
            canComplete() {
                return player.dsn.best.gte(15) && player.cel.best.gte(15) && player.isl.best.gte(15)
            },
            rewardDescription: "Choose <b>Essences</b> (true Third Step) or <b>Joss Flames</b> (easier, weaker void path).",
            onComplete() {
                if (typeof unlockJournal === "function") unlockJournal("fiveBlights")
            },
            style: { "border-color": "#ff4444" },
        },
    },
    upgrades: {
        11: {
            title: "Shatter Scripture",
            description: "Double Nirvana Qi gain.",
            cost: new Decimal(3),
            unlocked() { return hasMilestone("nsh", 0) },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("nsh", 0, "1 Nirvana Qi"),
            done() { return player.nsh.best.gte(1) },
            effectDescription: "Shatterer path open. Heavenly Blight trials unlock.",
        },
        1: {
            requirementDescription: realmReq("nsh", 1, "25 Nirvana Qi"),
            done() { return player.nsh.best.gte(25) },
            effectDescription: "+15% Nirvana Qi gain.",
        },
        2: {
            requirementDescription: realmReq("nsh", 2, "500 Nirvana Qi"),
            done() { return player.nsh.best.gte(500) },
            effectDescription: "+20% Nirvana Qi. Blight trials resist you less.",
        },
    },
    clickables: {
        81: {
            title: "Walk the Essences path",
            display() {
                if (player.nirvanaPath === "essences") return "Essences path — true Third Step"
                if (!canChooseNirvanaPath()) return "Complete the Five Blights trial to choose a path"
                return "Commit to Essences (harder, full Third Step power)"
            },
            canClick() { return canChooseNirvanaPath() },
            onClick() { chooseNirvanaPath("essences") },
            style() {
                return canChooseNirvanaPath() ? { "border-color": "#b8a0ff" } : { "border-color": "#555" }
            },
        },
        82: {
            title: "Walk the Joss Flames path",
            display() {
                if (player.nirvanaPath === "joss") return "Joss Flames path — void Essences weakened"
                if (!canChooseNirvanaPath()) return "Complete the Five Blights trial to choose a path"
                return "Commit to Joss Flames (easier boosts, −10% Third Step Essences)"
            },
            canClick() { return canChooseNirvanaPath() },
            onClick() { chooseNirvanaPath("joss") },
            style() {
                return canChooseNirvanaPath() ? { "border-color": "#ff6b6b" } : { "border-color": "#555" }
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Nirvana Shatterer</h2>"],
        ["display-text", "<div class='realm-intro'>Condense <b>Nirvana Qi</b>, then survive the <b>Five Heavenly Blights</b>. Trials save your progress, reset you for the run, and restore when you finish or exit — like sect events.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        ["challenges", [1, 2, 3, 4, 5, 6]],
        ["blank", "8px"],
        "clickables",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    tooltip() { return "Nirvana Shatterer — blights and Nirvana Qi" },
    tooltipLocked() { return "Cap all three refinements at 20." },
})
