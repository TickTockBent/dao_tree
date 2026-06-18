// Sect transfer ladder — each prestige on layer "k" means leaving your sect and joining a higher-ranked one.
// SECT_TRANSFER_IMPLEMENTED controls how many steps are live; raise it as cultivation layers ship.

const SECT_START_WORLD_RANK = 10
const SECT_FINAL_WORLD_RANK = 1
const SECT_TRANSFER_IMPLEMENTED = 3

const SECT_RANK_ASCENSION_CAP = SECT_TRANSFER_IMPLEMENTED
const SECT_MIN_WORLD_RANK = SECT_START_WORLD_RANK - SECT_TRANSFER_IMPLEMENTED

function sectWorldRank() {
    if (!player || !player.k || player.k.points === undefined) return new Decimal(SECT_START_WORLD_RANK)
    return new Decimal(SECT_START_WORLD_RANK).sub(player.k.points)
}

function nextSectWorldRank() {
    const gate = sectRankAscensionGate()
    if (gate && gate.targetRank !== undefined) return new Decimal(gate.targetRank)
    return sectWorldRank().sub(1).max(SECT_FINAL_WORLD_RANK)
}

const SECT_TRANSFER_STEPS = [
    {
        rank: 9,
        label: "Nascent Soul",
        detail: "Form at least <b>1 nascent soul</b> and become <b>Sect Leader</b> before you may join a Rank 9 sect.",
        journal: "sectRank9",
        implemented: true,
        done() { return hasMilestone("n", 0) },
    },
    {
        rank: 8,
        label: "Soul Formation",
        detail: "Break through to <b>Soul Formation</b> and lead your current sect before joining a Rank 8 sect.",
        journal: "sectRank8",
        implemented: true,
        done() {
            return typeof soulFormationReached === "function" && soulFormationReached()
        },
    },
    {
        rank: 7,
        label: "Soul Transformation",
        detail: "Reach <b>Soul Transformation</b> and lead your current sect before joining a Rank 7 sect.",
        journal: "sectRank7",
        implemented: true,
        done() {
            return typeof soulTransformationReady === "function" && soulTransformationReady()
        },
    },
    {
        rank: 6,
        label: "Ascendant",
        detail: "Future: join a Rank 6 sect after <b>Ascendant</b> — capstone of <b>Step 1</b> (main tree).",
        journal: "sectRank6",
        implemented: false,
        done() { return typeof ascendantReached === "function" && ascendantReached() },
    },
    {
        rank: 5,
        label: "Nirvana Scryer",
        detail: "Future: join a Rank 5 sect on the <b>second tree</b> after reaching <b>Nirvana Scryer</b> (Illusory Yin / Corporeal Yang behind you).",
        journal: "sectRank5",
        implemented: true,
        done() { return typeof nirvanaScryerReached === "function" && nirvanaScryerReached() },
    },
    {
        rank: 4,
        label: "Nirvana Shatterer",
        detail: "Join a Rank 4 sect after <b>Nirvana Shatterer</b> — triad refinements capped and Heavenly Blights behind you.",
        journal: "sectRank4",
        implemented: true,
        done() { return typeof nirvanaShattererUnlocked === "function" && nirvanaShattererUnlocked() },
    },
    {
        rank: 3,
        label: "Nirvana Void",
        detail: "Future: join a Rank 3 sect after <b>Nirvana Void</b> — Third Step on the void tree.",
        journal: "sectRank3",
        implemented: false,
        done() { return typeof stepThreeUnlocked === "function" && stepThreeUnlocked() },
    },
    {
        rank: 2,
        label: "Nirvana Void",
        detail: "Future: join a Rank 2 sect at <b>Nirvana Void</b> — opening of <b>Step 3</b> (third tree / void arc).",
        journal: "sectRank2",
        implemented: false,
        done() { return typeof nirvanaVoidReached === "function" && nirvanaVoidReached() },
    },
    {
        rank: 1,
        label: "Grand Empyrean",
        detail: "Future: join a Rank 1 sect at <b>Grand Empyrean</b> — capstone of <b>Step 3</b> (void tree).",
        journal: "sectRank1",
        implemented: false,
        done() { return typeof grandEmpyreanReached === "function" && grandEmpyreanReached() },
    },
]

function sectTransferStepIndex() {
    if (!player || !player.k || player.k.points === undefined) return 0
    return Math.min(player.k.points.toNumber(), SECT_TRANSFER_STEPS.length - 1)
}

function sectRankAscensionGate() {
    const idx = sectTransferStepIndex()
    const step = SECT_TRANSFER_STEPS[idx]
    if (!step) {
        return {
            ok: false,
            need: "Sealed",
            detail: "No further sect transfers are defined.",
            future: true,
        }
    }
    if (!step.implemented) {
        return {
            ok: false,
            need: step.label,
            detail: step.detail,
            future: true,
            targetRank: step.rank,
        }
    }
    return {
        ok: step.done(),
        need: step.label,
        detail: step.detail,
        future: false,
        targetRank: step.rank,
    }
}

function sectTransferRoadmapHTML(compact) {
    const lines = []
    const current = sectWorldRank()
    for (let i = 0; i < SECT_TRANSFER_STEPS.length; i++) {
        const step = SECT_TRANSFER_STEPS[i]
        const serving = current.eq(step.rank)
        const passed = current.lt(step.rank)
        let status = step.implemented ? "planned" : "future"
        if (passed) status = "passed"
        else if (serving) status = "current"
        else if (step.implemented && player.k.points.gt(i)) status = "joined"

        const tag = status === "current" ? " <b>[your sect]</b>"
            : status === "passed" ? " ✓"
            : !step.implemented ? " <i>(future)</i>" : ""
        if (compact && status === "passed") continue
        lines.push(`Rank ${step.rank}: ${step.label}${tag}`)
    }
    const intro = compact
        ? "<b>Sect ladder (higher rank = better sect):</b><br>"
        : "<h3>Sect transfer ladder</h3><p>Each row is a <b>new sect</b> you join after Sect Leader + cultivation gate. Disciple duties reset every transfer.</p><ul>"
    if (compact) return `<div class="realm-intro">${intro}${lines.join("<br>")}</div>`
    return `<div class="future-list">${intro}<li>${lines.join("</li><li>")}</li></ul><p><i>Live: Rank 10→7. Planned: Ascendant (Step 1) → Nirvana tree (Step 2) → Void tree (Step 3) → Heaven Trampling (Step 4 endgame).</i></p></div>`
}

function onSectTransferComplete() {
    const idx = player.k.points.toNumber() - 1
    if (idx < 0 || idx >= SECT_TRANSFER_STEPS.length) return
    const step = SECT_TRANSFER_STEPS[idx]
    if (step && step.journal && typeof unlockJournal === "function") unlockJournal(step.journal)
    if (typeof joinHigherSect === "function") joinHigherSect()
}

function atRank10Sect() {
    return sectWorldRank().gte(SECT_START_WORLD_RANK)
}

function sectServingWorldRankAtMost(maxWorldRank) {
    return sectWorldRank().lte(maxWorldRank)
}

function twinPathOtherStarted(layer) {
    const other = layer === "j" ? "g" : "j"
    if (!player[other]) return false
    return player[other].best.gte(1) || player[other].points.gte(1)
}

function twinPathSelfStarted(layer) {
    if (!player[layer]) return false
    return player[layer].best.gte(1) || player[layer].points.gte(1)
}

// Rank 10: allow cultivation while working toward the trial that grants each rank (avoids hard locks).
function rank10OuterStandingMet() {
    if (hasMilestone("s", 0)) return true
    if (hasTechnique("t_outer_tournament")) return true
    if (player.f && player.f.best.lt(15)) return true
    if (typeof inEvent === "function" && inEvent(13)) return true
    return false
}

function rank10InnerStandingMet() {
    if (hasMilestone("s", 1)) return true
    if (hasTechnique("t_inner_meridian")) return true
    if (player.f && player.f.best.lt(45)) return true
    if (typeof inEvent === "function" && (inEvent(21) || inEvent(23))) return true
    return false
}

function rank10ElderStandingMet() {
    if (hasMilestone("s", 3)) return true
    if (hasTechnique("t_pill_audit")) return true
    if (player.c && player.c.best.gte(25) && player.s && player.s.best.gte(40)) return true
    if (typeof inEvent === "function" && (inEvent(24) || inEvent(32) || inEvent(33))) return true
    return false
}

function rank10LeaderStandingMet() {
    if (typeof isSectLeader === "function" && isSectLeader()) return true
    if (player.w && player.w.best.gte(12)) return true
    if (player.w && player.w.best.gte(1)) return true
    if (hasTechnique("t_war_vanguard")) return true
    if (typeof inEvent === "function" && (inEvent(41) || inEvent(42))) return true
    return false
}

function rank10NascentStandingMet() {
    if (rank10LeaderStandingMet()) return true
    if (hasMilestone("j", 5) && hasMilestone("g", 5)) return true
    if (typeof inEvent === "function" && inEvent(42)) return true
    return false
}

function rank10TwinPathRoleMet(layer) {
    if (twinPathSelfStarted(layer)) return true
    if (twinPathOtherStarted(layer)) return rank10LeaderStandingMet()
    return rank10ElderStandingMet()
}

function rank10SectRoleMet(spec, layer) {
    if (!spec || !spec.role) return true
    if (spec.role === "outer") return rank10OuterStandingMet()
    if (spec.role === "inner") return rank10InnerStandingMet()
    if (spec.role === "elder") return rank10ElderStandingMet()
    if (spec.role === "leader") {
        if (layer === "n") return rank10NascentStandingMet()
        return rank10LeaderStandingMet()
    }
    if (spec.role === "twin") return rank10TwinPathRoleMet(layer)
    return true
}

function rank10SectRoleLabel(spec, layer) {
    if (!spec || !spec.role) return "disciple standing"
    if (spec.role === "outer") return "Outer Disciple in your Rank 10 sect"
    if (spec.role === "inner") return "Inner Disciple in your Rank 10 sect"
    if (spec.role === "elder") return "Sect Elder in your Rank 10 sect"
    if (spec.role === "leader") return "Sect Leader in your Rank 10 sect"
    if (spec.role === "twin") {
        return twinPathOtherStarted(layer)
            ? "Sect Leader in your Rank 10 sect (second twin path)"
            : "Sect Elder in your Rank 10 sect (first twin path)"
    }
    return "disciple standing"
}

function sectTransferStepForWorldRank(worldRank) {
    return SECT_TRANSFER_STEPS.find((s) => s.rank === worldRank) || null
}

// Cultivate toward a transfer before joining that sect (parent world rank = requiredRank + 1).
function cultivationWorldRankMet(requiredRank, layer) {
    if (sectServingWorldRankAtMost(requiredRank)) return true

    const current = sectWorldRank().toNumber()
    if (current > requiredRank) return cultivationProgressBeforeJoining(requiredRank, layer, current)

    return false
}

function cultivationProgressBeforeJoining(requiredRank, layer, currentWorldRank) {
    if (requiredRank === 9) {
        if (["n", "al", "ar", "re", "dom"].includes(layer)) {
            return hasMilestone("n", 0) || (hasMilestone("j", 5) && hasMilestone("g", 5))
        }
        if (layer === "sf") return hasMilestone("n", 0)
    }

    if (requiredRank === 8) {
        if (currentWorldRank === 9) {
            if (layer === "sf") return true
            if (layer === "st") {
                return typeof soulFormationReached === "function" && soulFormationReached()
            }
            return typeof soulFormationReached === "function" && soulFormationReached()
        }
        if (layer === "sf" && hasMilestone("n", 0)) return true
    }

    if (requiredRank === 7) {
        if (currentWorldRank === 8) {
            if (layer === "st") return true
            if (layer === "asc") {
                return typeof soulTransformationReady === "function" && soulTransformationReady()
            }
            return typeof soulTransformationReady === "function" && soulTransformationReady()
        }
    }

    if (requiredRank === 6 && currentWorldRank === 7) {
        if (["yin", "yang", "asc"].includes(layer)) return true
        if (layer === "asc") {
            return typeof soulTransformationReady === "function" && soulTransformationReady()
        }
    }

    if (requiredRank === 7 && currentWorldRank === 8) {
        if (layer === "asc") return true
        if (layer === "st") {
            return typeof soulTransformationReady === "function" && soulTransformationReady()
        }
    }

    if (requiredRank === 5 && currentWorldRank === 6) {
        if (["yin", "yang", "ns", "nc", "dsn", "cel", "isl"].includes(layer)) return true
    }

    if (requiredRank === 4 && currentWorldRank === 5) {
        if (layer === "nsh") return true
        if (typeof nirvanaShattererUnlocked === "function" && nirvanaShattererUnlocked()) return true
    }

    if (requiredRank === 3 && currentWorldRank === 4) {
        if (["ess", "jfl", "nv"].includes(layer)) return true
        if (typeof stepThreeUnlocked === "function" && stepThreeUnlocked()) return true
    }

    const step = sectTransferStepForWorldRank(requiredRank)
    if (step && step.implemented && step.done && step.done()) return true

    if (currentWorldRank === requiredRank + 1 && step && step.implemented) {
        const gate = sectRankAscensionGate()
        if (gate.ok && gate.targetRank === requiredRank) return true
    }

    return false
}

function cultivationSectGate(layer) {
    const rank10 = typeof cultivationRank10Gate === "function" ? cultivationRank10Gate(layer) : null
    const worldRank = typeof cultivationWorldRankGate === "function" ? cultivationWorldRankGate(layer) : null

    if (rank10 && atRank10Sect()) {
        if (rank10.exemptEvents && rank10.exemptEvents.some((id) => typeof inEvent === "function" && inEvent(id))) {
            return { ok: true }
        }
        if (rank10.needsEntrance && typeof hasSectContributionAccess === "function" && !hasSectContributionAccess()) {
            return { ok: false, message: "Clear the Sect Entrance Examination first" }
        }
        if (!rank10SectRoleMet(rank10, layer)) {
            return { ok: false, message: `Reach ${rank10SectRoleLabel(rank10, layer)} first (or advance the matching sect trial)` }
        }
        return { ok: true }
    }

    if (worldRank !== null) {
        if (cultivationWorldRankMet(worldRank, layer)) return { ok: true }
        const step = sectTransferStepForWorldRank(worldRank)
        const label = step ? step.label : `Rank ${worldRank}`
        const current = formatWhole(sectWorldRank())
        return {
            ok: false,
            message: `Advance toward World Rank ${worldRank} (${label}) — you serve Rank ${current}; see Sect Rankings transfer`,
        }
    }

    return { ok: true }
}

function cultivationSectGateBlocksReset(layer) {
    return !cultivationSectGate(layer).ok
}

function cultivationSectGateButtonText(layer) {
    const gate = cultivationSectGate(layer)
    return gate.ok ? null : gate.message
}
