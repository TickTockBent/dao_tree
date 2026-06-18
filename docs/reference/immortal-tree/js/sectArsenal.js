// Sect arsenal automations — granted upgrades in the Immortal Sect arsenal tab (reset on sect transfer).

const SECT_REALM_AUTO_LAYERS = {
    41: ["q"],
    42: ["q", "f", "c"],
}

const SECT_AUTO_REPLAY_ORDER = [11, 12, 13, 21, 22, 23, 24, 31, 32, 33]

function sectArsenalRealmAutoLayers() {
    const layers = []
    for (const upg in SECT_REALM_AUTO_LAYERS) {
        if (hasUpgrade("s", upg)) {
            for (const lr of SECT_REALM_AUTO_LAYERS[upg]) {
                if (!layers.includes(lr)) layers.push(lr)
            }
        }
    }
    return layers
}

function sectArsenalAutoReplaySlots() {
    let slots = 0
    if (hasUpgrade("s", 51)) slots++
    if (hasUpgrade("s", 52)) slots++
    return slots
}

function sectTrialRewardEarned(challengeId) {
    for (const id in TECHNIQUE_DEFS) {
        if (TECHNIQUE_DEFS[id].eventId === challengeId && hasTechnique(id)) return true
    }
    return false
}

function sectSnapshotMeetsTrialGoal(challengeId) {
    const snap = player.s && player.s.challengeSnapshot
    if (!snap) return false
    const id = Number(challengeId)
    const pts = new Decimal(snap.scattered || 0)
    const layerBest = (lr) => (snap[lr] && snap[lr].best !== undefined ? new Decimal(snap[lr].best) : new Decimal(0))

    if (id === 11) return layerBest("q").gte(1) && pts.gte(30)
    if (id === 12) return layerBest("q").gte(25)
    if (id === 13) return layerBest("f").gte(15)
    if (id === 21) return layerBest("f").gte(45)
    if (id === 22) return false
    if (id === 23) return layerBest("c").gte(1)
    if (id === 24) return false
    if (id === 31) return layerBest("c").gte(65)
    if (id === 32) return layerBest("j").gte(8) && layerBest("g").gte(8)
    if (id === 33) return layerBest("j").gte(20) && layerBest("g").gte(20)
    return false
}

function sectVeteranTrialEligible(challengeId) {
    if (maxedChallenge("s", challengeId)) return false
    if (!tmp.s.challenges[challengeId] || !tmp.s.challenges[challengeId].unlocked) return false
    if (!sectTrialRewardEarned(challengeId)) return false
    return sectSnapshotMeetsTrialGoal(challengeId)
}

function sectArsenalAutomate() {
    if (!player || !player.s || player.s.activeChallenge) return
    if (typeof hasSectContributionAccess === "function" && !hasSectContributionAccess()) return

    if (hasUpgrade("s", 43) && tmp.s && tmp.s.canReset) doReset("s")

    for (const lr of sectArsenalRealmAutoLayers()) {
        if (!tmp[lr] || !tmp[lr].canReset) continue
        if (typeof eventBlocksReset === "function" && eventBlocksReset(lr)) continue
        doReset(lr)
    }

    if (sectArsenalAutoReplaySlots() <= 0) return
    player.sectAutoReplayTick = (player.sectAutoReplayTick || 0) + 1
    if (player.sectAutoReplayTick < 60) return
    player.sectAutoReplayTick = 0
    sectArsenalAutoReplayStep()
}

function sectArsenalAutoReplayStep() {
    const slots = sectArsenalAutoReplaySlots()
    if (slots <= 0 || player.s.activeChallenge || player.sectAutoReplayBusy) return

    if (!Array.isArray(player.sectAutoReplayOrder) || player.sectAutoReplayOrder.length === 0) {
        player.sectAutoReplayOrder = SECT_AUTO_REPLAY_ORDER.filter(id => sectVeteranTrialEligible(id))
        player.sectAutoReplayIdx = 0
        if (player.sectAutoReplayOrder.length === 0) return
    }

    const idx = player.sectAutoReplayIdx || 0
    if (idx >= player.sectAutoReplayOrder.length) {
        player.sectAutoReplayOrder = []
        player.sectAutoReplayIdx = 0
        return
    }

    const id = player.sectAutoReplayOrder[idx]
    if (!sectVeteranTrialEligible(id)) {
        player.sectAutoReplayIdx = idx + 1
        return
    }

    player.sectAutoReplayBusy = true
    const snap = takeCultivationChallengeSnapshot()
    player.s.challengeSnapshot = snap
    if (typeof applySectChallengeStart === "function") applySectChallengeStart(id)
    Vue.set(player.s, "activeChallenge", id)
    run(layers.s.challenges[id].onEnter, layers.s.challenges[id])
    updateChallengeTemp("s")

    for (let i = 0; i < 64; i++) {
        for (const lr of sectArsenalRealmAutoLayers()) {
            if (tmp[lr] && tmp[lr].canReset && !(typeof eventBlocksReset === "function" && eventBlocksReset(lr))) {
                doReset(lr)
            }
        }
        if (canCompleteChallenge("s", id)) break
    }

    if (canCompleteChallenge("s", id)) {
        completeChallenge("s", id)
    } else {
        Vue.set(player.s, "activeChallenge", null)
        restoreCultivationChallengeSnapshot(snap)
        player.s.challengeSnapshot = null
        run(layers.s.challenges[id].onExit, layers.s.challenges[id])
        updateChallengeTemp("s")
    }

    player.sectAutoReplayBusy = false
    player.sectAutoReplayIdx = idx + 1
}
