// Ascendant — Step 1 capstone. World essence prestige, World Qi generator, breakthrough to Illusory Yin.

const ASC_ENTRY_RESET_LAYERS = ["q", "f", "c", "j", "g", "n", "al", "ar", "re", "dom", "sf"]
const ASC_AVATAR_MS = { blood: 10, body: 11, sense: 12, soul: 13, beast: 14, dao: 15 }
const ASC_STEP_TWO_WQ = new Decimal(1e12)
const ASC_STEP_TWO_ESSENCE = new Decimal(50000)

function ascendantReached() {
    return player && player.asc && player.asc.unlocked
}

function stAvatarIndividualComplete(id) {
    const ms = ASC_AVATAR_MS[id]
    return ms !== undefined && hasMilestone("st", ms)
}

function stAscendantBreakthroughReady() {
    if (!hasMilestone("st", 9)) return false
    stEnsureState()
    if (player.st.unlockedAvatars.length < 6) return false
    for (const id of ST_AVATAR_IDS) {
        if (!stAvatarIndividualComplete(id)) return false
        if (!stIsActive(id)) return false
    }
    return player.st.active.length >= 6
}

function ascBreakthroughPower() {
    let power = stTotalProgressScore().pow(2).times(1e10)
    if (player.sf && player.sf.best) power = power.times(player.sf.best.add(1).pow(0.25))
    if (player.st && player.st.best) power = power.times(player.st.best.add(1).pow(0.12))
    if (player.st && player.st.active.length >= 6) power = power.times(2.5)
    return power
}

function ascBreakthroughRequires() {
    return new Decimal(1e14).div(stTotalProgressScore().add(1).pow(1.45))
}

function ascPrestigeRequires() {
    const runs = player.asc.points.toNumber()
    return Decimal.pow(10, 5 + runs * 1.15).div(Decimal.pow(1.72, runs))
}

function ascEnsureState() {
    if (!player.asc) return
    if (player.asc.worldQi === undefined) player.asc.worldQi = new Decimal(0)
    if (player.asc.bestWorldQi === undefined) player.asc.bestWorldQi = new Decimal(0)
    if (player.asc.totalWorldQi === undefined) player.asc.totalWorldQi = new Decimal(0)
    if (player.asc.unlocked === undefined) player.asc.unlocked = false
}

function ascCondenserBaseRate() {
    let rate = new Decimal(1)
    if (hasUpgrade("asc", 21)) rate = rate.times(2)
    if (hasUpgrade("asc", 22)) rate = rate.times(player.asc.points.add(1).pow(0.08))
    if (hasUpgrade("asc", 23)) rate = rate.times(1.35)
    if (hasUpgrade("asc", 54)) rate = rate.times(1.5)
    if (hasMilestone("asc", 5)) rate = rate.times(1.2)
    if (hasMilestone("asc", 7)) rate = rate.times(1.35)
    return rate
}

function ascWorldQiMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("asc", 51)) mult = mult.times(upgradeEffect("asc", 51))
    if (hasUpgrade("asc", 52)) mult = mult.times(1.25)
    if (hasUpgrade("asc", 53)) mult = mult.times(player.asc.bestWorldQi.add(1).pow(0.06))
    if (hasMilestone("asc", 6)) mult = mult.times(1.15)
    if (hasMilestone("asc", 8)) mult = mult.times(1.25)
    if (hasMilestone("asc", 9)) mult = mult.times(1.4)
    return mult
}

function ascWorldQiPerSec() {
    const condenser = getBuyableAmount("asc", 11)
    if (condenser.lte(0)) return new Decimal(0)
    return condenser.times(ascCondenserBaseRate()).times(ascWorldQiMult())
}

function ascWorldQiStatusHTML() {
    ascEnsureState()
    const rate = format(ascWorldQiPerSec())
    return `<div class="realm-intro">World Qi: <b>${format(player.asc.worldQi)}</b> (best ${format(player.asc.bestWorldQi)}) · ${rate}/s from condenser</div>`
}

function ascBreakthroughStatusHTML() {
    if (player.asc.unlocked) return ""
    const ready = stAscendantBreakthroughReady()
    const power = format(ascBreakthroughPower())
    const need = format(ascBreakthroughRequires())
    let avatars = ST_AVATAR_IDS.map(id => {
        const ok = stAvatarIndividualComplete(id) && stIsActive(id)
        return `${ST_AVATARS[id].name}${ok ? " ✓" : ""}`
    }).join(" · ")
    return `<div class="realm-intro"><b>Ascendant breakthrough</b> — each incarnation must complete its path milestone and all six must be <b>active</b>. Power ${power} / ${need}. ${avatars}${ready ? " <b>Ready.</b>" : ""}</div>`
}

function ascAutomationLayers() {
    if (!hasMilestone("asc", 0)) return []
    const layers = ["q", "f"]
    if (hasMilestone("asc", 1)) layers.push("c")
    if (hasMilestone("asc", 2)) layers.push("j", "g")
    if (hasMilestone("asc", 3)) layers.push("n")
    if (hasMilestone("asc", 4)) layers.push("s")
    return layers
}

function ascCultivationMult() {
    let mult = new Decimal(1)
    if (hasMilestone("asc", 0)) mult = mult.times(1.12)
    if (hasMilestone("asc", 1)) mult = mult.times(1.08)
    if (hasMilestone("asc", 2)) mult = mult.times(1.1)
    if (hasMilestone("asc", 3)) mult = mult.times(1.12)
    if (hasMilestone("asc", 4)) mult = mult.times(1.15)
    if (hasUpgrade("asc", 31)) mult = mult.times(1.2)
    if (hasUpgrade("asc", 32)) mult = mult.times(player.asc.points.add(1).pow(0.05))
    return mult
}

function ascendantEntryReset() {
    if (!player) return
    ascEnsureState()

    stEnsureState()
    const first = player.st.unlockedAvatars[0] || ST_AVATAR_IDS.find(id => stAvatarUnlocked(id))
    player.st.maxActiveSlots = 1
    player.st.active = first && stAvatarUnlocked(first) ? [first] : []

    player.domainFormed = false
    player.points = getStartPoints()
    player.q.unlocked = true

    for (const lr of ASC_ENTRY_RESET_LAYERS) {
        if (!player[lr]) continue
        if (lr === "dom") {
            layerDataReset("dom", ["milestones"])
            continue
        }
        layerDataReset(lr, [])
        if (lr !== "q") player[lr].unlocked = false
    }
    for (const id of ["al", "ar", "re"]) {
        if (hasProfession(id)) player[id].unlocked = true
    }
    updateTemp()
}

function canBreakthroughStepTwo() {
    ascEnsureState()
    if (player.stepTwoUnlocked) return false
    return hasMilestone("asc", 4)
        && hasMilestone("asc", 9)
        && player.asc.best.gte(ASC_STEP_TWO_ESSENCE)
        && player.asc.bestWorldQi.gte(ASC_STEP_TWO_WQ)
}

function breakthroughStepTwo() {
    if (!canBreakthroughStepTwo()) return
    insightsEnsure()
    if (!player.yin) player.yin = { unlocked: false }
    if (!player.yang) player.yang = { unlocked: false }
    player.stepTwoUnlocked = true
    player.yin.unlocked = true
    if (typeof unlockJournal === "function") {
        unlockJournal("ascendantCapstone")
        unlockJournal("illusoryYin")
    }
    updateTemp()
}

function ascMakeWorldQiUpgrade(id, tier) {
    const costs = [new Decimal(500), new Decimal(5000), new Decimal(50000), new Decimal(500000), new Decimal(5e6)]
    const effects = [
        () => player.asc.worldQi.add(1).pow(0.15),
        () => 1.3,
        () => player.asc.bestWorldQi.add(1).pow(0.04),
        () => 1.5,
        () => ascWorldQiPerSec().add(1).pow(0.08),
    ]
    return {
        title: ["Qi Gathering Rune", "World Breath Scripture", "Essence Echo Array", "Heaven-Earth Condenser Art", "Cosmic Qi Amplifier"][tier],
        description: [
            "World Qi gain scales with current World Qi held.",
            "×1.3 World Qi from all sources.",
            "World Qi gain scales with best World Qi.",
            "×1.5 condenser output.",
            "Condenser rate scales with current output.",
        ][tier],
        cost: costs[tier],
        currencyInternalName: "worldQi",
        currencyLayer: "asc",
        unlocked() {
            return player.asc.unlocked && hasMilestone("asc", 5 + Math.min(tier, 1))
        },
        effect: effects[tier],
        effectDisplay() {
            const eff = upgradeEffect("asc", id)
            return tier === 0 || tier === 2 || tier === 4 ? format(eff) + "×" : format(eff) + "× World Qi"
        },
    }
}

addLayer("asc", {
    name: "Ascendant",
    symbol: "Asc",
    color: "#ffd89b",
    type: "normal",
    row: 9,
    branches: ["st"],
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
        worldQi: new Decimal(0),
        bestWorldQi: new Decimal(0),
        totalWorldQi: new Decimal(0),
    }},
    requires() {
        if (!player.asc.unlocked) return ascBreakthroughRequires()
        return ascPrestigeRequires()
    },
    resource: "world essence",
    baseResource() {
        return player.asc.unlocked ? "World Qi held" : "Ascendant breakthrough power"
    },
    baseAmount() {
        ascEnsureState()
        if (!player.asc.unlocked) return ascBreakthroughPower()
        return player.asc.worldQi
    },
    exponent() {
        const runs = player.asc.points.toNumber()
        return Math.max(0.2, 0.52 - runs * 0.075)
    },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("asc", 11)) mult = mult.times(2)
        if (hasUpgrade("asc", 12)) mult = mult.times(player.st.best.add(1).pow(0.08))
        if (hasUpgrade("asc", 13)) mult = mult.times(1.25)
        if (hasUpgrade("asc", 31)) mult = mult.times(1.15)
        if (hasUpgrade("asc", 33)) mult = mult.times(player.asc.bestWorldQi.add(1).pow(0.05))
        if (typeof techniqueMult === "function") mult = mult.times(techniqueMult("asc"))
        return mult
    },
    gainExp() {
        const runs = player.asc.points.toNumber()
        return new Decimal(1.85).pow(runs).times(stTotalProgressScore().pow(0.04).add(1))
    },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("asc")) return false
        ascEnsureState()
        if (!player.asc.unlocked) {
            return stAscendantBreakthroughReady() && tmp.asc.baseAmount.gte(tmp.asc.requires)
        }
        return player.asc.worldQi.gte(tmp.asc.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("asc")
            if (sectMsg) return sectMsg
        }
        ascEnsureState()
        if (!player.asc.unlocked) {
            if (!stAscendantBreakthroughReady()) return "Complete all incarnation milestones with six active avatars"
            if (!canReset(this.layer)) return `Need ${formatWhole(tmp.asc.requires)} breakthrough power (have ${formatWhole(tmp.asc.baseAmount)})`
            return "Ascend — break through to the Ascendant Realm"
        }
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.asc.requires)} World Qi (have ${formatWhole(player.asc.worldQi)})`
        if (player.asc.points.eq(0)) return "Condense your first world essence"
        return "Condense world essence"
    },
    resetDescription: "Refine the heavens and gain ",
    layerShown() { return hasMilestone("st", 9) },
    hotkeys: [{
        key: "shift+u",
        description: "Shift+U: Condense world essence / Ascend",
        onPress() { if (canReset(this.layer)) doReset(this.layer) },
    }],
    onPrestige(gain) {
        ascEnsureState()
        const firstEntry = !player.asc.unlocked
        if (firstEntry) {
            player.asc.unlocked = true
            ascendantEntryReset()
            if (typeof unlockJournal === "function") unlockJournal("ascendant")
        } else {
            player.asc.worldQi = new Decimal(0)
        }
    },
    update(diff) {
        ascEnsureState()
        if (!player.asc.unlocked) return
        const gain = ascWorldQiPerSec().times(diff)
        if (gain.gt(0)) {
            player.asc.worldQi = player.asc.worldQi.add(gain)
            player.asc.totalWorldQi = player.asc.totalWorldQi.add(gain)
            if (player.asc.worldQi.gt(player.asc.bestWorldQi)) player.asc.bestWorldQi = player.asc.worldQi
        }
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("asc", ["milestones", "upgrades", "buyables"])
        }
    },
    buyables: {
        11: {
            title: "World Qi Condenser",
            unlocked() { return player.asc.unlocked && hasMilestone("asc", 0) },
            cost(x) {
                let cost = Decimal.pow(1.38, x).times(15)
                if (hasUpgrade("asc", 24)) cost = cost.times(0.92)
                return cost
            },
            effect(x) { return x.times(ascCondenserBaseRate()).times(ascWorldQiMult()) },
            effectDisplay() { return format(buyableEffect("asc", 11)) + " World Qi/s" },
        },
    },
    upgrades: {
        11: {
            title: "Heaven Refinement Scripture",
            description: "Double world essence gain.",
            cost: new Decimal(5),
            unlocked() { return player.asc.unlocked && hasMilestone("asc", 0) },
        },
        12: {
            title: "Incarnation Echo Art",
            description: "World essence gain scales with transformation insights (best).",
            cost: new Decimal(40),
            unlocked() { return hasUpgrade("asc", 11) },
            effect() { return player.st.best.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("asc", 12)) + "× essence" },
        },
        13: {
            title: "Ascendant Breath Manual",
            description: "×1.25 world essence gain.",
            cost: new Decimal(200),
            unlocked() { return hasUpgrade("asc", 12) && hasMilestone("asc", 2) },
        },
        21: {
            title: "Condenser Foundation Array",
            description: "Double World Qi condenser output.",
            cost: new Decimal(25),
            unlocked() { return player.asc.unlocked && hasMilestone("asc", 0) },
        },
        22: {
            title: "Essence-Fed Condenser",
            description: "Condenser output scales with world essence held.",
            cost: new Decimal(300),
            unlocked() { return hasUpgrade("asc", 21) },
            effect() { return player.asc.points.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("asc", 22)) + "× condenser" },
        },
        23: {
            title: "Great Circle Condenser Art",
            description: "×1.35 condenser output.",
            cost: new Decimal(2500),
            unlocked() { return hasUpgrade("asc", 22) && hasMilestone("asc", 4) },
        },
        24: {
            title: "Efficient World Array",
            description: "Condenser cost ×0.92 per level.",
            cost: new Decimal(8000),
            unlocked() { return hasUpgrade("asc", 23) && hasMilestone("asc", 3) },
        },
        31: {
            title: "Lower Realm Echo",
            description: "×1.2 all Step-1 cultivation while Ascendant.",
            cost: new Decimal(100),
            unlocked() { return hasMilestone("asc", 1) },
        },
        32: {
            title: "Essence Resonance Field",
            description: "Step-1 cultivation scales with world essence.",
            cost: new Decimal(1200),
            unlocked() { return hasUpgrade("asc", 31) && hasMilestone("asc", 3) },
            effect() { return player.asc.points.add(1).pow(0.05) },
            effectDisplay() { return format(upgradeEffect("asc", 32)) + "× cultivation" },
        },
        33: {
            title: "World Qi Harmony",
            description: "World essence gain scales with best World Qi.",
            cost: new Decimal(15000),
            unlocked() { return hasUpgrade("asc", 32) && hasMilestone("asc", 7) },
            effect() { return player.asc.bestWorldQi.add(1).pow(0.05) },
            effectDisplay() { return format(upgradeEffect("asc", 33)) + "× essence" },
        },
        51: ascMakeWorldQiUpgrade(51, 0),
        52: ascMakeWorldQiUpgrade(52, 1),
        53: ascMakeWorldQiUpgrade(53, 2),
        54: ascMakeWorldQiUpgrade(54, 3),
        55: ascMakeWorldQiUpgrade(55, 4),
    },
    clickables: {
        91: {
            title: "Open the Nirvana Tree",
            display() {
                if (player.stepTwoUnlocked) return "Nirvana tree open — cultivate insights on the second tab"
                if (!canBreakthroughStepTwo()) return "Seal of the Second Step"
                return "Break the seal — open the Nirvana tree"
            },
            canClick() { return canBreakthroughStepTwo() },
            onClick() { breakthroughStepTwo() },
            style() {
                return canBreakthroughStepTwo()
                    ? { "background-color": "#3a2a5a", "border-color": "#c8a0ff" }
                    : { "background-color": "#222", "border-color": "#555" }
            },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("asc", 0, "1 world essence"),
            done() { ascEnsureState(); return player.asc.best.gte(1) },
            effectDescription: "Lower Step-1 layers autobuy upgrades (Artificer-style). +12% cultivation.",
            onComplete() {
                if (typeof unlockJournal === "function") unlockJournal("worldEssence")
            },
        },
        1: {
            requirementDescription: realmReq("asc", 1, "50 world essence"),
            done() { return player.asc.best.gte(50) },
            effectDescription: "+8% cultivation. Autobuy extends to Core Formation.",
        },
        2: {
            requirementDescription: realmReq("asc", 2, "500 world essence"),
            done() { return player.asc.best.gte(500) },
            effectDescription: "+10% cultivation. Autobuy extends to Ji and Golden Core.",
        },
        3: {
            requirementDescription: realmReq("asc", 3, "5,000 world essence"),
            done() { return player.asc.best.gte(5000) },
            effectDescription: "+12% cultivation. Autobuy extends to Nascent Soul.",
        },
        4: {
            requirementDescription: realmReq("asc", 4, "50,000 world essence — Great Circle"),
            done() { return player.asc.best.gte(ASC_STEP_TWO_ESSENCE) },
            effectDescription: "+15% cultivation. Autobuy extends to Sect. Ascendant Great Circle reached.",
        },
        5: {
            requirementDescription: "10,000 World Qi (best)",
            done() { ascEnsureState(); return player.asc.bestWorldQi.gte(1e4) },
            effectDescription: "+20% condenser output. World Qi upgrades unlock.",
        },
        6: {
            requirementDescription: "1,000,000 World Qi (best)",
            done() { return player.asc.bestWorldQi.gte(1e6) },
            effectDescription: "+15% World Qi gain.",
        },
        7: {
            requirementDescription: "100,000,000 World Qi (best)",
            done() { return player.asc.bestWorldQi.gte(1e8) },
            effectDescription: "+35% condenser output.",
        },
        8: {
            requirementDescription: "10,000,000,000 World Qi (best)",
            done() { return player.asc.bestWorldQi.gte(1e10) },
            effectDescription: "+25% World Qi gain.",
        },
        9: {
            requirementDescription: "1,000,000,000,000 World Qi (best) — World Qi Great Circle",
            done() { return player.asc.bestWorldQi.gte(ASC_STEP_TWO_WQ) },
            effectDescription: "×1.4 World Qi. Second Step breakthrough available with Ascendant Great Circle.",
        },
    },
    microtabs: {
        ascension: {
            title: "Ascendance",
            unlocked() { return player.asc.unlocked || stAscendantBreakthroughReady() },
            content: [
                ["display-text", function() { return ascBreakthroughStatusHTML() }],
                "main-display",
                "prestige-button",
                "resource-display",
                ["blank", "8px"],
                ["upgrades", ["11", "12", "13", "21", "22", "23", "24", "31", "32", "33"]],
            ],
        },
        world: {
            title: "World Qi",
            unlocked() { return player.asc.unlocked && hasMilestone("asc", 0) },
            content: [
                ["display-text", "<div class='realm-intro'>Spend <b>world essence</b> on the condenser; spend <b>World Qi</b> on qi arts. Milestones on both tabs track essence and qi for the Second Step seal.</div>"],
                ["display-text", function() { return ascWorldQiStatusHTML() }],
                ["blank", "8px"],
                "buyables",
                ["blank", "8px"],
                ["display-text", "<b>World Qi arts</b> (paid in World Qi):"],
                ["upgrades", ["51", "52", "53", "54", "55"]],
            ],
        },
    },
    tabFormat: [
        ["display-text", "<h2>Ascendant</h2>"],
        ["display-text", "<div class='realm-intro'>Step 1 capstone. First ascent is a long trial — later condensations grow swift. World essence powers ascendance; World Qi opens the Second Step.</div>"],
        ["microtabs", "asc"],
        ["blank", "12px"],
        "milestones",
        ["blank", "8px"],
        "clickables",
    ],
    tooltip() { return "Ascendant — World essence & World Qi" },
    tooltipLocked() { return "Complete Heavenly Soul Transformation (milestone 9)." },
})
