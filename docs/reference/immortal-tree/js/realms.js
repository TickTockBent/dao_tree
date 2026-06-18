// Minor realm labels aligned with Renegade Immortal (仙逆).

const REALM_MAJOR = {
    q: "Qi Condensation",
    f: "Foundation Establishment",
    c: "Core Formation",
    j: "Ji Realm",
    g: "Golden Core",
    n: "Nascent Soul",
    sf: "Soul Formation",
    st: "Soul Transformation",
    asc: "Ascendant",
    yin: "Illusory Yin",
    yang: "Corporeal Yang",
    ns: "Nirvana Scryer",
    nc: "Nirvana Cleanser",
    dsn: "Divine Sense",
    cel: "Celestial Body",
    isl: "Immortal Soul",
    nsh: "Nirvana Shatterer",
    ess: "Essences",
    jfl: "Joss Flames",
    nv: "Nirvana Void",
    sv: "Spirit Void",
    av: "Arcane Void",
    vt: "Void Turbulant",
    ee: "Empyrean Exalt",
    gex: "Golden Exalt",
    aex: "Ascendant Empyrean",
    ge: "Grand Empyrean",
    htr: "Heaven Trampling Realm",
    al: "Alchemy",
    ar: "Artificer",
    re: "Restrictions Master",
}

const STANDARD_TIER = {
    0: "Early",
    1: "Mid",
    2: "Late",
    3: "Peak",
    4: "Great Circle",
}

// Ji Realm milestones mirror major-realm power, not Early/Mid/Late.
const JI_REALM_POWER = {
    0: "Qi Condensation",
    1: "Foundation Establishment",
    3: "Core Formation",
    4: "Nascent Soul",
    5: "Great Circle",
}

// Golden Core path: core quality grades culminating in Perfect Golden Core.
const GOLDEN_CORE_QUALITY = {
    0: "Cracked Golden Core",
    1: "Lower-Grade Golden Core",
    3: "Middle-Grade Golden Core",
    4: "Upper-Grade Golden Core",
    5: "Perfect Golden Core",
}

const REALM_MINOR = {
    q: { 0: "1st Level", 1: "3rd Level", 2: "6th Level", 3: "10th Level", 4: "15th Level" },
    f: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle" },
    c: { 0: "Early", 1: "Mid", 2: "Late", 3: "Great Circle" },
    n: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle", 5: "Apex", 6: "Perfected" },
    sf: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle", 5: "Apex", 6: "Perfected" },
    st: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle", 5: "Apex", 6: "Perfected", 7: "Transcendent", 8: "Immortal", 9: "Heavenly" },
    asc: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle" },
    yin: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle" },
    yang: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle" },
    ns: { 0: "Early", 1: "Mid", 2: "Late", 3: "Peak", 4: "Great Circle" },
    al: { 0: "Early", 1: "Mid", 2: "Great Circle" },
    ar: { 0: "Early", 1: "Mid", 2: "Great Circle" },
    re: { 0: "Early", 1: "Mid", 2: "Great Circle" },
}

function realmMajor(layer) {
    if (typeof plannedRealmMajor === "function" && !REALM_MAJOR[layer]) {
        const planned = plannedRealmMajor(layer)
        if (planned !== layer) return planned
    }
    return REALM_MAJOR[layer] || (layers[layer] && layers[layer].name) || layer
}

function jiRealmLabel(ms) {
    const power = JI_REALM_POWER[ms]
    return power ? `Ji Realm · ${power}` : realmMajor("j")
}

function goldenCoreLabel(ms) {
    return GOLDEN_CORE_QUALITY[ms] || realmMajor("g")
}

function realmMinor(layer, ms) {
    if (layer === "j") return JI_REALM_POWER[ms] || ""
    if (layer === "g") return GOLDEN_CORE_QUALITY[ms] || ""
    const table = REALM_MINOR[layer]
    return table && table[ms] !== undefined ? table[ms] : ""
}

function realmLabel(layer, ms) {
    if (layer === "j") return jiRealmLabel(ms)
    if (layer === "g") return goldenCoreLabel(ms)
    const minor = realmMinor(layer, ms)
    return minor ? `${realmMajor(layer)}, ${minor}` : realmMajor(layer)
}

function realmReq(layer, ms, cost) {
    return `${realmLabel(layer, ms)} — ${cost}`
}

function realmReqLabel(majorLayer, minorLabel, cost) {
    return `${realmMajor(majorLayer)}, ${minorLabel} — ${cost}`
}

function twinPathCap() {
    const cap = typeof BALANCE !== "undefined" ? BALANCE.twinPath.cap : 20
    return new Decimal(cap)
}

function twinPathAtCap(layer) {
    return player[layer].points.gte(twinPathCap())
}

function twinPathMaxPerReset(layer) {
    const burst = typeof BALANCE !== "undefined" ? BALANCE.twinPath.maxPerResetBurst : 3
    if (hasMilestone(layer, 1)) return new Decimal(burst)
    const base = typeof BALANCE !== "undefined" ? BALANCE.twinPath.maxPerResetBase : 1
    return new Decimal(base)
}

function getTwinPathResetGain(layer) {
    if (tmp[layer].baseAmount.lt(tmp[layer].requires)) return decimalZero
    const room = twinPathCap().sub(player[layer].points).max(0)
    if (room.lte(0)) return decimalZero
    let gain = tmp[layer].baseAmount.div(tmp[layer].requires).pow(tmp[layer].exponent).times(tmp[layer].gainMult).pow(tmp[layer].gainExp)
    if (gain.gte(tmp[layer].softcap)) {
        gain = gain.pow(tmp[layer].softcapPower).times(tmp[layer].softcap.pow(decimalOne.sub(tmp[layer].softcapPower)))
    }
    gain = gain.times(tmp[layer].directMult).floor()
    return Decimal.min(gain, room, twinPathMaxPerReset(layer)).max(0)
}

function twinPathRequiresDiscount(layer) {
    const other = layer === "j" ? "g" : "j"
    const cap = twinPathCap()
    const discounted = typeof BALANCE !== "undefined" ? BALANCE.twinPath.requiresDiscounted : 55
    const base = typeof BALANCE !== "undefined" ? BALANCE.twinPath.requiresBase : 5500
    return player[other].best.gte(cap) ? new Decimal(discounted) : new Decimal(base)
}
