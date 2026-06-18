// Cultivation roadmap after Soul Transformation — design source for future layers, trees, and sect gates.
// Live layers use existing ids (q…st). Planned ids are reserved for implementation.

const CULTIVATION_STEPS = [
    {
        step: 1,
        title: "First Step — Main Tree",
        tab: "Cultivation (current tab)",
        blurb: "Qi Condensation through Soul Transformation on the primary tree. <b>Ascendant</b> is the capstone of this step — the last realm on tree 1.",
        realms: [
            { id: "q", name: "Qi Condensation", live: true },
            { id: "f", name: "Foundation Establishment", live: true },
            { id: "c", name: "Core Formation", live: true },
            { id: "j", name: "Ji Realm", live: true },
            { id: "g", name: "Golden Core", live: true },
            { id: "n", name: "Nascent Soul", live: true },
            { id: "dom", name: "Domain", live: true, branch: true, note: "One heavenly concept per major realm; tabs unlock with cultivation." },
            { id: "sf", name: "Soul Formation", live: true },
            { id: "st", name: "Soul Transformation", live: true },
            { id: "asc", name: "Ascendant", live: true, capstone: true, sectRank: 6 },
        ],
    },
    {
        step: 2,
        title: "Second Step — Nirvana Tree",
        tab: "New cultivation tab (second tree)",
        blurb: "A full second tree opens on its own tab. <b>Illusory Yin</b> starts the branch; <b>Corporeal Yang</b> walks beside it. Nirvana Scryer → Cleanser → Shatterer finish the step; <b>Nirvana Shatterer</b> ends tree 2.",
        realms: [
            { id: "yin", name: "Illusory Yin", live: true, opensTree: true },
            { id: "yang", name: "Corporeal Yang", live: true },
            { id: "ns", name: "Nirvana Scryer", live: true, sectRank: 5 },
            { id: "nc", name: "Nirvana Cleanser", live: true, sectRank: 4 },
            { id: "dsn", name: "Divine Sense", live: true, branch: true },
            { id: "cel", name: "Celestial Body", live: true, branch: true },
            { id: "isl", name: "Immortal Soul", live: true, branch: true },
            { id: "nsh", name: "Nirvana Shatterer", live: true, sectRank: 3 },
            { id: "ess", name: "Essences", live: true, branch: true },
            { id: "jfl", name: "Joss Flames", live: true, branch: true },
        ],
    },
    {
        step: 3,
        title: "Third Step — Void Tree",
        tab: "New cultivation tab (third tree)",
        blurb: "Eight realms on the void tree: four void foundations, then empyrean ascensions culminating in <b>Grand Empyrean</b> (end of tree 3).",
        realms: [
            { id: "nv", name: "Nirvana Void", live: true, opensTree: true, voidGroup: true, sectRank: 2 },
            { id: "sv", name: "Spirit Void", live: false, voidGroup: true },
            { id: "av", name: "Arcane Void", live: false, voidGroup: true },
            { id: "vt", name: "Void Turbulant", live: false, voidGroup: true },
            { id: "ee", name: "Empyrean Exalt", live: false },
            { id: "gex", name: "Golden Exalt", live: false },
            { id: "aex", name: "Ascendant Empyrean", live: false },
            { id: "ge", name: "Grand Empyrean", live: false, capstone: true, endTree: true, sectRank: 1 },
        ],
    },
    {
        step: 4,
        title: "Fourth Step — Endgame",
        tab: "Beyond the three cultivation trees",
        blurb: "The final step of the immortal road.",
        realms: [
            { id: "htr", name: "Heaven Trampling Realm", live: false, endgame: true },
        ],
    },
]

const PLANNED_REALM_MAJOR = {
    asc: "Ascendant",
    yin: "Illusory Yin",
    yang: "Corporeal Yang",
    ns: "Nirvana Scryer",
    nc: "Nirvana Cleanser",
    nsh: "Nirvana Shatterer",
    nv: "Nirvana Void",
    sv: "Spirit Void",
    av: "Arcane Void",
    vt: "Void Turbulant",
    ee: "Empyrean Exalt",
    gex: "Golden Exalt",
    aex: "Ascendant Empyrean",
    ge: "Grand Empyrean",
    htr: "Heaven Trampling Realm",
}

function realmRoadmapRealm(id) {
    for (const step of CULTIVATION_STEPS) {
        for (const r of step.realms) {
            if (r.id === id) return { ...r, step: step.step, stepTitle: step.title }
        }
    }
    return null
}

function realmReached(realmId) {
    if (realmId === "asc") return typeof ascendantReached === "function" && ascendantReached()
    if (realmId === "yin") return typeof illusoryYinReached === "function" && illusoryYinReached()
    if (realmId === "yang") return typeof corporealYangReached === "function" && corporealYangReached()
    if (realmId === "ns") return typeof nirvanaScryerReached === "function" && nirvanaScryerReached()
    if (realmId === "nc") return typeof nirvanaCleanserUnlocked === "function" && nirvanaCleanserUnlocked()
    if (realmId === "dsn" || realmId === "cel" || realmId === "isl") {
        return player[realmId] && (player[realmId].unlocked || player[realmId].best.gte(1))
    }
    if (realmId === "nsh") return typeof nirvanaShattererUnlocked === "function" && nirvanaShattererUnlocked()
    if (realmId === "ess") return player.nirvanaPath === "essences" && player.ess && player.ess.best.gte(1)
    if (realmId === "jfl") return player.nirvanaPath === "joss" && player.jfl && player.jfl.best.gte(1)
    if (realmId === "nv") return typeof stepThreeUnlocked === "function" && stepThreeUnlocked()
    const r = realmRoadmapRealm(realmId)
    if (!r || !r.live) return false
    if (player[realmId]) return player[realmId].unlocked || (player[realmId].best && player[realmId].best.gte(1))
    return false
}

function nirvanaCleanserReached() { return realmReached("nc") }
function nirvanaShattererReached() { return realmReached("nsh") }
function nirvanaVoidReached() { return realmReached("nv") }
function grandEmpyreanReached() { return realmReached("ge") }
function heavenTramplingReached() { return realmReached("htr") }

function plannedRealmMajor(id) {
    return PLANNED_REALM_MAJOR[id] || (typeof REALM_MAJOR !== "undefined" && REALM_MAJOR[id]) || id
}

function realmRoadmapHTML() {
    let html = `<div class="future-list">
        <p>The immortal road is organized in <b>four steps</b>. Steps 2 and 3 each add a <b>new cultivation tree</b> on its own tab. Sect transfers (Rank 10 → 1) track the same gates — become Sect Leader, then join the next sect when cultivation allows.</p>`

    for (const step of CULTIVATION_STEPS) {
        html += `<h3>Step ${step.step}: ${step.title}</h3>`
        html += `<p><i>${step.tab}</i> — ${step.blurb}</p><ul>`
        for (const r of step.realms) {
            let tags = []
            if (r.live) tags.push("live")
            else tags.push("planned")
            if (r.capstone) tags.push("capstone")
            if (r.endTree) tags.push("end of tree")
            if (r.parallel) tags.push("parallel to " + plannedRealmMajor(r.parallel))
            if (r.opensTree) tags.push("opens tree")
            if (r.voidGroup) tags.push("void foundation")
            if (r.sectRank) tags.push("sect Rank " + r.sectRank)
            if (r.endgame) tags.push("endgame")
            const tagStr = tags.length ? ` <span style="opacity:0.75">(${tags.join(" · ")})</span>` : ""
            html += `<li><b>${r.name}</b>${tagStr}</li>`
        }
        html += `</ul>`
    }

    html += `<h3>Tree layout (planned)</h3>
        <p><b>Tree 1:</b> q → f → c → (j, g) → n → professions → dom → sf → st → <b>Ascendant</b></p>
        <p><b>Tree 2 (new tab):</b> Illusory Yin ∥ Corporeal Yang → Nirvana Scryer → Nirvana Cleanser → <b>Nirvana Shatterer</b></p>
        <p><b>Tree 3 (new tab):</b> Nirvana Void → Spirit Void → Arcane Void → Void Turbulant → Empyrean Exalt → Golden Exalt → Ascendant Empyrean → <b>Grand Empyrean</b></p>
        <p><b>Step 4:</b> <b>Heaven Trampling Realm</b></p>`
    html += `</div>`
    return html
}

function realmRoadmapCompactHTML() {
    const parts = []
    for (const step of CULTIVATION_STEPS) {
        const names = step.realms.map(r => r.name + (r.live ? "" : "†")).join(" → ")
        parts.push(`<b>Step ${step.step}:</b> ${names}`)
    }
    return `<div class="realm-intro">${parts.join("<br>")}<br><span style="opacity:0.8">† planned</span></div>`
}
