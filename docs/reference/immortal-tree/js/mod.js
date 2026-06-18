let modInfo = {
	name: "Immortal Tree",
	id: "immortal_tree_demo",
	author: "Genesis",
	pointsName: "scattered qi",
	modFiles: ["balance.js", "milestones.js", "realms.js", "realmRoadmap.js", "professions.js", "domains.js", "nirvanaMeta.js", "techniques.js", "sectTransfer.js", "sectArsenal.js", "layers.js", "soulFormation.js", "soulTransformation.js", "ascendant.js", "nirvanaStep2.js", "illusoryYin.js", "corporealYang.js", "nirvanaScryer.js", "nirvanaCleanser.js", "nirvanaTriad.js", "nirvanaShatterer.js", "nirvanaStep3.js", "tree.js"],

	discordName: "",
	discordLink: "",
	initialStartPoints: new Decimal(0),
	offlineLimit: 24,
	offlineProdDefault: true,

	navHotkeys: [
		"S — Immortal Sect",
		"Q — Qi Condensation",
		"F — Foundation Establishment",
		"C — Core Formation",
		"J — Ji Realm",
		"G — Perfect Golden Core",
		"N — Nascent Soul",
		"A — Alchemy",
		"B — Artificer",
		"R — Restrictions Master",
		"D — Domain",
		"X — Soul Formation",
		"Y — Soul Transformation",
		"(Hold Shift + same key to prestige on that layer)",
	],
}

let VERSION = {
	num: "0.2",
	name: "Immortal Tree",
}

/** Add ?screenshot=1 to the URL for cleaner promotional captures (hides sect/journal chrome). */
function screenshotMode() {
	try { return new URLSearchParams(location.search).get("screenshot") === "1" } catch (e) { return false }
}

let changelog = `<h1>Changelog:</h1><br>
	<h3>v0.2</h3><br>
		- Removed demo milestone interruptions; cultivation continues uninterrupted after Nascent Soul.<br>
	<h3>v0.1</h3><br>
		- Qi Condensation through Nascent Soul, twin preparations, sect, and expansion scaffolding.`

let winText = `You have reached the current end of implemented content. Cultivation may continue as new realms are added.`

var doNotCallTheseFunctionsEveryTick = ["unlockJournal"]

const journalEntries = {
	start: {
		title: "Beneath the Immortal Tree",
		body: "You wake beneath jade leaves that do not wither. The tree offers one rule: cultivate, remember, and climb.",
	},
	qi: {
		title: "Qi Condensation",
		body: "The first breathwork settles. Scattered qi condenses into dantian qi, and the road finally begins to move.",
	},
	foundation: {
		title: "Foundation Establishment",
		body: "Your meridians settle into a stable pattern. The first true breakthrough leaves the old self behind.",
	},
	core: {
		title: "Core Formation",
		body: "Thunder gathers around the dantian. A golden core begins to turn, bright enough to invite tribulation.",
	},
	siblingChoice: {
		title: "Twin Preparations",
		body: "Two roads open before Nascent Soul: the Ji Realm, where each breakthrough lets you wield Ji intent at the power of a full major realm, and Golden Core refinement, where cracked cores are tempered toward a Perfect Golden Core.",
	},
	ji: {
		title: "Ji Realm · Great Circle",
		body: "Your will cuts through hesitation at the height of the Ji path. Ji threads gather into a single blade of intent, firm enough to support Nascent Soul.",
	},
	goldenCore: {
		title: "Perfect Golden Core",
		body: "The core hums without flaw. Golden progress settles into a steady rotation, bright enough to cradle a nascent soul.",
	},
	nascent: {
		title: "Nascent Soul Formed",
		body: "A small soul opens its eyes beneath the immortal canopy. One profession Dao is yours to choose now; Soul Formation and Soul Transformation will open the way to walk more.",
	},
	sectEntrance: {
		title: "Sect Entrance Examination",
		body: "You passed the outer gate trials. The sect elders note your breath is steady enough to walk the disciple road.",
	},
	outerTournament: {
		title: "Outer Disciple Tournament",
		body: "You held your ground against other recruits. The sect grants you a little more merit and sharper training.",
	},
	innerTrial: {
		title: "Inner Disciple Meridian Trial",
		body: "Your meridians endure the purification array. Inner halls open to you in truth, not only in name.",
	},
	innerTournament: {
		title: "Inner Disciple Tournament",
		body: "You defeat a ranked inner disciple without shaming your lineage. The sect treasury remembers your name.",
	},
	twinArena: {
		title: "Twin Path Arena",
		body: "Ji intent and golden light are forced into balance. Both preparations advance together toward Nascent Soul.",
	},
	sectLeader: {
		title: "Sect Leader",
		body: "The last enemy banner falls in this sect. Elders bow as your name is carved into the leader's stele — the final station before you may transfer to a higher-ranked sect.",
	},
	sectRank9: {
		title: "Joined Rank 9 Sect",
		body: "You leave your Rank 10 posting and enter a true Rank 9 sect. Disciple duties and sect war begin anew; your cultivation and personal accreditations endure.",
	},
	sectRank8: {
		title: "Joined Rank 8 Sect",
		body: "Soul Formation opens the gates of a Rank 8 hegemony sect. You walk the disciple road again beneath a greater banner.",
	},
	sectRank7: {
		title: "Joined Rank 7 Sect",
		body: "Soul Transformation earns you a seat among Rank 7 immortals. The highest sects in this age accept your transfer — and demand you prove yourself once more.",
	},
	sectRank6: {
		title: "Joined Rank 6 Sect (planned)",
		body: "Ascendant closes the main tree (Step 1). Only then may you leave a Rank 7 sect for a Rank 6 hegemony — and walk the disciple road again.",
	},
	sectRank5: {
		title: "Joined Rank 5 Sect (planned)",
		body: "On the second cultivation tree you reached Nirvana Scryer. Rank 5 sects answer to that sight.",
	},
	sectRank4: {
		title: "Joined Rank 4 Sect (planned)",
		body: "Nirvana Cleanser purified your path enough for a Rank 4 charter.",
	},
	sectRank3: {
		title: "Joined Rank 3 Sect (planned)",
		body: "Nirvana Shatterer ended the second tree. Rank 3 sects bow to cultivators who finished Step 2.",
	},
	sectRank2: {
		title: "Joined Rank 2 Sect (planned)",
		body: "Nirvana Void opened the third tree. Rank 2 sects gather void-walkers at the start of Step 3.",
	},
	sectRank1: {
		title: "Joined Rank 1 Sect (planned)",
		body: "Grand Empyrean crowned the void tree. A Rank 1 sect is the highest the cultivation world ranks below Heaven Trampling.",
	},
	heavenTrampling: {
		title: "Heaven Trampling Realm (planned)",
		body: "Fourth step — beyond the three trees. The end of the game waits past Grand Empyrean.",
	},
	sectTribunal: {
		title: "World Tribunal",
		body: "Your sect answered before the cultivation world's tribunal and survived scrutiny. Rank Nine recognition is no longer mere ceremony.",
	},
	sectBanner: {
		title: "Rank Nine Banner",
		body: "Allied clans witness your banner unveiled. Contribution flows more freely to a sect the world acknowledges.",
	},
	sectHegemony: {
		title: "Hegemony Summit",
		body: "Soul-formed and Rank Eight, your sect takes a seat at the regional summit. Lesser clans bend knee or flee.",
	},
	sectCovenant: {
		title: "Soul-Forged Covenant",
		body: "Mortal insight is woven into your sect's charter. Nascent divinity and war merit both answer the covenant's call.",
	},
	daoPaths: {
		title: "Three Profession Daos",
		body: "Nascent Soul opens more than power — it opens craft. Alchemy swells spiritual energy, Artificers automate the slow work, and Restrictions Masters soften the price of breakthrough. You may walk one Dao now; Soul Formation and Soul Transformation will permit more.",
	},
	daoAlchemy: {
		title: "Alchemy Dao",
		body: "You commit to the cauldron. Herbs, pills, and refined essences become your language. Other paths may forge or inscribe, but none gather scattered qi as swiftly as a true alchemist.",
	},
	daoArtificer: {
		title: "Artificer Dao",
		body: "You take up hammer and talisman plate. Instruments and arrays will buy and breathe for you while your hands remain free to chase higher realms.",
	},
	daoRestrictions: {
		title: "Restrictions Master Dao",
		body: "You study sealing and preservation arrays. Breakthroughs still demand sacrifice, but your inscriptions remember what others lose when they reset.",
	},
	daoSecond: {
		title: "Second Dao Opened",
		body: "Soul Formation reshapes the soul enough to carry two crafts. A second profession Dao joins your path — choose carefully, for each specialty still excludes what the others do best.",
	},
	daoThird: {
		title: "Third Dao Opened",
		body: "Soul Transformation completes the trinity. A third profession Dao becomes available — the rare cultivator who masters all three walks between elixir, instrument, and array.",
	},
	domainFormed: {
		title: "Domain Formed",
		body: "You step beyond Nascent Soul into Domain — cultivation below resets, but your profession Dao walks with you. Each major realm you have walked reveals its matching heavenly concept; trials begin here.",
	},
	domainQi: {
		title: "Breathing Domain",
		body: "You commit to the breath between heartbeats. Scattered qi and dantian condensation answer your Domain alone.",
	},
	domainF: {
		title: "Pillar Domain",
		body: "You commit to the unbroken pillar beneath your feet. Foundation becomes the language of your Domain.",
	},
	domainC: {
		title: "Furnace Domain",
		body: "You commit to the furnace at the dantian's center. Core sparks bend toward your Domain.",
	},
	domainJ: {
		title: "Blade Domain",
		body: "You commit to intent sharpened into a single edge. Ji threads weave only for your Domain.",
	},
	domainG: {
		title: "Sun Domain",
		body: "You commit to the inner sun's flawless rotation. Golden progress turns within your Domain.",
	},
	domainN: {
		title: "Soul Domain",
		body: "You commit to the infant soul seated in silence. Nascent refinement deepens through your Domain.",
	},
	domainCraft: {
		title: "Craft Domain",
		body: "You commit to the work of hands — pill, hammer, and inscription. Your chosen profession Daos resonate with this Domain.",
	},
	domainSf: {
		title: "Divinity Domain",
		body: "You comprehend nascent divinity as law — Soul Formation answers this Domain alone.",
	},
	domainSt: {
		title: "Incarnation Domain",
		body: "You comprehend multiplied selves — incarnation paths and Soul Transformation deepen through this Domain.",
	},
	domainAsc: {
		title: "Ascendant Domain",
		body: "You grasp the apex of Step 1 — every major realm on the main tree resonates with this final Domain concept.",
	},
	soulFormation: {
		title: "Soul Formation",
		body: "The great breakthrough completes. Cultivation and Domain below reset, but Soul Formation endures — condense nascent divinities, walk mortal lives, and prepare for Soul Transformation.",
	},
	domainSecond: {
		title: "Second Domain Opened",
		body: "Soul Formation opens a second domain pick. Commit to another heavenly concept whose realm you have reached — trial blessings stack.",
	},
	soulTransformation: {
		title: "Soul Transformation",
		body: "The infant soul sheds its chrysalis. Six incarnations walk beside you — each bar is a life you might have lived. Milestones here open the Second Domain and Third profession Dao.",
	},
	domainThird: {
		title: "Third Domain (Sealed Path)",
		body: "After walking two Domains, a third concept may one day complete the trinity — content beyond Soul Transformation.",
	},
	ascendant: {
		title: "Ascendant",
		body: "The six incarnations stand active as one. Cultivation below resets, but their paths endure — only active slots return to one. World essence condenses from the heavens.",
	},
	worldEssence: {
		title: "World Essence",
		body: "Essence drawn from the world itself powers ascendance. Early milestones make lower realms less manual — upgrades buy themselves where Artificer once stopped.",
	},
	ascendantCapstone: {
		title: "Second Step Unsealed",
		body: "Ascendant Great Circle and World Qi Great Circle align. The seal toward Illusory Yin cracks — the Nirvana tree awaits on a new tab.",
	},
	illusoryYin: {
		title: "Illusory Yin",
		body: "The Second Step begins in shadow. Corporeal Yang walks beside this path — further realms remain beyond current content.",
	},
	corporealYang: {
		title: "Corporeal Yang",
		body: "Contemplations become enlightenments. Prestige here resets Yin only — the first tree endures until the Scryer trial fails.",
	},
	nirvanaFall: {
		title: "Failed Scryer Trial",
		body: "The breakthrough collapses. You fall back to Qi on the first tree, but the memory of Yin and Yang lingers — production surges and upgrades begin to buy themselves.",
	},
	nirvanaFallSuccess: {
		title: "Nirvana Scryer",
		body: "On the second trial the seal holds. You have truly entered the Second Step.",
	},
	nirvanaScryer: {
		title: "Scryer Trial",
		body: "Challenge the boundary between steps from Corporeal Yang at Great Circle.",
	},
	nirvanaScryerRealm: {
		title: "Nirvana Scryer Realm",
		body: "The first realm of the Nirvana ladder. Cleanser and Shatterer lie ahead.",
	},
	stepTwoReached: {
		title: "Second Step Recognized",
		body: "Nirvana Scryer is attained. World Qi flows — the Second Step bonus is yours. The Cleanser, triad refinements, and Shatterer await.",
	},
	nirvanaCleanser: {
		title: "Nirvana Cleanser",
		body: "Celestial Qi washes the World Qi away. Three refinements — Divine Sense, Celestial Body, Immortal Soul — may now be walked together.",
	},
	nirvanaShatterer: {
		title: "Nirvana Shatterer",
		body: "All three refinements reached their cap. Nirvana Qi gathers; the Five Heavenly Blights must be faced.",
	},
	fiveBlights: {
		title: "Five Heavenly Blights Endured",
		body: "Life, Death, Karma, Devil, and Fate — then all five at once. Choose Essences or Joss Flames for the Third Step.",
	},
	nirvanaEssences: {
		title: "Essences Path",
		body: "You walk the true road. Minor Essences will feed the void at full power.",
	},
	nirvanaJossFlames: {
		title: "Joss Flames Path",
		body: "You took the offering flame — swift power now, but Third Step Essences will always burn dimmer.",
	},
	stepThreeReached: {
		title: "Third Step — Nirvana Void",
		body: "Void Qi condenses. The void tree has begun; eight realms remain on the roadmap.",
	},
	nirvanaVoidJoss: {
		title: "Void Through Joss Flames",
		body: "The void opens, weakened by the shortcut you chose.",
	},
}

function getStartPoints() {
	return new Decimal(modInfo.initialStartPoints)
}

function canGenPoints() {
	return true
}

function getPointGen() {
	if (!canGenPoints()) return new Decimal(0)
	if (typeof onNirvanaTreeTab === "function" && onNirvanaTreeTab()) return new Decimal(0)

	let gain = new Decimal(1)
	if (hasUpgrade("q", 11)) gain = gain.times(2)
	if (hasUpgrade("q", 12)) gain = gain.times(player.q.points.add(1).pow(0.35))
	if (hasUpgrade("q", 21)) gain = gain.times(2)
	if (hasUpgrade("q", 22)) gain = gain.times(player.q.total.add(1).pow(0.18))
	if (typeof milestoneGainMult === "function") gain = gain.times(milestoneGainMult("points"))
	if (typeof milestoneLowerRealmMult === "function") gain = gain.times(milestoneLowerRealmMult())
	if (typeof techniqueMult === "function") gain = gain.times(techniqueMult("points"))
	if (typeof sectPillMult === "function") gain = gain.times(sectPillMult("points"))
	if (typeof alchemyPointsMult === "function") gain = gain.times(alchemyPointsMult())
	if (typeof domainBoost === "function") gain = gain.times(domainBoost("points"))
	if (hasUpgrade("f", 21)) gain = gain.times(player.f.points.add(1).pow(0.25))
	const nPow = typeof BALANCE !== "undefined" ? BALANCE.scattered.nascentSoulPow : null
	if (hasUpgrade("n", 12)) gain = gain.times(player.n.points.add(1).pow(nPow ? nPow.m12 : 0.45))
	if (hasUpgrade("n", 22)) gain = gain.times(player.n.points.add(1).pow(nPow ? nPow.m22 : 0.22))
	if (hasUpgrade("n", 32)) gain = gain.times(player.n.points.add(1).pow(nPow ? nPow.m32 : 0.28))
	if (hasUpgrade("k", 12)) gain = gain.times(1.15)
	if (typeof avatarCultivationMult === "function") gain = gain.times(avatarCultivationMult("points"))
	if (typeof ascCultivationMult === "function") gain = gain.times(ascCultivationMult())
	if (typeof nirvanaFalloutMult === "function") gain = gain.times(nirvanaFalloutMult())
	if (typeof jossFlamesLowerMult === "function") gain = gain.times(jossFlamesLowerMult())
	if (typeof nirvanaBlightMult === "function") gain = gain.times(nirvanaBlightMult("points"))
	return gain
}

function addedPlayerData() { return {
	storyJournal: [],
	newJournal: false,
	sectAutoReplayBusy: false,
	sectAutoReplayIdx: 0,
	sectAutoReplayOrder: [],
	sectAutoReplayTick: 0,
	techniques: [],
	professionPrimary: null,
	professionSecondary: null,
	professionTertiary: null,
	domainFormed: false,
	domainPrimary: null,
	domainSecondary: null,
	domainTertiary: null,
	stepTwoUnlocked: false,
	stepThreeUnlocked: false,
	nirvanaPath: null,
	insights: new Decimal(0),
	bestInsights: new Decimal(0),
	totalInsights: new Decimal(0),
	nirvanaFallout: 0,
	scryerAttempts: 0,
}}

function unlockJournal(id) {
	if (!player || !journalEntries[id]) return
	if (!Array.isArray(player.storyJournal)) player.storyJournal = []
	if (!player.storyJournal.includes(id)) {
		player.storyJournal.push(id)
		player.newJournal = true
	}
}

function onNascentSoulFormed() {
	unlockJournal("nascent")
	unlockJournal("daoPaths")
}

function journalHTML() {
	if (!player || !Array.isArray(player.storyJournal) || player.storyJournal.length === 0) {
		return "<i>No entries yet. Begin cultivating beneath the immortal tree.</i>"
	}

	return player.storyJournal.map(id => {
		const entry = journalEntries[id]
		if (!entry) return ""
		return `<div class="journal-entry"><h3>${entry.title}</h3><p>${entry.body}</p></div>`
	}).join("")
}

var displayThings = [
	function() {
		if (player && isSectLeader && isSectLeader() && player.k) {
			return `<b>Sect Leader</b> — Rank ${formatWhole(sectWorldRank())} sect (transfer when ready)`
		}
	},
	function() {
		if (player && player.s && player.s.activeChallenge && tmp.s && tmp.s.challenges) {
			const id = player.s.activeChallenge
			const ch = tmp.s.challenges[id]
			if (ch && ch.name) return `<b>Sect event in progress:</b> ${ch.name}`
		}
	},
	function() {
		if (player && player.dom && player.dom.activeChallenge && tmp.dom && tmp.dom.challenges) {
			const id = player.dom.activeChallenge
			const ch = tmp.dom.challenges[id]
			if (ch && ch.name) return `<b>Domain trial in progress:</b> ${ch.name}`
		}
	},
	function() {
		if (player && domainFinalComplete && domainFinalComplete() && !(player.sf && player.sf.unlocked)) {
			return "<b>Domain capstone complete</b> — break through to Soul Formation."
		}
		if (player && stepThreeUnlocked && stepThreeUnlocked()) {
			return "<b>Third Step open</b> — Nirvana Void Realm on tab 3."
		}
		if (player && player.stepTwoUnlocked) {
			if (player.nsh && player.nsh.unlocked && !player.nirvanaPath) {
				return "<b>Nirvana Shatterer</b> — face the Heavenly Blights, then choose Essences or Joss Flames."
			}
			if (nirvanaScryerReached && nirvanaScryerReached()) {
				return "<b>Step 2</b> — Scryer, Cleanser, triad refinements, and Shatterer on tree 2."
			}
			if (player.scryerAttempts >= 1 && !nirvanaScryerReached()) {
				return "<b>Fallout active</b> — rebuild tree 1, then Yin → Yang for the second Scryer trial."
			}
			return "<b>Nirvana tree open</b> — insights on tab 2; walk Yin then Yang."
		}
		if (player && player.asc && player.asc.unlocked) {
			if (canBreakthroughStepTwo && canBreakthroughStepTwo()) {
				return "<b>Ascendant capstone ready</b> — open the Nirvana tree (Step 2 tab)."
			}
			return "<b>Ascendant active</b> — condense world essence and gather World Qi."
		}
		if (player && hasMilestone && hasMilestone("st", 9)) {
			if (typeof stAscendantBreakthroughReady === "function" && stAscendantBreakthroughReady()) {
				return "<b>Ascendant breakthrough ready</b> — activate all six incarnations and ascend."
			}
			return "<b>Heavenly Transformation complete</b> — finish incarnation milestones for Ascendant."
		}
		if (player && soulTransformationReady && soulTransformationReady()) {
			if (typeof stSecondDomainUnlocked === "function" && stSecondDomainUnlocked()) {
				return "<b>Soul Transformation</b> — Second Domain and Third Dao gates are open."
			}
			return "<b>Soul Transformation</b> — walk incarnations to unlock Second Domain, Third Dao, and Rank 7 sect transfer."
		}
		if (player && player.sf && player.sf.unlocked) {
			return "<b>Soul Formation active</b> — condense divinities and walk mortal lives."
		}
	},
]

function isEndgame() {
	return false
}

var backgroundStyle = {
	"background": "radial-gradient(circle at 50% 0%, rgba(96, 206, 152, 0.16), transparent 35%), linear-gradient(180deg, #08150f 0%, #12150f 100%)",
}

function maxTickLength() {
	return 1
}

function fixOldSave(oldVersion) {
	if (typeof ensurePlayerDecimals === "function") ensurePlayerDecimals()
	if (!Array.isArray(player.storyJournal)) player.storyJournal = Array.isArray(player.journal) ? player.journal : []
	if (player.sectAutoReplayBusy === undefined) player.sectAutoReplayBusy = false
	if (player.sectAutoReplayIdx === undefined) player.sectAutoReplayIdx = 0
	if (player.sectAutoReplayTick === undefined) player.sectAutoReplayTick = 0
	if (!Array.isArray(player.sectAutoReplayOrder)) player.sectAutoReplayOrder = []
	for (const lr of ["j", "g"]) {
		if (!player[lr]) continue
		const cap = typeof BALANCE !== "undefined" ? BALANCE.twinPath.cap : 20
		if (player[lr].points.gt(cap)) player[lr].points = new Decimal(cap)
		if (player[lr].best.gt(cap)) player[lr].best = new Decimal(cap)
	}
	player.keepGoing = true;
	delete player.demoComplete;
	if (player.k && player.k.points && player.k.best && player.k.best.gt(player.k.points)) {
		player.k.best = player.k.points
	}
	if (player.k && isSectLeader && isSectLeader() && !player.k.unlocked) player.k.unlocked = true
	if (sectPathUnlocked && sectPathUnlocked() && player.s && !player.s.unlocked) player.s.unlocked = true
	if (player.e && player.s) {
		if (player.e.challenges) {
			for (const id in player.e.challenges) {
				if (isNaN(id)) continue
				const prev = player.e.challenges[id]
				if (prev && (!player.s.challenges[id] || player.s.challenges[id] < prev)) player.s.challenges[id] = prev
			}
		}
		if (player.e.activeChallenge) player.s.activeChallenge = player.e.activeChallenge
	}
	if (!Array.isArray(player.techniques)) player.techniques = []
	if (player.professionPrimary === undefined) player.professionPrimary = null
	if (player.professionSecondary === undefined) player.professionSecondary = null
	if (player.professionTertiary === undefined) player.professionTertiary = null
	if (player.domainFormed === undefined) player.domainFormed = false
	if (player.domainPrimary === undefined) {
		player.domainPrimary = player.domainChoice !== undefined ? player.domainChoice : null
	}
	if (player.domainSecondary === undefined) player.domainSecondary = null
	if (player.domainTertiary === undefined) player.domainTertiary = null
	if (!Array.isArray(player.domainChosen)) {
		player.domainChosen = []
		if (player.domainPrimary) player.domainChosen.push(player.domainPrimary)
		if (player.domainSecondary) player.domainChosen.push(player.domainSecondary)
		if (player.domainTertiary) player.domainChosen.push(player.domainTertiary)
	}
	if (player.domainTraining === undefined) player.domainTraining = player.domainChosen[0] || player.domainPrimary || null
	delete player.domainChoice
	if (player.dom && player.domainFormed && !player.dom.unlocked) player.dom.unlocked = true
	if (player.sf && player.sf.unlocked === undefined) player.sf.unlocked = false
	if (player.sf && player.sf.best instanceof Decimal && player.sf.best.gte(1)) player.sf.unlocked = true
	if (player.sf && player.sf.mortalInsights === undefined) player.sf.mortalInsights = new Decimal(0)
	if (player.sf && player.sf.bestInsights === undefined) player.sf.bestInsights = new Decimal(0)
	if (player.s && player.s.challengeSnapshot === undefined) player.s.challengeSnapshot = null
	if (hasMilestone("sf", 6) && player.st && !player.st.unlocked) player.st.unlocked = true
	if (player.st) {
		if (player.st.points === undefined) player.st.points = new Decimal(0)
		if (player.st.best === undefined) player.st.best = new Decimal(0)
		if (player.st.total === undefined) player.st.total = new Decimal(0)
	}
	if (typeof stEnsureState === "function") stEnsureState()
	if (player.asc) {
		if (player.asc.worldQi === undefined) player.asc.worldQi = new Decimal(0)
		if (player.asc.bestWorldQi === undefined) player.asc.bestWorldQi = new Decimal(0)
		if (player.asc.totalWorldQi === undefined) player.asc.totalWorldQi = new Decimal(0)
		if (player.asc.unlocked === undefined) player.asc.unlocked = player.asc.best instanceof Decimal && player.asc.best.gte(1)
	}
	if (player.stepTwoUnlocked === undefined) player.stepTwoUnlocked = false
	if (player.stepThreeUnlocked === undefined) player.stepThreeUnlocked = false
	if (player.nirvanaPath === undefined) player.nirvanaPath = null
	for (const id of ["nc", "dsn", "cel", "isl", "nsh", "ess", "jfl", "nv"]) {
		if (!player[id]) player[id] = { unlocked: false, points: new Decimal(0), best: new Decimal(0), total: new Decimal(0) }
		if (id === "nsh" && player.nsh.challengeSnapshot === undefined) player.nsh.challengeSnapshot = null
	}
	if (hasMilestone("ns", 4) && player.nc) player.nc.unlocked = true
	if (nirvanaTriadAllComplete && nirvanaTriadAllComplete() && player.nsh) player.nsh.unlocked = true
	if (maxedChallenge("nsh", 6) && !player.nirvanaPath) { /* choice pending */ }
	if (player.nirvanaPath === "essences" && player.ess) player.ess.unlocked = true
	if (player.nirvanaPath === "joss" && player.jfl) player.jfl.unlocked = true
	if (player.stepThreeUnlocked && player.nv) player.nv.unlocked = true
	if (player.insights === undefined) player.insights = new Decimal(0)
	if (player.bestInsights === undefined) player.bestInsights = new Decimal(0)
	if (player.totalInsights === undefined) player.totalInsights = new Decimal(0)
	if (player.nirvanaFallout === undefined) player.nirvanaFallout = 0
	if (player.scryerAttempts === undefined) player.scryerAttempts = 0
	if (!player.yin) player.yin = { unlocked: false }
	if (!player.yang) player.yang = { unlocked: false }
	if (!player.ns) player.ns = { unlocked: false }
	if (player.yin.unlocked && !player.stepTwoUnlocked) player.stepTwoUnlocked = true
	if (typeof insightsEnsure === "function") insightsEnsure()
	for (const id of ["al", "ar", "re"]) {
		if (!player[id]) continue
		if (hasProfession && hasProfession(id) && !player[id].unlocked) player[id].unlocked = true
	}
	ensureOfflineProgress()
}

function ensureOfflineProgress() {
	if (typeof options !== "undefined" && modInfo.offlineProdDefault !== false) options.offlineProd = true
}

const LAYER_NAV_HOTKEYS = {
	s: "s",
	q: "q",
	f: "f",
	c: "c",
	j: "j",
	g: "g",
	n: "n",
	a: "al",
	b: "ar",
	r: "re",
	d: "dom",
	x: "sf",
	y: "st",
	u: "asc",
}

function openLayerTab(layer) {
	if (!player || !layers[layer]) return
	if (typeof layerunlocked === "function" && LAYERS.includes(layer) && !layerunlocked(layer)) return
	if (tmp[layer] && tmp[layer].layerShown === false) return

	if (tmp[layer].leftTab) {
		showNavTab(layer)
		showTab("none")
		return
	}

	const isSide = tmp[layer].displayRow === "side" || tmp[layer].row === "side"
	if (isSide) {
		if (player.navTab === "none" || (layers["tree-tab"] && player.navTab !== "tree-tab")) {
			showNavTab("tree-tab")
		}
		showTab(layer)
		return
	}

	if (layers["tree-tab"] && player.navTab !== "tree-tab") {
		showNavTab("tree-tab")
	}
	showTab(layer)
}

function layerNavHotkey(key) {
	const layer = LAYER_NAV_HOTKEYS[key]
	if (layer) openLayerTab(layer)
}