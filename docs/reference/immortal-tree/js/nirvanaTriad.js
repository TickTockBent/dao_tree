// Triad refinements — Divine Sense, Celestial Body, Immortal Soul (siblings, cap 20).

function nirvanaTriadLayerDef(id, opts) {
    return {
        name: opts.name,
        symbol: opts.symbol,
        color: opts.color,
        type: "normal",
        row: 24,
        branches: ["nc"],
        startData() { return {
            unlocked: false,
            points: new Decimal(0),
            best: new Decimal(0),
            total: new Decimal(0),
        }},
        resource: opts.resource,
        baseResource: opts.baseResource,
        baseAmount: opts.baseAmount,
        requires() {
            const runs = player[id].points.toNumber()
            return Decimal.pow(10, opts.reqBase + runs * 0.85).div(Decimal.pow(1.55, runs))
        },
        exponent: 0.32,
        gainMult() {
            let mult = new Decimal(1)
            mult = mult.times(nirvanaFalloutMult())
            if (hasMilestone(id, 0)) mult = mult.times(1.2)
            if (hasMilestone(id, 1)) mult = mult.times(1.15)
            if (hasMilestone(id, 3)) mult = mult.times(1.2)
            if (hasUpgrade(id, 11)) mult = mult.times(2)
            if (typeof nirvanaBlightMult === "function") mult = mult.times(nirvanaBlightMult(id))
            return mult.times(opts.gainMultExtra ? opts.gainMultExtra() : 1)
        },
        gainExp() { return new Decimal(1.1) },
        getResetGain() { return getNirvanaTriadResetGain(id) },
        canReset() {
            if (typeof cultivationSectGateBlocksReset === "function" && cultivationSectGateBlocksReset(id)) return false
            if (!player[id].unlocked) return false
            if (nirvanaTriadAtCap(id)) return false
            return tmp[id].baseAmount.gte(tmp[id].requires)
        },
        prestigeButtonText() {
            if (typeof cultivationSectGateButtonText === "function") {
                const sectMsg = cultivationSectGateButtonText(id)
                if (sectMsg) return sectMsg
            }
            if (!player[id].unlocked) return "Open Nirvana Cleanser first"
            if (nirvanaTriadAtCap(id)) return `${opts.resource} cap (${NIRVANA_TRIAD_CAP}) reached`
            if (!canReset(id)) return `Need ${formatWhole(tmp[id].requires)} ${opts.baseResource}`
            return opts.prestigeLabel
        },
        resetDescription: opts.resetDescription,
        layerShown() { return player.nc && (player.nc.unlocked || hasMilestone("nc", 0)) },
        onPrestige() {
            resetNirvanaBelowSibling(id, true)
            if (nirvanaTriadAllComplete() && player.nsh && !player.nsh.unlocked) {
                player.nsh.unlocked = true
                if (typeof unlockJournal === "function") unlockJournal("nirvanaShatterer")
            }
        },
        doReset(resettingLayer) {
            if (typeof treeOf === "function" && treeOf(resettingLayer) !== "nirvana") return
            if (NIRVANA_TRIAD_LAYERS.includes(resettingLayer) && resettingLayer !== id) return
            if (layers[resettingLayer].row > this.row) layerDataReset(id, ["milestones", "upgrades"])
        },
        upgrades: {
            11: {
                title: opts.upg11Title,
                description: opts.upg11Desc,
                cost: new Decimal(4),
                unlocked() { return hasMilestone(id, 0) },
            },
            12: {
                title: opts.upg12Title,
                description: opts.upg12Desc,
                cost: new Decimal(18),
                unlocked() { return hasUpgrade(id, 11) },
                effect: opts.upg12Effect,
                effectDisplay: opts.upg12Display,
            },
        },
        milestones: {
            0: {
                requirementDescription: `${opts.name} — 1 ${opts.resource}`,
                done() { return player[id].best.gte(1) },
                effectDescription: opts.ms0Effect,
            },
            1: {
                requirementDescription: `${opts.name} — 5 ${opts.resource}`,
                done() { return player[id].best.gte(5) },
                effectDescription: `Weave up to 3 ${opts.resource} per breakthrough. ${opts.ms1Effect}`,
            },
            3: {
                requirementDescription: `${opts.name} — 10 ${opts.resource}`,
                done() { return player[id].best.gte(10) },
                effectDescription: opts.ms3Effect,
            },
            4: {
                requirementDescription: `${opts.name} — 15 ${opts.resource}`,
                done() { return player[id].best.gte(15) },
                effectDescription: opts.ms4Effect,
            },
            5: {
                requirementDescription: `${opts.name} — 20 ${opts.resource} (cap)`,
                done() { return player[id].best.gte(20) },
                effectDescription: opts.ms5Effect,
            },
        },
        tabFormat: [
            ["display-text", `<h2>${opts.name}</h2>`],
            ["display-text", `<div class='realm-intro'>${opts.intro}</div>`],
            "main-display",
            "prestige-button",
            "resource-display",
            ["blank", "8px"],
            "upgrades",
            ["blank", "12px"],
            "milestones",
        ],
        tooltip() { return `${opts.name} — ${opts.resource}` },
        tooltipLocked() { return "Complete Nirvana Cleanser." },
    }
}

addLayer("dsn", nirvanaTriadLayerDef("dsn", {
    name: "Divine Sense",
    symbol: "Sn",
    color: "#9b7fd4",
    resource: "Perception",
    baseResource: "Celestial Qi (best)",
    baseAmount() { return player.nc && player.nc.best ? player.nc.best : new Decimal(0) },
    reqBase: 4,
    prestigeLabel: "Refine Perception",
    resetDescription: "Sharpen the mind and gain ",
    intro: "Focuses <b>Illusory Yin</b> and <b>Corporeal Yang</b>. Resets Yin, Yang, Scryer, and Cleanser beneath — not Celestial Body or Immortal Soul.",
    upg11Title: "Veiled Eye Art",
    upg11Desc: "Double Perception gain.",
    upg12Title: "Yin–Yang Mirror",
    upg12Desc: "Perception scales with combined Yin and Yang depth.",
    upg12Effect() { return player.yin.best.add(1).pow(0.04).times(player.yang.best.add(1).pow(0.04)) },
    upg12Display() { return format(upgradeEffect("dsn", 12)) + "×" },
    gainMultExtra() {
        let m = new Decimal(1)
        if (hasMilestone("yin", 2)) m = m.times(1.1)
        if (hasMilestone("yang", 2)) m = m.times(1.1)
        return m
    },
    ms0Effect: "+15% Yin and Yang gain.",
    ms1Effect: "+10% contemplation and enlightenment gain.",
    ms3Effect: "+15% Perception gain.",
    ms4Effect: "+12% insight generation.",
    ms5Effect: "Perception perfected — counts toward Nirvana Shatterer.",
}))

addLayer("cel", nirvanaTriadLayerDef("cel", {
    name: "Celestial Body",
    symbol: "Bd",
    color: "#e8c468",
    resource: "Body Refinements",
    baseResource: "Celestial Qi (best)",
    baseAmount() { return player.nc && player.nc.best ? player.nc.best : new Decimal(0) },
    reqBase: 4.2,
    prestigeLabel: "Temper the body",
    resetDescription: "Refine the vessel and gain ",
    intro: "Focuses Step 2 base realms (Yin through Cleanser). Resets that stack beneath — not Divine Sense or Immortal Soul.",
    upg11Title: "Celestial Furnace",
    upg11Desc: "Double Body Refinement gain.",
    upg12Title: "Scryer Bone Scripture",
    upg12Desc: "Body Refinements scale with World Qi depth.",
    upg12Effect() { return player.ns.best.add(1).pow(0.05) },
    upg12Display() { return format(upgradeEffect("cel", 12)) + "×" },
    gainMultExtra() {
        let m = new Decimal(1)
        if (hasMilestone("ns", 2)) m = m.times(1.12)
        if (hasMilestone("nc", 1)) m = m.times(1.1)
        return m
    },
    ms0Effect: "+12% World Qi and Celestial Qi gain.",
    ms1Effect: "+10% Step 2 base realm gains.",
    ms3Effect: "+15% Body Refinement gain.",
    ms4Effect: "+12% fallout production.",
    ms5Effect: "Body perfected — counts toward Nirvana Shatterer.",
}))

addLayer("isl", nirvanaTriadLayerDef("isl", {
    name: "Immortal Soul",
    symbol: "Is",
    color: "#7fe0c0",
    resource: "Soul Fragments",
    baseResource: "best contribution",
    baseAmount() { return player.s && player.s.best ? player.s.best : new Decimal(0) },
    reqBase: 4.4,
    prestigeLabel: "Bind soul fragments",
    resetDescription: "Forge the immortal soul and gain ",
    intro: "Focuses the <b>Sect</b>. Resets sect duties and the Step 2 stack beneath — not Divine Sense or Celestial Body.",
    upg11Title: "Sect-Bound Soul Art",
    upg11Desc: "Double Soul Fragment gain.",
    upg12Title: "War Merit Echo",
    upg12Desc: "Soul Fragments scale with war merits.",
    upg12Effect() { return player.w && player.w.best ? player.w.best.add(1).pow(0.06) : new Decimal(1) },
    upg12Display() { return format(upgradeEffect("isl", 12)) + "×" },
    gainMultExtra() {
        let m = new Decimal(1)
        if (hasMilestone("s", 2)) m = m.times(1.1)
        if (hasMilestone("w", 1)) m = m.times(1.08)
        return m
    },
    ms0Effect: "+12% contribution and war merit gain.",
    ms1Effect: "+10% sect event gains.",
    ms3Effect: "+15% Soul Fragment gain.",
    ms4Effect: "+8% transfer gain.",
    ms5Effect: "Soul perfected — counts toward Nirvana Shatterer.",
}))
