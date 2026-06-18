// Third Step — Essences vs Joss Flames, then Nirvana Void (Void Qi).

function jossFlamesLowerMult() {
    if (player.nirvanaPath !== "joss") return new Decimal(1)
    let mult = new Decimal(1.35)
    if (hasMilestone("jfl", 2)) mult = mult.times(1.2)
    if (hasUpgrade("jfl", 11)) mult = mult.times(1.25)
    return mult
}

addLayer("ess", {
    name: "Essences",
    symbol: "Es",
    color: "#b8a0ff",
    type: "normal",
    row: 26,
    branches: ["nsh"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "Minor Essences",
    baseResource: "Nirvana Qi (best)",
    baseAmount() { return player.nsh && player.nsh.best ? player.nsh.best : new Decimal(0) },
    requires() {
        const runs = player.ess.points.toNumber()
        return Decimal.pow(10, 6.5 + runs * 1.05).div(Decimal.pow(1.68, runs))
    },
    exponent: 0.33,
    gainMult() {
        let mult = new Decimal(1)
        if (hasMilestone("ess", 0)) mult = mult.times(1.25)
        if (hasUpgrade("ess", 11)) mult = mult.times(2)
        if (hasUpgrade("ess", 12)) mult = mult.times(player.nsh.best.add(1).pow(0.04))
        return mult
    },
    gainExp() { return new Decimal(1.2) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("ess")) return false
        if (!player.ess.unlocked || player.nirvanaPath !== "essences") return false
        return tmp.ess.baseAmount.gte(tmp.ess.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("ess")
            if (sectMsg) return sectMsg
        }
        if (player.nirvanaPath !== "essences") return "Walk the Essences path from Shatterer"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.ess.requires)} Nirvana Qi (best)`
        return "Condense Minor Essences"
    },
    resetDescription: "Distill truth and gain ",
    layerShown() { return player.nirvanaPath === "essences" },
    onPrestige() {
        if (hasMilestone("ess", 3) && player.nv && !player.nv.unlocked) {
            player.stepThreeUnlocked = true
            player.nv.unlocked = true
            if (typeof unlockJournal === "function") unlockJournal("nirvanaVoid")
        }
    },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) layerDataReset("nsh", ["milestones", "upgrades"])
    },
    upgrades: {
        11: {
            title: "Minor Essence Cauldron",
            description: "Double Minor Essence gain.",
            cost: new Decimal(2),
            unlocked() { return hasMilestone("ess", 0) },
        },
        12: {
            title: "Nirvana Qi Echo",
            description: "Minor Essences scale with Nirvana Qi depth.",
            cost: new Decimal(20),
            unlocked() { return hasUpgrade("ess", 11) },
            effect() { return player.nsh.best.add(1).pow(0.04) },
            effectDisplay() { return format(upgradeEffect("ess", 12)) + "×" },
        },
        21: {
            title: "Third Step Seed",
            description: "Minor Essences feed future Void Qi (+15% Essence production).",
            cost: new Decimal(80),
            unlocked() { return hasMilestone("ess", 2) },
            effect() { return player.ess.points.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("ess", 21)) + "× Minor Essences" },
        },
    },
    milestones: {
        0: {
            requirementDescription: "1 Minor Essence",
            done() { return player.ess.best.gte(1) },
            effectDescription: "+20% Minor Essence, Nirvana Qi, and Third Step Essence production.",
        },
        1: {
            requirementDescription: "50 Minor Essences",
            done() { return player.ess.best.gte(50) },
            effectDescription: "+15% Minor Essence gain.",
        },
        2: {
            requirementDescription: "500 Minor Essences",
            done() { return player.ess.best.gte(500) },
            effectDescription: "+25% Nirvana Qi gain.",
        },
        3: {
            requirementDescription: "5,000 Minor Essences — Essence Great Circle",
            done() { return player.ess.best.gte(5000) },
            effectDescription: "Opens the Third Step — Nirvana Void Realm.",
            onComplete() {
                player.stepThreeUnlocked = true
                if (player.nv) player.nv.unlocked = true
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Essences</h2>"],
        ["display-text", "<div class='realm-intro'>The <b>true</b> road to the Third Step. Minor Essences power themselves, Nirvana Qi, and the <b>Essences</b> that Void Qi will draw from — at full strength.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    tooltip() { return "Essences — true Third Step path" },
    tooltipLocked() { return "Complete the Five Blights and choose Essences." },
})

addLayer("jfl", {
    name: "Joss Flames",
    symbol: "Jf",
    color: "#ff6b6b",
    type: "normal",
    row: 26,
    branches: ["nsh"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "Joss Flames",
    baseResource: "Nirvana Qi (best)",
    baseAmount() { return player.nsh && player.nsh.best ? player.nsh.best : new Decimal(0) },
    requires() {
        const runs = player.jfl.points.toNumber()
        return Decimal.pow(10, 5.8 + runs * 0.9).div(Decimal.pow(1.55, runs))
    },
    exponent: 0.4,
    gainMult() {
        let mult = new Decimal(1)
        if (hasMilestone("jfl", 0)) mult = mult.times(1.5)
        if (hasUpgrade("jfl", 11)) mult = mult.times(2.5)
        return mult
    },
    gainExp() { return new Decimal(1.35) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("jfl")) return false
        if (!player.jfl.unlocked || player.nirvanaPath !== "joss") return false
        return tmp.jfl.baseAmount.gte(tmp.jfl.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("jfl")
            if (sectMsg) return sectMsg
        }
        if (player.nirvanaPath !== "joss") return "Walk the Joss Flames path from Shatterer"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.jfl.requires)} Nirvana Qi (best)`
        return "Kindle Joss Flames"
    },
    resetDescription: "Burn the easy road and gain ",
    layerShown() { return player.nirvanaPath === "joss" },
    onPrestige() {
        if (hasMilestone("jfl", 2) && player.nv && !player.nv.unlocked) {
            player.stepThreeUnlocked = true
            player.nv.unlocked = true
            if (typeof unlockJournal === "function") unlockJournal("nirvanaVoidJoss")
        }
    },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) layerDataReset("nsh", ["milestones", "upgrades"])
    },
    upgrades: {
        11: {
            title: "Offering Flame Array",
            description: "×2.5 Joss Flame gain and ×1.25 all prior cultivation realms.",
            cost: new Decimal(1),
            unlocked() { return hasMilestone("jfl", 0) },
        },
        12: {
            title: "False Shortcut Scripture",
            description: "Joss Flames boost themselves and Nirvana Qi — Third Step Essences will suffer.",
            cost: new Decimal(15),
            unlocked() { return hasUpgrade("jfl", 11) },
            effect() { return player.jfl.points.add(1).pow(0.2) },
            effectDisplay() { return format(upgradeEffect("jfl", 12)) + "× Joss Flames" },
        },
    },
    milestones: {
        0: {
            requirementDescription: "1 Joss Flame",
            done() { return player.jfl.best.gte(1) },
            effectDescription: "×1.35 all prior cultivation + ×1.5 Joss Flames. Third Step Essences generate at 90%.",
        },
        1: {
            requirementDescription: "30 Joss Flames",
            done() { return player.jfl.best.gte(30) },
            effectDescription: "+20% Joss Flame gain.",
        },
        2: {
            requirementDescription: "300 Joss Flames — Flame Great Circle",
            done() { return player.jfl.best.gte(300) },
            effectDescription: "Opens Third Step early — Void Qi weakened by the offering.",
            onComplete() {
                player.stepThreeUnlocked = true
                if (player.nv) player.nv.unlocked = true
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Joss Flames</h2>"],
        ["display-text", "<div class='realm-intro'>The <b>trap</b> path: strong boosts to everything behind you, but Third Step <b>Essences</b> (Void Qi base) are only 90% as potent.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    tooltip() { return "Joss Flames — easy path, weaker void" },
    tooltipLocked() { return "Complete the Five Blights and choose Joss Flames." },
})

addLayer("nv", {
    name: "Nirvana Void Realm",
    symbol: "Nv",
    color: "#4a6fa5",
    type: "normal",
    row: 27,
    branches: ["ess", "jfl"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    resource: "Void Qi",
    baseResource: "path power (best)",
    baseAmount() {
        if (player.nirvanaPath === "essences" && player.ess) return player.ess.best
        if (player.nirvanaPath === "joss" && player.jfl) return player.jfl.best
        return new Decimal(0)
    },
    requires() {
        const runs = player.nv.points.toNumber()
        return Decimal.pow(10, 7 + runs * 1.15).div(Decimal.pow(1.75, runs))
    },
    exponent: 0.32,
    gainMult() {
        let mult = stepThreeEssenceMult()
        if (hasMilestone("nv", 0)) mult = mult.times(1.3)
        if (hasUpgrade("nv", 11)) mult = mult.times(2)
        if (player.nirvanaPath === "essences" && hasUpgrade("ess", 21)) {
            mult = mult.times(upgradeEffect("ess", 21))
        }
        return mult
    },
    gainExp() { return new Decimal(1.15) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("nv")) return false
        if (!stepThreeUnlocked() || !player.nv.unlocked) return false
        return tmp.nv.baseAmount.gte(tmp.nv.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("nv")
            if (sectMsg) return sectMsg
        }
        if (!stepThreeUnlocked()) return "Complete your Shatterer path first"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.nv.requires)} ${tmp.nv.baseResource}`
        return "Condense Void Qi"
    },
    resetDescription: "Step into the void and gain ",
    layerShown() { return stepThreeUnlocked() },
    doReset(resettingLayer) {
        if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
        if (layers[resettingLayer].row > this.row) {
            if (player.nirvanaPath === "essences") layerDataReset("ess", ["milestones", "upgrades"])
            if (player.nirvanaPath === "joss") layerDataReset("jfl", ["milestones", "upgrades"])
            layerDataReset("nsh", ["milestones", "upgrades"])
        }
    },
    upgrades: {
        11: {
            title: "Void Breathing Art",
            description: "Double Void Qi gain.",
            cost: new Decimal(2),
            unlocked() { return hasMilestone("nv", 0) },
        },
    },
    milestones: {
        0: {
            requirementDescription: "1 Void Qi",
            done() { return player.nv.best.gte(1) },
            effectDescription: "Third Step begun — the void tree opens (more realms planned).",
            onComplete() {
                if (typeof unlockJournal === "function") unlockJournal("stepThreeReached")
            },
        },
        1: {
            requirementDescription: "100 Void Qi",
            done() { return player.nv.best.gte(100) },
            effectDescription: "+15% Void Qi gain.",
        },
    },
    tabFormat: [
        ["display-text", "<h2>Nirvana Void Realm</h2>"],
        ["display-text", function() {
            const pen = player.nirvanaPath === "joss" ? " <i>Joss Flames burden: Essence-line production ×0.9.</i>" : ""
            return `<div class='realm-intro'>Third Step base layer — <b>Void Qi</b> from your chosen path.${pen}</div>`
        }],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        "milestones",
    ],
    tooltip() { return "Nirvana Void — Third Step" },
    tooltipLocked() { return "Finish Essences or Joss Flames Great Circle." },
})
