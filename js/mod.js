let modInfo = {
	name: "Dao Tree",
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
	num: "0.2.1",
	name: "Dao Tree",
}

let changelog = `<h1>Changelog:</h1><br>
	<h3>v0.2.1</h3><br>
		- Fixed a display bug that hid in-game choice buttons. Forge pushes, the Soul Aspect, joining a sect and its techniques, the First Tribulation, and the journal's Reflect button now all appear and work.<br>
		- The journal's new-entry glow now clears once you Reflect on the entries.<br>
		- Outer Disciple now requires joining a sect, matching the rank.<br>
		- Reworded the body tempering milestones (for example, "Skin Tempered").<br>
		- Various text and wording polish.<br>
	<h3>v0.2</h3><br>
		- Comprehend the Dao Lattice: spend Insight on Glimpses and Seeds across the five elemental roots.<br>
		- Adopt a Stance. Breathing Trance trades Qi speed for Insight; Sword Trance runs deeper into the blade.<br>
		- Reach Nascent Soul and choose a Soul Aspect: Formless, or an elemental path earned through the lattice.<br>
		- Automation Tier 1 arrives with the Nascent Soul, so meridian purchases and Qi Condensation prestige run themselves.<br>
		- Join the Azure Sword Sect or the Stone Formation Sect. Study techniques, draw a stipend, and earn Contribution through deeds.<br>
		- Ascend to Soul Formation and face the First Tribulation. Your temper, meridians, core grade, techniques, and banked Qi all stand between you and the storm.<br>
		- Survive a Scarred result and carry the wound. The scar dims your Qi while it heals, and a fully healed depth becomes a permanent Tempered by Ruin buff.<br>
		- Pass the tribulation and the Act I Legacy Grade is written: the measure of the road you walked.<br>
	<h3>v0.1</h3><br>
		- Gather Qi and walk the cultivator's road from mortal to Golden Core.<br>
		- Open your meridians and temper your body. These are permanent attributes that never reset.<br>
		- Break through Qi Condensation, Foundation Establishment, and Core Formation.<br>
		- Your Foundation is graded; a stronger foundation forges a finer core.<br>
		- Forge your first Golden Core at the climax: push hard for grade, or warm it slowly and safely.<br>
		- Earn Outer Disciple standing in the sect for a permanent Qi boon.`

let winText = `You have endured the First Tribulation. The heavens came down wave after wave, and everything
	you built across a lifetime held against them: your tempered body, your opened meridians, your Golden Core,
	the Daos you comprehended, the sect that gave you a name. Soul Formation is complete. The Act I Legacy Grade
	of your mortal road is written into the eternal record, a measure of the life you led that will outlast this
	one.<br>
	The mortal road ends here. Beyond it lies Act II, the Severing of the Mortal: Spirit Severing, the cutting
	away of all that bound you to the dust, and the long climb toward Mahayana. That frontier awaits a future
	update.`

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
// Each entry may be a function() -> HTML string; the TMT engine calls it each
// tick and renders the result with v-html (see js/technical/temp.js lines 117-121
// and js/technical/systemComponents.js overlay-head template). An empty string
// suppresses the entry entirely — the template guards with v-if="thing".
var displayThings = [
    function () {
        // Guidance bar (design doc §1.5): one-line diegetic hint from the
        // hint engine. Returns "" when the engine is not yet loaded or has
        // no text, so the entry is invisible until the factory is ready.
        if (typeof cultivationHintText !== "function") return "";
        var guidanceText = cultivationHintText();
        if (!guidanceText) return "";
        return "<i>Guidance: " + guidanceText + "</i>";
    }
]

// Determines when the game "ends" — the Act I complete beat (slice 6, expansion §5):
// cultivationEndgameReached() (the factory) is true once the highest-row realm's last
// sub-stage is reached on best AND, when that realm carries a tribulation set-piece
// (Soul Formation's First Tribulation), tribulationPassed() — generic, so future act
// frontiers inherit it. Keep the defensive typeof pattern so a pre-factory tick
// reports not-endgame rather than throwing.
function isEndgame() {
	if (typeof cultivationEndgameReached === "function") return cultivationEndgameReached()
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