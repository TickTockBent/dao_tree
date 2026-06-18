// Post–Nascent Soul profession paths: Alchemy, Artificer, Restrictions Master.

const PROFESSION_IDS = ["al", "ar", "re"]

const PROFESSION_JOURNAL = { al: "daoAlchemy", ar: "daoArtificer", re: "daoRestrictions" }

function professionName(id) {
    const names = { al: "Alchemy", ar: "Artificer", re: "Restrictions Master" }
    return names[id] || id
}

function soulTransformationReached() {
    return typeof soulTransformationReady === "function" ? soulTransformationReady() : hasMilestone("sf", 6)
}

function stThirdProfessionUnlocked() {
    return hasMilestone("st", 7)
}

function hasProfession(id) {
    if (!player) return false
    return player.professionPrimary === id || player.professionSecondary === id || player.professionTertiary === id
}

function professionChoiceOpen(slot) {
    if (slot === 1) return !player.professionPrimary && hasMilestone("n", 0)
    if (slot === 2) return hasMilestone("sf", 3) && player.professionPrimary && !player.professionSecondary
    if (slot === 3) return stThirdProfessionUnlocked() && player.professionSecondary && !player.professionTertiary
    return false
}

function chooseProfession(id) {
    if (!PROFESSION_IDS.includes(id) || !player) return
    if (hasProfession(id)) return
    if (professionChoiceOpen(1)) {
        player.professionPrimary = id
        player[id].unlocked = true
        if (typeof unlockJournal === "function") {
            unlockJournal(PROFESSION_JOURNAL[id])
        }
        return
    }
    if (professionChoiceOpen(2)) {
        player.professionSecondary = id
        player[id].unlocked = true
        if (typeof unlockJournal === "function") {
            unlockJournal(PROFESSION_JOURNAL[id])
            unlockJournal("daoSecond")
        }
        return
    }
    if (professionChoiceOpen(3)) {
        player.professionTertiary = id
        player[id].unlocked = true
        if (typeof unlockJournal === "function") {
            unlockJournal(PROFESSION_JOURNAL[id])
            unlockJournal("daoThird")
        }
    }
}

function professionLayerShown(id) {
    if (!hasMilestone("n", 0)) return false
    if (professionChoiceOpen(1)) return true
    if (hasProfession(id)) return true
    return professionChoiceOpen(2) || professionChoiceOpen(3)
}

function professionDaoGateHTML() {
    if (!player || !player.professionPrimary) return ""
    if (!player.professionSecondary) {
        if (hasMilestone("sf", 3)) return "<i><b>Second Dao open:</b> choose another profession on the tree.</i>"
        return "<i><b>Second Dao sealed</b> until Soul Formation milestone: 1,000 divinities and a Second Life.</i>"
    }
    if (!player.professionTertiary) {
        if (stThirdProfessionUnlocked()) return "<i><b>Third Dao open:</b> choose your final profession on the tree.</i>"
        if (soulTransformationReached()) return "<i><b>Third Dao sealed</b> until Soul Transformation <b>Peak</b> (four active incarnations and path progress).</i>"
        return "<i><b>Third Dao sealed</b> until you reach <b>Soul Transformation</b>.</i>"
    }
    return "<i>All three profession Daos walk with you.</i>"
}

function professionChoiceHTML(id, flavor) {
    if (professionChoiceOpen(1)) return `Commit to the ${professionName(id)} Dao — ${flavor}`
    if (professionChoiceOpen(2) && !hasProfession(id)) {
        return `Take ${professionName(id)} as your second Dao — ${flavor}`
    }
    if (professionChoiceOpen(3) && !hasProfession(id)) {
        return `Take ${professionName(id)} as your third Dao — ${flavor}`
    }
    if (hasProfession(id)) return `${professionName(id)} Dao active.`
    if (player.professionPrimary && !player.professionSecondary && !hasMilestone("sf", 3)) {
        return `${professionName(id)} waits for Soul Formation progress (1,000 divinities and a Second Life).`
    }
    if (player.professionSecondary && !player.professionTertiary && !stThirdProfessionUnlocked()) {
        if (soulTransformationReached()) return `${professionName(id)} waits for ST Peak — four active incarnations and ${format(new Decimal(10))} path progress.`
        return `${professionName(id)} waits behind Soul Transformation.`
    }
    return "This Dao is not available on your path."
}

function alchemyPointsMult() {
    let mult = new Decimal(1)
    if (!hasProfession("al")) return mult
    if (hasUpgrade("al", 11)) mult = mult.times(1.15)
    if (hasUpgrade("al", 12)) mult = mult.times(player.al.points.add(1).pow(0.12))
    if (hasUpgrade("al", 13)) mult = mult.times(1.2)
    if (hasUpgrade("al", 21)) mult = mult.times(1.15)
    if (hasUpgrade("al", 22)) mult = mult.times(player.al.points.add(1).pow(0.15))
    if (hasUpgrade("al", 23)) mult = mult.times(1.35)
    if (hasUpgrade("al", 31)) mult = mult.times(1.2)
    return mult
}

function artificerPassiveMult() {
    let mult = 1
    if (!hasProfession("ar")) return mult
    if (hasUpgrade("ar", 11)) mult *= 1.25
    if (hasUpgrade("ar", 12)) mult *= 1.15
    if (hasUpgrade("ar", 13)) mult *= 1.2
    if (hasUpgrade("ar", 21)) mult *= 1.15
    if (hasUpgrade("ar", 22)) mult *= 1.2
    if (hasUpgrade("ar", 23)) mult *= 1.35
    if (hasUpgrade("ar", 31)) mult *= 1.25
    return mult
}

function artificerAutoLayers() {
    const layers = []
    if (!hasProfession("ar")) {
        if (typeof ascAutomationLayers === "function") return ascAutomationLayers()
        return layers
    }
    if (hasUpgrade("ar", 21)) layers.push("q")
    if (hasUpgrade("ar", 22)) layers.push("f")
    if (hasUpgrade("ar", 23)) layers.push("c", "s")
    if (typeof ascAutomationLayers === "function") {
        for (const l of ascAutomationLayers()) {
            if (!layers.includes(l)) layers.push(l)
        }
    }
    if (typeof nirvanaAutomationLayers === "function") {
        for (const l of nirvanaAutomationLayers()) {
            if (!layers.includes(l)) layers.push(l)
        }
    }
    return layers
}

function restrictionRequiresMult() {
    let mult = new Decimal(1)
    if (!hasProfession("re")) return mult
    if (hasUpgrade("re", 11)) mult = mult.times(0.96)
    if (hasUpgrade("re", 12)) mult = mult.times(0.96)
    if (hasUpgrade("re", 21)) mult = mult.times(0.95)
    if (hasUpgrade("re", 22)) mult = mult.times(0.94)
    if (hasUpgrade("re", 32)) mult = mult.times(0.96)
    return mult
}

function restrictionKeepOnReset(layer) {
    const extra = []
    if (!hasProfession("re")) return extra
    if (hasUpgrade("re", 13) && layer === "q") extra.push("upgrades")
    if (hasUpgrade("re", 23) && layer === "f") extra.push("upgrades")
    if (hasUpgrade("re", 31) && (layer === "c" || layer === "j" || layer === "g")) extra.push("upgrades")
    return extra
}

function restrictionGainMult(layer) {
    let mult = new Decimal(1)
    if (!hasProfession("re")) return mult
    if (hasUpgrade("re", 24)) mult = mult.times(1.1)
    if (hasUpgrade("re", 32)) mult = mult.times(player.re.points.add(1).pow(0.08))
    return mult
}

function applyRestrictionRequires(base) {
    if (typeof restrictionRequiresMult !== "function") return base
    return base.times(restrictionRequiresMult())
}
