// Immortal Tree — balance pass knobs (pass 1).
// Change numbers here, then playtest per docs/balance-pass.md.

const BALANCE = {
	pass: 1,
	targetDemoMinutes: [45, 90],

	prestige: {
		requires: { q: 28, f: 42, c: 55 },
		exponent: { main: 0.38, twin: 0.36, nascent: 0.82 },
	},

	twinPath: {
		cap: 20,
		maxPerResetBase: 1,
		maxPerResetBurst: 3,
		requiresBase: 5500,
		requiresDiscounted: 55,
	},

	nascent: {
		lowerRealm: { first: 10, m1: 1.75, m3: 1.12, m5: 1.2, m6: 1.12 },
	},

	scattered: {
		nascentSoulPow: { m12: 0.45, m22: 0.22, m32: 0.28 },
	},

	lowerRealmUpgrade: {
		n11: 1.75,
		n14: 1.35,
		n34: 1.2,
		n12Pow: 0.45,
		n22Pow: 0.22,
	},

	// Rank 10: disciple / leader roles. After transfer: min world rank only (see sectTransfer.js).
	sect: {
		rank10: {
			f: { role: "outer", needsEntrance: true, exemptEvents: [13] },
			c: { role: "inner", needsEntrance: true, exemptEvents: [21, 23] },
			j: { role: "twin", exemptEvents: [32, 33] },
			g: { role: "twin", exemptEvents: [32, 33] },
			n: { role: "leader", exemptEvents: [42] },
		},
		worldRank: {
			n: 9,
			al: 9,
			ar: 9,
			re: 9,
			dom: 9,
			sf: 9,
			st: 8,
			asc: 7,
			yin: 6,
			yang: 6,
			ns: 5,
			nc: 5,
			dsn: 5,
			cel: 5,
			isl: 5,
			nsh: 4,
			ess: 3,
			jfl: 3,
			nv: 3,
		},
	},
}

function balanceRequires(layer) {
	const r = BALANCE.prestige.requires
	if (layer === "q") return new Decimal(r.q)
	if (layer === "f") return new Decimal(r.f)
	if (layer === "c") return new Decimal(r.c)
	return null
}

function balanceExponent(layer) {
	if (layer === "n") return new Decimal(BALANCE.prestige.exponent.nascent)
	if (layer === "j" || layer === "g") return new Decimal(BALANCE.prestige.exponent.twin)
	return new Decimal(BALANCE.prestige.exponent.main)
}

function cultivationWorldRankGate(layer) {
	const table = BALANCE.sect && BALANCE.sect.worldRank
	return table && table[layer] !== undefined ? table[layer] : null
}

function cultivationRank10Gate(layer) {
	const table = BALANCE.sect && BALANCE.sect.rank10
	return table && table[layer] ? table[layer] : null
}
