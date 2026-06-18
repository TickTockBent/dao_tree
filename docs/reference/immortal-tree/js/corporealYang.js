// Corporeal Yang — second Step 2 layer. Enlightenments from contemplations; prestige resets Yin only.

function yangGainMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("yang", 11)) mult = mult.times(2)
    if (hasUpgrade("yang", 12)) mult = mult.times(player.yin.best.add(1).pow(0.08))
    if (hasMilestone("yang", 2)) mult = mult.times(1.2)
    mult = mult.times(nirvanaFalloutMult())
    if (typeof nirvanaBlightMult === "function") mult = mult.times(nirvanaBlightMult("yang"))
    return mult
}

function canAttemptScryerBreakthrough() {
    if (!player.yang || !player.yang.unlocked) return false
    return hasMilestone("yang", 4) && player.yang.best.gte(10000)
}

function scryerBreakthroughButtonText() {
    if (nirvanaScryerReached()) return "Nirvana Scryer — Step 2 entered"
    if (!canAttemptScryerBreakthrough()) return "Walk Yang Great Circle to attempt Scryer breakthrough"
    if (!canReset("yang")) return `Need ${formatWhole(tmp.yang.requires)} contemplations for enlightenments first`
    insightsEnsure()
    if (player.scryerAttempts >= 1) return "Break through to Nirvana Scryer (second trial)"
    return "Attempt Nirvana Scryer breakthrough (first trial)"
}

addLayer("yang", {
    name: "Corporeal Yang",
    symbol: "Yang",
    color: "#e8c468",
    type: "normal",
    row: 21,
    branches: ["yin"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "enlightenments",
    baseResource: "contemplations (best)",
    baseAmount() { return player.yin && player.yin.best ? player.yin.best : new Decimal(0) },
    requires() {
        const runs = player.yang.points.toNumber()
        return Decimal.pow(10, 4 + runs * 1.0).div(Decimal.pow(1.55, runs))
    },
    exponent: 0.4,
    gainMult() { return yangGainMult() },
    gainExp() {
        const fallout = nirvanaFalloutActive() ? new Decimal(1.4) : new Decimal(1)
        return fallout.times(player.yang.points.add(1).pow(0.12).add(1))
    },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("yang")) return false
        if (!player.yang.unlocked) return false
        return tmp.yang.baseAmount.gte(tmp.yang.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("yang")
            if (sectMsg) return sectMsg
        }
        if (!player.yang.unlocked) return "Complete Illusory Yin Great Circle first"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.yang.requires)} best contemplations`
        return "Condense enlightenments"
    },
    resetDescription: "Temper the self and gain ",
    layerShown() { return player.yang && player.yang.unlocked },
    onPrestige() {
        if (!player.yang.unlocked) player.yang.unlocked = true
        if (typeof unlockJournal === "function") unlockJournal("corporealYang")
    },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("yin", ["milestones", "upgrades"])
        }
    },
    upgrades: {
        11: {
            title: "Sunlit Refinement Art",
            description: "Double enlightenment gain.",
            cost: new Decimal(5),
            unlocked() { return player.yang.unlocked && hasMilestone("yang", 0) },
        },
        12: {
            title: "Contemplation Furnace",
            description: "Enlightenment gain scales with Yin depth.",
            cost: new Decimal(40),
            unlocked() { return hasUpgrade("yang", 11) },
            effect() { return player.yin.best.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("yang", 12)) + "× enlightenments" },
        },
        13: {
            title: "Corporeal Vessel Scripture",
            description: "×1.25 enlightenment gain.",
            cost: new Decimal(250),
            unlocked() { return hasMilestone("yang", 2) },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("yang", 0, "1 enlightenment"),
            done() { return player.yang.best.gte(1) },
            effectDescription: "Yang path active. Scryer trial unlocks at Great Circle.",
        },
        1: {
            requirementDescription: realmReq("yang", 1, "50 enlightenments"),
            done() { return player.yang.best.gte(50) },
            effectDescription: "+12% enlightenment gain.",
        },
        2: {
            requirementDescription: realmReq("yang", 2, "1,000 enlightenments"),
            done() { return player.yang.best.gte(1000) },
            effectDescription: "+20% enlightenment gain. +12% fallout production.",
            onComplete() {
                insightsEnsure()
                if (player.nirvanaFallout >= 1) player.nirvanaFallout = Math.max(player.nirvanaFallout, 2)
            },
        },
        3: {
            requirementDescription: realmReq("yang", 3, "10,000 enlightenments"),
            done() { return player.yang.best.gte(10000) },
            effectDescription: "+15% enlightenment gain.",
        },
        4: {
            requirementDescription: realmReq("yang", 4, "100,000 enlightenments — Yang Great Circle"),
            done() { return player.yang.best.gte(100000) },
            effectDescription: "Corporeal Yang Great Circle. The Scryer seal may be challenged.",
        },
    },
    clickables: {
        91: {
            title: "Nirvana Scryer breakthrough",
            display() { return scryerBreakthroughButtonText() },
            canClick() {
                return canAttemptScryerBreakthrough() && !nirvanaScryerReached()
            },
            onClick() {
                if (!canAttemptScryerBreakthrough() || nirvanaScryerReached()) return
                insightsEnsure()
                if (player.scryerAttempts < 1) {
                    scryerFallResetTree1()
                    return
                }
                player.ns.unlocked = true
                if (typeof unlockJournal === "function") {
                    unlockJournal("nirvanaScryer")
                    unlockJournal("nirvanaFallSuccess")
                }
                updateTemp()
            },
            style() {
                return canAttemptScryerBreakthrough() && !nirvanaScryerReached()
                    ? { "background-color": "#4a3a20", "border-color": "#e8c468" }
                    : { "background-color": "#222", "border-color": "#555" }
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Corporeal Yang</h2>"],
        ["display-text", "<div class='realm-intro'>Turn contemplations into <b>enlightenments</b>. Prestige here resets <b>Illusory Yin</b> only — never tree 1. The Scryer trial ends the bridge between steps.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "8px"],
        "clickables",
        ["blank", "12px"],
        "milestones",
    ],
    hotkeys: [{
        key: "shift+h",
        description: "Shift+H: Condense enlightenments (Yang)",
        onPress() { if (canReset(this.layer)) doReset(this.layer) },
    }],
    tooltip() { return "Corporeal Yang — contemplations to enlightenments" },
    tooltipLocked() { return "Reach Illusory Yin Great Circle." },
})
