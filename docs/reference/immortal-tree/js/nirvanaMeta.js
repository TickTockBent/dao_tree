// Step 2 — separate tree: insights, Nirvana fallout meta, tree-isolated resets.

const NIRVANA_LAYERS = ["yin", "yang", "ns", "nc", "dsn", "cel", "isl", "nsh", "ess", "jfl", "nv"]
const NIRVANA_TREE_RESET_LAYERS = ["q", "f", "c", "j", "g", "n", "al", "ar", "re", "dom", "sf", "asc"]
const NIRVANA_RUN_RESET_LAYERS = ["yin", "yang"]

const NIRVANA_FAIL_MULT_BASE = 1.35
const NIRVANA_FAIL_MULT_PEAK = 0.08

const NIRVANA_AUTOBUY_GATES = [
    { layer: "q", ms: 0 },
    { layer: "f", ms: 0 },
    { layer: "c", ms: 1 },
    { layer: "j", ms: 1 },
    { layer: "g", ms: 1 },
    { layer: "n", ms: 0 },
    { layer: "s", ms: 0 },
]

const NIRVANA_PRESERVE_RULES = [
    { reset: "f", ms: 1, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "c", ms: 0, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "c", ms: 1, target: "q", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 0, target: "c", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 1, target: "f", keep: ["milestones", "upgrades"] },
    { reset: "n", ms: 2, target: "q", keep: ["milestones", "upgrades"] },
]

function treeOfNirvana(layer) {
    return NIRVANA_LAYERS.includes(layer)
}

function insightsEnsure() {
    if (!player) return
    if (player.insights === undefined) player.insights = new Decimal(0)
    if (player.bestInsights === undefined) player.bestInsights = new Decimal(0)
    if (player.totalInsights === undefined) player.totalInsights = new Decimal(0)
    if (player.nirvanaFallout === undefined) player.nirvanaFallout = 0
    if (player.scryerAttempts === undefined) player.scryerAttempts = 0
}

function onNirvanaTreeTab() {
    return player && player.navTab === "tree-tab-2"
}

function nirvanaScryerReached() {
    return player && player.ns && player.ns.unlocked
}

function nirvanaScryerSecondStepReached() {
    return nirvanaScryerReached()
}

function illusoryYinReached() {
    return player && player.yin && (player.yin.unlocked || player.yin.best.gte(1))
}

function corporealYangReached() {
    return player && player.yang && (player.yang.unlocked || player.yang.best.gte(1))
}

function nirvanaFalloutActive() {
    insightsEnsure()
    return player.nirvanaFallout >= 1
}

function nirvanaFalloutPreserveActive() {
    insightsEnsure()
    return player.nirvanaFallout >= 2
}

function nirvanaFalloutMult() {
    let mult = new Decimal(1)
    if (!nirvanaFalloutActive()) return mult
    mult = mult.times(NIRVANA_FAIL_MULT_BASE)
    if (player.asc && player.asc.best) mult = mult.times(player.asc.best.add(1).pow(NIRVANA_FAIL_MULT_PEAK))
    if (player.yang && player.yang.best) mult = mult.times(player.yang.best.add(1).pow(0.04))
    if (hasMilestone("yin", 2)) mult = mult.times(1.1)
    if (hasMilestone("yang", 2)) mult = mult.times(1.12)
    return mult
}

function getInsightGen() {
    if (!onNirvanaTreeTab()) return new Decimal(0)
    insightsEnsure()
    let gain = new Decimal(1)
    if (hasMilestone("ns", 0)) gain = gain.times(1.25)
    if (hasMilestone("yin", 0)) gain = gain.times(1.5)
    if (hasMilestone("yin", 2)) gain = gain.times(1.25)
    if (hasUpgrade("yin", 11)) gain = gain.times(2)
    if (hasUpgrade("yin", 12)) gain = gain.times(player.yin.points.add(1).pow(0.1))
    if (player.asc && player.asc.best) gain = gain.times(player.asc.best.add(1).pow(0.05))
    gain = gain.times(nirvanaFalloutMult())
    if (typeof ascCultivationMult === "function") gain = gain.times(ascCultivationMult())
    return gain
}

function nirvanaAutomationLayers() {
    if (!nirvanaFalloutActive()) return []
    const out = []
    for (const gate of NIRVANA_AUTOBUY_GATES) {
        if (hasMilestone(gate.layer, gate.ms)) out.push(gate.layer)
    }
    return out
}

function nirvanaPreserveKeep(targetLayer, resettingLayer) {
    if (!nirvanaFalloutPreserveActive()) return []
    const keep = []
    for (const rule of NIRVANA_PRESERVE_RULES) {
        if (rule.reset !== resettingLayer || rule.target !== targetLayer) continue
        if (!hasMilestone(resettingLayer, rule.ms)) continue
        for (const field of rule.keep) keep.push(field)
    }
    return keep
}

function nirvanaResetTree2Run(keepYinYangMeta) {
    insightsEnsure()
    player.insights = new Decimal(0)
    for (const lr of NIRVANA_RUN_RESET_LAYERS) {
        if (!player[lr]) continue
        const keep = keepYinYangMeta ? ["milestones", "upgrades"] : []
        layerDataReset(lr, keep)
        if (!keepYinYangMeta) player[lr].unlocked = lr === "yin"
    }
}

function scryerFallResetTree1() {
    if (!player) return
    insightsEnsure()
    stEnsureState()
    const first = player.st.unlockedAvatars[0] || ST_AVATAR_IDS.find(id => stAvatarUnlocked(id))
    player.st.maxActiveSlots = 1
    player.st.active = first && stAvatarUnlocked(first) ? [first] : []

    player.domainFormed = false
    player.points = getStartPoints()
    player.q.unlocked = true

    for (const lr of NIRVANA_TREE_RESET_LAYERS) {
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
    nirvanaResetTree2Run(true)
    player.nirvanaFallout = Math.max(player.nirvanaFallout, 1)
    player.scryerAttempts = (player.scryerAttempts || 0) + 1
    if (typeof unlockJournal === "function") unlockJournal("nirvanaFall")
    updateTemp()
}

function activeMainCurrencyHTML() {
    insightsEnsure()
    if (onNirvanaTreeTab()) {
        const rate = typeof getInsightGen === "function" ? format(getInsightGen()) : "0"
        return `<span class="overlayThing">You have </span><h2 class="overlayThing">${format(player.insights)}</h2><span class="overlayThing"> insights</span><br><span class="overlayThing">(${rate}/sec on Step 2)</span>`
    }
    return ""
}
