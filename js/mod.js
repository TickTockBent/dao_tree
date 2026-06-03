let modInfo = {
	name: "Mortal to Golden Core",
	author: "ticktockbent",
	pointsName: "Qi",
	modFiles: ["layers.js", "tree.js"],

	discordName: "",
	discordLink: "",
	// New cultivators begin with no Qi gathered; Qi accrues passively (spec §2).
	initialStartPoints: new Decimal(0), // Used for hard resets and new players
	offlineLimit: 1,  // In hours
}

// Set your version in num and name
let VERSION = {
	num: "0.1",
	name: "Mortal to Golden Core",
}

let changelog = `<h1>Changelog:</h1><br>
	<h3>v0.1 — Mortal to Golden Core</h3><br>
		- Gather Qi and walk the cultivator's road from mortal to Golden Core.<br>
		- Open your meridians and temper your body — permanent attributes that never reset.<br>
		- Break through Qi Condensation, Foundation Establishment, and Core Formation.<br>
		- Your Foundation is graded; a stronger foundation forges a finer core.<br>
		- Forge your first Golden Core at the climax: push hard for grade, or warm it slowly and safely.<br>
		- Earn Outer Disciple standing in the sect for a permanent Qi boon.`

let winText = `You have forged a Golden Core. The mortal road is behind you; the immortal road begins.<br>
	The path beyond — Nascent Soul and further heavens — awaits a future update.`

// If you add new functions anywhere inside of a layer, and those functions have an effect when called, add them here.
// (The ones here are examples, all official functions are already taken care of)
var doNotCallTheseFunctionsEveryTick = ["blowUpEverything"]

function getStartPoints(){
    return new Decimal(modInfo.initialStartPoints)
}

// Determines if it should show points/sec
function canGenPoints(){
	return true
}

// Calculate Qi/sec (points are Qi, modInfo.pointsName = "Qi").
// Qi/sec = baseRate x meridianMult x temperMult x realmMult x gateMult x coreMult,
// every factor read from live layer state by the factory. baseRate and all
// multipliers resolve from data rows (spec §2/§11) — no literals here.
function getPointGen() {
	if(!canGenPoints())
		return new Decimal(FACTORY_NUMERICS.zero)

	if (typeof cultivationQiPerSecond === "function")
		return cultivationQiPerSecond()

	// Factory not yet loaded (defensive): fall back to the data-defined base rate.
	return new Decimal(BODY_DATA.qi.baseRate)
}

// You can add non-layer related variables that should to into "player" and be saved here, along with default values
function addedPlayerData() { return {
}}

// Display extra things at the top of the page
var displayThings = [
]

// Determines when the game "ends" — the demo-complete beat (spec §1/§7): forging
// a Golden Core of ANY grade. coreIsForged() (the factory) reads the stored Core
// Grade index off the reset-immune Body layer; index >= 0 means a core exists.
function isEndgame() {
	if (typeof coreIsForged === "function") return coreIsForged()
	return false
}



// Less important things beyond this point!

// Style for the background, can be a function
var backgroundStyle = {

}

// You can change this if you have things that can be messed up by long tick lengths
function maxTickLength() {
	return(3600) // Default is 1 hour which is just arbitrarily large
}

// Use this if you need to undo inflation from an older version. If the version is older than the version that fixed the issue,
// you can cap their current resources with this.
function fixOldSave(oldVersion){
}