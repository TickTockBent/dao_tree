// Soul Formation — nascent divinity producers + mortal life chain. Unlocks Soul Transformation at capstone.

const SF_DIVINITY_IDS = [11, 12, 13, 14, 15, 16]
const SF_LIFE_IDS = [21, 22, 23, 24, 25, 26]

const SF_DIVINITY_NAMES = [
    "Soul Seed",
    "Soul Platform",
    "Soul Canopy",
    "Soul Anchor",
    "Soul Manifestation",
    "Soul Throne",
]

const SF_LIFE_NAMES = [
    "Mortal Life",
    "Second Life",
    "Third Life",
    "Fourth Life",
    "Fifth Life",
    "Sixth Life",
]

const SF_FINAL_MILESTONE = 6
const SF_SECOND_PROFESSION_MS = 3

function soulFormationReached() {
    return player && player.sf && player.sf.best.gte(1)
}

function soulTransformationReady() {
    return hasMilestone("sf", SF_FINAL_MILESTONE)
}

function sfTierBase(tier) {
    return Decimal.pow(2, tier)
}

function sfDivinityMult() {
    let mult = new Decimal(1)
    if (hasMilestone("sf", 1)) mult = mult.times(1.25)
    if (hasMilestone("sf", 4)) mult = mult.times(1.35)
    if (hasMilestone("sf", 5)) mult = mult.times(1.5)
    if (hasUpgrade("sf", 11)) mult = mult.times(2)
    if (hasUpgrade("sf", 12)) mult = mult.times(1.35)
    if (hasUpgrade("sf", 13)) mult = mult.times(1.25)
    if (hasUpgrade("sf", 14)) mult = mult.times(upgradeEffect("sf", 14))
    if (hasUpgrade("st", 42)) mult = mult.times(1.15)
    if (typeof techniqueMult === "function") mult = mult.times(techniqueMult("sf"))
    return mult
}

function sfInsightMult() {
    let mult = new Decimal(1)
    if (hasMilestone("sf", 2)) mult = mult.times(1.3)
    if (hasMilestone("sf", 4)) mult = mult.times(1.25)
    if (hasMilestone("sf", 5)) mult = mult.times(1.4)
    if (typeof eventChallengeMult === "function") mult = mult.times(eventChallengeMult("sf_insights"))
    return mult
}

function sfDivinityTierRates() {
    const rates = []
    const mult = sfDivinityMult()
    for (let i = 0; i < 6; i++) {
        rates.push(getBuyableAmount("sf", SF_DIVINITY_IDS[i]).times(sfTierBase(i)).times(mult))
    }
    return rates
}

function sfLifeTierRates() {
    const rates = []
    const mult = sfInsightMult()
    for (let i = 0; i < 6; i++) {
        rates.push(getBuyableAmount("sf", SF_LIFE_IDS[i]).times(sfTierBase(i)).times(mult))
    }
    return rates
}

function sfTickProduction(diff) {
    if (!player || !player.sf || !player.sf.unlocked) return
    const d = new Decimal(diff)
    if (player.sf.mortalInsights === undefined) player.sf.mortalInsights = new Decimal(0)
    if (player.sf.bestInsights === undefined) player.sf.bestInsights = new Decimal(0)

    const divRates = sfDivinityTierRates()
    let divGain = new Decimal(0)
    for (let i = 0; i < 6; i++) {
        const flow = divRates[i].times(d)
        if (i === 0) divGain = divGain.add(flow)
        else addBuyables("sf", SF_DIVINITY_IDS[i - 1], flow)
    }
    player.sf.points = player.sf.points.add(divGain)
    player.sf.best = player.sf.best.max(player.sf.points)
    player.sf.total = player.sf.total.add(divGain)

    const lifeRates = sfLifeTierRates()
    let insightGain = new Decimal(0)
    for (let i = 0; i < 6; i++) {
        const flow = lifeRates[i].times(d)
        if (i === 0) insightGain = insightGain.add(flow)
        else addBuyables("sf", SF_LIFE_IDS[i - 1], flow)
    }
    player.sf.mortalInsights = player.sf.mortalInsights.add(insightGain)
    player.sf.bestInsights = player.sf.bestInsights.max(player.sf.mortalInsights)
}

function sfDivinityStatusHTML() {
    if (!player.sf || !player.sf.unlocked) return ""
    const rates = sfDivinityTierRates()
    let lines = rates.map((r, i) => `${SF_DIVINITY_NAMES[i]}: ${format(r)}/s`).join(" · ")
    return `<div class="realm-intro"><b>Nascent divinities:</b> ${format(player.sf.points)}<br><span style="opacity:0.85;font-size:0.92em">${lines}</span></div>`
}

function sfInsightStatusHTML() {
    if (!player.sf || !player.sf.unlocked) return ""
    const rates = sfLifeTierRates()
    let lines = rates.map((r, i) => `${SF_LIFE_NAMES[i]}: ${format(r)}/s`).join(" · ")
    const ins = player.sf.mortalInsights || new Decimal(0)
    return `<div class="realm-intro"><b>Mortal insights:</b> ${format(ins)}<br><span style="opacity:0.85;font-size:0.92em">${lines}</span></div>`
}

function sfMakeDivinityBuyable(id, tier) {
    const name = SF_DIVINITY_NAMES[tier]
    const produces = tier === 0 ? "nascent divinities" : SF_DIVINITY_NAMES[tier - 1].toLowerCase() + "s"
    return {
        title: name,
        cost(x) {
            let c = Decimal.pow(10, tier + 2).times(Decimal.pow(1.14, x))
            if (tier === 0 && hasUpgrade("sf", 15)) {
                c = c.times(Decimal.pow(0.9, getBuyableAmount("sf", 11).div(10).floor()))
            }
            return c.floor()
        },
        effect(x) {
            return x.times(sfTierBase(tier))
        },
        display() {
            const data = tmp[this.layer].buyables[this.id]
            return `Cost: ${format(data.cost)} nascent divinities\n\
Owned: ${formatWhole(player[this.layer].buyables[this.id])}\n\
Each produces ${format(sfTierBase(tier))} ${produces}/s (×${format(sfDivinityMult())} total)`
        },
        unlocked() { return player.sf.unlocked && hasMilestone("sf", 0) },
        canAfford() {
            return player.sf.points.gte(tmp.sf.buyables[this.id].cost)
        },
        buy() {
            const cost = tmp.sf.buyables[this.id].cost
            player.sf.points = player.sf.points.sub(cost)
            addBuyables("sf", this.id, 1)
        },
    }
}

function sfMakeLifeBuyable(id, tier) {
    const name = SF_LIFE_NAMES[tier]
    const produces = tier === 0 ? "mortal insights" : SF_LIFE_NAMES[tier - 1].toLowerCase() + "s"
    return {
        title: name,
        cost(x) {
            return Decimal.pow(10, tier + 2).times(Decimal.pow(1.16, x)).floor()
        },
        effect(x) {
            return x.times(sfTierBase(tier))
        },
        display() {
            const data = tmp[this.layer].buyables[this.id]
            const ins = player.sf.mortalInsights || new Decimal(0)
            return `Cost: ${format(data.cost)} mortal insights\n\
Lives walked: ${formatWhole(player[this.layer].buyables[this.id])}\n\
Each produces ${format(sfTierBase(tier))} ${produces}/s (×${format(sfInsightMult())} total)`
        },
        unlocked() {
            if (!player.sf.unlocked || !hasMilestone("sf", 1)) return false
            if (tier === 0) return true
            return getBuyableAmount("sf", SF_LIFE_IDS[tier - 1]).gte(1)
        },
        canAfford() {
            const ins = player.sf.mortalInsights || new Decimal(0)
            return ins.gte(tmp.sf.buyables[this.id].cost)
        },
        buy() {
            const cost = tmp.sf.buyables[this.id].cost
            player.sf.mortalInsights = player.sf.mortalInsights.sub(cost)
            addBuyables("sf", this.id, 1)
        },
    }
}

function unlockSoulTransformation() {
    if (!player) return
    player.st.unlocked = true
    if (typeof stEnsureState === "function") stEnsureState()
    if (typeof unlockJournal === "function") unlockJournal("soulTransformation")
}

addLayer("sf", {
    name: "Soul Formation",
    symbol: "SF",
    color: "#b8a0ff",
    row: 7,
    branches: ["dom"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
        mortalInsights: new Decimal(0),
        bestInsights: new Decimal(0),
    }},
    requires: new Decimal(1),
    resource: "nascent divinities",
    baseResource: "nascent souls",
    baseAmount() { return player.n.points },
    type: "normal",
    exponent: 0.45,
    resetsNothing: true,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("sf", 14)) mult = mult.times(1.2)
        if (typeof techniqueMult === "function") mult = mult.times(techniqueMult("sf"))
        return mult.times(typeof milestoneGainMult === "function" ? milestoneGainMult("sf") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("sf") : 0) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("sf")) return false
        if (!domainFinalComplete()) return false
        return tmp.sf.baseAmount.gte(tmp.sf.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("sf")
            if (sectMsg) return sectMsg
        }
        if (!domainFinalComplete()) return "Complete your Domain capstone trial first"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.sf.requires)} nascent souls`
        if (!player.sf.unlocked) return "Break through to Soul Formation"
        return "Break through again for nascent divinities"
    },
    onPrestige() {
        if (!player.sf.unlocked) player.sf.unlocked = true
        const first = player.sf.points.eq(0)
        if (first && typeof unlockJournal === "function") unlockJournal("soulFormation")
        if (typeof soulFormationPrestigeReset === "function") soulFormationPrestigeReset()
    },
    update(diff) { sfTickProduction(diff) },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("sf", ["milestones", "upgrades", "buyables", "mortalInsights", "bestInsights"])
        }
    },
    buyables: {
        11: sfMakeDivinityBuyable(11, 0),
        12: sfMakeDivinityBuyable(12, 1),
        13: sfMakeDivinityBuyable(13, 2),
        14: sfMakeDivinityBuyable(14, 3),
        15: sfMakeDivinityBuyable(15, 4),
        16: sfMakeDivinityBuyable(16, 5),
        21: sfMakeLifeBuyable(21, 0),
        22: sfMakeLifeBuyable(22, 1),
        23: sfMakeLifeBuyable(23, 2),
        24: sfMakeLifeBuyable(24, 3),
        25: sfMakeLifeBuyable(25, 4),
        26: sfMakeLifeBuyable(26, 5),
    },
    upgrades: {
        11: {
            title: "Divinity-Condensing Scripture",
            description: "Double Soul Seed production.",
            cost: new Decimal(50),
            unlocked() { return player.sf.unlocked && hasMilestone("sf", 0) },
        },
        12: {
            title: "Platform Stabilization Array",
            description: "Soul Platforms and above produce ×1.35.",
            cost: new Decimal(400),
            unlocked() { return hasUpgrade("sf", 11) && getBuyableAmount("sf", 12).gte(1) },
        },
        13: {
            title: "Canopy Refinement Art",
            description: "All divinity producers ×1.25.",
            cost: new Decimal(2500),
            unlocked() { return hasUpgrade("sf", 12) && getBuyableAmount("sf", 13).gte(1) },
        },
        14: {
            title: "Throne Echo Amplifier",
            description: "Nascent divinity gain scales with Soul Thrones owned.",
            cost: new Decimal(15000),
            unlocked() { return hasUpgrade("sf", 13) && getBuyableAmount("sf", 16).gte(1) },
            effect() { return getBuyableAmount("sf", 16).add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("sf", 14)) + "x" },
        },
        15: {
            title: "Seed Autocondensation Talisman",
            description: "Soul Seeds cost 10% less per ten owned.",
            cost: new Decimal(8000),
            unlocked() { return hasMilestone("sf", 1) && getBuyableAmount("sf", 11).gte(10) },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("sf", 0, "1 nascent divinity"),
            done() { return player.sf.best.gte(1) },
            effectDescription: "Soul formed. Nascent Divinity producers unlock.",
        },
        1: {
            requirementDescription: realmReq("sf", 1, "100 nascent divinities"),
            done() { return player.sf.best.gte(100) },
            effectDescription: "+25% divinity production. Mortal Lives tab opens.",
        },
        2: {
            requirementDescription: realmReq("sf", 2, "25 mortal insights"),
            done() { return (player.sf.bestInsights || new Decimal(0)).gte(25) },
            effectDescription: "+30% mortal insight production.",
        },
        3: {
            requirementDescription: realmReq("sf", 3, "1,000 divinities and a Second Life walked"),
            done() {
                return player.sf.best.gte(1000) && getBuyableAmount("sf", 22).gte(1)
            },
            effectDescription: "Second profession Dao opens on the tree.",
        },
        4: {
            requirementDescription: realmReq("sf", 4, "50,000 divinities and 500 mortal insights"),
            done() {
                return player.sf.best.gte(50000) && (player.sf.bestInsights || new Decimal(0)).gte(500)
            },
            effectDescription: "+35% divinity and +25% insight production.",
        },
        5: {
            requirementDescription: realmReq("sf", 5, "1M divinities and 5 Fifth Lives"),
            done() {
                return player.sf.best.gte(1e6) && getBuyableAmount("sf", 25).gte(5)
            },
            effectDescription: "+50% divinity and +40% insight production.",
        },
        6: {
            requirementDescription: realmReq("sf", 6, "100M divinities and the Sixth Life"),
            done() {
                return player.sf.best.gte(1e8) && getBuyableAmount("sf", 26).gte(1)
            },
            effectDescription: "Soul Transformation unlocks. Walk incarnations to open Second Domain and Third Dao.",
            onComplete() { unlockSoulTransformation() },
        },
    },
    microtabs: {
        sf: {
            divinity: {
                title: "Nascent Divinity",
                unlocked() { return player.sf.unlocked || domainFinalComplete() },
                content: [
                    ["display-text", "<div class='realm-intro'>Condense nascent divinities through six soul structures — each tier feeds the one below, like dimensions folding inward.</div>"],
                    ["display-text", function() { return sfDivinityStatusHTML() }],
                    ["blank", "8px"],
                    ["buyables", [1]],
                    ["blank", "10px"],
                    "upgrades",
                ],
            },
            lives: {
                title: "Mortal Lives",
                unlocked() { return hasMilestone("sf", 1) },
                content: [
                    ["display-text", "<div class='realm-intro'>Walk mortal lives to gather insights. Each deeper life reincarnates the one before — memory upon memory.</div>"],
                    ["display-text", function() { return sfInsightStatusHTML() }],
                    ["blank", "8px"],
                    ["buyables", [2]],
                ],
            },
        },
    },
    tabFormat: [
        ["display-text", "<div class='realm-intro'>Soul Formation follows your great breakthrough. Nascent divinities and mortal insights advance in parallel — only both together open Soul Transformation.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        ["microtabs", "sf"],
        ["blank", "12px"],
        "milestones",
    ],
    layerShown() { return typeof soulFormationLayerShown === "function" ? soulFormationLayerShown() : domainFinalComplete() },
    tooltip() { return soulFormationReached() ? "Soul Formation" : "Soul Formation (Domain capstone required)" },
    tooltipLocked() { return "Complete your Domain capstone trial." },
    hotkeys: [{ key: "shift+x", description: "Shift+X: Soul Formation breakthrough", onPress() { if (canReset(this.layer)) doReset(this.layer) } }],
    resetDescription: "Form Soul and gain ",
})
