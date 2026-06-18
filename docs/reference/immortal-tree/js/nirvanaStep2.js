// Step 2 shared rules: triad path cap (20), sibling resets, challenge snapshots.

const NIRVANA_TRIAD_CAP = 20
const NIRVANA_TRIAD_LAYERS = ["dsn", "cel", "isl"]
const NIRVANA_TRIAD_IDS = { dsn: "dsn", cel: "cel", isl: "isl" }

const NIRVANA_TREE_BASE = ["yin", "yang", "ns", "nc"]
const NIRVANA_SNAPSHOT_KEYS = ["points", "best", "total", "upgrades", "milestones", "unlocked", "challenges"]

const NIRVANA_LAYER_ORDER = {
    yin: 0, yang: 1, ns: 2, nc: 3, dsn: 4, cel: 4, isl: 4, nsh: 5, ess: 6, jfl: 6, nv: 7,
}

function nirvanaTriadCap() {
    return new Decimal(NIRVANA_TRIAD_CAP)
}

function nirvanaTriadAtCap(layer) {
    return player[layer].points.gte(NIRVANA_TRIAD_CAP)
}

function nirvanaTriadMaxPerReset(layer) {
    if (hasMilestone(layer, 1)) return new Decimal(3)
    return decimalOne
}

function getNirvanaTriadResetGain(layer) {
    if (tmp[layer].baseAmount.lt(tmp[layer].requires)) return decimalZero
    const room = nirvanaTriadCap().sub(player[layer].points).max(0)
    if (room.lte(0)) return decimalZero
    let gain = tmp[layer].baseAmount.div(tmp[layer].requires).pow(tmp[layer].exponent).times(tmp[layer].gainMult).pow(tmp[layer].gainExp)
    if (gain.gte(tmp[layer].softcap)) {
        gain = gain.pow(tmp[layer].softcapPower).times(tmp[layer].softcap.pow(decimalOne.sub(tmp[layer].softcapPower)))
    }
    gain = gain.times(tmp[layer].directMult).floor()
    return Decimal.min(gain, room, nirvanaTriadMaxPerReset(layer)).max(0)
}

function nirvanaTriadAllComplete() {
    return NIRVANA_TRIAD_LAYERS.every(lr => hasMilestone(lr, 5))
}

function layersBelowNirvanaSibling(layer) {
    const order = NIRVANA_LAYER_ORDER[layer]
    if (order === undefined) return []
    const out = []
    for (const lr of [...NIRVANA_TREE_BASE, ...NIRVANA_TRIAD_LAYERS, "nsh", "ess", "jfl", "nv"]) {
        if (NIRVANA_LAYER_ORDER[lr] !== undefined && NIRVANA_LAYER_ORDER[lr] < order && lr !== layer) {
            if (NIRVANA_TRIAD_LAYERS.includes(lr) && NIRVANA_TRIAD_LAYERS.includes(layer)) continue
            out.push(lr)
        }
    }
    if (layer === "isl") out.push("s", "w")
    return [...new Set(out)]
}

function resetNirvanaBelowSibling(layer, keepMeta) {
    const keep = keepMeta ? ["milestones", "upgrades"] : []
    for (const lr of layersBelowNirvanaSibling(layer)) {
        if (!player[lr]) continue
        if (lr === "s" || lr === "w") {
            layerDataReset(lr, lr === "s" ? ["unlocked", ...keep] : keep)
            if (lr === "s") player.s.unlocked = true
            continue
        }
        layerDataReset(lr, keep)
        if (!keepMeta && lr === "yin") player[lr].unlocked = true
        else if (!keepMeta && (lr === "yang" || lr === "ns" || lr === "nc")) player[lr].unlocked = false
    }
}

function nirvanaCleanserUnlocked() {
    return hasMilestone("ns", 4) || (player.nc && player.nc.unlocked)
}

function nirvanaShattererUnlocked() {
    return nirvanaTriadAllComplete() || (player.nsh && player.nsh.unlocked)
}

function takeNirvanaChallengeSnapshot() {
    const snap = { sect: {} }
    for (const lr of [...NIRVANA_TREE_BASE, ...NIRVANA_TRIAD_LAYERS, "nsh", "ess", "jfl", "nv"]) {
        if (!player[lr]) continue
        snap[lr] = {}
        for (const key of NIRVANA_SNAPSHOT_KEYS) {
            if (player[lr][key] === undefined) continue
            if (key === "upgrades" || key === "milestones") snap[lr][key] = player[lr][key].slice()
            else if (key === "unlocked") snap[lr][key] = player[lr][key]
            else if (key === "challenges") snap[lr][key] = { ...player[lr].challenges }
            else snap[lr][key] = player[lr][key].toString()
        }
    }
    if (player.s) {
        snap.sect = { s: {} }
        for (const key of ["points", "best", "total"]) {
            if (player.s[key] !== undefined) snap.sect.s[key] = player.s[key].toString()
        }
    }
    insightsEnsure()
    snap.insights = player.insights.toString()
    return snap
}

function restoreNirvanaChallengeSnapshot(snap) {
    if (!snap) return
    insightsEnsure()
    if (snap.insights !== undefined) player.insights = new Decimal(snap.insights)
    for (const lr of [...NIRVANA_TREE_BASE, ...NIRVANA_TRIAD_LAYERS, "nsh", "ess", "jfl", "nv"]) {
        if (!snap[lr] || !player[lr]) continue
        for (const key of NIRVANA_SNAPSHOT_KEYS) {
            if (snap[lr][key] === undefined) continue
            if (key === "upgrades" || key === "milestones") player[lr][key] = snap[lr][key].slice()
            else if (key === "unlocked") player[lr][key] = snap[lr][key]
            else if (key === "challenges") player[lr][key] = { ...snap[lr][key] }
            else player[lr][key] = new Decimal(snap[lr][key])
        }
    }
    if (snap.sect && snap.sect.s && player.s) {
        for (const key of ["points", "best", "total"]) {
            if (snap.sect.s[key] !== undefined) player.s[key] = new Decimal(snap.sect.s[key])
        }
    }
    if (typeof updateTemp === "function") updateTemp()
}

function clearNirvanaChallengeSnapshot() {
    if (!player.nsh) return
    if (player.nsh.challengeSnapshot) restoreNirvanaChallengeSnapshot(player.nsh.challengeSnapshot)
    player.nsh.challengeSnapshot = null
}

const NIRVANA_BLIGHT_CHALLENGES = [1, 2, 3, 4, 5, 6]

function nshChallengeUsesTrialReset(challengeId) {
    return NIRVANA_BLIGHT_CHALLENGES.includes(Number(challengeId))
}

function applyNirvanaBlightChallengeStart(challengeId) {
    const id = Number(challengeId)
    insightsEnsure()
    player.insights = decimalZero
    for (const lr of NIRVANA_TREE_BASE) {
        resetCultivationLayerForTrial(lr, false)
        if (lr === "yin") player[lr].unlocked = true
    }
    for (const lr of NIRVANA_TRIAD_LAYERS) layerDataReset(lr, [])
    if (id >= 2) {
        player.yang.unlocked = true
    }
    if (id >= 3) {
        player.ns.unlocked = true
    }
    if (id >= 4) {
        player.nc.unlocked = true
    }
    if (id >= 5) {
        for (const lr of NIRVANA_TRIAD_LAYERS) player[lr].unlocked = true
    }
    if (id === 6) {
        for (const lr of NIRVANA_TRIAD_LAYERS) {
            player[lr].unlocked = true
            player[lr].points = new Decimal(12)
            player[lr].best = new Decimal(12)
        }
    }
    if (typeof updateTemp === "function") updateTemp()
}

function nshAllBlightChallengesMaxed() {
    return maxedChallenge("nsh", 1) && maxedChallenge("nsh", 2) && maxedChallenge("nsh", 3)
        && maxedChallenge("nsh", 4) && maxedChallenge("nsh", 5)
}

function stepThreeEssenceMult() {
    if (player.nirvanaPath === "joss") return new Decimal(0.9)
    return new Decimal(1)
}

function stepThreeUnlocked() {
    return player.stepThreeUnlocked === true
}

function canChooseNirvanaPath() {
    return maxedChallenge("nsh", 6) && !player.nirvanaPath
}

function nirvanaBlightMult(currency) {
    if (!player.nsh || !player.nsh.activeChallenge) return new Decimal(1)
    const id = player.nsh.activeChallenge
    let mult = new Decimal(1)
    if (id === 1) {
        if (currency === "points") mult = mult.times(0.55)
        if (currency === "q") mult = mult.times(0.65)
    }
    if (id === 2 && currency === "f") mult = mult.times(0.5)
    if (id === 3) {
        if (currency === "yin") mult = mult.times(0.5)
        if (currency === "yang") mult = mult.times(0.5)
    }
    if (id === 4) {
        if (currency === "ns") mult = mult.times(0.55)
        if (currency === "nc") mult = mult.times(0.55)
    }
    if (id === 5) {
        if (NIRVANA_TRIAD_LAYERS.includes(currency)) mult = mult.times(0.5)
    }
    if (id === 6) mult = mult.times(0.45)
    return mult
}

function chooseNirvanaPath(path) {
    if (!canChooseNirvanaPath()) return
    if (path !== "essences" && path !== "joss") return
    player.nirvanaPath = path
    if (path === "essences") {
        player.ess.unlocked = true
        if (typeof unlockJournal === "function") unlockJournal("nirvanaEssences")
    } else {
        player.jfl.unlocked = true
        if (typeof unlockJournal === "function") unlockJournal("nirvanaJossFlames")
    }
    updateTemp()
}
