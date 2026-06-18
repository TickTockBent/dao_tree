// Domain layer — one heavenly concept per major Step-1 realm; tabs appear as you reach each realm.

const DOMAIN_IDS = ["qi", "f", "c", "j", "g", "n", "craft", "sf", "st", "asc"]

const DOMAIN_NAMES = {
    qi: "Breathing Domain",
    f: "Pillar Domain",
    c: "Furnace Domain",
    j: "Blade Domain",
    g: "Sun Domain",
    n: "Soul Domain",
    craft: "Craft Domain",
    sf: "Divinity Domain",
    st: "Incarnation Domain",
    asc: "Ascendant Domain",
}

const DOMAIN_JOURNAL = {
    qi: "domainQi",
    f: "domainF",
    c: "domainC",
    j: "domainJ",
    g: "domainG",
    n: "domainN",
    craft: "domainCraft",
    sf: "domainSf",
    st: "domainSt",
    asc: "domainAsc",
}

const DOMAIN_FLAVOR = {
    qi: "boost scattered qi and dantian condensation",
    f: "boost Foundation Establishment",
    c: "boost Core Formation",
    j: "boost Ji Realm weaving",
    g: "boost Perfect Golden Core",
    n: "boost Nascent Soul refinement",
    craft: "boost your profession Dao progress",
    sf: "boost nascent divinity and Soul Formation",
    st: "boost incarnation path and Soul Transformation",
    asc: "boost every Step 1 realm toward Ascendant",
}

const DOMAIN_INTRO = {
    qi: "Comprehend breath as law — boosts scattered qi and dantian qi.",
    f: "Comprehend the unbroken pillar — boosts Foundation.",
    c: "Comprehend the core furnace — boosts Core Formation.",
    j: "Comprehend cutting intent — boosts Ji Realm.",
    g: "Comprehend the inner sun — boosts Golden Core.",
    n: "Comprehend the seated soul — boosts Nascent Soul.",
    craft: "Comprehend the Dao of making — boosts your profession path.",
    sf: "Comprehend condensed divinity — boosts Soul Formation.",
    st: "Comprehend multiplied selves — boosts Soul Transformation.",
    asc: "Comprehend the apex of Step 1 — boosts the whole main tree.",
}

const DOMAIN_BOOST_LAYER = {
    qi: ["q", "points"],
    f: ["f"],
    c: ["c"],
    j: ["j"],
    g: ["g"],
    n: ["n"],
    craft: ["al", "ar", "re"],
    sf: ["sf"],
    st: ["st"],
    asc: ["q", "f", "c", "j", "g", "n", "sf", "st"],
}

const DOMAIN_PASSIVE_LAYER = {
    qi: "q",
    f: "f",
    c: "c",
    j: null,
    g: null,
    n: null,
    craft: "al",
    sf: "sf",
    st: null,
    asc: null,
}

const DOMAIN_COLORS = {
    qi: "#6ee7a8",
    f: "#9bd47b",
    c: "#f2c766",
    j: "#8fb7ff",
    g: "#ffc857",
    n: "#d49cff",
    craft: "#e88fd4",
    sf: "#b8a0ff",
    st: "#a8c4ff",
    asc: "#e8d4a8",
    capstone: "#c4a8ff",
}

// Slot picks evenly across Step 1: 1 @ Nascent → 2 @ SF → 4 @ ST → 6 @ late ST → 10 @ Ascendant.
const DOMAIN_SLOT_GATES = [
    { slots: 1, label: "Nascent Soul", ok() { return domainFormed() } },
    { slots: 2, label: "Soul Formation", ok() { return typeof soulFormationReached === "function" && soulFormationReached() } },
    { slots: 4, label: "Soul Transformation", ok() { return typeof soulTransformationReady === "function" && soulTransformationReady() } },
    { slots: 6, label: "late Soul Transformation", ok() { return hasMilestone("st", 7) } },
    { slots: 10, label: "Ascendant", ok() { return typeof ascendantReached === "function" && ascendantReached() } },
]

const DOMAIN_REALM_GATE = {
    qi: { afterNascent: true },
    f: { afterNascent: true },
    c: { afterNascent: true },
    j: { afterNascent: true },
    g: { afterNascent: true },
    n: { afterNascent: true },
    craft: { afterNascent: true, needProfession: true },
    sf: { check: () => typeof soulFormationReached === "function" && soulFormationReached() },
    st: { check: () => typeof soulTransformationReady === "function" && soulTransformationReady() },
    asc: { check: () => typeof ascendantReached === "function" && ascendantReached() },
}

const DOMAIN_CHALLENGE_BASE = { qi: 10, f: 20, c: 30, j: 40, g: 50, n: 60, craft: 70, sf: 80, st: 90, asc: 100 }

const DOMAIN_MILESTONE_COUNTS = [1, 2, 3, 4, 6, 8]

const DOMAIN_REWARD_DEFS = [
    { type: "gain", mult: 1.12, label: "Gathering Insight", desc: "+12% gain on the linked layer." },
    { type: "prestige", mult: 1.1, label: "Breakthrough Echo", desc: "+10% prestige gain on the linked layer." },
    { type: "passive", amount: 0.005, label: "Mortal Rhythm", desc: "+0.5% passive generation on the linked layer." },
    { type: "requires", mult: 0.95, label: "Lighter Gate", desc: "−5% breakthrough requirements on the linked layer." },
    { type: "best", pow: 0.05, label: "Best Memory", desc: "Linked layer best slightly boosts gain." },
    { type: "insight", mult: 1.15, label: "Heavenly Glimpse", desc: "+15% gain on the linked layer." },
    { type: "preserve", label: "Milestone Anchor", desc: "Keep milestones on the linked layer through its resets." },
    { type: "capstone", mult: 1.25, label: "Domain Capstone", desc: "+25% gain on the linked layer." },
]

const DOMAIN_CAPSTONE_EXTRA = {
    n: " Soul Formation unlocked.",
    sf: " Stronger divinity condensation.",
    st: " Faster incarnation paths.",
    asc: " Step 1 approaches its apex.",
}

const DOMAIN_TRIAL_NAMES = [
    "Trial of Awakening",
    "Trial of Endurance",
    "Trial of Depth",
    "Trial of Clarity",
    "Trial of Resolve",
    "Trial of Harmony",
    "Trial of Transcendence",
    "Capstone — Life and Death",
]

const CULTIVATION_RESET_LAYERS = ["q", "f", "c", "j", "g", "n"]
const SOUL_FORMATION_RESET_LAYERS = ["q", "f", "c", "j", "g", "n", "al", "ar", "re", "dom"]

function domainChallengeIds(domainId) {
    const base = DOMAIN_CHALLENGE_BASE[domainId]
    const ids = []
    for (let i = 1; i <= 8; i++) ids.push(base + i)
    return ids
}

const DOMAIN_CHALLENGES = {}
DOMAIN_IDS.forEach(id => { DOMAIN_CHALLENGES[id] = domainChallengeIds(id) })

function domainName(id) {
    return DOMAIN_NAMES[id] || id
}

function domainCapstoneDesc(domainId) {
    const base = DOMAIN_REWARD_DEFS[7].desc
    return base + (DOMAIN_CAPSTONE_EXTRA[domainId] || "")
}

function domainFormed() {
    return player && player.domainFormed
}

function domainEnsureState() {
    if (!player) return
    if (!Array.isArray(player.domainChosen)) {
        player.domainChosen = []
        if (player.domainPrimary) player.domainChosen.push(player.domainPrimary)
        if (player.domainSecondary) player.domainChosen.push(player.domainSecondary)
        if (player.domainTertiary) player.domainChosen.push(player.domainTertiary)
    }
    if (player.domainTraining === undefined) player.domainTraining = player.domainChosen[0] || null
}

function domainChosenList() {
    domainEnsureState()
    return player.domainChosen
}

function domainRealmUnlocked(id) {
    if (!domainFormed()) return false
    const gate = DOMAIN_REALM_GATE[id]
    if (!gate) return false
    if (gate.afterNascent) {
        if (gate.needProfession) return player.professionPrimary
        return true
    }
    return gate.check()
}

function domainLayerShown() {
    return canFormDomain() || domainFormed()
}

function domainMaxSlots() {
    if (!domainFormed()) return 0
    let slots = 0
    for (const gate of DOMAIN_SLOT_GATES) {
        if (gate.ok()) slots = gate.slots
    }
    return slots
}

function domainNextSlotGate() {
    if (!domainFormed()) return null
    for (const gate of DOMAIN_SLOT_GATES) {
        if (!gate.ok()) return gate
    }
    return null
}

function domainNextSlotUnlockHint() {
    const max = domainMaxSlots()
    const chosen = domainChosenList().length
    if (chosen < max) return `Pick domain ${chosen + 1} of ${max} — slot open now.`
    const next = domainNextSlotGate()
    if (!next) return `All ${DOMAIN_IDS.length} domain picks unlocked (Ascendant).`
    return `Next domain pick (${chosen + 1} of ${next.slots}) at <b>${next.label}</b>.`
}

function hasDomain(id) {
    return domainChosenList().includes(id)
}

function domainChoiceOpen(slot) {
    if (!domainFormed() || !player.professionPrimary) return false
    if (slot < 1 || slot > domainMaxSlots()) return false
    return domainChosenList().length === slot - 1
}

function domainChoiceOpenFor(id) {
    if (!domainFormed() || !player.professionPrimary) return false
    if (hasDomain(id) || !domainRealmUnlocked(id)) return false
    return domainChosenList().length < domainMaxSlots()
}

function domainTabUnlocked(id) {
    return domainRealmUnlocked(id)
}

function domainCanInteract(id) {
    if (!domainTabUnlocked(id)) return false
    if (domainChoiceOpenFor(id)) return true
    return domainFormed() && hasDomain(id)
}

function setDomainTraining(id) {
    domainEnsureState()
    if (!hasDomain(id)) return
    player.domainTraining = id
}

function syncLegacyDomainFields() {
    const list = domainChosenList()
    player.domainPrimary = list[0] || null
    player.domainSecondary = list[1] || null
    player.domainTertiary = list[2] || null
}

function chooseDomain(id) {
    if (!DOMAIN_IDS.includes(id) || !player) return
    if (domainChoiceOpenFor(id)) {
        domainChosenList().push(id)
        player.domainTraining = id
        syncLegacyDomainFields()
        if (typeof unlockJournal === "function") unlockJournal(DOMAIN_JOURNAL[id])
        const n = domainChosenList().length
        if (n === 2 && typeof unlockJournal === "function") unlockJournal("domainSecond")
        if (n === 3 && typeof unlockJournal === "function") unlockJournal("domainThird")
        return
    }
    if (hasDomain(id)) setDomainTraining(id)
}

function domainTrialsComplete(domainId) {
    if (!domainId) return false
    for (const ch of DOMAIN_CHALLENGES[domainId]) {
        if (!hasChallenge("dom", ch)) return false
    }
    return true
}

function domainTrainingId() {
    const list = domainChosenList()
    if (!list.length) return null
    if (player.domainTraining && list.includes(player.domainTraining) && !domainTrialsComplete(player.domainTraining)) {
        return player.domainTraining
    }
    for (const id of list) {
        if (!domainTrialsComplete(id)) return id
    }
    return player.domainTraining || list[0]
}

function activeDomainId() {
    return domainChosenList()[0] || null
}

function canFormDomain() {
    if (!player || domainFormed()) return false
    return hasMilestone("n", 0)
}

function domainChallengesCompletedFor(domainId) {
    if (!domainId) return 0
    let n = 0
    for (const ch of DOMAIN_CHALLENGES[domainId]) {
        if (hasChallenge("dom", ch)) n++
    }
    return n
}

function domainChallengesCompleted() {
    return domainChallengesCompletedFor(domainTrainingId())
}

function domainMilestoneMet(index) {
    const need = DOMAIN_MILESTONE_COUNTS[index]
    return need !== undefined && domainChallengesCompleted() >= need
}

function domainFinalComplete() {
    const train = domainTrainingId()
    if (!train) return false
    return domainTrialsComplete(train)
}

function domainChallengeUnlocked(chId, domainId) {
    if (!domainFormed()) return false
    const training = domainTrainingId()
    if (training !== domainId) return false
    const list = DOMAIN_CHALLENGES[domainId]
    const idx = list.indexOf(chId)
    if (idx < 0) return false
    if (idx === 0) return true
    return hasChallenge("dom", list[idx - 1])
}

function domainBestStat(domainId) {
    if (domainId === "qi") return player.q.best
    if (domainId === "f") return player.f.best
    if (domainId === "c") return player.c.best
    if (domainId === "j") return player.j.best
    if (domainId === "g") return player.g.best
    if (domainId === "n") return player.n.best
    if (domainId === "sf") return player.sf && player.sf.best ? player.sf.best : new Decimal(0)
    if (domainId === "st") {
        return typeof stTotalProgressScore === "function" ? stTotalProgressScore() : new Decimal(0)
    }
    if (domainId === "asc") {
        return typeof ascendantReached === "function" && ascendantReached() ? new Decimal(1) : new Decimal(0)
    }
    if (domainId === "craft") {
        let best = new Decimal(0)
        for (const pid of ["al", "ar", "re"]) {
            if (hasProfession(pid) && player[pid].best.gt(best)) best = player[pid].best
        }
        return best
    }
    return new Decimal(0)
}

function domainTrialComplete(domainId, tier) {
    if (domainId === "qi") {
        const goals = [80, 10, 150, 20, 250, 35, 400, 50]
        if (tier % 2 === 0) return player.points.gte(goals[tier])
        return player.q.best.gte(goals[tier])
    }
    if (domainId === "f") {
        const goals = [12, 25, 40, 55, 75, 95, 110, 130]
        return player.f.best.gte(goals[tier])
    }
    if (domainId === "c") {
        const goals = [5, 12, 22, 35, 50, 65, 80, 95]
        return player.c.best.gte(goals[tier])
    }
    if (domainId === "j") {
        const goals = [15, 35, 60, 90, 120, 150, 175, 190]
        return player.j.best.gte(goals[tier])
    }
    if (domainId === "g") {
        const goals = [15, 35, 60, 90, 120, 150, 175, 190]
        return player.g.best.gte(goals[tier])
    }
    if (domainId === "n") {
        const goals = [2, 3, 5, 7, 9, 11, 13, 15]
        return player.n.best.gte(goals[tier])
    }
    if (domainId === "craft") {
        let best = new Decimal(0)
        for (const pid of ["al", "ar", "re"]) {
            if (hasProfession(pid) && player[pid].best.gt(best)) best = player[pid].best
        }
        if (best.lte(0)) return false
        const goals = [2, 4, 7, 10, 14, 18, 22, 28]
        return best.gte(goals[tier])
    }
    if (domainId === "sf") {
        if (!player.sf || !player.sf.best) return false
        const goals = [1, 10, 100, 500, 1000, 1e4, 1e6, 1e7]
        return player.sf.best.gte(goals[tier])
    }
    if (domainId === "st") {
        if (typeof stTotalProgressScore !== "function") return false
        const goals = [1, 2, 4, 6, 8, 10, 14, 18]
        return stTotalProgressScore().gte(goals[tier])
    }
    if (domainId === "asc") {
        if (!player.asc || !player.asc.best) return false
        const goals = [1, 10, 100, 1000, 10000, 100000, 1e6, 1e7]
        return player.asc.best.gte(goals[tier])
    }
    return false
}

function soulFormationLayerShown() {
    return domainFinalComplete() || (typeof soulFormationReached === "function" && soulFormationReached())
}

function soulFormationPrestigeReset() {
    if (!player) return
    player.domainFormed = false
    player.points = getStartPoints()
    player.q.unlocked = true
    for (const lr of SOUL_FORMATION_RESET_LAYERS) {
        if (!player[lr]) continue
        if (lr === "dom") {
            layerDataReset("dom", ["milestones"])
            continue
        }
        const keep = typeof layerResetKeepForPrestige === "function" ? layerResetKeepForPrestige(lr, "sf") : []
        layerDataReset(lr, keep)
        if (lr !== "q") player[lr].unlocked = false
    }
    for (const id of ["al", "ar", "re"]) {
        if (hasProfession(id)) player[id].unlocked = true
    }
    updateTemp()
}

function domainBreakthrough() {
    if (!canFormDomain()) return
    player.domainFormed = true
    player.dom.unlocked = true
    for (const lr of CULTIVATION_RESET_LAYERS) {
        if (!player[lr]) continue
        layerDataReset(lr, [])
        player[lr].unlocked = lr === "q"
    }
    player.points = getStartPoints()
    if (typeof unlockJournal === "function") unlockJournal("domainFormed")
    updateTemp()
}

function domainAllChosenIds() {
    return domainChosenList()
}

function domainRewardsForDomain(layerKey, domainId) {
    if (!domainId) return []
    const layers = DOMAIN_BOOST_LAYER[domainId]
    let linked = false
    if (domainId === "craft" && ["al", "ar", "re"].includes(layerKey)) linked = true
    else if (layers.includes(layerKey) || (domainId === "qi" && layerKey === "points")) linked = true
    if (!linked) return []
    const out = []
    const list = DOMAIN_CHALLENGES[domainId]
    for (let tier = 0; tier < list.length; tier++) {
        if (hasChallenge("dom", list[tier])) out.push({ reward: DOMAIN_REWARD_DEFS[tier], domainId })
    }
    return out
}

function domainRewardsForLayer(layerKey) {
    const out = []
    for (const id of domainAllChosenIds()) {
        out.push(...domainRewardsForDomain(layerKey, id))
    }
    return out
}

function domainBoost(layerKey) {
    let mult = new Decimal(1)
    for (const entry of domainRewardsForLayer(layerKey)) {
        const r = entry.reward
        if (r.type === "gain" || r.type === "insight" || r.type === "capstone") mult = mult.times(r.mult)
        if (r.type === "best") mult = mult.times(domainBestStat(entry.domainId).add(1).pow(r.pow))
    }
    return mult
}

function domainPrestigeMult(layerKey) {
    let mult = new Decimal(1)
    for (const entry of domainRewardsForLayer(layerKey)) {
        if (entry.reward.type === "prestige") mult = mult.times(entry.reward.mult)
    }
    return mult
}

function domainRequiresMultFor(layer) {
    const id = domainTrainingId() || activeDomainId()
    if (!id) return new Decimal(1)
    const layers = DOMAIN_BOOST_LAYER[id]
    let linked = false
    if (id === "craft" && ["al", "ar", "re"].includes(layer)) linked = true
    else if (layers.includes(layer) || (id === "qi" && layer === "points")) linked = true
    if (!linked) return new Decimal(1)
    const rewardKey = id === "craft" ? layer : (layer === "points" ? "q" : layer)
    let mult = new Decimal(1)
    for (const entry of domainRewardsForLayer(rewardKey)) {
        if (entry.reward.type === "requires") mult = mult.times(entry.reward.mult)
    }
    return mult
}

function domainPassiveBonus(layer) {
    let bonus = 0
    for (const id of domainAllChosenIds()) {
        if (DOMAIN_PASSIVE_LAYER[id] !== layer) continue
        const key = DOMAIN_BOOST_LAYER[id][0]
        for (const entry of domainRewardsForLayer(key === "points" ? "q" : key)) {
            if (entry.domainId !== id) continue
            if (entry.reward.type === "passive") bonus += entry.reward.amount
        }
    }
    return bonus
}

function domainKeepOnReset(layer) {
    const extra = []
    const linked = { qi: "q", f: "f", c: "c", j: "j", g: "g", n: "n", craft: player.professionPrimary, sf: "sf", st: "st" }
    for (const id of domainAllChosenIds()) {
        if (linked[id] !== layer) continue
        const rewardLayer = DOMAIN_BOOST_LAYER[id][0]
        for (const entry of domainRewardsForLayer(rewardLayer === "points" ? "points" : rewardLayer)) {
            if (entry.domainId !== id) continue
            if (entry.reward.type === "preserve") extra.push("milestones")
        }
    }
    return extra
}

function domainStatusHTML() {
    if (!canFormDomain() && !domainFormed()) {
        return "<i>Form a Nascent Soul to approach Domain — one heavenly concept per major Step-1 realm.</i>"
    }
    if (!domainFormed()) {
        return "<i><b>Domain available at Nascent Soul:</b> break through to reset cultivation below. Your profession Dao is unchanged; sect progress remains. You will pick one Domain, then more as Soul Formation, Soul Transformation, and Ascendant open.</i>"
    }
    if (!player.professionPrimary) {
        return "<i><b>Choose a profession Dao</b> on the tree, then commit to Domains in the tabs.</i>"
    }
    const train = domainTrainingId()
    const slots = `${domainChosenList().length}/${domainMaxSlots()}`
    const visible = DOMAIN_IDS.filter(id => domainRealmUnlocked(id)).length
    if (domainChosenList().length < domainMaxSlots()) {
        return `<i><b>${visible}</b> domain concept${visible === 1 ? "" : "s"} available · picks <b>${slots}</b>. ${domainNextSlotUnlockHint()}</i>`
    }
    if (train && !domainTrialsComplete(train)) {
        return `<i>Training <b>${domainName(train)}</b> — ${domainChallengesCompletedFor(train)}/8 trials. Picks <b>${slots}</b>.</i>`
    }
    if (domainFinalComplete()) {
        return "<i><b>Active domain capstone complete.</b> Train another chosen concept or break through to Soul Formation.</i>"
    }
    return `<i>Picks <b>${slots}</b>. Switch tabs to train another committed concept. ${domainNextSlotUnlockHint()}</i>`
}

function domainChoiceHTML(id, flavor) {
    if (!domainFormed()) {
        return `${domainName(id)} — form Domain at Nascent Soul first.`
    }
    if (!domainRealmUnlocked(id)) {
        if (id === "sf") return `${domainName(id)} — appears when you reach Soul Formation.`
        if (id === "st") return `${domainName(id)} — appears when you reach Soul Transformation.`
        if (id === "asc") return `${domainName(id)} — appears when you reach Ascendant.`
        if (DOMAIN_REALM_GATE[id] && DOMAIN_REALM_GATE[id].needProfession) {
            return `${domainName(id)} — requires a profession Dao.`
        }
        return `${domainName(id)} — reach the matching major realm first.`
    }
    if (domainChoiceOpenFor(id)) return `Commit to ${domainName(id)} — ${flavor}`
    if (hasDomain(id)) {
        const active = domainTrainingId() === id ? " <b>[training]</b>" : ""
        return `${domainName(id)} committed.${active} Click to focus trials here.`
    }
    if (domainFormed() && domainChosenList().length >= domainMaxSlots()) {
        return `${domainName(id)} — no open picks (${domainNextSlotUnlockHint()}).`
    }
    if (!domainFormed()) return `${domainName(id)} — form Domain at Nascent Soul to commit.`
    return `${domainName(id)} — ${flavor}`
}

function domainDaoGateHTML() {
    if (!player || !domainFormed()) return ""
    const max = domainMaxSlots()
    const n = domainChosenList().length
    const next = domainNextSlotGate()
    if (n < max) {
        return `<i><b>Domain pick open:</b> ${n}/${max} chosen. ${domainNextSlotUnlockHint()}</i>`
    }
    if (next) {
        return `<i>${n}/${max} domains chosen. ${domainNextSlotUnlockHint()}</i>`
    }
    return `<i>All ${DOMAIN_IDS.length} Step-1 domain picks unlocked (${n}/${DOMAIN_IDS.length} chosen).</i>`
}

function domainAnyChoiceOpen() {
    if (!domainFormed()) return false
    return domainChosenList().length < domainMaxSlots()
}

function buildDomainChallenges() {
    const challenges = {}
    for (const domainId of DOMAIN_IDS) {
        const ids = DOMAIN_CHALLENGES[domainId]
        const color = DOMAIN_COLORS[domainId]
        for (let tier = 0; tier < 8; tier++) {
            const chId = ids[tier]
            const reward = DOMAIN_REWARD_DEFS[tier]
            const trialName = DOMAIN_TRIAL_NAMES[tier]
            const capDesc = tier === 7 ? domainCapstoneDesc(domainId) : `${reward.desc}`
            challenges[chId] = {
                name: `${domainName(domainId).replace(" Domain", "")} — ${trialName}`,
                challengeDescription: `A ${domainName(domainId)} trial testing ${domainId === "craft" ? "your craft" : "its linked cultivation layer"}.`,
                goalDescription: `Complete ${domainName(domainId)} trial ${tier + 1}.`,
                unlocked() { return domainChallengeUnlocked(chId, domainId) },
                canEnter() { return domainTrainingId() === domainId },
                canComplete() { return domainTrialComplete(domainId, tier) },
                rewardDescription: `<b>${reward.label}:</b> ${capDesc}`,
                style: { "border-color": tier === 7 ? DOMAIN_COLORS.capstone : color },
            }
        }
    }
    return challenges
}

function domainChallengeList(domainId) {
    return DOMAIN_CHALLENGES[domainId]
}

function initDomainClickables() {
    const clickables = {}
    for (const id of DOMAIN_IDS) {
        const flavor = DOMAIN_FLAVOR[id]
        clickables[id] = {
            title: `Commit to ${domainName(id)}`,
            display() { return domainChoiceHTML(id, flavor) },
            unlocked() { return domainTabUnlocked(id) },
            canClick() { return domainCanInteract(id) },
            onClick() { chooseDomain(id) },
        }
    }
    clickables[90] = {
        title: "Form Domain",
        display() {
            if (domainFormed()) return "Domain formed — cultivation below has reset. Your profession Dao is unchanged."
            if (!canFormDomain()) return "Requires Nascent Soul (1st major realm milestone on the Nascent layer)."
            return "Break through to Domain at Nascent Soul. Cultivation below resets; profession and sect remain."
        },
        unlocked() { return canFormDomain() || domainFormed() },
        canClick() { return canFormDomain() },
        onClick() { domainBreakthrough() },
    }
    return clickables
}

function initDomainMicrotabs() {
    const tabs = {}
    const titles = { qi: "Breathing", f: "Pillar", c: "Furnace", j: "Blade", g: "Sun", n: "Soul", craft: "Craft", sf: "Divinity", st: "Incarnation", asc: "Ascendant" }
    for (const id of DOMAIN_IDS) {
        tabs[id] = {
            title: titles[id],
            unlocked() { return domainTabUnlocked(id) },
            content: [
                ["display-text", `<div class="realm-intro">${DOMAIN_INTRO[id]}</div>`],
                ["clickables", [id]],
                ["blank", "8px"],
                ["challenges", domainChallengeList(id)],
            ],
        }
    }
    return tabs
}

function layerResetKeepExtras(layer) {
    return []
}

function thirdDomainChoiceOpen() {
    return domainMaxSlots() >= 3 && domainChosenList().length < 3 && domainFormed()
}

function stSecondDomainUnlocked() {
    return domainMaxSlots() >= 2
}
