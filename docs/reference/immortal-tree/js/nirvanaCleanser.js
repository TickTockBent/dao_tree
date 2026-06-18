// Nirvana Cleanser — refines World Qi into Celestial Qi.

addLayer("nc", {
    name: "Nirvana Cleanser",
    symbol: "Nc",
    color: "#a8d4ff",
    type: "normal",
    row: 23,
    branches: ["ns"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "Celestial Qi",
    baseResource: "World Qi (best)",
    baseAmount() { return player.ns && player.ns.best ? player.ns.best : new Decimal(0) },
    requires() {
        const runs = player.nc.points.toNumber()
        return Decimal.pow(10, 5.5 + runs * 1.0).div(Decimal.pow(1.65, runs))
    },
    exponent: 0.36,
    gainMult() {
        let mult = new Decimal(1)
        mult = mult.times(nirvanaFalloutMult())
        if (hasMilestone("nc", 0)) mult = mult.times(1.3)
        if (hasMilestone("nc", 2)) mult = mult.times(1.2)
        if (hasUpgrade("nc", 11)) mult = mult.times(2)
        if (hasUpgrade("nc", 12)) mult = mult.times(player.ns.best.add(1).pow(0.05))
        if (typeof nirvanaBlightMult === "function") mult = mult.times(nirvanaBlightMult("nc"))
        return mult
    },
    gainExp() { return new Decimal(1.15).pow(player.nc.points.add(1).pow(0.07)) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("nc")) return false
        if (!player.nc.unlocked) return false
        return tmp.nc.baseAmount.gte(tmp.nc.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("nc")
            if (sectMsg) return sectMsg
        }
        if (!player.nc.unlocked) return "Reach Nirvana Scryer Great Circle first"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.nc.requires)} World Qi (best)`
        return "Refine Celestial Qi"
    },
    resetDescription: "Wash away impurity and gain ",
    layerShown() { return typeof nirvanaCleanserUnlocked === "function" ? nirvanaCleanserUnlocked() : player.nc.unlocked },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("ns", ["milestones", "upgrades"])
            layerDataReset("yang", ["milestones", "upgrades"])
            layerDataReset("yin", ["milestones", "upgrades"])
        }
    },
    upgrades: {
        11: {
            title: "Celestial Wash Cauldron",
            description: "Double Celestial Qi refinement.",
            cost: new Decimal(5),
            unlocked() { return hasMilestone("nc", 0) },
        },
        12: {
            title: "World Qi Memory",
            description: "Celestial Qi scales with Scryer depth.",
            cost: new Decimal(40),
            unlocked() { return hasUpgrade("nc", 11) },
            effect() { return player.ns.best.add(1).pow(0.05) },
            effectDisplay() { return format(upgradeEffect("nc", 12)) + "× Celestial Qi" },
        },
        13: {
            title: "Cleanser Scripture",
            description: "×1.2 Celestial Qi; opens the triad refinement gates.",
            cost: new Decimal(150),
            unlocked() { return hasMilestone("nc", 1) },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("nc", 0, "1 Celestial Qi"),
            done() { return player.nc.best.gte(1) },
            effectDescription: "Cleanser path active. Divine Sense, Celestial Body, and Immortal Soul unlock.",
            onComplete() {
                for (const lr of NIRVANA_TRIAD_LAYERS) {
                    if (player[lr]) player[lr].unlocked = true
                }
                if (typeof unlockJournal === "function") unlockJournal("nirvanaCleanser")
            },
        },
        1: {
            requirementDescription: realmReq("nc", 1, "25 Celestial Qi"),
            done() { return player.nc.best.gte(25) },
            effectDescription: "+12% Celestial Qi and +10% triad path gain.",
        },
        2: {
            requirementDescription: realmReq("nc", 2, "250 Celestial Qi"),
            done() { return player.nc.best.gte(250) },
            effectDescription: "+20% Celestial Qi. All three refinements walk together.",
        },
        3: {
            requirementDescription: realmReq("nc", 3, "2,500 Celestial Qi — Cleanser Great Circle"),
            done() { return player.nc.best.gte(2500) },
            effectDescription: "Cleanser Great Circle. +15% all Step 2 gains.",
        },
    },
    tabFormat: [
        ["display-text", "<h2>Nirvana Cleanser</h2>"],
        ["display-text", "<div class='realm-intro'>Refine <b>Celestial Qi</b> from World Qi. When the Cleanser path is open, walk the three refinements below — each is slow (cap 20) and resets the Step 2 stack beneath it, not its siblings.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    tooltip() { return "Nirvana Cleanser — Celestial Qi" },
    tooltipLocked() { return "Complete Nirvana Scryer Great Circle." },
})
