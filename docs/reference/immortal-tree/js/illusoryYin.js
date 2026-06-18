// Illusory Yin — first Step 2 layer. Contemplations from insights; never resets tree 1.

function yinGainMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("yin", 13)) mult = mult.times(1.2)
    if (hasUpgrade("yin", 21)) mult = mult.times(player.insights.add(1).pow(0.06))
    mult = mult.times(nirvanaFalloutMult())
    if (typeof nirvanaBlightMult === "function") mult = mult.times(nirvanaBlightMult("yin"))
    return mult
}

addLayer("yin", {
    name: "Illusory Yin",
    symbol: "Yin",
    color: "#9b7fd4",
    type: "normal",
    row: 20,
    branches: [],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "contemplations",
    baseResource: "insights held",
    baseAmount() {
        insightsEnsure()
        return player.insights
    },
    requires() {
        const runs = player.yin.points.toNumber()
        return Decimal.pow(10, 3 + runs * 0.9).div(Decimal.pow(1.5, runs))
    },
    exponent: 0.42,
    gainMult() { return yinGainMult() },
    gainExp() {
        return new Decimal(1.15).pow(player.yin.points).times(nirvanaFalloutMult().pow(0.15))
    },
    resetsNothing: true,
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("yin")) return false
        if (!player.stepTwoUnlocked) return false
        insightsEnsure()
        return tmp.yin.baseAmount.gte(tmp.yin.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("yin")
            if (sectMsg) return sectMsg
        }
        if (!player.stepTwoUnlocked) return "Break the Ascendant seal to open the Nirvana tree"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.yin.requires)} insights (have ${formatWhole(player.insights)})`
        if (!player.yin.unlocked) return "Condense your first contemplations"
        return "Condense contemplations"
    },
    resetDescription: "Gather shadow and gain ",
    layerShown() { return player && player.stepTwoUnlocked },
    onPrestige() {
        if (!player.yin.unlocked) {
            player.yin.unlocked = true
            if (typeof unlockJournal === "function") unlockJournal("illusoryYin")
        }
        insightsEnsure()
        const cost = tmp.yin.baseAmount.min(player.insights)
        player.insights = player.insights.sub(cost).max(0)
    },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("yin", ["milestones", "upgrades"])
        }
    },
    upgrades: {
        11: {
            title: "Veiled Perception Art",
            description: "Double insight gathering on the Nirvana tree.",
            cost: new Decimal(3),
            unlocked() { return player.yin.unlocked && hasMilestone("yin", 0) },
        },
        12: {
            title: "Contemplation Echo",
            description: "Insight gain scales with contemplations held.",
            cost: new Decimal(15),
            unlocked() { return hasUpgrade("yin", 11) },
            effect() { return player.yin.points.add(1).pow(0.1) },
            effectDisplay() { return format(upgradeEffect("yin", 12)) + "× insights" },
        },
        13: {
            title: "Yin Breathing Scripture",
            description: "×1.2 contemplation gain.",
            cost: new Decimal(80),
            unlocked() { return hasMilestone("yin", 2) },
        },
        21: {
            title: "Ascendant Memory Fragment",
            description: "Contemplation gain scales with insights held.",
            cost: new Decimal(200),
            unlocked() { return hasUpgrade("yin", 13) && player.asc && player.asc.best.gte(100) },
            effect() { return player.insights.add(1).pow(0.06) },
            effectDisplay() { return format(upgradeEffect("yin", 21)) + "× contemplations" },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("yin", 0, "1 contemplation"),
            done() { return player.yin.best.gte(1) },
            effectDescription: "×1.5 insight generation on tree 2. Corporeal Yang path opens.",
            onComplete() {
                if (player.yang) player.yang.unlocked = true
            },
        },
        1: {
            requirementDescription: realmReq("yin", 1, "25 contemplations"),
            done() { return player.yin.best.gte(25) },
            effectDescription: "+10% contemplation gain.",
        },
        2: {
            requirementDescription: realmReq("yin", 2, "500 contemplations"),
            done() { return player.yin.best.gte(500) },
            effectDescription: "+25% insight generation. +10% Nirvana fallout production.",
        },
        3: {
            requirementDescription: realmReq("yin", 3, "5,000 contemplations"),
            done() { return player.yin.best.gte(5000) },
            effectDescription: "+15% contemplation gain.",
        },
        4: {
            requirementDescription: realmReq("yin", 4, "50,000 contemplations — Yin Great Circle"),
            done() { return player.yin.best.gte(50000) },
            effectDescription: "Illusory Yin Great Circle. The Yang gate deepens.",
        },
    },
    tabFormat: [
        ["display-text", "<h2>Illusory Yin</h2>"],
        ["display-text", "<div class='realm-intro'>Step 2 begins in shadow. Spend <b>insights</b> (tree 2 currency) to condense <b>contemplations</b>. Prestige here never touches the first tree.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    hotkeys: [{
        key: "shift+i",
        description: "Shift+I: Condense contemplations (Yin)",
        onPress() { if (canReset(this.layer)) doReset(this.layer) },
    }],
    tooltip() { return "Illusory Yin — insights to contemplations" },
    tooltipLocked() { return "Open the Second Step from Ascendant Great Circle." },
})
