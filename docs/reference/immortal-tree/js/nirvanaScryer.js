// Nirvana Scryer — Step 2 realm. Produces World Qi from enlightenments.

addLayer("ns", {
    name: "Nirvana Scryer",
    symbol: "Ns",
    color: "#c8a0ff",
    type: "normal",
    row: 22,
    branches: ["yang"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "World Qi",
    baseResource: "enlightenments (best)",
    baseAmount() { return player.yang && player.yang.best ? player.yang.best : new Decimal(0) },
    requires() {
        const runs = player.ns.points.toNumber()
        return Decimal.pow(10, 5 + runs * 0.95).div(Decimal.pow(1.6, runs))
    },
    exponent: 0.38,
    gainMult() {
        let mult = new Decimal(1)
        mult = mult.times(nirvanaFalloutMult())
        if (hasMilestone("ns", 0)) mult = mult.times(1.35)
        if (hasMilestone("ns", 2)) mult = mult.times(1.2)
        if (hasMilestone("ns", 4)) mult = mult.times(1.25)
        if (hasUpgrade("ns", 11)) mult = mult.times(2)
        if (hasUpgrade("ns", 12)) mult = mult.times(player.yang.best.add(1).pow(0.06))
        if (typeof nirvanaBlightMult === "function") mult = mult.times(nirvanaBlightMult("ns"))
        return mult
    },
    gainExp() { return new Decimal(1.2).pow(player.ns.points.add(1).pow(0.08)) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("ns")) return false
        if (!player.ns.unlocked) return false
        return tmp.ns.baseAmount.gte(tmp.ns.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("ns")
            if (sectMsg) return sectMsg
        }
        if (!player.ns.unlocked) return "Complete the Scryer breakthrough on Corporeal Yang"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.ns.requires)} enlightenments (best)`
        return "Condense World Qi"
    },
    resetDescription: "Pierce the veil and gain ",
    layerShown() { return nirvanaScryerReached() },
    onPrestige() {
        if (!player.nc) return
        if (hasMilestone("ns", 4) && !player.nc.unlocked) player.nc.unlocked = true
    },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("yang", ["milestones", "upgrades"])
            layerDataReset("yin", ["milestones", "upgrades"])
        }
    },
    upgrades: {
        11: {
            title: "World Qi Condensation Art",
            description: "Double World Qi gain.",
            cost: new Decimal(3),
            unlocked() { return hasMilestone("ns", 0) },
        },
        12: {
            title: "Yang Mirror Scripture",
            description: "World Qi scales with Yang depth.",
            cost: new Decimal(25),
            unlocked() { return hasUpgrade("ns", 11) },
            effect() { return player.yang.best.add(1).pow(0.06) },
            effectDisplay() { return format(upgradeEffect("ns", 12)) + "× World Qi" },
        },
        13: {
            title: "Second Step Recognition Seal",
            description: "×1.25 World Qi and +15% all Step 2 layer gains.",
            cost: new Decimal(120),
            unlocked() { return hasMilestone("ns", 2) },
        },
        21: {
            title: "Scryer Veil Breathing",
            description: "World Qi strengthens insight gathering.",
            cost: new Decimal(200),
            unlocked() { return hasMilestone("ns", 3) },
            effect() { return player.ns.points.add(1).pow(0.1) },
            effectDisplay() { return format(upgradeEffect("ns", 21)) + "× insights" },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("ns", 0, "1 World Qi"),
            done() { return player.ns.best.gte(1) },
            effectDescription: "Second Step recognized. ×1.35 World Qi, +25% insight generation on tree 2.",
            onComplete() {
                if (typeof unlockJournal === "function") {
                    unlockJournal("nirvanaScryerRealm")
                    unlockJournal("stepTwoReached")
                }
            },
        },
        1: {
            requirementDescription: realmReq("ns", 1, "10 World Qi"),
            done() { return player.ns.best.gte(10) },
            effectDescription: "+15% World Qi. Nirvana Cleanser gate stirs.",
        },
        2: {
            requirementDescription: realmReq("ns", 2, "50 World Qi"),
            done() { return player.ns.best.gte(50) },
            effectDescription: "+20% World Qi and +10% Yin/Yang gains.",
        },
        3: {
            requirementDescription: realmReq("ns", 3, "200 World Qi"),
            done() { return player.ns.best.gte(200) },
            effectDescription: "+15% all Nirvana tree gains.",
        },
        4: {
            requirementDescription: realmReq("ns", 4, "1,000 World Qi — Scryer Great Circle"),
            done() { return player.ns.best.gte(1000) },
            effectDescription: "Scryer Great Circle. Unlocks Nirvana Cleanser.",
            onComplete() {
                if (player.nc) player.nc.unlocked = true
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Nirvana Scryer</h2>"],
        ["display-text", "<div class='realm-intro'>A full Step 2 realm: condense <b>World Qi</b> from enlightenments. Milestones here are your <b>Second Step</b> bonuses — Cleanser opens at Great Circle.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    hotkeys: [{ key: "shift+o", description: "Shift+O: Condense World Qi (Scryer)", onPress() { if (canReset(this.layer)) doReset(this.layer) } }],
    tooltip() { return "Nirvana Scryer — World Qi" },
    tooltipLocked() { return "Succeed on the second Scryer breakthrough trial." },
})
