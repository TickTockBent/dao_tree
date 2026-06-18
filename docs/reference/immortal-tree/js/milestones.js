// Permanent milestone bonuses — each milestone should soften the cost of prestiging.

function milestoneLowerRealmMult() {
    const n = typeof BALANCE !== "undefined" ? BALANCE.nascent.lowerRealm : null
    let mult = new Decimal(1)
    if (hasMilestone("n", 0)) mult = mult.times(n ? n.first : 10)
    if (hasMilestone("n", 1)) mult = mult.times(n ? n.m1 : 1.75)
    if (hasMilestone("n", 3)) mult = mult.times(n ? n.m3 : 1.12)
    if (hasMilestone("n", 5)) mult = mult.times(n ? n.m5 : 1.2)
    if (hasMilestone("n", 6)) mult = mult.times(n ? n.m6 : 1.12)
    if (hasMilestone("k", 0)) mult = mult.times(1.1)
    if (hasMilestone("k", 1)) mult = mult.times(1.15)
    if (hasMilestone("k", 2)) mult = mult.times(1.12)
    return mult
}

function milestoneGainMult(currency) {
    let mult = new Decimal(1)
    if (!player) return mult

    if (currency === "points" || currency === "q") {
        if (hasMilestone("q", 0)) mult = mult.times(1.08)
        if (hasMilestone("q", 1)) mult = mult.times(currency === "q" ? 1.1 : 1.06)
        if (hasMilestone("q", 4)) mult = mult.times(currency === "q" ? 1.12 : 1.08)
        if (hasMilestone("f", 0)) mult = mult.times(1.5)
        if (hasMilestone("f", 1)) mult = mult.times(1.08)
        if (hasMilestone("c", 0)) mult = mult.times(1.5)
        if (hasMilestone("c", 2)) mult = mult.times(1.08)
        if (hasMilestone("j", 1)) mult = mult.times(1.06)
        if (hasMilestone("g", 1)) mult = mult.times(1.06)
        if (hasMilestone("s", 0)) mult = mult.times(1.05)
        if (hasMilestone("s", 1)) mult = mult.times(1.08)
        if (hasMilestone("s", 2)) mult = mult.times(1.1)
        if (hasMilestone("s", 3)) mult = mult.times(1.12)
    }

    if (currency === "f") {
        if (hasMilestone("c", 0)) mult = mult.times(1.35)
        if (hasMilestone("f", 1)) mult = mult.times(1.12)
        if (hasMilestone("f", 2)) mult = mult.times(1.1)
        if (hasMilestone("f", 4)) mult = mult.times(1.15)
        if (hasMilestone("c", 0)) mult = mult.times(1.08)
        if (hasMilestone("j", 1)) mult = mult.times(1.1)
        if (hasMilestone("g", 1)) mult = mult.times(1.1)
    }

    if (currency === "c") {
        if (hasMilestone("c", 0)) mult = mult.times(1.12)
        if (hasMilestone("c", 1)) mult = mult.times(1.15)
        if (hasMilestone("c", 3)) mult = mult.times(1.2)
        if (hasMilestone("f", 4)) mult = mult.times(1.1)
        if (hasMilestone("j", 1)) mult = mult.times(1.1)
        if (hasMilestone("g", 1)) mult = mult.times(1.1)
    }

    if (currency === "j") {
        if (hasMilestone("j", 0)) mult = mult.times(1.15)
        if (hasMilestone("j", 1)) mult = mult.times(1.15)
        if (hasMilestone("j", 3)) mult = mult.times(1.2)
        if (hasMilestone("j", 4)) mult = mult.times(1.15)
        if (hasMilestone("j", 5)) mult = mult.times(1.25)
    }

    if (currency === "g") {
        if (hasMilestone("g", 0)) mult = mult.times(1.15)
        if (hasMilestone("g", 1)) mult = mult.times(1.15)
        if (hasMilestone("g", 3)) mult = mult.times(1.2)
        if (hasMilestone("g", 4)) mult = mult.times(1.15)
        if (hasMilestone("g", 5)) mult = mult.times(1.25)
    }

    if (currency === "n") {
        if (hasMilestone("n", 2)) mult = mult.times(1.15)
        if (hasMilestone("n", 4)) mult = mult.times(1.2)
        if (hasMilestone("n", 6)) mult = mult.times(1.35)
    }

    if (currency === "al" || currency === "ar" || currency === "re") {
        if (hasMilestone(currency, 0)) mult = mult.times(1.12)
        if (hasMilestone(currency, 1)) mult = mult.times(1.15)
        if (hasMilestone(currency, 2)) mult = mult.times(1.2)
    }

    if (currency === "s") {
        if (hasMilestone("s", 0)) mult = mult.times(1.1)
        if (hasMilestone("s", 1)) mult = mult.times(1.15)
        if (hasMilestone("s", 2)) mult = mult.times(1.2)
        if (hasMilestone("s", 3)) mult = mult.times(1.25)
        if (hasMilestone("k", 0)) mult = mult.times(1.12)
        if (hasMilestone("k", 2)) mult = mult.times(1.12)
        if (hasMilestone("k", 4)) mult = mult.times(1.1)
    }

    if (currency === "w") {
        if (hasMilestone("w", 0)) mult = mult.times(1.15)
        if (hasMilestone("w", 1)) mult = mult.times(1.2)
        if (hasMilestone("k", 0)) mult = mult.times(1.1)
        if (hasMilestone("k", 2)) mult = mult.times(1.1)
    }

    if (currency === "k") {
        if (hasMilestone("k", 1)) mult = mult.times(1.15)
        if (hasMilestone("k", 3)) mult = mult.times(1.15)
        if (hasMilestone("k", 4)) mult = mult.times(1.12)
    }

    if (typeof domainFormed === "function" && domainFormed()) {
        if (hasMilestone("dom", 0)) mult = mult.times(1.05)
        if (hasMilestone("dom", 1)) mult = mult.times(1.05)
        if (hasMilestone("dom", 2)) mult = mult.times(1.06)
        if (hasMilestone("dom", 3)) mult = mult.times(1.06)
        if (hasMilestone("dom", 4)) mult = mult.times(1.08)
        if (hasMilestone("dom", 5)) mult = mult.times(1.1)
    }

    if (player.sf && player.sf.best.gte(1)) mult = mult.times(1.1)

    return mult
}

function milestoneRequiresMult(layer) {
    let mult = new Decimal(1)
    if (layer === "f") {
        if (hasMilestone("q", 2)) mult = mult.times(0.95)
        if (hasMilestone("q", 4)) mult = mult.times(0.92)
    }
    if (layer === "c") {
        if (hasMilestone("f", 2)) mult = mult.times(0.9)
        if (hasMilestone("f", 4)) mult = mult.times(0.88)
    }
    if (layer === "j" || layer === "g") {
        if (hasMilestone("c", 1)) mult = mult.times(0.92)
        if (hasMilestone("c", 3)) mult = mult.times(0.9)
        if (layer === "j" && hasMilestone("j", 4)) mult = mult.times(0.88)
        if (layer === "g" && hasMilestone("g", 4)) mult = mult.times(0.88)
        if (hasMilestone("j", 5) || hasMilestone("g", 5)) mult = mult.times(0.85)
    }
    if (layer === "n") {
        if (hasMilestone("j", 4) && hasMilestone("g", 4)) mult = mult.times(0.85)
        if (hasMilestone("j", 5) && hasMilestone("g", 5)) mult = mult.times(0.8)
    }
    if (layer === "al" || layer === "ar" || layer === "re") {
        if (hasMilestone(layer, 0)) mult = mult.times(0.95)
        if (hasMilestone(layer, 1)) mult = mult.times(0.92)
        if (hasMilestone(layer, 2)) mult = mult.times(0.88)
        if (hasMilestone("n", 2)) mult = mult.times(0.95)
    }
    if (layer === "w") {
        if (hasMilestone("s", 1)) mult = mult.times(0.92)
        if (hasMilestone("s", 2)) mult = mult.times(0.88)
    }
    if (layer === "k") {
        if (hasMilestone("w", 1)) mult = mult.times(0.95)
        if (hasMilestone("w", 2)) mult = mult.times(0.88)
    }
    if (typeof domainFormed === "function" && domainFormed()) {
        if (hasMilestone("dom", 3)) mult = mult.times(0.95)
        if (hasMilestone("dom", 4)) mult = mult.times(0.93)
        if (hasMilestone("dom", 5)) mult = mult.times(0.9)
    }
    return mult
}

const PRESTIGE_PRESERVE_MIN_BEST = 3

// Lower layers only stop fully resetting after the 3rd breakthrough on the prestiging layer (best ≥ 3 after reset).
const PRESTIGE_PRESERVE_RULES = [
    { reset: "f", ms: 1, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "c", ms: 1, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "c", ms: 3, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "j", ms: 1, target: "c", keep: ["milestones", "upgrades"] },
    { reset: "g", ms: 1, target: "c", keep: ["milestones", "upgrades"] },
    { reset: "j", ms: 3, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "g", ms: 3, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "j", ms: 4, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "g", ms: 4, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 1, target: "c", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 2, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 3, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 4, target: "j", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 4, target: "g", keep: ["milestones", "upgrades"] },
]

function prestigePreservationActive(resettingLayer) {
    if (!player || !player[resettingLayer] || !player[resettingLayer].best) return false
    return player[resettingLayer].best.gte(PRESTIGE_PRESERVE_MIN_BEST)
}

function layerResetKeepForPrestige(targetLayer, resettingLayer) {
    const keep = new Set()

    if (prestigePreservationActive(resettingLayer)) {
        for (const rule of PRESTIGE_PRESERVE_RULES) {
            if (rule.reset !== resettingLayer || rule.target !== targetLayer) continue
            if (!hasMilestone(resettingLayer, rule.ms)) continue
            for (const field of rule.keep) keep.add(field)
        }
    }

    if (targetLayer === "q" && resettingLayer === "f" && hasTechnique("t_quiet_orbit")) keep.add("upgrades")
    if (targetLayer === "j" && resettingLayer === "n" && hasUpgrade("re", 23) && hasProfession("re")) keep.add("upgrades")
    if (targetLayer === "g" && resettingLayer === "n" && hasUpgrade("re", 23) && hasProfession("re")) keep.add("upgrades")

    if (typeof nirvanaPreserveKeep === "function") {
        for (const field of nirvanaPreserveKeep(targetLayer, resettingLayer)) keep.add(field)
    }

    if (keep.size === 0) return []

    if (typeof restrictionKeepOnReset === "function") {
        for (const field of restrictionKeepOnReset(targetLayer)) keep.add(field)
    }
    if (typeof domainKeepOnReset === "function") {
        for (const field of domainKeepOnReset(targetLayer)) keep.add(field)
    }

    return [...keep]
}

function milestoneKeepOnReset(layer) {
    return []
}

const CULTIVATION_SNAPSHOT_KEYS = ["points", "best", "total", "upgrades", "milestones", "unlocked"]

function takeCultivationChallengeSnapshot() {
    const snap = { scattered: player.points.toString() }
    for (const lr of ["q", "f", "c", "j", "g"]) {
        if (!player[lr]) continue
        snap[lr] = {}
        for (const key of CULTIVATION_SNAPSHOT_KEYS) {
            if (player[lr][key] === undefined) continue
            if (key === "upgrades" || key === "milestones") snap[lr][key] = player[lr][key].slice()
            else if (key === "unlocked") snap[lr][key] = player[lr][key]
            else snap[lr][key] = player[lr][key].toString()
        }
    }
    return snap
}

function restoreCultivationChallengeSnapshot(snap) {
    if (!snap) return
    player.points = new Decimal(snap.scattered)
    for (const lr of ["q", "f", "c", "j", "g"]) {
        if (!snap[lr] || !player[lr]) continue
        for (const key of CULTIVATION_SNAPSHOT_KEYS) {
            if (snap[lr][key] === undefined) continue
            if (key === "upgrades" || key === "milestones") player[lr][key] = snap[lr][key].slice()
            else if (key === "unlocked") player[lr][key] = snap[lr][key]
            else player[lr][key] = new Decimal(snap[lr][key])
        }
    }
    if (typeof updateTemp === "function") updateTemp()
}

function clearSectChallengeSnapshot() {
    if (!player.s) return
    if (player.s.challengeSnapshot) restoreCultivationChallengeSnapshot(player.s.challengeSnapshot)
    player.s.challengeSnapshot = null
}

const SECT_TRIAL_RESET_CHALLENGES = [11, 12, 13, 21, 22, 23, 24, 31, 32, 33, 42]

function sectChallengeUsesTrialReset(challengeId) {
    return SECT_TRIAL_RESET_CHALLENGES.includes(Number(challengeId))
}

function resetCultivationLayerForTrial(layer, keepUnlocked) {
    const keep = keepUnlocked && player[layer] && player[layer].unlocked ? ["unlocked"] : []
    layerDataReset(layer, keep)
    if (keepUnlocked) player[layer].unlocked = true
}

function applySectChallengeStart(challengeId) {
    const id = Number(challengeId)
    player.points = decimalZero
    for (const lr of ["j", "g", "c", "f", "q"]) resetCultivationLayerForTrial(lr, false)
    player.q.unlocked = true

    if (id === 11) return

    if (id >= 12) {
        resetCultivationLayerForTrial("q", true)
    }
    if (id >= 13 || id === 21 || id === 22 || id === 24) {
        player.f.unlocked = true
    }
    if (id >= 23 || id === 31 || id === 32 || id === 33) {
        player.c.unlocked = true
    }
    if (id === 32 || id === 33) {
        player.j.unlocked = true
        player.g.unlocked = true
    }
    if (id === 22 || id === 24) {
        if (player.s) {
            layerDataReset("s", ["unlocked", "milestones", "upgrades", "challenges"])
            player.s.unlocked = true
        }
    }
    if (id === 42) {
        player.j.unlocked = true
        player.g.unlocked = true
    }
    if (typeof updateTemp === "function") updateTemp()
}

function milestonePassiveBonus(layer) {
    let bonus = 0
    if (layer === "q") {
        if (hasMilestone("q", 1)) bonus += 0.003
        if (hasMilestone("q", 4)) bonus += 0.005
    }
    if (layer === "f") {
        if (hasMilestone("f", 1)) bonus += 0.004
        if (hasMilestone("f", 4)) bonus += 0.006
    }
    if (layer === "c") {
        if (hasMilestone("c", 2)) bonus += 0.004
        if (hasMilestone("c", 3)) bonus += 0.006
    }
    if (layer === "s") {
        if (hasMilestone("s", 2)) bonus += 0.003
        if (hasMilestone("s", 3)) bonus += 0.005
    }
    if (layer === "w") {
        if (hasMilestone("w", 0)) bonus += 0.002
        if (hasMilestone("w", 1)) bonus += 0.004
    }
    if (layer === "k") {
        if (hasMilestone("k", 3)) bonus += 0.004
    }
    if (typeof domainFormed === "function" && domainFormed() && hasMilestone("dom", 2)) bonus += 0.003
    return bonus
}

function milestoneGainExp(layer) {
    let exp = new Decimal(0)
    if (layer === "q") {
        if (hasMilestone("q", 1)) exp = exp.plus(0.02)
        if (hasMilestone("q", 4)) exp = exp.plus(0.03)
    }
    if (layer === "f") {
        if (hasMilestone("f", 1)) exp = exp.plus(0.02)
        if (hasMilestone("f", 4)) exp = exp.plus(0.04)
    }
    if (layer === "c") {
        if (hasMilestone("c", 1)) exp = exp.plus(0.02)
        if (hasMilestone("c", 3)) exp = exp.plus(0.03)
    }
    if (layer === "j" || layer === "g") {
        if (hasMilestone(layer, 1)) exp = exp.plus(0.02)
        if (hasMilestone(layer, 4)) exp = exp.plus(0.03)
    }
    if (layer === "n") {
        if (hasMilestone("n", 2)) exp = exp.plus(0.02)
        if (hasMilestone("n", 4)) exp = exp.plus(0.03)
    }
    if (layer === "al" || layer === "ar" || layer === "re") {
        if (hasMilestone(layer, 0)) exp = exp.plus(0.015)
        if (hasMilestone(layer, 2)) exp = exp.plus(0.025)
    }
    if (layer === "s") {
        if (hasMilestone("s", 1)) exp = exp.plus(0.02)
        if (hasMilestone("s", 3)) exp = exp.plus(0.03)
    }
    return exp
}

function withMilestoneRequires(base, layer) {
    const req = base instanceof Decimal ? base : new Decimal(base)
    return req.times(milestoneRequiresMult(layer))
}
