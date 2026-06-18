const COLOR_QI = "#6ee7a8"
const COLOR_FOUNDATION = "#9bd47b"
const COLOR_CORE = "#f2c766"
const COLOR_JI = "#8fb7ff"
const COLOR_GOLD = "#ffc857"
const COLOR_NASCENT = "#d49cff"
const COLOR_LOCKED = "#48515a"

// layerResetInTree defined in techniques.js

function lowerRealmGainMult() {
    const u = typeof BALANCE !== "undefined" ? BALANCE.lowerRealmUpgrade : null
    let mult = typeof milestoneLowerRealmMult === "function" ? milestoneLowerRealmMult() : new Decimal(1)
    if (hasUpgrade("n", 11)) mult = mult.times(u ? u.n11 : 1.75)
    if (hasUpgrade("n", 14)) mult = mult.times(u ? u.n14 : 1.35)
    if (hasUpgrade("n", 34)) mult = mult.times(u ? u.n34 : 1.2)
    if (hasUpgrade("n", 12)) mult = mult.times(player.n.points.add(1).pow(u ? u.n12Pow : 0.45))
    if (hasUpgrade("n", 22)) mult = mult.times(player.n.points.add(1).pow(u ? u.n22Pow : 0.22))
    if (hasUpgrade("k", 12)) mult = mult.times(1.15)
    return mult
}

function capReached(layer, milestoneId) {
    return hasMilestone(layer, milestoneId)
}

const COLOR_SECT = "#7fe0c0"

function sectRank() {
    if (hasMilestone("s", 3)) return 3
    if (hasMilestone("s", 2)) return 2
    if (hasMilestone("s", 1)) return 1
    if (hasMilestone("s", 0)) return 0
    return -1
}

function cultMult(currency) {
    return techniqueMult(currency).times(sectPillMult(currency))
}

function realmGainTail(currency) {
    let mult = lowerRealmGainMult().times(cultMult(currency)).times(eventChallengeMult(currency))
    if (typeof milestoneGainMult === "function") mult = mult.times(milestoneGainMult(currency))
    if (typeof restrictionGainMult === "function") mult = mult.times(restrictionGainMult(currency))
    if (typeof domainBoost === "function") mult = mult.times(domainBoost(currency))
    if (typeof domainPrestigeMult === "function") mult = mult.times(domainPrestigeMult(currency))
    if (typeof avatarCultivationMult === "function") mult = mult.times(avatarCultivationMult(currency))
    if (typeof nirvanaFalloutMult === "function") mult = mult.times(nirvanaFalloutMult())
    return mult
}

function isSectLeader() {
    return hasMilestone("w", 2)
}

function sectPathUnlocked() {
    return hasMilestone("q", 0)
}

function sectMembershipHTML() {
    const rank = formatWhole(sectWorldRank())
    if (isSectLeader()) {
        return `<div class='realm-intro'>You serve a <b>World Rank ${rank}</b> sect as <b>Sect Leader</b>. Win the war and hold the hall, then transfer to a higher-ranked sect when your cultivation qualifies.</div>`
    }
    return `<div class='realm-intro'>You serve a <b>World Rank ${rank}</b> sect. Rise through disciple duties, then sect war — <b>Sect Leader</b> is the last title here before you may join a higher-ranked sect.</div>`
}

function canAscendSectRank() {
    if (!isSectLeader()) return false
    if (inEvent(61)) return false
    if (player.k.points.gte(SECT_RANK_ASCENSION_CAP)) return false
    const gate = sectRankAscensionGate()
    if (!gate.ok) return false
    return tmp.k.baseAmount.gte(tmp.k.requires)
}

function sectRankEventTier() {
    if (player.k.points.gte(3)) return 3
    if (player.k.points.gte(2)) return 2
    if (player.k.points.gte(1)) return 1
    return 0
}

function inEvent(id) {
    return inChallenge("s", id)
}

function eventChallengeMult(currency) {
    let mult = new Decimal(1)
    if (inEvent(11)) {
        if (currency === "points") mult = mult.times(0.5)
        else if (currency === "q") mult = mult.times(0.7)
        else mult = mult.times(0.85)
    }
    if (inEvent(12)) {
        if (currency === "points") mult = mult.times(0.6)
        else if (currency === "q") mult = mult.times(0.75)
    }
    if (inEvent(13) && currency === "f") mult = mult.times(0.55)
    if (inEvent(21)) {
        if (currency === "points" || currency === "f") mult = mult.times(0.6)
        else mult = mult.times(0.75)
    }
    if (inEvent(22) && (currency === "q" || currency === "s")) mult = mult.times(0.5)
    if (inEvent(23)) {
        if (currency === "s") mult = mult.times(0.65)
        if (currency === "c") mult = mult.times(0.7)
    }
    if (inEvent(24) && currency === "points") mult = mult.times(0.5)
    if (inEvent(31) && currency === "c") mult = mult.times(0.55)
    if (inEvent(32) && (currency === "j" || currency === "g")) mult = mult.times(0.5)
    if (inEvent(33) && (currency === "j" || currency === "g")) mult = mult.times(0.6)
    if (inEvent(41) && currency === "w") mult = mult.times(0.55)
    if (inEvent(42)) mult = mult.times(0.8)
    if (inEvent(51) && (currency === "w" || currency === "s")) mult = mult.times(0.6)
    if (inEvent(52) && currency === "s") mult = mult.times(0.65)
    if (inEvent(61) && (currency === "w" || currency === "k")) mult = mult.times(0.5)
    if (inEvent(62)) {
        if (currency === "points") mult = mult.times(0.7)
        if (currency === "sf" || currency === "sf_insights") mult = mult.times(0.55)
    }
    return mult
}

function eventBlocksReset(layer) {
    if (layer === "f" && (inEvent(12) || inEvent(13))) return true
    if (layer === "c" && (inEvent(23) || inEvent(31))) return true
    if (layer === "s" && (inEvent(22) || inEvent(24) || inEvent(52))) return true
    if (layer === "k" && inEvent(61)) return true
    return false
}

function realmTab(intro) {
    return [
        ["display-text", `<div class="realm-intro">${intro}</div>`],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
    ]
}

addLayer("q", {
    name: "Qi Condensation",
    symbol: "Qi",
    position: 0,
    startData() { return {
        unlocked: true,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_QI,
    requires() { return balanceRequires("q") || new Decimal(28) },
    resource: "dantian qi",
    baseResource: "scattered qi",
    baseAmount() { return player.points },
    type: "normal",
    exponent() { return balanceExponent("q") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("q", 13)) mult = mult.times(2)
        if (hasUpgrade("q", 23)) mult = mult.times(2)
        if (hasUpgrade("q", 31)) mult = mult.times(2)
        if (hasUpgrade("q", 24)) mult = mult.times(player.points.add(1).pow(0.1))
        if (hasUpgrade("f", 11)) mult = mult.times(player.f.points.add(1).pow(0.3))
        if (hasUpgrade("c", 22)) mult = mult.times(player.c.points.add(1).pow(0.2))
        return mult.times(realmGainTail("q"))
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("q") : 0) },
    passiveGeneration() { return techniquePassive("q") },
    autoUpgrade() { return hasUpgrade("q", 34) || (typeof artificerAutoLayers === "function" && artificerAutoLayers().includes("q")) },
    row: 0,
    branches: [],
    milestones: {
        0: {
            requirementDescription: realmReq("q", 0, "5 scattered qi"),
            done() { return player.points.gte(5) },
            effectDescription: "+10% scattered qi gathering. Reveal Immortal Sect.",
            onComplete() {
                unlockJournal("start")
                if (player.s) player.s.unlocked = true
            },
        },
        1: {
            requirementDescription: realmReq("q", 1, "1 dantian qi"),
            done() { return player.q.best.gte(1) },
            effectDescription: "+12% dantian qi gain and +0.3% passive dantian qi. Unlock journal.",
            onComplete() { unlockJournal("qi") },
        },
        2: {
            requirementDescription: realmReq("q", 2, "40 dantian qi"),
            done() { return player.q.best.gte(40) },
            effectDescription: "Reveal Foundation Establishment. −5% Foundation breakthrough cost.",
        },
        3: {
            requirementDescription: realmReq("q", 3, "120 dantian qi"),
            done() { return player.q.best.gte(120) },
            effectDescription: "+10% dantian qi from echoes of past Foundation lives.",
        },
        4: {
            requirementDescription: realmReq("q", 4, "400 dantian qi"),
            done() { return player.q.best.gte(400) },
            effectDescription: "+15% dantian qi, −8% Foundation cost, faster qi prestige.",
        },
    },
    upgrades: {
        11: {
            title: "Nine-Turn Breathing Art",
            description: "A basic breathing cycle doubles scattered spiritual energy.",
            cost: new Decimal(2),
        },
        12: {
            title: "Seated Root Cultivation",
            description: "Unspent dantian qi resonates with heaven and earth, boosting scattered qi.",
            cost: new Decimal(5),
            unlocked() { return hasUpgrade("q", 11) },
            effect() { return player.q.points.add(1).pow(0.35) },
            effectDisplay() { return format(upgradeEffect("q", 12)) + "x" },
        },
        13: {
            title: "Stumble Upon a Spirit Vein",
            description: "Fortune smiles — dantian qi condenses twice as fast.",
            cost: new Decimal(15),
            unlocked() { return hasUpgrade("q", 12) },
        },
        21: {
            title: "Mist-Splitting Movement Art",
            description: "Footwork learned from a wandering immortal doubles scattered qi.",
            cost: new Decimal(55),
            unlocked() { return hasMilestone("q", 2) },
        },
        22: {
            title: "Hundred-Cycle Inner Breathing",
            description: "Lifetime dantian qi refines your gathering speed.",
            cost: new Decimal(60),
            unlocked() { return hasUpgrade("q", 21) },
            effect() { return player.q.total.add(1).pow(0.18) },
            effectDisplay() { return format(upgradeEffect("q", 22)) + "x" },
        },
        23: {
            title: "Discover a Hidden Spirit Spring",
            description: "A secluded spring feeds your dantian — double qi gain.",
            cost: new Decimal(100),
            unlocked() { return hasUpgrade("q", 22) },
        },
        24: {
            title: "Mortal Realm Epiphany",
            description: "Insight from the mundane world turns scattered qi into cultivation fuel.",
            cost: new Decimal(180),
            unlocked() { return hasUpgrade("q", 23) },
            effect() { return player.points.add(1).pow(0.1) },
            effectDisplay() { return format(upgradeEffect("q", 24)) + "x" },
        },
        31: {
            title: "Cloud Sea Meditation Posture",
            description: "A lost posture from a fallen sect elder doubles dantian qi gain.",
            cost: new Decimal(320),
            unlocked() { return hasMilestone("q", 3) },
        },
        33: {
            title: "Echo of Foundation Realms",
            description: "Memories of liquid qi from past lives strengthen gathering.",
            cost: new Decimal(450),
            unlocked() { return hasMilestone("q", 3) && player.f.total.gte(1) },
            effect() { return player.f.total.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("q", 33)) + "x" },
        },
        35: {
            title: "Breakthrough Glimpse Scripture",
            description: "A fragment of a higher scripture lowers Foundation gate requirements.",
            cost: new Decimal(750),
            unlocked() { return hasUpgrade("q", 33) },
        },
        34: {
            title: "Solitary Cave Gathering Art",
            description: "Cultivate alone in a cave — passively gain 1% of dantian qi reset gain per second and auto-buy qi arts.",
            cost: new Decimal(1200),
            unlocked() { return hasMilestone("q", 4) },
        },
    },
    doReset(resettingLayer) {
        if (resettingLayer === "n") {
            layerDataReset("q", layerResetKeepForPrestige("q", "n"))
            return
        }
        layerResetInTree("q", resettingLayer)
    },
    hotkeys: [
        { key: "shift+q", description: "Shift+Q: Condense Qi", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    resetDescription: "Condense scattered qi into ",
    tabFormat: realmTab("Qi Condensation turns scattered qi into the first breath of cultivation."),
    layerShown() { return true },
})

addLayer("f", {
    name: "Foundation Establishment",
    symbol: "F",
    position: 0,
    startData() { return {
        unlocked: false,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_FOUNDATION,
    requires() {
        let req = balanceRequires("f") || new Decimal(42)
        if (hasUpgrade("q", 35)) {
            const steps = player.q.points.div(10).floor().min(50)
            req = req.times(Decimal.pow(0.99, steps))
        }
        return applyRestrictionRequires(req).times(typeof domainRequiresMultFor === "function" ? domainRequiresMultFor("f") : 1).times(typeof milestoneRequiresMult === "function" ? milestoneRequiresMult("f") : 1)
    },
    resource: "liquid qi",
    baseResource: "dantian qi",
    baseAmount() { return player.q.points },
    type: "normal",
    exponent() { return balanceExponent("f") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("f", 12)) mult = mult.times(2)
        if (hasUpgrade("f", 21)) mult = mult.times(player.f.points.add(1).pow(0.22))
        if (hasUpgrade("f", 22)) mult = mult.times(2)
        if (hasUpgrade("f", 31)) mult = mult.times(2)
        if (hasUpgrade("f", 24)) mult = mult.times(player.q.points.add(1).pow(0.12))
        if (hasUpgrade("j", 23)) mult = mult.times(player.j.points.add(1).pow(0.18))
        return mult.times(realmGainTail("f"))
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("f") : 0) },
    passiveGeneration() { return techniquePassive("f") },
    autoUpgrade() { return typeof artificerAutoLayers === "function" && artificerAutoLayers().includes("f") },
    canReset() {
        if (eventBlocksReset("f")) return false
        if (cultivationSectGateBlocksReset("f")) return false
        return tmp.f.baseAmount.gte(tmp.f.requires)
    },
    prestigeButtonText() {
        if (inEvent(12)) return "Complete the Outer Court Spar first"
        if (inEvent(13)) return "Finish the Outer Disciple Tournament first"
        const sectMsg = cultivationSectGateButtonText("f")
        if (sectMsg) return sectMsg
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.f.requires)} dantian qi`
        return "Break through to Foundation"
    },
    row: 1,
    branches: ["q"],
    milestones: {
        0: {
            requirementDescription: realmReq("f", 0, "1 liquid qi"),
            done() { return player.f.best.gte(1) },
            effectDescription: "+50% scattered qi and dantian qi gain. Unlock journal.",
            onComplete() { unlockJournal("foundation") },
        },
        1: {
            requirementDescription: realmReq("f", 1, "15 liquid qi"),
            done() { return player.f.best.gte(15) },
            effectDescription: "+12% liquid qi, +8% scattered qi, +0.3% passive liquid qi. From your 3rd Foundation breakthrough onward, keep dantian qi arts when establishing Foundation.",
        },
        2: {
            requirementDescription: realmReq("f", 2, "45 liquid qi"),
            done() { return player.f.best.gte(45) },
            effectDescription: "Reveal Core Formation. −10% Core cost, +10% liquid qi.",
        },
        3: {
            requirementDescription: realmReq("f", 3, "130 liquid qi"),
            done() { return player.f.best.gte(130) },
            effectDescription: "From your 3rd Foundation breakthrough onward, keep Foundation arts when forming Core.",
        },
        4: {
            requirementDescription: realmReq("f", 4, "350 liquid qi"),
            done() { return player.f.best.gte(350) },
            effectDescription: "−12% Core cost, +18% liquid qi, faster Foundation prestige.",
        },
    },
    upgrades: {
        11: {
            title: "Meridian Refinement Scripture",
            description: "A sect hand-me-down turns liquid qi into gathering strength.",
            cost: new Decimal(3),
            effect() { return player.f.points.add(1).pow(0.45) },
            effectDisplay() { return format(upgradeEffect("f", 11)) + "x dantian qi" },
        },
        12: {
            title: "Establish a Foundation Pillar",
            description: "Raise an earthen pillar in your cave — double Foundation gain.",
            cost: new Decimal(10),
            unlocked() { return hasUpgrade("f", 11) },
        },
        13: {
            title: "Eightfold Vessel Inheritance",
            description: "An inherited vessel art boosts liquid qi from past breakthroughs.",
            cost: new Decimal(18),
            unlocked() { return hasMilestone("f", 1) },
            effect() { return player.f.best.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("f", 13)) + "x" },
        },
        21: {
            title: "Deep-Root Immortal Sutra",
            description: "Roots drink deep — liquid qi empowers scattered qi and Foundation.",
            cost: new Decimal(35),
            unlocked() { return hasMilestone("f", 1) },
            effect() { return player.f.points.add(1).pow(0.25) },
            effectDisplay() { return format(upgradeEffect("f", 21)) + "x scattered qi, " + format(player.f.points.add(1).pow(0.22)) + "x Foundation" },
        },
        22: {
            title: "Refine a Personal Pill Furnace",
            description: "A crude furnace still doubles Foundation condensation.",
            cost: new Decimal(60),
            unlocked() { return hasUpgrade("f", 21) },
        },
        23: {
            title: "Unbroken Meditation Platform",
            description: "Best dantian qi steadies the platform beneath you.",
            cost: new Decimal(90),
            unlocked() { return hasUpgrade("f", 22) },
            effect() { return player.q.best.add(1).pow(0.06) },
            effectDisplay() { return format(upgradeEffect("f", 23)) + "x" },
        },
        24: {
            title: "Qi-Nourished Jade Pillars",
            description: "Unspent qi seeps into jade pillars, strengthening Foundation.",
            cost: new Decimal(130),
            unlocked() { return hasUpgrade("f", 23) },
            effect() { return player.q.points.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("f", 24)) + "x" },
        },
        31: {
            title: "Tempered Foundation Body",
            description: "The body itself becomes the cauldron — double Foundation gain.",
            cost: new Decimal(220),
            unlocked() { return hasMilestone("f", 3) },
        },
        33: {
            title: "Steady Refinement Breathing",
            description: "Breath without interruption — 1% passive liquid qi per second (or learn the scripture from the Outer Tournament).",
            cost: new Decimal(360),
            unlocked() { return hasUpgrade("f", 31) },
        },
    },
    doReset(resettingLayer) {
        if (resettingLayer === "n") {
            layerDataReset("f", layerResetKeepForPrestige("f", "n"))
            return
        }
        layerResetInTree("f", resettingLayer)
    },
    hotkeys: [
        { key: "shift+f", description: "Shift+F: Establish Foundation", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    resetDescription: "Break through to Foundation and gain ",
    tabFormat: realmTab("Foundation Establishment stabilizes the first realm. At <b>World Rank 10</b>, become an <b>Outer Disciple</b> before breaking through."),
    layerShown() { return player.f.unlocked || hasMilestone("q", 2) },
})

addLayer("c", {
    name: "Core Formation",
    symbol: "C",
    position: 0,
    startData() { return {
        unlocked: false,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_CORE,
    requires() {
        const base = balanceRequires("c") || new Decimal(55)
        return withMilestoneRequires(base.times(typeof domainRequiresMultFor === "function" ? domainRequiresMultFor("c") : 1), "c")
    },
    resource: "core sparks",
    baseResource: "liquid qi",
    baseAmount() { return player.f.points },
    type: "normal",
    exponent() { return balanceExponent("c") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("c", 12)) mult = mult.times(2)
        if (hasUpgrade("c", 23)) mult = mult.times(player.c.points.add(1).pow(0.24))
        if (hasUpgrade("c", 24)) mult = mult.times(player.f.points.add(1).pow(0.16))
        if (hasUpgrade("c", 31)) mult = mult.times(2)
        if (hasUpgrade("g", 24)) mult = mult.times(player.g.points.add(1).pow(0.2))
        return mult.times(realmGainTail("c"))
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("c") : 0) },
    passiveGeneration() { return techniquePassive("c") },
    autoUpgrade() { return typeof artificerAutoLayers === "function" && artificerAutoLayers().includes("c") },
    canReset() {
        if (eventBlocksReset("c")) return false
        if (cultivationSectGateBlocksReset("c")) return false
        return tmp.c.baseAmount.gte(tmp.c.requires)
    },
    prestigeButtonText() {
        if (inEvent(23)) return "Stabilize the assigned core before breaking through again"
        if (inEvent(31)) return "Hold your core steady through the tribulation echo"
        const sectMsg = cultivationSectGateButtonText("c")
        if (sectMsg) return sectMsg
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.c.requires)} liquid qi`
        return "Form Core"
    },
    row: 2,
    branches: ["f"],
    milestones: {
        0: {
            requirementDescription: realmReq("c", 0, "1 core spark"),
            done() { return player.c.best.gte(1) },
            effectDescription: "+50% lower qi gains, +10% core sparks. Unlock journal.",
            onComplete() { unlockJournal("core") },
        },
        1: {
            requirementDescription: realmReq("c", 1, "25 core sparks"),
            done() { return player.c.best.gte(25) },
            effectDescription: "Unlock twin paths. +12% core sparks, −8% Ji/Golden cost. From your 3rd Core breakthrough onward, keep Foundation arts when forming Core.",
            onComplete() { unlockJournal("siblingChoice") },
        },
        2: {
            requirementDescription: realmReq("c", 2, "65 core sparks"),
            done() { return player.c.best.gte(65) },
            effectDescription: "+0.3% passive core sparks.",
        },
        3: {
            requirementDescription: realmReq("c", 3, "180 core sparks"),
            done() { return player.c.best.gte(180) },
            effectDescription: "From your 3rd Core breakthrough onward, keep dantian qi arts when forming Core. +20% core sparks, +0.6% passive core sparks, faster Core prestige.",
        },
    },
    upgrades: {
        11: {
            title: "Tribulation Spark Scripture",
            description: "The first spark of tribulation turns core light into scattered qi.",
            cost: new Decimal(2),
        },
        12: {
            title: "Golden Core Rotation Art",
            description: "Rotate the nascent core — double core spark gain.",
            cost: new Decimal(8),
            unlocked() { return hasUpgrade("c", 11) },
        },
        13: {
            title: "Quiet Thunder Inheritance",
            description: "Inherited thunder-breathing feeds liquid qi from core sparks.",
            cost: new Decimal(15),
            unlocked() { return hasMilestone("c", 1) },
            effect() { return player.c.points.add(1).pow(0.15) },
            effectDisplay() { return format(upgradeEffect("c", 13)) + "x liquid qi" },
        },
        22: {
            title: "Living Spirit Array Fragment",
            description: "A broken array still channels dantian qi.",
            cost: new Decimal(32),
            unlocked() { return hasMilestone("c", 2) },
            effect() { return player.c.points.add(1).pow(0.2) },
            effectDisplay() { return format(upgradeEffect("c", 22)) + "x dantian qi" },
        },
        23: {
            title: "Core Furnace Heart Manual",
            description: "The furnace heart beats — core sparks multiply themselves.",
            cost: new Decimal(55),
            unlocked() { return hasUpgrade("c", 22) },
            effect() { return player.c.points.add(1).pow(0.24) },
            effectDisplay() { return format(upgradeEffect("c", 23)) + "x" },
        },
        24: {
            title: "Foundation-Fed Golden Core",
            description: "Unspent Foundation qi stokes the core flame.",
            cost: new Decimal(85),
            unlocked() { return hasUpgrade("c", 23) },
            effect() { return player.f.points.add(1).pow(0.16) },
            effectDisplay() { return format(upgradeEffect("c", 24)) + "x" },
        },
        31: {
            title: "Tempered Golden Core Body",
            description: "The core hardens like immortal gold — double core gain.",
            cost: new Decimal(140),
            unlocked() { return hasMilestone("c", 3) },
        },
        32: {
            title: "Tribulation Memory Jade",
            description: "A jade slip records past tribulations, boosting core condensation.",
            cost: new Decimal(220),
            unlocked() { return hasUpgrade("c", 31) },
            effect() { return player.f.best.add(1).pow(0.1) },
            effectDisplay() { return format(upgradeEffect("c", 32)) + "x" },
        },
        33: {
            title: "Core Furnace Breathing",
            description: "1% passive core sparks per second (or learn the art from the Tribulation Echo trial).",
            cost: new Decimal(280),
            unlocked() { return hasUpgrade("c", 32) },
        },
    },
    clickables: {
        11: {
            title: "Open Ji Threads",
            display() { return "Begin weaving Ji Threads." },
            unlocked() { return hasMilestone("c", 1) },
            canClick() { return true },
            onClick() { player.j.unlocked = true },
        },
        12: {
            title: "Open Golden Progress",
            display() { return "Begin refining Golden Progress." },
            unlocked() { return hasMilestone("c", 1) },
            canClick() { return true },
            onClick() { player.g.unlocked = true },
        },
    },
    doReset(resettingLayer) {
        if (resettingLayer === "n") {
            layerDataReset("c", layerResetKeepForPrestige("c", "n"))
            return
        }
        layerResetInTree("c", resettingLayer)
    },
    tabFormat: [
        ["display-text", "<div class='realm-intro'>Core Formation opens two parallel preparations. At <b>World Rank 10</b>, become an <b>Inner Disciple</b> first. Complete both caps to form a Nascent Soul.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        "clickables",
    ],
    hotkeys: [
        { key: "shift+c", description: "Shift+C: Form Core", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    resetDescription: "Form a Core and gain ",
    layerShown() { return player.c.unlocked || hasMilestone("f", 2) },
    tooltipLocked() { return "Unlock from Foundation. Core breakthroughs require <b>Inner Disciple</b> at World Rank 10." },
})

addLayer("j", {
    name: "Ji Realm",
    symbol: "Ji",
    position: -0.5,
    startData() { return {
        unlocked: false,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_JI,
    requires() {
        const base = typeof twinPathRequiresDiscount === "function" ? twinPathRequiresDiscount("j") : new Decimal(5500)
        return withMilestoneRequires(base.times(typeof domainRequiresMultFor === "function" ? domainRequiresMultFor("j") : 1), "j")
    },
    getResetGain() { return typeof getTwinPathResetGain === "function" ? getTwinPathResetGain("j") : getResetGain("j") },
    canReset() {
        if (typeof twinPathAtCap === "function" && twinPathAtCap("j")) return false
        if (cultivationSectGateBlocksReset("j")) return false
        return tmp.j.baseAmount.gte(tmp.j.requires)
    },
    prestigeButtonText() {
        if (typeof twinPathAtCap === "function" && twinPathAtCap("j")) return "Ji Realm at Great Circle (cap)"
        const sectMsg = cultivationSectGateButtonText("j")
        if (sectMsg) return sectMsg
        if (!tmp.j.baseAmount.gte(tmp.j.requires)) return `Need ${formatWhole(tmp.j.requires)} core sparks`
        return "Weave Ji Threads"
    },
    resource: "Ji threads",
    baseResource: "core sparks",
    baseAmount() { return player.c.points },
    type: "normal",
    exponent() { return balanceExponent("j") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("j", 11)) mult = mult.times(2)
        if (hasUpgrade("j", 12)) mult = mult.times(2)
        if (hasUpgrade("j", 24)) mult = mult.times(player.c.points.add(1).pow(0.18))
        if (hasUpgrade("j", 31)) mult = mult.times(2)
        return mult.times(realmGainTail("j")).times(typeof nirvanaBlightMult === "function" ? nirvanaBlightMult("j") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("j") : 0) },
    row: 3,
    branches: ["c"],
    milestones: {
        0: {
            requirementDescription: realmReq("j", 0, "1 Ji thread"),
            done() { return player.j.best.gte(1) },
            effectDescription: "+15% Ji gain and +10% core spark gain.",
        },
        1: {
            requirementDescription: realmReq("j", 1, "5 Ji threads"),
            done() { return player.j.best.gte(5) },
            effectDescription: "+12% Ji gain, +8% core sparks, faster Ji prestige. Weave up to 3 Ji threads per breakthrough. From your 3rd Ji breakthrough onward, keep Core arts when weaving Ji.",
        },
        3: {
            requirementDescription: realmReq("j", 3, "10 Ji threads"),
            done() { return player.j.best.gte(10) },
            effectDescription: "+15% Ji gain. From your 3rd Ji breakthrough onward, keep Ji arts through Nascent resets.",
        },
        4: {
            requirementDescription: realmReq("j", 4, "15 Ji threads"),
            done() { return player.j.best.gte(15) },
            effectDescription: "−12% Golden/Nascent cost, +12% Ji gain. From your 3rd Ji breakthrough onward, keep dantian qi arts when weaving Ji.",
        },
        5: {
            requirementDescription: realmReq("j", 5, "20 Ji threads (cap)"),
            done() { return player.j.best.gte(20) },
            effectDescription: "+25% Ji gain. Enables Nascent Soul breakthrough at Great Circle.",
        },
    },
    upgrades: {
        11: {
            title: "Extreme Will Inheritance",
            description: "An ancestral blade intent doubles Ji thread weaving.",
            cost: new Decimal(8),
        },
        12: {
            title: "Blade Thought Breathing",
            description: "Thought becomes blade — double Ji gain and sharpen the twin path.",
            cost: new Decimal(22),
            unlocked() { return hasMilestone("j", 1) },
        },
        22: {
            title: "Unbroken Foundation Echo",
            description: "Ji intent echoes through Foundation, strengthening liquid qi.",
            cost: new Decimal(55),
            unlocked() { return hasMilestone("j", 1) },
            effect() { return player.j.points.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("j", 22)) + "x liquid qi" },
        },
        23: {
            title: "Extreme Meridian Pressure Art",
            description: "Meridians strain under will — Ji threads boost Foundation.",
            cost: new Decimal(55),
            unlocked() { return hasUpgrade("j", 22) },
            effect() { return player.j.points.add(1).pow(0.18) },
            effectDisplay() { return format(upgradeEffect("j", 23)) + "x" },
        },
        24: {
            title: "Core-Cutting Intent",
            description: "Intent cuts through the core — unspent sparks sharpen Ji threads.",
            cost: new Decimal(80),
            unlocked() { return hasUpgrade("j", 23) },
            effect() { return player.c.points.add(1).pow(0.18) },
            effectDisplay() { return format(upgradeEffect("j", 24)) + "x" },
        },
        31: {
            title: "Single-Thought Scripture",
            description: "One thought, one blade — double Ji gain after 10 threads.",
            cost: new Decimal(40),
            unlocked() { return hasMilestone("j", 3) },
        },
        32: {
            title: "Will That Does Not Spill",
            description: "Past tribulation cores lend strength to Ji weaving.",
            cost: new Decimal(220),
            unlocked() { return hasUpgrade("j", 31) },
            effect() { return player.c.best.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("j", 32)) + "x" },
        },
    },
    doReset(resettingLayer) {
        if (resettingLayer === "n") {
            layerDataReset("j", layerResetKeepForPrestige("j", "n"))
            return
        }
        if (resettingLayer !== "g") layerResetInTree("j", resettingLayer)
    },
    tabFormat: realmTab("Ji Realm at <b>World Rank 10</b>: first twin path needs <b>Sect Elder</b>; the second needs <b>Sect Leader</b>. Weave <b>1 thread</b> per breakthrough; cap <b>20</b> at Great Circle."),
    layerShown() { return player.j.unlocked || hasMilestone("c", 1) },
    tooltipLocked() { return "Unlock from Core Formation." },
    hotkeys: [
        { key: "shift+j", description: "Shift+J: Weave Ji Threads", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    resetDescription: "Weave Ji Threads and gain ",
})

addLayer("g", {
    name: "Perfect Golden Core",
    symbol: "PGC",
    position: 0.5,
    startData() { return {
        unlocked: false,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_GOLD,
    requires() {
        const base = typeof twinPathRequiresDiscount === "function" ? twinPathRequiresDiscount("g") : new Decimal(5500)
        return withMilestoneRequires(base.times(typeof domainRequiresMultFor === "function" ? domainRequiresMultFor("g") : 1), "g")
    },
    getResetGain() { return typeof getTwinPathResetGain === "function" ? getTwinPathResetGain("g") : getResetGain("g") },
    canReset() {
        if (typeof twinPathAtCap === "function" && twinPathAtCap("g")) return false
        if (cultivationSectGateBlocksReset("g")) return false
        return tmp.g.baseAmount.gte(tmp.g.requires)
    },
    prestigeButtonText() {
        if (typeof twinPathAtCap === "function" && twinPathAtCap("g")) return "Perfect Golden Core reached (cap)"
        const sectMsg = cultivationSectGateButtonText("g")
        if (sectMsg) return sectMsg
        if (!tmp.g.baseAmount.gte(tmp.g.requires)) return `Need ${formatWhole(tmp.g.requires)} core sparks`
        return "Refine Golden Progress"
    },
    resource: "golden progress",
    baseResource: "core sparks",
    baseAmount() { return player.c.points },
    type: "normal",
    exponent() { return balanceExponent("g") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("g", 11)) mult = mult.times(2)
        if (hasUpgrade("g", 12)) mult = mult.times(2)
        if (hasUpgrade("g", 24)) mult = mult.times(player.c.points.add(1).pow(0.18))
        if (hasUpgrade("g", 31)) mult = mult.times(2)
        return mult.times(realmGainTail("g")).times(typeof nirvanaBlightMult === "function" ? nirvanaBlightMult("g") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("g") : 0) },
    row: 3,
    branches: ["c"],
    milestones: {
        0: {
            requirementDescription: realmReq("g", 0, "1 golden progress"),
            done() { return player.g.best.gte(1) },
            effectDescription: "+15% golden progress gain.",
        },
        1: {
            requirementDescription: realmReq("g", 1, "5 golden progress"),
            done() { return player.g.best.gte(5) },
            effectDescription: "+12% golden progress, +8% core sparks, faster Golden prestige. Refine up to 3 progress per breakthrough. From your 3rd Golden breakthrough onward, keep Core arts when refining Golden progress.",
        },
        3: {
            requirementDescription: realmReq("g", 3, "10 golden progress"),
            done() { return player.g.best.gte(10) },
            effectDescription: "+15% golden progress. From your 3rd Golden breakthrough onward, keep Golden arts through Nascent resets.",
        },
        4: {
            requirementDescription: realmReq("g", 4, "15 golden progress"),
            done() { return player.g.best.gte(15) },
            effectDescription: "−12% Ji/Nascent cost, +12% golden progress. From your 3rd Golden breakthrough onward, keep dantian qi arts when refining Golden progress.",
        },
        5: {
            requirementDescription: realmReq("g", 5, "20 golden progress (cap)"),
            done() { return player.g.best.gte(20) },
            effectDescription: "+25% golden progress. Enables Nascent Soul breakthrough at Perfect Golden Core.",
        },
    },
    upgrades: {
        11: {
            title: "Flawless Sun Rotation",
            description: "The inner sun turns without flaw — double golden progress.",
            cost: new Decimal(8),
        },
        12: {
            title: "Sunlit Dantian Breathing",
            description: "Light fills the dantian — double golden progress.",
            cost: new Decimal(22),
            unlocked() { return hasMilestone("g", 1) },
        },
        22: {
            title: "Unbroken Core Reflection",
            description: "Golden light reflects through Foundation, strengthening liquid qi.",
            cost: new Decimal(55),
            unlocked() { return hasMilestone("g", 1) },
            effect() { return player.g.points.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("g", 22)) + "x liquid qi" },
        },
        23: {
            title: "Golden Insight Halo",
            description: "A halo of insight turns golden progress into scattered qi.",
            cost: new Decimal(55),
            unlocked() { return hasUpgrade("g", 22) },
            effect() { return player.g.points.add(1).pow(0.2) },
            effectDisplay() { return format(upgradeEffect("g", 23)) + "x scattered qi" },
        },
        24: {
            title: "Core-Nourished Inner Sun",
            description: "Core sparks feed the sun — golden progress and core gain rise together.",
            cost: new Decimal(80),
            unlocked() { return hasUpgrade("g", 23) },
            effect() { return player.c.points.add(1).pow(0.18) },
            effectDisplay() { return format(upgradeEffect("g", 24)) + "x PGC, " + format(player.g.points.add(1).pow(0.2)) + "x Core" },
        },
        31: {
            title: "Solar Core Scripture",
            description: "A scripture of the inner sun — double golden progress after 10 best.",
            cost: new Decimal(40),
            unlocked() { return hasMilestone("g", 3) },
        },
        32: {
            title: "Light That Does Not Spill",
            description: "Tribulation cores remember the sun's rotation.",
            cost: new Decimal(180),
            unlocked() { return hasUpgrade("g", 31) },
            effect() { return player.c.best.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("g", 32)) + "x" },
        },
    },
    doReset(resettingLayer) {
        if (resettingLayer === "n") {
            layerDataReset("g", layerResetKeepForPrestige("g", "n"))
            return
        }
        if (resettingLayer !== "j") layerResetInTree("g", resettingLayer)
    },
    tabFormat: realmTab("Perfect Golden Core at <b>World Rank 10</b>: first twin path needs <b>Sect Elder</b>; the second needs <b>Sect Leader</b>. Gain <b>1 progress</b> per breakthrough; cap <b>20</b>."),
    layerShown() { return player.g.unlocked || hasMilestone("c", 1) },
    tooltipLocked() { return "Unlock from Core Formation." },
    hotkeys: [
        { key: "shift+g", description: "Shift+G: Refine Golden Progress", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    resetDescription: "Refine Golden Progress and gain ",
})

addLayer("n", {
    name: "Nascent Soul",
    symbol: "NS",
    position: 0,
    startData() { return {
        unlocked: false,
		points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_NASCENT,
    requires: new Decimal(1),
    resource: "nascent souls",
    baseResource: "completed preparations",
    baseAmount() { return (hasMilestone("j", 5) && hasMilestone("g", 5)) ? new Decimal(1) : new Decimal(0) },
    type: "normal",
    exponent() { return balanceExponent("n") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("n", 13)) mult = mult.times(1.5)
        if (hasUpgrade("n", 14)) mult = mult.times(1.25)
        if (hasUpgrade("n", 21)) mult = mult.times(player.n.points.add(1).pow(0.5))
        if (hasUpgrade("n", 24)) mult = mult.times(player.c.best.add(1).pow(0.06))
        if (hasUpgrade("n", 33)) mult = mult.times(1.5)
        if (hasUpgrade("n", 41)) mult = mult.times(player.n.points.add(1).pow(0.35))
        if (typeof restrictionGainMult === "function") mult = mult.times(restrictionGainMult("n"))
        if (typeof domainBoost === "function") mult = mult.times(domainBoost("n"))
        return mult
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("n") : 0) },
    canReset() {
        if (cultivationSectGateBlocksReset("n")) return false
        return tmp.n.baseAmount.gte(tmp.n.requires)
    },
    prestigeButtonText() {
        if (!(hasMilestone("j", 5) && hasMilestone("g", 5))) return "Complete Ji and Golden Great Circles first"
        const sectMsg = cultivationSectGateButtonText("n")
        if (sectMsg) return sectMsg
        if (!tmp.n.baseAmount.gte(tmp.n.requires)) return "Twin preparations incomplete"
        return "Form Nascent Soul"
    },
    row: 4,
    branches: ["j", "g"],
    milestones: {
        0: {
            requirementDescription: realmReq("n", 0, "1 nascent soul"),
            done() { return player.n.best.gte(1) },
            effectDescription: "Lower realms ×10. Choose a profession Dao.",
            onComplete() { if (typeof onNascentSoulFormed === "function") onNascentSoulFormed() },
        },
        1: {
            requirementDescription: realmReq("n", 1, "2 nascent souls"),
            done() { return player.n.best.gte(2) },
            effectDescription: "Lower realm gains ×1.75 more. From your 3rd Nascent breakthrough onward, keep Core arts when forming Nascent Soul.",
        },
        2: {
            requirementDescription: realmReq("n", 2, "4 nascent souls"),
            done() { return player.n.best.gte(4) },
            effectDescription: "+15% Nascent gain, −5% profession breakthrough cost. From your 3rd Nascent breakthrough onward, keep Foundation arts when forming Nascent Soul.",
        },
        3: {
            requirementDescription: realmReq("n", 3, "8 nascent souls"),
            done() { return player.n.best.gte(8) },
            effectDescription: "+12% scattered qi rebuild after higher resets. From your 3rd Nascent breakthrough onward, keep dantian qi arts when forming Nascent Soul.",
        },
        4: {
            requirementDescription: realmReq("n", 4, "15 nascent souls"),
            done() { return player.n.best.gte(15) },
            effectDescription: "+20% Nascent gain, faster Nascent prestige. From your 3rd Nascent breakthrough onward, keep Ji and Golden arts when forming Nascent Soul.",
        },
        5: {
            requirementDescription: realmReq("n", 5, "25 nascent souls"),
            done() { return player.n.best.gte(25) },
            effectDescription: "Lower realms ×1.2. From your 3rd Nascent breakthrough onward, keep profession arts when forming Nascent Soul.",
        },
        6: {
            requirementDescription: realmReq("n", 6, "40 nascent souls"),
            done() { return player.n.best.gte(40) },
            effectDescription: "+35% Nascent gain, +15% lower realm rebuild.",
        },
    },
    upgrades: {
        11: {
            title: "Infant Soul Breathing Art",
            description: "The newborn soul breathes — multiply all lower realm gains by 1.75.",
            cost: new Decimal(1),
            unlocked() { return hasMilestone("n", 0) },
        },
        12: {
            title: "Soul-Seated Epiphany",
            description: "Seated in silence, the soul amplifies every breath of cultivation.",
            cost: new Decimal(1),
            unlocked() { return hasUpgrade("n", 11) },
            effect() { return player.n.points.add(1).pow(0.5) },
            effectDisplay() { return format(upgradeEffect("n", 12)) + "x" },
        },
        13: {
            title: "Second Life Foundation Inheritance",
            description: "An inherited second-life manual quickens Nascent Soul formation.",
            cost: new Decimal(2),
            unlocked() { return hasMilestone("n", 1) },
        },
        14: {
            title: "Memory of the First Path",
            description: "The soul remembers every past breakthrough — lower realms ×1.35.",
            cost: new Decimal(3),
            unlocked() { return hasUpgrade("n", 13) },
        },
        21: {
            title: "Soul Multiplication Scripture",
            description: "Each nascent soul makes the next easier to form.",
            cost: new Decimal(4),
            unlocked() { return hasUpgrade("n", 14) },
            effect() { return player.n.points.add(1).pow(0.5) },
            effectDisplay() { return format(upgradeEffect("n", 21)) + "x Nascent gain" },
        },
        22: {
            title: "Nascent World Seed",
            description: "A seed-world inside the soul feeds scattered spiritual energy.",
            cost: new Decimal(6),
            unlocked() { return hasMilestone("n", 2) },
            effect() { return player.n.points.add(1).pow(0.25) },
            effectDisplay() { return format(upgradeEffect("n", 22)) + "x scattered qi" },
        },
        23: {
            title: "Canopy Soul Scripture",
            description: "Scriptures of the canopy soul deepen Nascent refinement.",
            cost: new Decimal(8),
            unlocked() { return hasUpgrade("n", 22) },
        },
        24: {
            title: "Balanced Twin Preparations Recall",
            description: "Memories of Ji and Golden paths steady the next Nascent breakthrough.",
            cost: new Decimal(12),
            unlocked() { return hasUpgrade("n", 23) },
            effect() { return player.c.best.add(1).pow(0.06) },
            effectDisplay() { return format(upgradeEffect("n", 24)) + "x Nascent gain" },
        },
        31: {
            title: "Soul Anchor Talisman",
            description: "A talisman anchors the soul through the storm of reset.",
            cost: new Decimal(15),
            unlocked() { return hasMilestone("n", 4) },
        },
        32: {
            title: "Seed of Soul Formation",
            description: "A forbidden glimpse of the next realm — scattered qi scales with nascent souls.",
            cost: new Decimal(20),
            unlocked() { return hasUpgrade("n", 31) },
            effect() { return player.n.points.add(1).pow(0.3) },
            effectDisplay() { return format(upgradeEffect("n", 32)) + "x scattered qi" },
        },
        33: {
            title: "Heaven-Defying Nascent Art",
            description: "×1.5 Nascent Soul gain after anchoring the soul.",
            cost: new Decimal(28),
            unlocked() { return hasUpgrade("n", 32) },
        },
        34: {
            title: "Immortal Tree Communion",
            description: "The tree shares a sliver of its root-vein — lower realms ×1.2.",
            cost: new Decimal(35),
            unlocked() { return hasMilestone("n", 5) },
        },
        41: {
            title: "Soul Manifestation Glimpse",
            description: "The soul walks briefly outside the flesh, boosting future Nascent gain.",
            cost: new Decimal(45),
            unlocked() { return hasMilestone("n", 6) },
            effect() { return player.n.points.add(1).pow(0.35) },
            effectDisplay() { return format(upgradeEffect("n", 41)) + "x Nascent gain" },
        },
        42: {
            title: "Bridge to Soul Formation (Sealed)",
            description: "A sealed gate toward Soul Formation — placeholder for the next realm arc.",
            cost: new Decimal(60),
            unlocked() { return hasUpgrade("n", 41) },
        },
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("n", ["milestones", "upgrades"])
        }
    },
    resetDescription: "Form Nascent Soul and gain ",
    layerShown() { return player.n.unlocked || (hasMilestone("j", 5) && hasMilestone("g", 5)) },
    tabFormat: [
        ["display-text", "<div class='realm-intro'>Nascent Soul opens the road ahead — choose a profession Dao below, then Domain and Soul Formation. Later realms on the tree and roadmap unlock as you cultivate.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        ["display-text", function() {
            if (!hasMilestone("n", 0)) {
                const gate = cultivationSectGate("n")
                let msg = "Complete Ji Realm · Great Circle and Perfect Golden Core, then form your first Nascent Soul."
                if (!gate.ok) msg += ` <i>(${gate.message}.)</i>`
                return msg
            }
            if (!player.professionPrimary) return "<b>Profession choice open:</b> open Alchemy, Artificer, or Restrictions Master on the tree and commit to one Dao."
            let msg = `<b>Active profession Daos:</b> ${[player.professionPrimary, player.professionSecondary, player.professionTertiary].filter(Boolean).map(professionName).join(", ") || "none"}.`
            if (!player.professionSecondary && !hasMilestone("sf", 3)) msg += " <i>Second Dao unlocks at Soul Formation milestone (1,000 divinities + Second Life).</i>"
            else if (player.professionSecondary && !player.professionTertiary && !stThirdProfessionUnlocked()) msg += " <i>Third Dao unlocks at ST Peak (four active incarnations, 10 path progress).</i>"
            return msg
        }],
    ],
    hotkeys: [
        { key: "shift+n", description: "Shift+N: Form Nascent Soul", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
})

const COLOR_ALCHEMY = "#e88fd4"
const COLOR_ARTIFICER = "#ffb366"
const COLOR_RESTRICTION = "#9b8cff"

function professionLayerTab(intro) {
    return [
        ["display-text", `<div class="realm-intro">${intro}</div>`],
        ["display-text", function() { return professionDaoGateHTML() }],
        "clickables",
        ["blank", "8px"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
    ]
}

addLayer("al", {
    name: "Alchemy",
    symbol: "Al",
    position: -0.55,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_ALCHEMY,
    requires() { return withMilestoneRequires(new Decimal(1), "al") },
    resource: "refined essences",
    baseResource: "nascent souls",
    baseAmount() { return player.n.points },
    type: "normal",
    exponent: 0.5,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("al", 12)) mult = mult.times(1.75)
        if (hasUpgrade("al", 22)) mult = mult.times(player.al.points.add(1).pow(0.2))
        if (typeof domainBoost === "function") mult = mult.times(domainBoost("al"))
        return mult.times(typeof milestoneGainMult === "function" ? milestoneGainMult("al") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("al") : 0) },
    row: 5,
    branches: ["n"],
    clickables: {
        11: {
            title: "Walk the Alchemy Dao",
            display() { return professionChoiceHTML("al", "elixir arts and scattered spiritual energy") },
            unlocked() { return professionLayerShown("al") },
            canClick() { return professionChoiceOpen(1) || professionChoiceOpen(2) || professionChoiceOpen(3) },
            onClick() { chooseProfession("al") },
        },
    },
    milestones: {
        0: { requirementDescription: realmReq("al", 0, "1 refined essence"), done() { return player.al.best.gte(1) }, effectDescription: "+12% essence gain, −5% profession cost." },
        1: { requirementDescription: realmReq("al", 1, "5 refined essences"), done() { return player.al.best.gte(5) }, effectDescription: "+15% gain, −8% cost. Keep alchemy arts through Nascent resets." },
        2: { requirementDescription: realmReq("al", 2, "15 refined essences"), done() { return player.al.best.gte(15) }, effectDescription: "+20% gain, −12% cost, faster profession prestige." },
    },
    upgrades: {
        11: { title: "Found a Crude Pill Cauldron", description: "+15% scattered spiritual energy (Alchemy specialty).", cost: new Decimal(1), unlocked() { return hasProfession("al") } },
        12: { title: "Learn the Spirit-Gathering Pill Formula", description: "Double refined essence gain.", cost: new Decimal(2), unlocked() { return hasUpgrade("al", 11) } },
        13: { title: "Refine a Qi-Returning Elixir", description: "Refined essences boost scattered qi further.", cost: new Decimal(4), unlocked() { return hasUpgrade("al", 12) },
            effect() { return player.al.points.add(1).pow(0.12) }, effectDisplay() { return format(upgradeEffect("al", 13)) + "x scattered qi" },
        },
        21: { title: "Grand Elixir Ledger", description: "+15% scattered spiritual energy.", cost: new Decimal(8), unlocked() { return hasMilestone("al", 1) } },
        22: { title: "Nine-Vein Spirit Herb Garden", description: "Herbs multiply elixir refinement.", cost: new Decimal(12), unlocked() { return hasUpgrade("al", 13) },
            effect() { return player.al.points.add(1).pow(0.15) }, effectDisplay() { return format(upgradeEffect("al", 22)) + "x essence gain" },
        },
        23: { title: "Heaven-Grade Qi Pill Recipe", description: "+35% scattered qi.", cost: new Decimal(20), unlocked() { return hasUpgrade("al", 22) } },
        31: { title: "Immortal Dew Cauldron", description: "+20% scattered spiritual energy at master rank.", cost: new Decimal(35), unlocked() { return hasMilestone("al", 2) } },
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) layerResetInTree("al", resettingLayer)
    },
    layerShown() { return professionLayerShown("al") },
    canReset() {
        if (cultivationSectGateBlocksReset("al")) return false
        return hasProfession("al") && tmp.al.baseAmount.gte(tmp.al.requires)
    },
    prestigeButtonText() {
        const sectMsg = cultivationSectGateButtonText("al")
        if (sectMsg) return sectMsg
        if (!hasProfession("al")) return "Walk the Alchemy Dao first"
        if (!tmp.al.baseAmount.gte(tmp.al.requires)) return `Need ${formatWhole(tmp.al.requires)} nascent souls`
        return "Refine essences"
    },
    tabFormat: professionLayerTab("Alchemists refine essences into elixirs that swell scattered spiritual energy. A second Dao opens at Soul Formation; a third at Soul Transformation."),
    hotkeys: [{ key: "shift+a", description: "Shift+A: Refine essences (Alchemy)", onPress() { if (canReset(this.layer)) doReset(this.layer) } }],
    resetDescription: "Refine essences and gain ",
})

addLayer("ar", {
    name: "Artificer",
    symbol: "Ar",
    position: 0,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_ARTIFICER,
    requires() { return withMilestoneRequires(new Decimal(1), "ar") },
    baseResource: "nascent souls",
    baseAmount() { return player.n.points },
    type: "normal",
    exponent: 0.5,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("ar", 12)) mult = mult.times(1.75)
        if (hasUpgrade("ar", 22)) mult = mult.times(player.ar.points.add(1).pow(0.18))
        if (typeof domainBoost === "function") mult = mult.times(domainBoost("ar"))
        return mult.times(typeof milestoneGainMult === "function" ? milestoneGainMult("ar") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("ar") : 0) },
    row: 5,
    branches: ["n"],
    clickables: {
        11: {
            title: "Walk the Artificer Dao",
            display() { return professionChoiceHTML("ar", "automation talismans and passive cultivation") },
            unlocked() { return professionLayerShown("ar") },
            canClick() { return professionChoiceOpen(1) || professionChoiceOpen(2) || professionChoiceOpen(3) },
            onClick() { chooseProfession("ar") },
        },
    },
    milestones: {
        0: { requirementDescription: realmReq("ar", 0, "1 forged instrument"), done() { return player.ar.best.gte(1) }, effectDescription: "+12% instrument gain, −5% profession cost." },
        1: { requirementDescription: realmReq("ar", 1, "5 forged instruments"), done() { return player.ar.best.gte(5) }, effectDescription: "+15% gain, −8% cost. Keep artificer arts through Nascent resets." },
        2: { requirementDescription: realmReq("ar", 2, "15 forged instruments"), done() { return player.ar.best.gte(15) }, effectDescription: "+20% gain, −12% cost, faster profession prestige." },
    },
    upgrades: {
        11: { title: "Forge a Spirit-Gathering Talisman", description: "+25% passive cultivation % (Artificer specialty).", cost: new Decimal(1), unlocked() { return hasProfession("ar") } },
        12: { title: "Inherit a Tool-Smith's Manual", description: "Double forged instrument gain.", cost: new Decimal(2), unlocked() { return hasUpgrade("ar", 11) } },
        13: { title: "Automaton Assistant Golem", description: "+20% passive cultivation speed.", cost: new Decimal(4), unlocked() { return hasUpgrade("ar", 12) } },
        21: { title: "Self-Buying Upgrade Array", description: "Auto-buy Qi layer arts while this Dao is active.", cost: new Decimal(8), unlocked() { return hasMilestone("ar", 1) } },
        22: { title: "Foundation Automation Furnace", description: "Auto-buy Foundation arts; +20% passive %.", cost: new Decimal(12), unlocked() { return hasUpgrade("ar", 13) } },
        23: { title: "Core & Sect Automation Plate", description: "Auto-buy Core and Sect arts; +35% passive %.", cost: new Decimal(20), unlocked() { return hasUpgrade("ar", 22) } },
        31: { title: "Masterwork Spirit Compass", description: "+25% passive cultivation % at master rank.", cost: new Decimal(35), unlocked() { return hasMilestone("ar", 2) } },
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) layerResetInTree("ar", resettingLayer)
    },
    layerShown() { return professionLayerShown("ar") },
    canReset() {
        if (cultivationSectGateBlocksReset("ar")) return false
        return hasProfession("ar") && tmp.ar.baseAmount.gte(tmp.ar.requires)
    },
    prestigeButtonText() {
        const sectMsg = cultivationSectGateButtonText("ar")
        if (sectMsg) return sectMsg
        if (!hasProfession("ar")) return "Walk the Artificer Dao first"
        if (!tmp.ar.baseAmount.gte(tmp.ar.requires)) return `Need ${formatWhole(tmp.ar.requires)} nascent souls`
        return "Forge instruments"
    },
    tabFormat: professionLayerTab("Artificers forge instruments that accelerate passive gathering and automate repetitive cultivation. Further Daos require Soul Formation and Soul Transformation."),
    hotkeys: [{ key: "shift+b", description: "Shift+B: Forge instruments (Artificer)", onPress() { if (canReset(this.layer)) doReset(this.layer) } }],
    resetDescription: "Forge instruments and gain ",
})

addLayer("re", {
    name: "Restrictions Master",
    symbol: "Rx",
    position: 0.55,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_RESTRICTION,
    requires() { return withMilestoneRequires(new Decimal(1), "re") },
    baseResource: "nascent souls",
    baseAmount() { return player.n.points },
    type: "normal",
    exponent: 0.5,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("re", 12)) mult = mult.times(1.75)
        if (hasUpgrade("re", 22)) mult = mult.times(player.re.points.add(1).pow(0.15))
        if (typeof domainBoost === "function") mult = mult.times(domainBoost("re"))
        return mult.times(typeof milestoneGainMult === "function" ? milestoneGainMult("re") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("re") : 0) },
    row: 5,
    branches: ["n"],
    clickables: {
        11: {
            title: "Walk the Restrictions Dao",
            display() { return professionChoiceHTML("re", "array arts that soften the cost of prestige") },
            unlocked() { return professionLayerShown("re") },
            canClick() { return professionChoiceOpen(1) || professionChoiceOpen(2) || professionChoiceOpen(3) },
            onClick() { chooseProfession("re") },
        },
    },
    milestones: {
        0: { requirementDescription: realmReq("re", 0, "1 array inscription"), done() { return player.re.best.gte(1) }, effectDescription: "+12% inscription gain, −5% profession cost." },
        1: { requirementDescription: realmReq("re", 1, "5 array inscriptions"), done() { return player.re.best.gte(5) }, effectDescription: "+15% gain, −8% cost. Keep restriction arts through Nascent resets." },
        2: { requirementDescription: realmReq("re", 2, "15 array inscriptions"), done() { return player.re.best.gte(15) }, effectDescription: "+20% gain, −12% cost, faster profession prestige." },
    },
    upgrades: {
        11: { title: "Draw a Gathering Lighter Array", description: "Lower prestige requirements by 4% (Restrictions specialty).", cost: new Decimal(1), unlocked() { return hasProfession("re") } },
        12: { title: "Found a Lost Restriction Scripture", description: "Double array inscription gain.", cost: new Decimal(2), unlocked() { return hasUpgrade("re", 11) } },
        13: { title: "Preserve Arts Through Qi Reset", description: "From your 3rd Foundation breakthrough onward, keep dantian qi arts when establishing Foundation (stacks with Foundation milestones).", cost: new Decimal(4), unlocked() { return hasUpgrade("re", 12) } },
        21: { title: "Foundation-Locking Array", description: "From your 3rd Core breakthrough onward, keep Foundation arts when forming Core; requirements −5%.", cost: new Decimal(8), unlocked() { return hasMilestone("re", 1) } },
        22: { title: "Core Preservation Inscription", description: "From your 3rd Ji/Golden breakthrough onward, keep Core arts through twin-path resets.", cost: new Decimal(12), unlocked() { return hasUpgrade("re", 21) } },
        23: { title: "Twin-Path Memory Seal", description: "From your 3rd Nascent breakthrough onward, keep Ji and Golden arts when forming Nascent Soul.", cost: new Decimal(20), unlocked() { return hasUpgrade("re", 22) } },
        24: { title: "Nascent Softening Talisman", description: "+10% prestige gain on all cultivation layers.", cost: new Decimal(16), unlocked() { return hasUpgrade("re", 22) } },
        31: { title: "Heaven-Defying Restriction Array", description: "Keep Core-layer arts through higher resets.", cost: new Decimal(35), unlocked() { return hasMilestone("re", 2) } },
        32: { title: "Immortal Gate Inscription", description: "Array inscriptions further soften breakthrough gates and boost prestige gain.", cost: new Decimal(45), unlocked() { return hasUpgrade("re", 31) } },
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) layerResetInTree("re", resettingLayer)
    },
    layerShown() { return professionLayerShown("re") },
    canReset() {
        if (cultivationSectGateBlocksReset("re")) return false
        return hasProfession("re") && tmp.re.baseAmount.gte(tmp.re.requires)
    },
    prestigeButtonText() {
        const sectMsg = cultivationSectGateButtonText("re")
        if (sectMsg) return sectMsg
        if (!hasProfession("re")) return "Walk the Restrictions Dao first"
        if (!tmp.re.baseAmount.gte(tmp.re.requires)) return `Need ${formatWhole(tmp.re.requires)} nascent souls`
        return "Inscribe arrays"
    },
    tabFormat: professionLayerTab("Restriction masters inscribe arrays that preserve arts through resets and lower breakthrough requirements. Soul Formation and Soul Transformation open additional Daos."),
    hotkeys: [{ key: "shift+r", description: "Shift+R: Inscribe arrays (Restrictions)", onPress() { if (canReset(this.layer)) doReset(this.layer) } }],
    resetDescription: "Inscribe arrays and gain ",
})

const COLOR_DOMAIN = "#c4a8ff"

function domainTabContent(domainId, intro, chooseFlavor, challengeIds, color) {
    return [
        ["display-text", `<div class="realm-intro">${intro}</div>`],
        ["clickables", [domainId]],
        ["blank", "8px"],
        ["challenges", challengeIds],
    ]
}

addLayer("dom", {
    name: "Domain",
    symbol: "Dm",
    position: 0,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_DOMAIN,
    type: "none",
    row: 6,
    branches: ["n"],
    clickables: typeof initDomainClickables === "function" ? initDomainClickables() : {},
    milestones: {
        0: {
            requirementDescription: "1 domain trial complete",
            done() { return domainMilestoneMet(0) },
            effectDescription: "+5% all cultivation gain (stacks with trial rewards).",
        },
        1: {
            requirementDescription: "2 domain trials complete",
            done() { return domainMilestoneMet(1) },
            effectDescription: "+5% gain and faster rebuild after Domain resets.",
        },
        2: {
            requirementDescription: "3 domain trials complete",
            done() { return domainMilestoneMet(2) },
            effectDescription: "+6% gain and +0.3% passive on linked layers.",
        },
        3: {
            requirementDescription: "4 domain trials complete",
            done() { return domainMilestoneMet(3) },
            effectDescription: "+6% gain and −5% breakthrough requirements.",
        },
        4: {
            requirementDescription: "6 domain trials complete",
            done() { return domainMilestoneMet(4) },
            effectDescription: "+8% gain and −7% breakthrough requirements.",
        },
        5: {
            requirementDescription: "8 domain trials complete (capstone)",
            done() { return domainMilestoneMet(5) },
            effectDescription: "+10% gain, −10% requirements. Break through to Soul Formation.",
        },
    },
    challenges: buildDomainChallenges(),
    shouldNotify() {
        if (!tmp.dom || !tmp.dom.challenges) return false
        if (canFormDomain()) return true
        if (domainAnyChoiceOpen && domainAnyChoiceOpen()) return true
        if (domainChoiceOpen(1) || domainChoiceOpen(2) || domainChoiceOpen(3)) return true
        for (const id in tmp.dom.challenges) {
            if (tmp.dom.challenges[id].unlocked && !maxedChallenge("dom", id) && !inChallenge("dom", id)) return true
        }
        if (player.dom.activeChallenge && canCompleteChallenge("dom", player.dom.activeChallenge)) return true
        return false
    },
    microtabs: {
        domains: typeof initDomainMicrotabs === "function" ? initDomainMicrotabs() : {},
    },
    tabFormat: [
        ["display-text", "<div class='realm-intro'>Domain opens at <b>Nascent Soul</b>. Pick one heavenly concept per major realm as you advance Step 1: <b>1</b> at Nascent, <b>2</b> at Soul Formation, <b>4</b> at Soul Transformation, <b>6</b> in late ST, <b>10</b> at Ascendant. Each realm reveals its matching tab when you reach it.</div>"],
        ["display-text", function() { return domainStatusHTML() }],
        ["clickables", [90]],
        ["display-text", function() { return domainDaoGateHTML() }],
        ["blank", "10px"],
        ["microtabs", "domains"],
        ["blank", "12px"],
        "milestones",
    ],
    layerShown() { return typeof domainLayerShown === "function" ? domainLayerShown() : canFormDomain() || domainFormed() },
    tooltip() { return "Domain" },
    tooltipLocked() { return "Form a Nascent Soul to approach Domain." },
})

addLayer("story", {
    name: "Journal",
    symbol: "Jr",
    startData() { return {
        unlocked: true,
		points: new Decimal(0),
    }},
    color: "#b7f7c1",
    resource: "entries",
    type: "none",
    row: "side",
    tooltip() { return "Journal" },
    shouldNotify() { return player.newJournal },
    clickables: {
        11: {
            title: "Mark Journal Read",
            display() { return player.newJournal ? "New entries are glowing. Click to clear the notice." : "No unread entries." },
            canClick() { return player.newJournal },
            onClick() { player.newJournal = false },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Immortal Tree Journal</h2>"],
        ["raw-html", function() { return journalHTML() }],
        ...(typeof screenshotMode === "function" && screenshotMode() ? [] : [["blank", "12px"], "clickables"]),
    ],
    layerShown() { return true },
})

addLayer("future", {
    name: "Future Realms",
    symbol: "FR",
    startData() { return {
        unlocked: true,
		points: new Decimal(0),
    }},
    color: COLOR_LOCKED,
    resource: "sealed futures",
    type: "none",
    row: "side",
    tooltip() { return "Locked future realms" },
    tabFormat: [
        ["display-text", "<h2>Locked Future Realms</h2>"],
        ["raw-html", function() {
            if (typeof realmRoadmapHTML === "function") return realmRoadmapHTML()
            return "<div class='future-list'><p>Roadmap loading…</p></div>"
        }],
        ["blank", "12px"],
        ["raw-html", function() {
            return typeof sectTransferRoadmapHTML === "function" ? sectTransferRoadmapHTML(false) : ""
        }],
    ],
    layerShown() { return true },
})

addLayer("s", {
    name: "Immortal Sect",
    symbol: "Sect",
    position: "e",
    displayRow: "side",
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: COLOR_SECT,
    requires: new Decimal(120),
    resource: "contribution points",
    baseResource: "scattered qi",
    baseAmount() { return player.points },
    type: "normal",
    exponent: 0.35,
    tooltip() { return "Immortal Sect" },
    tooltipLocked() { return "Reach Qi Condensation, 1st Level (5 scattered qi)." },
    shouldNotify() {
        if (!tmp.s || !tmp.s.challenges) return false
        for (const id in tmp.s.challenges) {
            if (tmp.s.challenges[id].unlocked && !maxedChallenge("s", id) && !inChallenge("s", id)) return true
        }
        if (player.s.activeChallenge && canCompleteChallenge("s", player.s.activeChallenge)) return true
        return false
    },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("s", 11)) mult = mult.times(1.75)
        if (hasMilestone("s", 2)) mult = mult.times(1.5)
        if (hasUpgrade("k", 11)) mult = mult.times(1.2)
        if (hasUpgrade("k", 21)) mult = mult.times(1.2)
        return mult.times(techniqueMult("s")).times(eventChallengeMult("s")).times(typeof milestoneGainMult === "function" ? milestoneGainMult("s") : 1)
    },
    gainExp() { return new Decimal(1).plus(typeof milestoneGainExp === "function" ? milestoneGainExp("s") : 0) },
    passiveGeneration() { return techniquePassive("s") },
    autoUpgrade() { return typeof artificerAutoLayers === "function" && artificerAutoLayers().includes("s") },
    canReset() {
        if (!hasSectContributionAccess()) return false
        if (eventBlocksReset("s")) return false
        if (atSectCap()) return false
        return tmp.s.baseAmount.gte(tmp.s.requires)
    },
    prestigeButtonText() {
        if (!hasSectContributionAccess()) return "Clear the Sect Entrance Examination first"
        if (inEvent(22)) return "Finish the Inner Disciple Tournament first"
        if (inEvent(24)) return "Pill Hall auditors forbid new contribution claims"
        if (inEvent(52)) return "Wait for the Rank Nine banner ceremony to conclude"
        if (atSectCap()) return "Complete the next sect trial to raise your contribution cap"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.s.requires)} scattered qi`
        return "Claim contribution"
    },
    row: 10,
    branches: ["q"],
    challenges: {
        11: {
            name: "Sect Entrance Examination",
            challengeDescription: "The outer gate suppresses your gathering. Prove you can still condense qi under pressure.",
            goalDescription: realmReq("q", 1, "1 dantian qi and 30 scattered qi"),
            unlocked() { return sectPathUnlocked() },
            canComplete() { return player.q.best.gte(1) && player.points.gte(30) },
            rewardDescription: "Learn <b>Sect Entrance Scripture</b> (+15% scattered qi) and <b>Quiet Inner Orbit</b> (keep Qi upgrades through Foundation).",
            onComplete() { grantTechniqueForEvent(11); unlockJournal("sectEntrance") },
            style: { "border-color": COLOR_QI },
        },
        12: {
            name: "Outer Court Sparring",
            challengeDescription: "You may not break through to Foundation during this spar. Grind scattered qi with discipline.",
            goalDescription: realmReqLabel("q", "6th Level", "25 dantian qi"),
            unlocked() { return hasMilestone("q", 1) },
            canComplete() { return player.q.best.gte(25) },
            rewardDescription: "Learn <b>Outer Court Breathing</b> (+8% scattered qi).",
            onComplete() { grantTechniqueForEvent(12) },
            style: { "border-color": COLOR_QI },
        },
        13: {
            name: "Outer Disciple Tournament",
            challengeDescription: "Liquid qi condenses slowly while the arena watches. Establish your foundation under scrutiny.",
            goalDescription: realmReq("f", 1, "15 liquid qi"),
            unlocked() { return hasMilestone("q", 2) },
            canComplete() { return player.f.best.gte(15) },
            rewardDescription: "Learn <b>Tournament Victor's Art</b> (+18% liquid qi) and <b>Steady Refinement Art</b> (1% passive liquid qi).",
            onComplete() { grantTechniqueForEvent(13); unlockJournal("outerTournament") },
            style: { "border-color": COLOR_FOUNDATION },
        },
        21: {
            name: "Inner Disciple Meridian Trial",
            challengeDescription: "A purification array scours your meridians. Scattered qi and liquid qi flow are both reduced.",
            goalDescription: realmReq("f", 2, "45 liquid qi"),
            unlocked() { return hasMilestone("f", 0) },
            canComplete() { return player.f.best.gte(45) },
            rewardDescription: "Learn <b>Meridian Purification Script</b> (+20% liquid qi, +10% scattered qi).",
            onComplete() { grantTechniqueForEvent(21); unlockJournal("innerTrial") },
            style: { "border-color": COLOR_SECT },
        },
        22: {
            name: "Inner Disciple Tournament",
            challengeDescription: "You cannot claim new contribution until the bracket ends. Dantian qi and sect gains are halved.",
            goalDescription: "Reach 18 best contribution points.",
            unlocked() { return hasTechnique("t_inner_meridian") },
            canEnter() { return hasTechnique("t_inner_meridian") },
            canComplete() { return player.s.best.gte(18) },
            rewardDescription: "Learn <b>Inner Bracket Scripture</b> and <b>Sect Task Rotation</b> (1% passive contribution).",
            onComplete() { grantTechniqueForEvent(22); unlockJournal("innerTournament") },
            style: { "border-color": COLOR_SECT },
        },
        23: {
            name: "Core Disciple Assignment",
            challengeDescription: "The sect sends you to stabilize a forming core. Contribution and core spark gains are reduced; you cannot break through to Core again until the assignment succeeds.",
            goalDescription: realmReq("c", 0, "1 core spark"),
            unlocked() { return hasTechnique("t_inner_tournament") && hasMilestone("c", 0) },
            canEnter() { return hasTechnique("t_inner_tournament") },
            canComplete() { return player.c.best.gte(1) },
            rewardDescription: "Learn <b>Core Assignment Manual</b> (+15% contribution and core sparks).",
            onComplete() { grantTechniqueForEvent(23) },
            style: { "border-color": COLOR_CORE },
        },
        24: {
            name: "Pill Hall Audit",
            challengeDescription: "Auditors measure every breath. Scattered qi gathering is suppressed during the inspection.",
            goalDescription: realmReq("c", 1, "25 core sparks and 40 contribution"),
            unlocked() { return hasTechnique("t_core_assignment") && hasMilestone("c", 1) },
            canEnter() { return hasTechnique("t_core_assignment") },
            canComplete() { return player.s.best.gte(40) && player.c.best.gte(25) },
            rewardDescription: "Learn <b>Pill Hall Audit Record</b> (+25% contribution).",
            onComplete() { grantTechniqueForEvent(24) },
            style: { "border-color": COLOR_CORE },
        },
        31: {
            name: "Core Formation Tribulation Echo",
            challengeDescription: "You must hold a core steady without breaking through again. Core sparks form slowly.",
            goalDescription: realmReq("c", 2, "65 core sparks"),
            unlocked() { return hasMilestone("c", 1) },
            canComplete() { return player.c.best.gte(65) },
            rewardDescription: "Learn <b>Tribulation Echo Art</b> and <b>Core Furnace Breath</b> (1% passive core sparks).",
            onComplete() { grantTechniqueForEvent(31) },
            style: { "border-color": COLOR_CORE },
        },
        32: {
            name: "Twin Path Arena",
            challengeDescription: "The arena forces balance: Ji threads and golden progress are both cut in half until you harmonize them.",
            goalDescription: "Twin paths revealed — 8 Ji threads and 8 golden progress.",
            unlocked() { return hasMilestone("c", 1) },
            canComplete() { return player.j.best.gte(8) && player.g.best.gte(8) },
            rewardDescription: "Learn <b>Twin Path Balance Art</b> (+15% Ji and golden progress).",
            onComplete() { grantTechniqueForEvent(32); unlockJournal("twinArena") },
            style: { "border-color": COLOR_JI },
        },
        33: {
            name: "Twin Path Proving",
            challengeDescription: "A final proving ground before Nascent Soul. Both preparations must advance under heavy suppression.",
            goalDescription: `${realmLabel("j", 3)} or ${realmLabel("g", 3)} — 20 best Ji threads and 20 golden progress`,
            unlocked() { return hasMilestone("j", 3) || hasMilestone("g", 3) },
            canComplete() { return player.j.best.gte(20) && player.g.best.gte(20) },
            rewardDescription: "Learn <b>Great Circle Proving Scripture</b> (+25% Ji and golden progress).",
            onComplete() { grantTechniqueForEvent(33) },
            style: { "border-color": COLOR_NASCENT },
        },
        41: {
            name: "Sect War Vanguard Sortie",
            challengeDescription: "Lead a vanguard sortie. War merits are harder to claim until the sortie succeeds.",
            goalDescription: "Earn 1 war merit.",
            unlocked() { return player.w.unlocked || hasMilestone("s", 3) },
            canEnter() { return player.w.unlocked || hasMilestone("s", 3) },
            canComplete() { return player.w.best.gte(1) },
            rewardDescription: "Learn <b>Vanguard War Manual</b> (+30% war merits).",
            onComplete() { grantTechniqueForEvent(41) },
            style: { "border-color": "#ff6b6b" },
        },
        42: {
            name: "Nascent Tribulation Preview",
            challengeDescription: "The heavens test your nerve before the true breakthrough. All gathering is strained.",
            goalDescription: "Approach Nascent Soul — reach Ji Realm · Great Circle and Perfect Golden Core.",
            unlocked() { return hasMilestone("j", 4) && hasMilestone("g", 4) },
            canComplete() { return hasMilestone("j", 5) && hasMilestone("g", 5) },
            rewardDescription: "Learn <b>Nascent Tribulation Glimpse</b> (+25% scattered qi).",
            onComplete() { grantTechniqueForEvent(42) },
            style: { "border-color": COLOR_NASCENT },
        },
        51: {
            name: "World Tribunal Hearing",
            challengeDescription: "Rank Nine sects must answer before the cultivation world's tribunal. War merits and contribution are scrutinized until you prove your banner worthy.",
            goalDescription: "Earn 8 war merits while Rank 9.",
            unlocked() { return hasMilestone("k", 0) },
            canEnter() { return hasMilestone("k", 0) },
            canComplete() { return player.w.best.gte(8) },
            rewardDescription: "Learn <b>Tribunal Circuit Art</b> (+20% rank ascension gain, +12% war merits).",
            onComplete() { grantTechniqueForEvent(51); unlockJournal("sectTribunal") },
            style: { "border-color": "#e8c468" },
        },
        52: {
            name: "Rank Nine Banner Ceremony",
            challengeDescription: "Unveil your sect's banner before allied clans. You cannot claim new contribution until the ceremony concludes.",
            goalDescription: "Reach 25 best contribution after ascending to Rank 9.",
            unlocked() { return hasMilestone("k", 0) },
            canEnter() { return hasMilestone("k", 0) },
            canComplete() { return player.s.best.gte(25) },
            rewardDescription: "Learn <b>Rank Nine Banner Doctrine</b> (+18% contribution).",
            onComplete() { grantTechniqueForEvent(52); unlockJournal("sectBanner") },
            style: { "border-color": "#e8c468" },
        },
        61: {
            name: "Hegemony Summit",
            challengeDescription: "Only Soul-formed leaders may sit at the Rank Eight table. War merits and rank ascensions are halved; new ascensions are forbidden until the summit adjourns.",
            goalDescription: "Complete a second rank ascension to Rank 8 and earn 15 war merits.",
            unlocked() { return hasMilestone("k", 1) && typeof soulFormationReached === "function" && soulFormationReached() },
            canEnter() { return hasMilestone("k", 1) },
            canComplete() { return player.k.points.gte(2) && player.w.best.gte(15) },
            rewardDescription: "Learn <b>Hegemony Summit Record</b> (+15% all lower cultivation, +10% contribution).",
            onComplete() { grantTechniqueForEvent(61); unlockJournal("sectHegemony") },
            style: { "border-color": "#b8a0ff" },
        },
        62: {
            name: "Soul-Forged Sect Covenant",
            challengeDescription: "Bind mortal insight into your sect's charter. Scattered qi and mortal insight production are both strained while the covenant sets.",
            goalDescription: "Hold 500 best mortal insights and 50 best contribution.",
            unlocked() { return hasMilestone("k", 1) && typeof soulFormationReached === "function" && soulFormationReached() },
            canEnter() { return hasMilestone("k", 1) },
            canComplete() {
                const ins = player.sf && player.sf.bestInsights ? player.sf.bestInsights : new Decimal(0)
                return ins.gte(500) && player.s.best.gte(50)
            },
            rewardDescription: "Learn <b>Soul-Forged Covenant</b> (+25% nascent divinity gain, +15% war merits).",
            onComplete() { grantTechniqueForEvent(62); unlockJournal("sectCovenant") },
            style: { "border-color": "#b8a0ff" },
        },
    },
    milestones: {
        0: {
            requirementDescription: "Outer Disciple Tournament cleared, 1 contribution",
            done() { return hasTechnique("t_outer_tournament") && player.s.best.gte(1) },
            effectDescription: "Outer Disciple rank. +10% contribution, +5% scattered qi, keep sect stipend arts.",
        },
        1: {
            requirementDescription: "Inner Meridian Trial cleared, 10 contribution",
            done() { return hasTechnique("t_inner_meridian") && player.s.best.gte(10) },
            effectDescription: "Inner Disciple. +15% contribution, −8% war merit cost.",
        },
        2: {
            requirementDescription: "Inner Tournament cleared, 50 contribution",
            done() { return hasTechnique("t_inner_tournament") && player.s.best.gte(50) },
            effectDescription: "Core Disciple. +20% contribution, +0.3% passive contribution.",
        },
        3: {
            requirementDescription: "Pill Hall Audit cleared, 120 contribution",
            done() { return hasTechnique("t_pill_audit") && player.s.best.gte(120) },
            effectDescription: "Sect Elder. +25% contribution, +0.5% passive contribution, faster sect prestige.",
        },
    },
    upgrades: {
        11: { title: "Granted Outer Disciple Stipend", description: "The sect grants spirit stones — double contribution gain.", cost: new Decimal(5) },
        12: {
            title: "Assigned an Outer Court Cave",
            description: "A cramped cave still concentrates qi — contribution boosts scattered spiritual energy.",
            cost: new Decimal(15),
            unlocked() { return hasUpgrade("s", 11) },
            effect() { return player.s.points.add(1).pow(0.1) },
            effectDisplay() { return format(upgradeEffect("s", 12)) + "x scattered qi" },
        },
        13: { title: "Sect-Issued War Summons", description: "The elders mobilize you for sect war after enough merit.", cost: new Decimal(40), unlocked() { return hasUpgrade("s", 12) } },
        21: {
            title: "Outer Disciple Qi-Returning Pill",
            description: "A pill from the task hall — +25% scattered qi and dantian qi.",
            cost: new Decimal(12),
            unlocked() { return hasMilestone("s", 0) },
        },
        22: {
            title: "Inner Peak Cave Abode",
            description: "Promoted to Inner Disciple — receive a better cave and a merit pill (+20% dantian qi, +15% liquid qi).",
            cost: new Decimal(35),
            unlocked() { return hasMilestone("s", 1) },
        },
        23: {
            title: "Recover a Lost Inner Court Scripture",
            description: "Core Disciple reward — a scripture lost in the library (+20% core, Ji, and golden progress).",
            cost: new Decimal(90),
            unlocked() { return hasMilestone("s", 2) },
        },
        24: {
            title: "Inherit a Treasure Spirit Weapon",
            description: "The sect elder bestows a spirit weapon (+20% all cultivation from arsenal).",
            cost: new Decimal(180),
            unlocked() { return hasMilestone("s", 3) },
        },
        31: {
            title: "Elder Vein Cave Estate",
            description: "A private spirit-vein cave beneath the elder hall (+30% contribution).",
            cost: new Decimal(220),
            unlocked() { return hasMilestone("s", 3) },
        },
        32: {
            title: "Pill Hall Battlefield Recovery Pellet",
            description: "Issued before war campaigns (+25% contribution).",
            cost: new Decimal(160),
            unlocked() { return hasMilestone("s", 2) },
        },
        33: {
            title: "Rotating Task Token",
            description: "1% passive contribution per second (or learn Sect Task Rotation from the Inner Tournament).",
            cost: new Decimal(250),
            unlocked() { return hasMilestone("s", 2) },
        },
        41: {
            title: "Outer Court Automaton",
            description: "While posted in this sect, auto-prestige Qi Condensation through major levels.",
            cost: new Decimal(28),
            unlocked() { return hasMilestone("s", 0) },
        },
        42: {
            title: "Inner Hall Automaton",
            description: "Also auto-prestige Foundation and Core Formation in this sect.",
            cost: new Decimal(55),
            unlocked() { return hasUpgrade("s", 41) && hasMilestone("s", 1) },
        },
        43: {
            title: "Contribution Servitor Golem",
            description: "Auto-claim contribution when you meet the scattered qi requirement.",
            cost: new Decimal(70),
            unlocked() { return hasMilestone("s", 2) },
        },
        51: {
            title: "Trial Echo Array",
            description: "Slowly auto-replays one cleared disciple trial per cycle (must still meet its specs).",
            cost: new Decimal(95),
            unlocked() { return hasMilestone("s", 2) },
        },
        52: {
            title: "Twin Echo Scripture",
            description: "Second trial echo slot — still one replay at a time, two trials per full cycle.",
            cost: new Decimal(140),
            unlocked() { return hasUpgrade("s", 51) && hasMilestone("s", 3) },
        },
    },
    automate() { if (typeof sectArsenalAutomate === "function") sectArsenalAutomate() },
    hotkeys: [{ key: "shift+s", description: "Shift+S: Claim contribution (Sect)", onPress(){ if (canReset(this.layer)) doReset(this.layer) } }],
    layerShown() { return player.s.unlocked || sectPathUnlocked() },
    microtabs: {
        sect: {
            events: {
                title: "Events",
                content: [
                    ...(typeof screenshotMode === "function" && screenshotMode() ? [] : [
                        ["display-text", "<div class='realm-intro'>Trials unlock as your cultivation advances. Complete them to learn scriptures and raise your contribution cap.</div>"],
                        ["blank", "8px"],
                    ]),
                    ["microtabs", "eventTrials"],
                ],
            },
            duties: {
                title: "Duties",
                content: [
                    ["display-text", function() {
                        const cap = formatWhole(sectContributionCap())
                        return `<div class='realm-intro'>Claim contribution from scattered qi. Cap: <b>${cap}</b>${atSectCap() ? " — complete the next event to continue." : ""}</div>`
                    }],
                    "main-display",
                    "prestige-button",
                    "resource-display",
                    ["blank", "10px"],
                    "milestones",
                ],
            },
            war: {
                title: "Sect War",
                embedLayer: "w",
                unlocked() { return tmp.w.layerShown },
            },
            rankings: {
                title: "Sect Transfer",
                embedLayer: "k",
                unlocked() { return isSectLeader() },
            },
            arsenal: {
                title: "Arsenal",
                unlocked() { return hasSectContributionAccess() },
                content: [
                    ["display-text", "<div class='realm-intro'>Caves, pills, scriptures, and spirit weapons granted <b>in this sect only</b> — they reset when you transfer to a higher-ranked sect. Automations below are sect-local: realm prestiges, contribution claims, and veteran trial echoes (one replay at a time).</div>"],
                    ["upgrades", [11, 12, 13, 21, 22, 23, 24, 31, 32, 33, 41, 42, 43, 51, 52]],
                ],
            },
            scriptures: {
                title: "Scriptures",
                content: [
                    ["display-text", "<div class='realm-intro'>Permanent arts learned from sect events.</div>"],
                    ["raw-html", function() { return techniquesHTML() }],
                ],
            },
        },
        eventTrials: {
            disciple: {
                title: "Disciple Trials",
                content: [
                    ["challenges", [1, 2, 3, 4]],
                ],
            },
            world: {
                title: "World Rank",
                unlocked() { return isSectLeader() || hasMilestone("k", 0) },
                content: [
                    ["display-text", function() {
                        const tier = sectRankEventTier()
                        if (tier === 0) return "<div class='realm-intro'><i>Become Sect Leader and join a Rank 9 sect (Nascent Soul) to unlock tribunal events.</i></div>"
                        if (tier === 1) return "<div class='realm-intro'>Rank 9 sect tribunal events. Rank 8 sect trials need Soul Formation.</div>"
                        if (tier === 2) return "<div class='realm-intro'>Rank 8 sect hegemony events. Rank 7 sect trials need Soul Transformation.</div>"
                        return "<div class='realm-intro'>You serve a Rank 7 sect — disciple and war trials continue here; dedicated Rank 7 world events await future content.</div>"
                    }],
                    ["blank", "8px"],
                    ["challenges", [5, 6]],
                ],
            },
        },
    },
    tabFormat: [
        ["display-text", "<h2>Immortal Sect</h2>"],
        ...(typeof screenshotMode === "function" && screenshotMode() ? [] : [
            ["display-text", function() { return sectMembershipHTML() }],
            ["display-text", "<div class='realm-intro'>Events track your cultivation in <b>this</b> sect; duties earn contribution; sect war ends in leadership. Higher world ranks mean joining a new sect and starting disciple duties again — not upgrading the same banner.</div>"],
        ]),
        ["microtabs", "sect"],
    ],
    layerShown() { return sectPathUnlocked() },
})

addLayer("w", {
    name: "Sect War",
    symbol: "War",
    position: 0.9,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: "#ff6b6b",
    requires() { return withMilestoneRequires(new Decimal(120), "w") },
    baseResource: "contribution points",
    baseAmount() { return player.s.points },
    type: "normal",
    exponent: 0.5,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("w", 11)) mult = mult.times(2)
        if (hasUpgrade("k", 11)) mult = mult.times(1.3)
        if (hasUpgrade("k", 21)) mult = mult.times(1.2)
        return mult.times(techniqueMult("w")).times(eventChallengeMult("w")).times(typeof milestoneGainMult === "function" ? milestoneGainMult("w") : 1)
    },
    gainExp() { return new Decimal(1) },
    passiveGeneration() { return techniquePassive("w") },
    row: 11,
    branches: ["s"],
    milestones: {
        0: { requirementDescription: "1 war merit", done() { return player.w.best.gte(1) }, effectDescription: "+15% war merit gain, +0.2% passive war merits." },
        1: { requirementDescription: "5 war merits", done() { return player.w.best.gte(5) }, effectDescription: "+20% war merit gain, +0.4% passive war merits." },
        2: {
            requirementDescription: "12 war merits",
            done() { return player.w.best.gte(12) },
            effectDescription: "Sect Leader of this sect — your last duty here. Unlocks transfer to a higher-ranked sect when cultivation qualifies.",
            onComplete() {
                unlockJournal("sectLeader")
                player.k.unlocked = true
            },
        },
    },
    upgrades: {
        11: { title: "Raise the War Banner", description: "Your banner rallies the sect — double war merit gain.", cost: new Decimal(1) },
        12: { title: "Merit-Tempered Spirit Blade", description: "A blade quenched in merit boosts core sparks.", cost: new Decimal(3), unlocked() { return hasUpgrade("w", 11) },
            effect() { return player.w.points.add(1).pow(0.1) }, effectDisplay() { return format(upgradeEffect("w", 12)) + "x core sparks" },
        },
        21: {
            title: "Sect Leader's Jade Seal",
            description: "The leader's seal commands respect — war merits strengthen contribution.",
            cost: new Decimal(8),
            unlocked() { return isSectLeader() },
            effect() { return player.w.points.add(1).pow(0.08) },
            effectDisplay() { return format(upgradeEffect("w", 21)) + "x contribution" },
        },
        33: {
            title: "Campaign Logistics Array",
            description: "Supply lines run smoothly — 1% passive war merit per second.",
            cost: new Decimal(20),
            unlocked() { return hasMilestone("w", 1) },
        },
    },
    hotkeys: [{ key: "shift+w", description: "Shift+W: Enter war (Sect War)", onPress(){ if (canReset(this.layer)) doReset(this.layer) } }],
    layerShown() { return player.w.unlocked || hasMilestone("s", 3) },
    tabFormat: [
        ["display-text", function() { return sectMembershipHTML() }],
        ["display-text", "<div class='realm-intro'>Fight for this sect until you hold <b>Sect Leader</b> (12 war merits). That is the end of your road here — then transfer to a higher-ranked sect: Rank 9 at Nascent Soul, Rank 8 at Soul Formation, Rank 7 at Soul Transformation.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        ["display-text", function() {
            if (isSectLeader()) return "<b>Sect Leader:</b> Final rank in this sect. Open Rankings to join a higher-ranked sect when Nascent Soul (Rank 9), Soul Formation (Rank 8), or Soul Transformation (Rank 7) allows."
            return "Reach 12 war merits to become Sect Leader — the last step before you can join a higher-ranked sect."
        }],
    ],
})

addLayer("k", {
    name: "Sect Transfer",
    symbol: "Rank",
    position: 0,
    startData() { return {
        unlocked: false,
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    color: "#e8c468",
    resource: "sect transfers",
    baseResource: "war merits",
    baseAmount() { return player.w.points },
    type: "normal",
    exponent: 0.45,
    requires() { return withMilestoneRequires(new Decimal(12).times(Decimal.pow(1.75, player.k.points)), "k") },
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("k", 11)) mult = mult.times(1.5)
        if (hasUpgrade("k", 12)) mult = mult.times(1.25)
        if (hasUpgrade("k", 22)) mult = mult.times(1.12)
        return mult.times(typeof eventChallengeMult === "function" ? eventChallengeMult("k") : 1).times(typeof milestoneGainMult === "function" ? milestoneGainMult("k") : 1)
    },
    gainExp() { return new Decimal(1) },
    passiveGeneration() { return 0 },
    resetsNothing: true,
    canReset() { return canAscendSectRank() },
    onPrestige() {
        if (typeof onSectTransferComplete === "function") onSectTransferComplete()
    },
    doReset(resettingLayer) {
        if (resettingLayer === "k") return
        if (layers[resettingLayer].row > this.row) {
            const keep = ["milestones", "upgrades", "points", "best", "total"]
            layerDataReset("k", keep)
        }
    },
    row: 12,
    branches: ["w", "n"],
    milestones: {
        0: {
            requirementDescription: "Join a World Rank 9 sect (sect transfer)",
            done() { return player.k.points.gte(1) },
            effectDescription: "Serving a Rank 9 sect. +10% contribution and war merits, +10% lower cultivation. Unlocks tribunal events in that sect.",
        },
        1: {
            requirementDescription: "Join a World Rank 8 sect (Soul Formation + transfer)",
            done() { return player.k.points.gte(2) },
            effectDescription: "Serving a Rank 8 sect. +15% lower cultivation and +15% transfer gain. Unlocks hegemony events.",
        },
        2: {
            requirementDescription: "Complete both Rank 9 sect world events",
            done() { return maxedChallenge("s", 51) && maxedChallenge("s", 52) },
            effectDescription: "Tribunal recognized in your Rank 9 posting. +12% contribution and +10% war merits.",
        },
        3: {
            requirementDescription: "Complete both Rank 8 sect world events",
            done() { return maxedChallenge("s", 61) && maxedChallenge("s", 62) },
            effectDescription: "Hegemony sealed in your Rank 8 posting. +15% transfer gain and +0.4% passive war merits.",
        },
        4: {
            requirementDescription: "Join a World Rank 7 sect (Soul Transformation + transfer)",
            done() { return player.k.points.gte(3) },
            effectDescription: "Serving a Rank 7 sect. +12% lower cultivation and +10% contribution.",
        },
    },
    upgrades: {
        11: {
            title: "Rank Nine Transfer Seal",
            description: "Accreditation from a Rank 9 posting — +20% contribution and war merits while in any sect.",
            cost: new Decimal(1),
            unlocked() { return player.k.points.gte(1) },
        },
        12: {
            title: "Spirit-Vein Memory",
            description: "You remember a Rank 9 vein — all lower cultivation strengthens.",
            cost: new Decimal(2),
            unlocked() { return hasUpgrade("k", 11) },
        },
        21: {
            title: "Rank Eight Hegemony Seal",
            description: "Accreditation from a Rank 8 posting — +20% contribution and war merits.",
            cost: new Decimal(5),
            unlocked() { return player.k.points.gte(2) },
        },
        22: {
            title: "Soul-Forged Tribunal Seat",
            description: "Your Soul-formed charter eases future sect transfers — +12% transfer gain.",
            cost: new Decimal(8),
            unlocked() { return hasUpgrade("k", 21) && hasMilestone("k", 3) },
        },
        31: {
            title: "Rank Seven Ascension Seal",
            description: "Accreditation from a Rank 7 posting — +15% contribution and +12% war merits.",
            cost: new Decimal(12),
            unlocked() { return player.k.points.gte(3) },
        },
        33: {
            title: "Transfer Merit Array",
            description: "+0.4% passive war merits while you qualify for the next sect transfer.",
            cost: new Decimal(3),
            unlocked() { return hasMilestone("k", 0) },
        },
    },
    resetDescription() { return `Join World Rank ${formatWhole(nextSectWorldRank())} sect for ` },
    prestigeButtonText() {
        const rank = formatWhole(sectWorldRank())
        const next = formatWhole(nextSectWorldRank())
        if (!isSectLeader()) return "Become Sect Leader in this sect first (12 war merits)"
        if (inEvent(61)) return "The Hegemony Summit blocks sect transfers until it ends"
        if (player.k.points.gte(SECT_RANK_ASCENSION_CAP)) return `Serving Rank ${rank} sect — no higher sect available`
        const gate = sectRankAscensionGate()
        if (!gate.ok) return `Need ${gate.need} to join Rank ${next} sect`
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.k.requires)} war merits to transfer`
        return `Join Rank ${next} sect (leave Rank ${rank} — reset duties & war)`
    },
    hotkeys: [
        { key: "shift+k", description: "Shift+K: Join higher-ranked sect", onPress() { if (canReset(this.layer)) doReset(this.layer) } },
    ],
    tooltip() { return `Serving World Rank ${formatWhole(sectWorldRank())} sect` },
    tooltipLocked() {
        if (!isSectLeader()) return "Become Sect Leader by winning the Sect War (12 war merits)."
        const gate = sectRankAscensionGate()
        if (!gate.ok && player.k.points.lt(SECT_RANK_ASCENSION_CAP)) return gate.detail.replace(/<[^>]+>/g, "")
        return "Sect transfer"
    },
    layerShown() { return isSectLeader() },
    tabFormat: [
        ["display-text", function() {
            return `<h2 style="color:#e8c468">World Rank ${formatWhole(sectWorldRank())} Sect</h2>`
        }],
        ["display-text", function() {
            if (player.k.points.gte(SECT_RANK_ASCENSION_CAP)) {
                return `<div class='realm-intro'>You serve the highest <b>implemented</b> sect tier (Rank ${formatWhole(sectWorldRank())}). ${typeof sectTransferRoadmapHTML === "function" ? sectTransferRoadmapHTML(true) : ""}</div>`
            }
            const gate = sectRankAscensionGate()
            if (!gate.ok) return `<div class='realm-intro'><i>${gate.detail}</i></div>`
            return "<div class='realm-intro'>Transferring sects is <b>not</b> upgrading your old hall — you join a higher-ranked sect, reset contribution, war, disciple milestones, and arsenal in that sect, then climb to Sect Leader again. Cultivation realms never reset. Personal accreditations below persist.</div>"
        }],
        "prestige-button",
        ["blank", "8px"],
        ["display-text", function() {
            return `Sects joined: <b>${formatWhole(player.k.points)}</b> (best ${formatWhole(player.k.best)}) — currently Rank <b>${formatWhole(sectWorldRank())}</b>`
        }],
        ["blank", "10px"],
        "milestones",
        ["blank", "12px"],
        "upgrades",
        ["blank", "12px"],
        ["display-text", function() {
            if (!isSectLeader()) return "<div class='realm-intro'><i>Become Sect Leader in your current sect before you may transfer.</i></div>"
            if (player.k.points.gte(SECT_RANK_ASCENSION_CAP)) return ""
            const gate = sectRankAscensionGate()
            if (!gate.ok) return gate.detail
            const next = formatWhole(nextSectWorldRank())
            return `Join Rank <b>${next}</b> sect with <b>${formatWhole(tmp.k.requires)}</b> war merits — you start as a new disciple there (contribution, war, events, and arsenal reset).`
        }],
    ],
})
