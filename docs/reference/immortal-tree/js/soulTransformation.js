// Soul Transformation — six incarnation avatars with progress bars, active slots, and cultivation bonuses.

const ST_AVATAR_IDS = ["blood", "body", "sense", "soul", "beast", "dao"]

const ST_SEGMENTS = [
    "Qi Condensation",
    "Foundation Establishment",
    "Core Formation",
    "Nascent Soul",
    "Soul Formation",
    "Soul Transformation",
]

const ST_AVATARS = {
    blood: {
        name: "Bloodline",
        symbol: "Bl",
        color: "#c45a5a",
        focus: "Nascent Soul & professions",
        starterDesc: "Inherit ancestral potency — stronger Nascent and profession gains.",
        passiveBySegment: [0.02, 0.03, 0.04, 0.06, 0.08, 0.1],
        activeBySegment: [0.04, 0.06, 0.08, 0.12, 0.15, 0.2],
        currencies: ["n", "al", "ar", "re"],
    },
    body: {
        name: "Body Refinement",
        symbol: "Bd",
        color: "#7bc96f",
        focus: "Qi & Foundation",
        starterDesc: "Temper the mortal shell — scattered qi and liquid qi swell faster.",
        passiveBySegment: [0.025, 0.03, 0.035, 0.04, 0.05, 0.06],
        activeBySegment: [0.05, 0.06, 0.07, 0.08, 0.1, 0.12],
        currencies: ["points", "q", "f"],
    },
    sense: {
        name: "Divine Sense",
        symbol: "Sn",
        color: "#6eb5ff",
        focus: "Sect & awareness",
        starterDesc: "Expand perception — contribution and war merits rise while incarnated.",
        passiveBySegment: [0.02, 0.025, 0.03, 0.035, 0.04, 0.05],
        activeBySegment: [0.06, 0.08, 0.1, 0.12, 0.14, 0.16],
        currencies: ["s", "w", "k"],
    },
    soul: {
        name: "Soul",
        symbol: "Sl",
        color: "#b8a0ff",
        focus: "Soul Formation & Nascent",
        starterDesc: "Strengthen the true soul — nascent divinities condense faster.",
        passiveBySegment: [0.02, 0.03, 0.04, 0.05, 0.08, 0.1],
        activeBySegment: [0.05, 0.07, 0.09, 0.12, 0.18, 0.22],
        currencies: ["sf", "n"],
    },
    beast: {
        name: "Magic Beast",
        symbol: "Bs",
        color: "#e8a84a",
        focus: "Passive cultivation",
        starterDesc: "Bond a spirit beast — passive breath on all realms while active.",
        passiveBySegment: [0.003, 0.004, 0.005, 0.006, 0.008, 0.01],
        activeBySegment: [0.008, 0.01, 0.012, 0.015, 0.02, 0.025],
        currencies: ["points", "q", "f", "c", "j", "g"],
        passiveIsRate: true,
    },
    dao: {
        name: "Dao",
        symbol: "Da",
        color: "#9b8cff",
        focus: "Twin paths & Domain",
        starterDesc: "Comprehend the Dao — Ji, Golden progress, and Domain trials accelerate.",
        passiveBySegment: [0.02, 0.025, 0.03, 0.04, 0.05, 0.06],
        activeBySegment: [0.05, 0.065, 0.08, 0.1, 0.12, 0.15],
        currencies: ["j", "g", "dom"],
    },
}

// After starter: avatar, avatar, slot+2, avatar, slot+3, ...
const ST_UNLOCK_STEPS = [
    { type: "avatar", threshold: 0.5 },
    { type: "avatar", threshold: 1 },
    { type: "slot", threshold: 1.5, slots: 2 },
    { type: "avatar", threshold: 2.5 },
    { type: "slot", threshold: 3.5, slots: 3 },
    { type: "avatar", threshold: 5 },
    { type: "slot", threshold: 7, slots: 4 },
    { type: "avatar", threshold: 9 },
    { type: "slot", threshold: 11, slots: 5 },
    { type: "slot", threshold: 13, slots: 6 },
]

function stThirdProfessionUnlocked() {
    return hasMilestone("st", 7)
}

function stEffectiveMaxSlots() {
    stEnsureState()
    let n = player.st.maxActiveSlots
    if (hasUpgrade("st", 22)) n += 1
    return Math.min(n, 6)
}

function stInsightGainMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("st", 21)) mult = mult.times(player.sf.best.add(1).pow(0.06))
    if (hasUpgrade("st", 33)) mult = mult.times(player.st.best.add(1).pow(0.12))
    if (hasUpgrade("st", 41)) mult = mult.times(1.15)
    return mult
}

function stPathRateMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("st", 11)) mult = mult.times(2)
    if (hasUpgrade("st", 12)) mult = mult.times(upgradeEffect("st", 12))
    if (hasUpgrade("st", 24)) mult = mult.times(1.2)
    if (hasUpgrade("st", 32)) {
        mult = mult.times(1.2)
        mult = mult.times(player.st.unlockedAvatars.length * 0.04 + 1)
    }
    if (hasUpgrade("st", 41)) mult = mult.times(1.5)
    return mult
}

function stAvatarUpgradeMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("st", 13)) mult = mult.times(1.25)
    if (hasUpgrade("st", 14)) mult = mult.times(1.15)
    if (hasUpgrade("st", 31) && player.st.active.length >= 3) mult = mult.times(1.3)
    if (hasUpgrade("st", 41)) mult = mult.times(1.25)
    return mult
}

function stPassiveInsightPerSec() {
    if (!player || !player.st || !player.st.unlocked || !player.st.starterChosen) return new Decimal(0)
    let rate = stTotalProgressScore().add(1).pow(0.22).times(0.015)
    rate = rate.times(player.st.active.length * 0.35 + 0.65)
    return rate
}

function stAwardInsight(amount) {
    if (!player || !player.st || amount.lte(0)) return
    const gain = amount.times(stInsightGainMult())
    player.st.points = player.st.points.add(gain)
    player.st.best = player.st.best.max(player.st.points)
    player.st.total = player.st.total.add(gain)
}

function stInsightStatusHTML() {
    if (!player.st || !player.st.unlocked) return ""
    const rate = stPassiveInsightPerSec().times(stInsightGainMult())
    return `<div class="realm-intro"><b>Transformation insights:</b> ${format(player.st.points)} (best ${format(player.st.best)}) · passive +${format(rate)}/s while incarnations walk.</div>`
}

function stAnyAvatarAtFinalSegment() {
    stEnsureState()
    for (const id of player.st.unlockedAvatars) {
        const a = player.st.avatars[id]
        if (a && a.segment >= ST_SEGMENTS.length - 1 && a.progress >= 1) return true
    }
    return false
}

function stEnsureState() {
    if (!player || !player.st) return
    if (!player.st.avatars) player.st.avatars = {}
    if (!Array.isArray(player.st.unlockedAvatars)) player.st.unlockedAvatars = []
    if (!Array.isArray(player.st.active)) player.st.active = []
    if (player.st.maxActiveSlots === undefined) player.st.maxActiveSlots = 1
    if (player.st.progressionStep === undefined) player.st.progressionStep = 0
    if (player.st.pendingAvatarPick === undefined) player.st.pendingAvatarPick = false
    for (const id of ST_AVATAR_IDS) {
        if (!player.st.avatars[id]) {
            player.st.avatars[id] = { segment: 0, progress: 0, bestSegment: 0 }
        }
    }
}

function stAvatarUnlocked(id) {
    stEnsureState()
    return player.st.unlockedAvatars.includes(id)
}

function stIsActive(id) {
    stEnsureState()
    return player.st.active.includes(id)
}

function stLockedAvatars() {
    return ST_AVATAR_IDS.filter(id => !stAvatarUnlocked(id))
}

function stTotalProgressScore() {
    stEnsureState()
    let score = new Decimal(0)
    for (const id of player.st.unlockedAvatars) {
        const a = player.st.avatars[id]
        if (!a) continue
        score = score.add(a.segment).add(a.progress || 0)
    }
    return score
}

function stAdvanceProgression() {
    stEnsureState()
    if (!player.st.starterChosen) return
    const score = stTotalProgressScore()
    while (player.st.progressionStep < ST_UNLOCK_STEPS.length) {
        const step = ST_UNLOCK_STEPS[player.st.progressionStep]
        if (score.lt(step.threshold)) break
        if (step.type === "slot") {
            player.st.maxActiveSlots = step.slots
            player.st.progressionStep++
            continue
        }
        if (step.type === "avatar") {
            if (stLockedAvatars().length === 0) {
                player.st.progressionStep++
                continue
            }
            player.st.pendingAvatarPick = true
            break
        }
    }
}

function stChooseAvatar(id) {
    stEnsureState()
    if (!ST_AVATAR_IDS.includes(id) || stAvatarUnlocked(id)) return
    player.st.unlockedAvatars.push(id)
    if (player.st.active.length < stEffectiveMaxSlots() && !stIsActive(id)) {
        player.st.active.push(id)
    }
    player.st.pendingAvatarPick = false
    if (player.st.progressionStep < ST_UNLOCK_STEPS.length && ST_UNLOCK_STEPS[player.st.progressionStep].type === "avatar") {
        player.st.progressionStep++
    }
    stAdvanceProgression()
}

function stChooseStarter(id) {
    stEnsureState()
    if (player.st.starterChosen) return
    if (!ST_AVATAR_IDS.includes(id)) return
    player.st.starterChosen = true
    player.st.unlockedAvatars = [id]
    player.st.active = [id]
    player.st.maxActiveSlots = 1
    player.st.progressionStep = 0
    stAdvanceProgression()
}

function stToggleActive(id) {
    stEnsureState()
    if (!stAvatarUnlocked(id)) return
    if (stIsActive(id)) {
        player.st.active = player.st.active.filter(x => x !== id)
        return
    }
    if (player.st.active.length >= stEffectiveMaxSlots()) return
    player.st.active.push(id)
}

function stSegmentLabel(id) {
    const a = player.st.avatars[id]
    if (!a) return ""
    const seg = Math.min(a.segment, ST_SEGMENTS.length - 1)
    return ST_SEGMENTS[seg]
}

function stAvatarFillRate(id) {
    let rate = new Decimal(0.025)
    rate = rate.times(stPathRateMult())
    if (hasMilestone("st", 2)) rate = rate.times(1.03)
    if (hasMilestone("st", 4)) rate = rate.times(1.08)
    if (hasMilestone("st", 9)) rate = rate.times(1.1)
    if (hasUpgrade("st", 23) && stIsActive("beast")) rate = rate.times(1.15)
    if (hasUpgrade("st", 24) && stIsActive("dao")) rate = rate.times(1.12)
    if (player.sf && player.sf.best) rate = rate.times(player.sf.best.add(1).pow(0.08))
    if (player.n && player.n.best) rate = rate.times(player.n.best.add(1).pow(0.05))
    const activeCount = player.st.active.length
    if (activeCount > 1) rate = rate.div(activeCount * 0.85)
    if (stIsActive(id)) {
        const def = ST_AVATARS[id]
        const a = player.st.avatars[id]
        const seg = Math.min(a.segment, def.activeBySegment.length - 1)
        rate = rate.times(1 + def.activeBySegment[seg] * 0.5)
    }
    if (stIsActive("sense")) rate = rate.times(1.08)
    if (stIsActive("soul")) rate = rate.times(1.1)
    if (stIsActive("dao")) rate = rate.times(1.06)
    return rate
}

function stTickAvatars(diff) {
    if (!player || !player.st || !player.st.unlocked || !player.st.starterChosen) return
    stEnsureState()
    const d = new Decimal(diff)
    for (const id of player.st.active) {
        if (!stAvatarUnlocked(id)) continue
        const a = player.st.avatars[id]
        const segBefore = a.segment
        let gain = stAvatarFillRate(id).times(d)
        a.progress = (a.progress || 0) + gain.toNumber()
        while (a.progress >= 1 && a.segment < ST_SEGMENTS.length) {
            a.progress -= 1
            a.segment++
            a.bestSegment = Math.max(a.bestSegment, a.segment)
        }
        if (a.segment > segBefore) {
            stAwardInsight(new Decimal(a.segment - segBefore).times(0.35))
        }
        if (a.segment >= ST_SEGMENTS.length) {
            a.segment = ST_SEGMENTS.length - 1
            a.progress = 1
        }
    }
    stAdvanceProgression()
}

function stPassiveMultForAvatar(id, currency) {
    const def = ST_AVATARS[id]
    if (!def.currencies.includes(currency)) return new Decimal(1)
    const a = player.st.avatars[id]
    if (!a || !stAvatarUnlocked(id)) return new Decimal(1)
    const tier = Math.min(a.bestSegment, def.passiveBySegment.length - 1)
    let bonus = def.passiveBySegment[tier] || 0
    for (let s = 0; s < tier; s++) bonus += (def.passiveBySegment[s] || 0) * 0.35
    if (def.passiveIsRate) return new Decimal(1).add(bonus)
    return new Decimal(1).add(bonus)
}

function stActiveMultForAvatar(id, currency) {
    if (!stIsActive(id)) return new Decimal(1)
    const def = ST_AVATARS[id]
    if (!def.currencies.includes(currency)) return new Decimal(1)
    const a = player.st.avatars[id]
    const tier = Math.min(a.segment, def.activeBySegment.length - 1)
    const bonus = def.activeBySegment[tier] || 0
    if (def.passiveIsRate) return new Decimal(1).add(bonus * 2)
    return new Decimal(1).add(bonus)
}

function avatarCultivationMult(currency) {
    if (!player || !player.st || !player.st.unlocked || !player.st.starterChosen) return new Decimal(1)
    stEnsureState()
    let mult = new Decimal(1)
    if (hasMilestone("st", 3)) mult = mult.times(1.05)
    if (hasMilestone("st", 5) && player.st.active.length > 0) mult = mult.times(1.08)
    if (hasMilestone("st", 6)) mult = mult.times(1.12)
    if (hasMilestone("st", 8)) mult = mult.times(1.15)
    if (hasMilestone("st", 9)) mult = mult.times(1.2)
    mult = mult.times(stAvatarUpgradeMult())
    for (const id of player.st.unlockedAvatars) {
        mult = mult.times(stPassiveMultForAvatar(id, currency))
    }
    for (const id of player.st.active) {
        mult = mult.times(stActiveMultForAvatar(id, currency))
    }
    const cap = new Decimal(25)
    return mult.gt(cap) ? cap : mult
}

function avatarPassiveGeneration(layer) {
    if (!player || !player.st || !player.st.unlocked || !player.st.starterChosen) return new Decimal(0)
    if (!stAvatarUnlocked("beast") || !ST_AVATARS.beast.currencies.includes(layer)) return new Decimal(0)
    const def = ST_AVATARS.beast
    const a = player.st.avatars.beast
    const tier = Math.min(a.bestSegment, def.passiveBySegment.length - 1)
    let rate = def.passiveBySegment[tier] || 0
    if (stIsActive("beast")) {
        const activeTier = Math.min(a.segment, def.activeBySegment.length - 1)
        rate += (def.activeBySegment[activeTier] || 0) * 0.5
    }
    if (hasUpgrade("st", 23)) rate *= 2
    return new Decimal(rate)
}

function stAvatarStatusHTML() {
    stEnsureState()
    if (!player.st.unlocked) return "<div class='realm-intro'>Complete Soul Formation capstone to open Soul Transformation.</div>"
    if (!player.st.starterChosen) {
        return "<div class='realm-intro'><b>Choose your first incarnation.</b> Only one avatar is active at first; others unlock as you refine the path.</div>"
    }
    let lines = []
    lines.push(`<b>Active slots:</b> ${player.st.active.length} / ${stEffectiveMaxSlots()} · <b>Incarnations:</b> ${player.st.unlockedAvatars.length} / 6 · <b>Path:</b> ${format(stTotalProgressScore())}`)
    if (player.st.pendingAvatarPick) {
        lines.push("<br><i>A new incarnation awaits — choose below.</i>")
    }
    const next = ST_UNLOCK_STEPS[player.st.progressionStep]
    if (next) {
        lines.push(`<br><span style="opacity:0.85">Next unlock (${next.type}): ${format(stTotalProgressScore())} / ${next.threshold} path progress</span>`)
    }
    for (const id of ST_AVATAR_IDS) {
        if (!stAvatarUnlocked(id)) continue
        const a = player.st.avatars[id]
        const pct = a.segment >= ST_SEGMENTS.length - 1 && a.progress >= 1
            ? 100
            : Math.floor((a.progress || 0) * 100)
        const active = stIsActive(id) ? " <b>[ACTIVE]</b>" : " [idle]"
        lines.push(`<br>${ST_AVATARS[id].name}${active}: ${stSegmentLabel(id)} — ${pct}%`)
    }
    return `<div class="realm-intro">${lines.join("")}</div>`
}

function stDaoGateHTML() {
    if (!player || !player.st || !player.st.unlocked) return ""
    const parts = []
    if (typeof professionDaoGateHTML === "function") parts.push(professionDaoGateHTML())
    if (typeof domainDaoGateHTML === "function") parts.push(domainDaoGateHTML())
    return parts.filter(Boolean).join("<br>")
}

function stNextUnlockText() {
    if (!player.st || !player.st.starterChosen) return ""
    const next = ST_UNLOCK_STEPS[player.st.progressionStep]
    if (!next) return "All incarnation slots awakened."
    if (next.type === "slot") return `Reach ${next.threshold} total path progress to unlock ${next.slots} active slots.`
    return `Reach ${next.threshold} total path progress to unlock another incarnation.`
}

function initStClickables() {
    const clickables = {}
    for (const id of ST_AVATAR_IDS) {
        const def = ST_AVATARS[id]
        clickables[`pick_${id}`] = {
            title() {
                return `Incarnate ${def.name}`
            },
            display() {
                if (player.st.starterChosen && !player.st.pendingAvatarPick) {
                    if (!stAvatarUnlocked(id)) return `${def.name} — locked`
                    return `${def.name} — ${stIsActive(id) ? "click to rest (idle)" : "click to activate"}`
                }
                if (!player.st.starterChosen) return def.starterDesc
                return `${def.name} — ${def.focus}`
            },
            unlocked() {
                if (!player.st.unlocked) return false
                if (!player.st.starterChosen) return true
                if (player.st.pendingAvatarPick) return !stAvatarUnlocked(id)
                return stAvatarUnlocked(id)
            },
            canClick() {
                if (!player.st.starterChosen) return true
                if (player.st.pendingAvatarPick) return !stAvatarUnlocked(id)
                return stAvatarUnlocked(id)
            },
            onClick() {
                if (!player.st.starterChosen) stChooseStarter(id)
                else if (player.st.pendingAvatarPick) stChooseAvatar(id)
                else stToggleActive(id)
            },
            style() { return { "border-color": def.color } },
        }
    }
    return clickables
}

addLayer("st", {
    name: "Soul Transformation",
    symbol: "ST",
    color: "#a8c4ff",
    type: "normal",
    row: 8,
    branches: ["sf"],
    startData() { return {
        unlocked: false,
        starterChosen: false,
        pendingAvatarPick: false,
        progressionStep: 0,
        maxActiveSlots: 1,
        unlockedAvatars: [],
        active: [],
        avatars: {},
        points: new Decimal(0),
        best: new Decimal(0),
        total: new Decimal(0),
    }},
    requires: new Decimal(1e5),
    resource: "transformation insights",
    baseResource: "nascent divinities (best)",
    baseAmount() { return player.sf && player.sf.best ? player.sf.best : new Decimal(0) },
    exponent: 0.38,
    resetsNothing: true,
    gainMult() {
        let mult = new Decimal(1)
        if (hasUpgrade("st", 21)) mult = mult.times(upgradeEffect("st", 21))
        if (hasUpgrade("st", 33)) mult = mult.times(player.st.points.add(1).pow(0.08))
        if (typeof techniqueMult === "function") mult = mult.times(techniqueMult("st"))
        return mult
    },
    gainExp() { return new Decimal(1).plus(stTotalProgressScore().pow(0.04)) },
    canReset() {
        if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset("st")) return false
        if (!player.st || !player.st.starterChosen) return false
        return tmp.st.baseAmount.gte(tmp.st.requires)
    },
    prestigeButtonText() {
        if (typeof cultivationSectGateButtonText === "function") {
            const sectMsg = cultivationSectGateButtonText("st")
            if (sectMsg) return sectMsg
        }
        if (!player.st.starterChosen) return "Choose your first incarnation below"
        if (!canReset(this.layer)) return `Need ${formatWhole(tmp.st.requires)} best nascent divinities`
        if (player.st.points.eq(0)) return "Condense your first transformation insights"
        return "Condense transformation insights"
    },
    resetDescription: "Refine the soul and gain ",
    layerShown() { return typeof soulTransformationReady === "function" ? soulTransformationReady() : hasMilestone("sf", 6) },
    update(diff) {
        stTickAvatars(diff)
        if (player.st && player.st.unlocked && player.st.starterChosen) {
            const gain = stPassiveInsightPerSec().times(diff)
            if (gain.gt(0)) stAwardInsight(gain)
        }
    },
    doReset(resettingLayer) {
        if (layers[resettingLayer].row > this.row) {
            layerDataReset("st", ["milestones", "upgrades"])
        }
    },
    clickables: initStClickables(),
    upgrades: {
        11: {
            title: "Incarnation Breathing Art",
            description: "×2 avatar path progress speed.",
            cost: new Decimal(8),
            unlocked() { return player.st.starterChosen && hasMilestone("st", 1) },
        },
        12: {
            title: "Path Memory Scripture",
            description: "Path speed scales with transformation insights held.",
            cost: new Decimal(25),
            unlocked() { return hasUpgrade("st", 11) },
            effect() { return player.st.points.add(1).pow(0.35) },
            effectDisplay() { return format(upgradeEffect("st", 12)) + "× path" },
        },
        13: {
            title: "Passive Incarnation Echo",
            description: "×1.25 cultivation from idle incarnation passives.",
            cost: new Decimal(60),
            unlocked() { return hasMilestone("st", 3) },
        },
        14: {
            title: "Active Soul Projection",
            description: "×1.15 cultivation while incarnations are active.",
            cost: new Decimal(120),
            unlocked() { return hasUpgrade("st", 13) && hasMilestone("st", 4) },
        },
        21: {
            title: "Divinity-to-Path Converter",
            description: "Transformation insight gain scales with Soul Formation depth.",
            cost: new Decimal(250),
            unlocked() { return hasUpgrade("st", 14) && player.sf.best.gte(1e6) },
            effect() { return player.sf.best.add(1).pow(0.06) },
            effectDisplay() { return format(upgradeEffect("st", 21)) + "× insight gain" },
        },
        22: {
            title: "Twin Incarnation Array",
            description: "+1 active incarnation slot (max 6).",
            cost: new Decimal(500),
            unlocked() { return hasUpgrade("st", 21) && hasMilestone("st", 4) },
        },
        23: {
            title: "Spirit Beast Bond Scripture",
            description: "×2 Magic Beast passive generation; +15% path when beast is active.",
            cost: new Decimal(900),
            unlocked() { return stAvatarUnlocked("beast") && hasMilestone("st", 5) },
        },
        24: {
            title: "Dao Incarnation Fragment",
            description: "×1.2 path speed; +12% path when Dao incarnation is active.",
            cost: new Decimal(1400),
            unlocked() { return stAvatarUnlocked("dao") && hasMilestone("st", 5) },
        },
        31: {
            title: "Six Souls Chorus",
            description: "×1.3 avatar cultivation when three or more incarnations are active.",
            cost: new Decimal(3000),
            unlocked() { return hasMilestone("st", 6) },
        },
        32: {
            title: "Heavenly Transformation Manual",
            description: "×1.2 path speed; extra speed per incarnation unlocked.",
            cost: new Decimal(7500),
            unlocked() { return hasUpgrade("st", 31) && hasMilestone("st", 7) },
        },
        33: {
            title: "Insight Condensation Array",
            description: "Insight gain and passive insight scale with best insights held.",
            cost: new Decimal(15000),
            unlocked() { return hasUpgrade("st", 32) && hasMilestone("st", 8) },
            effect() { return player.st.best.add(1).pow(0.12) },
            effectDisplay() { return format(upgradeEffect("st", 33)) + "× insight" },
        },
        41: {
            title: "Heaven-Defying Transformation Art",
            description: "×1.5 path speed, ×1.25 avatar cultivation, ×1.15 insight gain.",
            cost: new Decimal(40000),
            unlocked() { return hasMilestone("st", 9) },
        },
        42: {
            title: "Nascent Echo Refinement",
            description: "Soul Formation nascent divinity production ×1.15.",
            cost: new Decimal(80000),
            unlocked() { return hasUpgrade("st", 41) && player.sf.best.gte(1e7) },
        },
    },
    milestones: {
        0: {
            requirementDescription: realmReq("st", 0, "Complete Soul Formation capstone"),
            done() { return hasMilestone("sf", 6) },
            effectDescription: "Incarnation hall opens. Choose your first avatar.",
            onComplete() {
                if (player.st) player.st.unlocked = true
            },
        },
        1: {
            requirementDescription: realmReq("st", 1, "Choose your first incarnation"),
            done() { stEnsureState(); return player.st.starterChosen },
            effectDescription: "Path progression begins — bars fill only on active avatars.",
        },
        2: {
            requirementDescription: realmReq("st", 2, "Two incarnations unlocked"),
            done() { stEnsureState(); return player.st.unlockedAvatars.length >= 2 },
            effectDescription: "+3% path progress speed.",
            onComplete() {
                if (typeof unlockJournal === "function") unlockJournal("soulTransformation")
            },
        },
        3: {
            requirementDescription: realmReq("st", 3, "Three incarnations unlocked"),
            done() { stEnsureState(); return player.st.unlockedAvatars.length >= 3 },
            effectDescription: "+5% all cultivation gains from incarnation passives.",
        },
        4: {
            requirementDescription: realmReq("st", 4, "Two active incarnation slots"),
            done() { stEnsureState(); return player.st.maxActiveSlots >= 2 },
            effectDescription: "+8% path progress speed.",
        },
        5: {
            requirementDescription: realmReq("st", 5, "Five incarnations unlocked"),
            done() { stEnsureState(); return player.st.unlockedAvatars.length >= 5 },
            effectDescription: "+8% cultivation while any incarnation is active.",
        },
        6: {
            requirementDescription: realmReq("st", 6, "All six incarnations unlocked"),
            done() { stEnsureState(); return player.st.unlockedAvatars.length >= 6 },
            effectDescription: "+12% cultivation.",
        },
        7: {
            requirementDescription: realmReq("st", 7, "Four active slots and 10 path progress"),
            done() {
                stEnsureState()
                return player.st.maxActiveSlots >= 4 && stTotalProgressScore().gte(10)
            },
            effectDescription: "Third profession Dao opens. Sixth domain pick unlocks at this milestone.",
            onComplete() {
                if (typeof unlockJournal === "function") unlockJournal("daoThird")
            },
        },
        8: {
            requirementDescription: realmReq("st", 8, "Six active incarnation slots"),
            done() { stEnsureState(); return player.st.maxActiveSlots >= 6 },
            effectDescription: "+15% cultivation from the full incarnation chorus.",
        },
        9: {
            requirementDescription: realmReq("st", 9, "18 path progress or an avatar at Soul Transformation segment"),
            done() {
                stEnsureState()
                return stTotalProgressScore().gte(18) || stAnyAvatarAtFinalSegment()
            },
            effectDescription: "+20% cultivation and +10% path speed. Heavenly Transformation complete.",
        },
        10: {
            requirementDescription: "Bloodline incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.blood
                return a && a.bestSegment >= 4
            },
            effectDescription: "+3% cultivation from Bloodline passives.",
        },
        11: {
            requirementDescription: "Body Refinement incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.body
                return a && a.bestSegment >= 4
            },
            effectDescription: "+3% Qi and Foundation gains.",
        },
        12: {
            requirementDescription: "Divine Sense incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.sense
                return a && a.bestSegment >= 4
            },
            effectDescription: "+3% sect contribution and war merit.",
        },
        13: {
            requirementDescription: "Soul incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.soul
                return a && a.bestSegment >= 4
            },
            effectDescription: "+3% Soul Formation divinity production.",
        },
        14: {
            requirementDescription: "Magic Beast incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.beast
                return a && a.bestSegment >= 4
            },
            effectDescription: "+4% passive cultivation from the beast bond.",
        },
        15: {
            requirementDescription: "Dao incarnation reaches Soul Formation on its path",
            done() {
                stEnsureState()
                const a = player.st.avatars.dao
                return a && a.bestSegment >= 4
            },
            effectDescription: "+3% Ji, Golden, and Domain trial progress.",
        },
    },
    microtabs: {
        hall: {
            title: "Incarnation Hall",
            unlocked() { return player.st.unlocked },
            content: [
                ["display-text", function() { return stAvatarStatusHTML() }],
                ["display-text", function() { return stDaoGateHTML() ? `<div class='realm-intro'>${stDaoGateHTML()}</div>` : "" }],
                ["display-text", function() { return `<div class='realm-intro' style='opacity:0.9'>${stNextUnlockText()}</div>` }],
                ["blank", "10px"],
                "clickables",
            ],
        },
        arts: {
            title: "Transformation Arts",
            unlocked() { return player.st.starterChosen },
            content: [
                ["display-text", "<div class='realm-intro'>Spend <b>transformation insights</b> on arts that quicken incarnation paths and deepen their cultivation bonuses. Insights drip passively from walking the path and condense through breakthrough below.</div>"],
                ["display-text", function() { return stInsightStatusHTML() }],
                ["blank", "8px"],
                "upgrades",
            ],
        },
    },
    tabFormat: [
        ["display-text", "<h2>Soul Transformation</h2>"],
        ["display-text", "<div class='realm-intro'>Raise six incarnations — each bar walks the cultivation ladder. Only <b>active</b> avatars gain progress; idle ones still grant passives. Break through using Soul Formation depth to buy Transformation Arts.</div>"],
        "main-display",
        "prestige-button",
        "resource-display",
        ["blank", "8px"],
        ["microtabs", "st"],
        ["blank", "12px"],
        "milestones",
    ],
    hotkeys: [{
        key: "shift+y",
        description: "Shift+Y: Condense transformation insights",
        onPress() { if (canReset(this.layer)) doReset(this.layer) },
    }],
    tooltip() { return "Soul Transformation — Incarnation Hall" },
    tooltipLocked() { return "Complete Soul Formation capstone (100M divinities + Sixth Life)." },
})
