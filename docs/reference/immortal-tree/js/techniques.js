// Event-won scriptures and arts (permanent). Granted on challenge completion.

const CULTIVATION_LAYERS = ["q", "f", "c", "j", "g", "n", "al", "ar", "re", "dom", "sf", "st", "asc"]
const SECT_LAYERS = ["s", "w", "k"]
const CULTIVATION_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const SECT_ROWS = [10, 11, 12]

const TECHNIQUE_DEFS = {
    t_entrance: {
        name: "Sect Entrance Scripture",
        description: "+15% scattered qi. Required to earn contribution beyond the gate trial.",
        eventId: 11,
    },
    t_outer_spar: {
        name: "Outer Court Breathing",
        description: "+8% scattered qi.",
        eventId: 12,
    },
    t_outer_tournament: {
        name: "Tournament Victor's Art",
        description: "+18% liquid qi. Unlocks Outer Disciple rank progress.",
        eventId: 13,
    },
    t_inner_meridian: {
        name: "Meridian Purification Script",
        description: "+20% liquid qi and +10% scattered qi. Unlocks Inner Disciple trials.",
        eventId: 21,
    },
    t_inner_tournament: {
        name: "Inner Bracket Scripture",
        description: "+15% scattered qi, +12% dantian qi, +20% contribution.",
        eventId: 22,
    },
    t_core_assignment: {
        name: "Core Assignment Manual",
        description: "+15% contribution and +15% core sparks.",
        eventId: 23,
    },
    t_pill_audit: {
        name: "Pill Hall Audit Record",
        description: "+25% contribution gain.",
        eventId: 24,
    },
    t_core_echo: {
        name: "Tribulation Echo Art",
        description: "+20% core sparks and +8% dantian qi.",
        eventId: 31,
    },
    t_twin_arena: {
        name: "Twin Path Balance Art",
        description: "+15% Ji threads and golden progress.",
        eventId: 32,
    },
    t_great_circle: {
        name: "Great Circle Proving Scripture",
        description: "+25% Ji threads and golden progress.",
        eventId: 33,
    },
    t_war_vanguard: {
        name: "Vanguard War Manual",
        description: "+30% war merits.",
        eventId: 41,
    },
    t_nascent_preview: {
        name: "Nascent Tribulation Glimpse",
        description: "+25% scattered qi.",
        eventId: 42,
    },
    t_tribunal_circuit: {
        name: "Tribunal Circuit Art",
        description: "+20% rank ascension gain and +12% war merits.",
        eventId: 51,
    },
    t_rank_nine_banner: {
        name: "Rank Nine Banner Doctrine",
        description: "+18% contribution gain.",
        eventId: 52,
    },
    t_hegemony_summit: {
        name: "Hegemony Summit Record",
        description: "+15% all lower cultivation and +10% contribution.",
        eventId: 61,
    },
    t_soul_sect_covenant: {
        name: "Soul-Forged Covenant",
        description: "+25% nascent divinity gain and +15% war merits.",
        eventId: 62,
    },
    t_quiet_orbit: {
        name: "Quiet Inner Orbit",
        description: "Keep dantian qi upgrades through Foundation resets (Qi layer).",
        protectQiUpgrades: true,
    },
    t_steady_refinement: {
        name: "Steady Refinement Art",
        description: "1% passive liquid qi reset gain per second (without buying the upgrade).",
        passiveF: true,
    },
    t_core_breath: {
        name: "Core Furnace Breath",
        description: "1% passive core spark reset gain per second.",
        passiveC: true,
    },
    t_sect_rotation: {
        name: "Sect Task Rotation",
        description: "1% passive contribution reset gain per second.",
        passiveS: true,
    },
    t_sect_transfer: {
        name: "Sect Transfer Record",
        description: "+12% scattered qi. Qualifies you to earn contribution in a new sect without repeating the outer gate exam.",
    },
}

const SECT_MEMBERSHIP_TECHNIQUE_IDS = [
    "t_entrance", "t_outer_spar", "t_outer_tournament", "t_inner_meridian", "t_inner_tournament",
    "t_core_assignment", "t_pill_audit", "t_core_echo", "t_twin_arena", "t_great_circle",
    "t_war_vanguard", "t_nascent_preview", "t_tribunal_circuit", "t_rank_nine_banner",
    "t_hegemony_summit", "t_soul_sect_covenant", "t_quiet_orbit", "t_steady_refinement",
    "t_core_breath", "t_sect_rotation", "t_sect_transfer",
]

function hasSectContributionAccess() {
    return hasTechnique("t_entrance") || hasTechnique("t_sect_transfer")
}

function stripSectMembershipTechniques() {
    if (!player || !Array.isArray(player.techniques)) return
    player.techniques = player.techniques.filter(id => !SECT_MEMBERSHIP_TECHNIQUE_IDS.includes(id))
}

function joinHigherSect() {
    if (!player) return
    stripSectMembershipTechniques()
    if (player.s) {
        layerDataReset("s", ["unlocked"])
        player.s.unlocked = true
    }
    if (player.w) {
        layerDataReset("w", [])
        player.w.unlocked = false
    }
    grantTechnique("t_sect_transfer")
    grantTechnique("t_quiet_orbit")
}

function treeOf(layer) {
    if (SECT_LAYERS.includes(layer)) return "sect"
    if (NIRVANA_LAYERS.includes(layer)) return "nirvana"
    if (CULTIVATION_LAYERS.includes(layer)) return "cultivation"
    return "other"
}

function layerOrder(layer) {
    const o = {
        q: 0, f: 1, c: 2, j: 3, g: 3, n: 4, al: 5, ar: 5, re: 5, dom: 6, sf: 7, st: 8, asc: 9,
        yin: 0, yang: 1, ns: 2, nc: 3, dsn: 4, cel: 4, isl: 4, nsh: 5, ess: 6, jfl: 6, nv: 7,
        s: 0, w: 1, k: 2,
    }
    return o[layer] !== undefined ? o[layer] : -1
}

function layerResetInTree(layer, resettingLayer, keepOverride) {
    if (treeOf(layer) !== treeOf(resettingLayer)) return
    if (treeOf(layer) === "nirvana") {
        if (layerOrder(resettingLayer) <= layerOrder(layer)) return
    } else if (layerOrder(resettingLayer) <= layerOrder(layer)) {
        return
    }
    let keep = keepOverride
    if (keep === undefined && typeof layerResetKeepForPrestige === "function") {
        keep = layerResetKeepForPrestige(layer, resettingLayer)
    }
    layerDataReset(layer, keep || [])
}

function hasTechnique(id) {
    return player && Array.isArray(player.techniques) && player.techniques.includes(id)
}

function grantTechnique(id) {
    if (!player || !TECHNIQUE_DEFS[id]) return
    if (!Array.isArray(player.techniques)) player.techniques = []
    if (!player.techniques.includes(id)) player.techniques.push(id)
}

function grantTechniqueForEvent(eventId) {
    for (const id in TECHNIQUE_DEFS) {
        if (TECHNIQUE_DEFS[id].eventId === eventId) grantTechnique(id)
    }
    if (eventId === 11) grantTechnique("t_quiet_orbit")
    if (eventId === 13) grantTechnique("t_steady_refinement")
    if (eventId === 31) grantTechnique("t_core_breath")
    if (eventId === 22) grantTechnique("t_sect_rotation")
}

function sectContributionCap() {
    if (!hasSectContributionAccess()) return new Decimal(0)
    if (!hasTechnique("t_outer_tournament")) return new Decimal(9)
    if (!hasTechnique("t_inner_meridian")) return new Decimal(11)
    if (!hasTechnique("t_inner_tournament")) return new Decimal(25)
    if (!hasTechnique("t_core_assignment")) return new Decimal(45)
    if (!hasTechnique("t_pill_audit")) return new Decimal(80)
    return new Decimal("e1000")
}

function atSectCap() {
    if (!hasSectContributionAccess()) return true
    const cap = sectContributionCap()
    if (cap.gte("e500")) return false
    return player.s.points.gte(cap)
}

function techniqueMult(currency) {
    let mult = new Decimal(1)
    if (currency === "points") {
        if (hasTechnique("t_entrance")) mult = mult.times(1.15)
        if (hasTechnique("t_sect_transfer")) mult = mult.times(1.12)
        if (hasTechnique("t_outer_spar")) mult = mult.times(1.08)
        if (hasTechnique("t_inner_meridian")) mult = mult.times(1.1)
        if (hasTechnique("t_inner_tournament")) mult = mult.times(1.15)
        if (hasTechnique("t_nascent_preview")) mult = mult.times(1.25)
    }
    if (currency === "q") {
        if (hasTechnique("t_inner_tournament")) mult = mult.times(1.12)
        if (hasTechnique("t_core_echo")) mult = mult.times(1.08)
    }
    if (currency === "f") {
        if (hasTechnique("t_outer_tournament")) mult = mult.times(1.18)
        if (hasTechnique("t_inner_meridian")) mult = mult.times(1.2)
    }
    if (currency === "c") {
        if (hasTechnique("t_core_assignment")) mult = mult.times(1.15)
        if (hasTechnique("t_core_echo")) mult = mult.times(1.2)
        if (hasTechnique("t_twin_arena")) mult = mult.times(1.1)
    }
    if (currency === "j" || currency === "g") {
        if (hasTechnique("t_twin_arena")) mult = mult.times(1.15)
        if (hasTechnique("t_great_circle")) mult = mult.times(1.25)
    }
    if (currency === "s") {
        if (hasTechnique("t_inner_tournament")) mult = mult.times(1.2)
        if (hasTechnique("t_core_assignment")) mult = mult.times(1.15)
        if (hasTechnique("t_pill_audit")) mult = mult.times(1.25)
        if (hasTechnique("t_rank_nine_banner")) mult = mult.times(1.18)
        if (hasTechnique("t_hegemony_summit")) mult = mult.times(1.1)
    }
    if (currency === "w") {
        if (hasTechnique("t_war_vanguard")) mult = mult.times(1.3)
        if (hasTechnique("t_tribunal_circuit")) mult = mult.times(1.12)
        if (hasTechnique("t_soul_sect_covenant")) mult = mult.times(1.15)
    }
    if (currency === "k") {
        if (hasTechnique("t_tribunal_circuit")) mult = mult.times(1.2)
    }
    if (currency === "sf") {
        if (hasTechnique("t_soul_sect_covenant")) mult = mult.times(1.25)
    }
    if (currency === "points" || currency === "q" || currency === "f" || currency === "c" || currency === "j" || currency === "g" || currency === "n") {
        if (hasTechnique("t_hegemony_summit")) mult = mult.times(1.15)
    }
    return mult
}

function techniquePassive(layer) {
    let rate = 0
    if (layer === "q" && hasUpgrade("q", 34)) rate = 0.01
    if (layer === "f" && (hasUpgrade("f", 33) || hasTechnique("t_steady_refinement"))) rate = 0.01
    if (layer === "c" && (hasUpgrade("c", 33) || hasTechnique("t_core_breath"))) rate = 0.01
    if (layer === "s" && (hasUpgrade("s", 33) || hasTechnique("t_sect_rotation"))) rate = 0.01
    if (layer === "w" && (hasUpgrade("w", 33) || hasUpgrade("k", 33))) rate = Math.max(rate, hasUpgrade("k", 33) ? 0.014 : 0.01)
    if (typeof artificerPassiveMult === "function") rate *= artificerPassiveMult()
    if (typeof domainPassiveBonus === "function") rate += domainPassiveBonus(layer)
    if (typeof milestonePassiveBonus === "function") rate += milestonePassiveBonus(layer)
    if (typeof avatarPassiveGeneration === "function") rate += avatarPassiveGeneration(layer).toNumber()
    return rate
}

function sectPillMult(currency) {
    let mult = new Decimal(1)
    if (hasUpgrade("s", 11)) mult = mult.times(1.1)
    if (hasUpgrade("s", 12)) mult = mult.times(player.s.points.add(1).pow(0.08))
    if (hasUpgrade("s", 13)) mult = mult.times(1.12)
    if (hasUpgrade("s", 21)) mult = mult.times(1.15)
    if (hasUpgrade("s", 22)) mult = mult.times(1.12)
    if (hasUpgrade("s", 23)) mult = mult.times(1.1)
    if (hasUpgrade("s", 24)) mult = mult.times(1.12)
    if (hasUpgrade("s", 31)) mult = mult.times(1.15)
    if (hasUpgrade("s", 32)) mult = mult.times(1.1)
    return mult
}

function techniquesHTML() {
    if (!player || !Array.isArray(player.techniques) || player.techniques.length === 0) {
        return "<i>Complete sect events to learn scriptures and arts.</i>"
    }
    return player.techniques.map(id => {
        const t = TECHNIQUE_DEFS[id]
        if (!t) return ""
        return `<div class="journal-entry"><h3>${t.name}</h3><p>${t.description}</p></div>`
    }).join("")
}
