# Cultivation Design Expansion v0.1.1

*Reference decomposition + full-game creative direction. Companion to `cultivation-progression-map.md` and `early-game-spec-v0.1.2.md`. Sources analyzed: `immortal-tree` reference build (2026-06-03 snapshot, Renegade Immortal based, 23 layer files) and `cultivation_prestige` (v0.1 "Mortal to Golden Core", data/factory architecture). Date: 2026-06-12.*

**Rev 0.1.1** — incorporates doc review. Changes: optionality stated as a *proposed new* map invariant (§6.6, text in §3) instead of mis-cited under §6.3 completability (§7.2, §8); persistence scopes (tree / life / eternal) declared, resolving the Body layer's act-boundary topology (§8.1, new §10.8); severing and hint lint claims restated as actually machine-checkable (§1.5, §5, §8); post-lattice Domain terminology cleaned (§1.4, §5); Scar stacking typed and Demon Trial concurrency pinned (§6.2, §6.3, new §10.9); Seed persistence reconciled with memory fragments (§4.2/§7.2); synthetic two-tree lint fixture noted at slice 2 (§11); achievement scope split by `kind` tag so checkpoint gates re-fire each life (§8.1).

**How to read this.** §1 and §2 are the mining report: what the reference does that's worth our own implementation of, and what it does that we already ruled out. §3 onward is the expansion: the design pillars, the three progression grammars, realm-by-realm signature mechanics for all three acts, the challenge-state taxonomy, the meta loop, and a build order. Everything here respects the map's §6 invariants, including the one it added to that list (§6.6, stated in §3). Nothing here copies code, numbers, or text from the reference.

---

## 1. Patterns worth lifting (our implementation, their idea)

### 1.1 Tree-isolated reset topology
The reference runs three tree tabs. Tree 2 entry is a mega-prestige that resets all of tree 1; within tree 2, layers only reset siblings in their own tree (`treeOf()` guards in every `doReset`). The shape is right: act transitions are mega-prestiges, intra-act resets never leak across acts.

**Adaptation:** the reference hand-rolls this with per-layer guard code and three parallel constant arrays. We make it data. A `TREE_DATA` table declares tree membership, reset scope, and isolation; the factory compiles `doReset` from it; the linter verifies no cross-tree leak path exists. One table replaces ~20 scattered guards. Persistence scopes (what sits *outside* every tree) are pinned in §8.1.

### 1.2 Declarative-ish keep rules (made actually declarative)
The reference's `NIRVANA_PRESERVE_RULES` rows (`{ reset, ms, target, keep }`) are the right instinct: milestones that progressively protect lower-layer state from resets. But the same logic also lives in milestone effect text, in `doReset` special cases, and in `layerResetKeepForPrestige`, four places that can disagree.

**Adaptation:** one `KEEP_RULES` table in `js/data/`, factory-compiled, linter-verified (every rule's milestone is reachable, every kept key exists). Keep-rule acquisition is the single most important long-tail reward class in incrementals: "your Qi upgrades now survive Foundation breakthrough" is felt progress with zero new content cost.

### 1.3 Scripted failure as story beat (generalized)
The reference's best moment: the first Nirvana Scryer attempt *always* fails, resets tree 1, and activates "fallout", a permanent ×1.35-and-scaling buff. The second attempt succeeds. Failure-as-progress, and the rebuild is fast because of the buff plus accumulated keep rules, so the player gets a victory-lap tour of old content instead of a punishment.

**Adaptation:** the specific beat is Wang Lin's story; we generalize the *mechanic*. Each act-entry tribulation leaves a guaranteed **Scar** on first crossing (canonical: severing hurts, tribulations mark you). A Scar is a visible debuff with a heal arc; healing converts it into a permanent buff ("tempered by ruin"). One per act, narratively distinct each time, and it satisfies completability because the scarred state is tuned as the baseline.

### 1.4 Counted prestiges with per-reset caps
The twin paths (Ji / Golden Core) cap at 20 total weaves, gain 1 per breakthrough (3 with a milestone burst), and the *second* sibling is steeply discounted so taking both isn't double grind. Counted prestiges turn a layer into a finite ladder of known length, a strong pacing tool for branch layers where exponential scaling would be wrong.

**Adaptation:** use for any sibling/branch pair (our Dao Manifestation picks, profession Dao ranks, triad-style refinements). Data fields: `cap`, `gainPerReset`, `siblingDiscount`.

### 1.5 The guidance bar
`displayThings` runs a state-cascade producing one line of "what to do next" ("**Fallout active**: rebuild tree 1, then Yin → Yang for the second trial"). In a 100+ hour game this is the difference between long-tail and lost-tail.

**Adaptation:** data-driven hint table `{ when: condition, text }`, evaluated top-down, same `meets()` grammar as unlocks. First match wins, and a mandatory unconditional catch-all row terminates the cascade; the lint asserts the catch-all exists and sits last. (The full state space isn't enumerable, so the catch-all is the honest coverage guarantee.)

### 1.6 Journal + roadmap as anticipation engines
Narrative journal entries unlock on progress (with a new-entry glow), and a "Future Realms" side tab renders the entire planned ladder with live/planned markers and sect-rank pairings. Cheap, high flavor, and the roadmap converts "is there more?" churn into anticipation. Players idle longer when they can see the mountain.

**Adaptation:** both are pure data + one side layer each. The journal doubles as our story-gate flavor channel (gates are achievements per invariant §6.1; the journal is where their prose lives).

### 1.7 Automation as climbing reward
`NIRVANA_AUTOBUY_GATES`: reaching tree 2 milestones progressively automates tree 1 layers. The rule of thumb to adopt: **content two layers below your frontier should run itself.** Automation is the #1 retention mechanic in long incrementals and it must be a *reward*, never a settings toggle.

**Adaptation:** `AUTOMATION_DATA` rows `{ grantedBy: {layer, milestone}, automates: {layer, actions} }`. Linter rule: no manual-click-required action may exist more than two rows below the player's frontier without an automation row covering it.

### 1.8 Second-order texture worth keeping
Offline production on by default with a generous cap; nav hotkeys with shift-to-prestige; per-realm minor-stage naming tables (recognition is the progress feedback, our map already says this); a consistent realm-tab template (our factory already does this better); screenshot mode for promo captures.

---

## 2. Patterns to skip (confirmed against source)

1. **Story events as reset-challenges.** Confirmed worse than diagnosed: the reference maintains `challengeSnapshot` ledgers (`takeCultivationChallengeSnapshot`, `sectSnapshotMeetsTrialGoal`) that re-validate trial goals against *pre-challenge* state, because entering a TMT challenge resets the progress the goal needs. A parallel shadow-state system exists solely to fight the primitive. Our invariant §6.1 stands: story gates are achievements reading live state. The challenge primitive is reserved for genuinely optional repeatable runs (§6 below: Secret Realms).
2. **Penalty mults on suppressed resources.** `eventChallengeMult` applies ×0.5-style penalties to resources the same event forbids you from gaining (dead multiplier, invariant §6.2). Our linter already catches this class.
3. **Flat stat-stick upgrades.** The reference's upgrade economy is overwhelmingly "×2 gain", "×1.35 gain". Zero decision content. Our rule: every upgrade row either presents a tradeoff, changes a formula shape, or unlocks a verb. Pure mult rows are allowed only as milestone rewards (which are free), never as purchases competing for the decision currency.
4. **Tuning constants smeared across files.** `balance.js` exists, then every `gainMult()` hardcodes its own literals anyway. Our zero-numeric-literals rule + linter already solves this; the reference is the cautionary tale.
5. **Realm names from one author's invention.** Ji Realm, Nirvana Scryer/Cleanser/Shatterer, Joss Flames-as-realm, the Step structure: that's Er Gen's specific upper ladder, not genre canon. Already resolved in our progression map (canonical spine, [CANON]/[STRUCTURE]/[OURS] tagging). Mechanics inspired by these layers get reskinned onto canonical realms.

---

## 3. Design pillars

The map's §6 invariants are the floor. These four pillars are the ceiling, what the game is *about*:

1. **Graded consequence at every scale.** Minor stages feed realm grades; realm grades feed act Legacy Grades; Legacy Grades feed the Samsara meta loop. The fractal version of "early choices echo late." Nothing is pass/fail; everything is *how well*.
2. **Three grammars, not one.** Vertical prestige (realms), lattice comprehension (Daos), horizontal standing (sect/world). Each progresses differently, each feeds the others, and at any moment at least two have a live decision. This is what "multiple trees" should mean: trees of different *grammar*, not just more tabs of the same grammar.
3. **Challenge states without resets.** Stances, tribulations, and demon trials are all live-state modifiers; only Secret Realms use the reset primitive, because only they are genuinely optional repeatable runs. No snapshots, ever.
4. **The long tail is automation + anticipation.** Every act automates the last act's hands; the roadmap, journal, and Samsara loop keep the next mountain visible.

**Map invariant §6.6 — meta-prestige is never a ransom.** Optional meta systems (Samsara, Secret Realms, stances) are accelerants and variety, never requirements: every gated objective is reachable, within its act's tuned pacing budget, without engaging any optional meta system. This is *new*, not a restatement of map §6.3 (completability under a gate's own modifiers); it constrains the meta loop, not individual gates. Machine-checked by the pacing sim's no-Samsara run (§8.8). Now amended into the map's §6 list as invariant 6.6.

---

## 4. The three grammars

### 4.1 Realm spine (vertical prestige)
The canonical ladder per the progression map, three act trees on three tabs. Act entry = mega-prestige + tribulation set-piece + Scar (§1.3). Each realm carries exactly **one signature mechanic** (§5); minor stages are milestones; breakthroughs are graded where the genre grades them.

### 4.2 Dao lattice (comprehension, never resets)
Resolves the map's open question (Domain: flavor-pick vs full tree) as: **full second tree, parallel from mid-Act-I, different grammar.** This is the build-identity carrier.

- **Currency: Insight.** Trickles passively, surges from epiphany sources: stances (§6.1), tribulation grades, secret realm finds, sect libraries, mortal-life events.
- **Structure: a lattice, not a ladder.** Concept nodes in an elemental/conceptual graph. Five Elements at the root (matching spiritual roots, §7.1), derived concepts branching (Metal → Sword → Severing; Water → Flow → Time; Fire → Life/Death as a yin-yang pair that must be walked in tension). Node tiers: **Glimpse → Seed → Manifestation → Law** (Act III adds **Authority**: weave two Laws, e.g. Sword + Time).
- **Exclusivity at depth.** Glimpses are cheap and broad; Manifestations are few; Laws are 1-2 per life. Deep nodes conflict (can't manifest both Stillness and Flow). Build identity through scarcity, not menus.
- **Persistence.** The lattice never resets within a life. Across reincarnations: Glimpses persist free (you never forget what you have glimpsed); Seeds persist only via memory-fragment purchase (§7.2); Manifestations and Laws never persist but re-walk at a steep discount ⟨tune⟩ on familiar paths.
- Realm gates read the lattice lightly (Void Refinement wants any Manifestation), the lattice reads realms lightly (Law tier needs Act II). Coupled, not chained.

### 4.3 Sect & world standing (horizontal)
The reference's macro shape, rebuilt on checkpoint grammar:

- **Contribution** side-spine (prestige currency from qi, as reference) buying stipends, library access, **arsenal** automations. Arsenal persists across sect transfer but *re-prices* at each world rank (softer than the reference's reset; still a sink at every rank).
- **Story events are achievements** reading live state, journal-flavored. Tournaments, trials, promotions: all checkpoints. Rewards: **Techniques** (permanent arts library, the reference's best reward loop, kept as-is in spirit).
- **Sect archetypes matter.** Sword sect, pill sect, formation sect, beast-taming sect: each offers a different technique library and Dao-lattice discount region. Transferring up the world-rank ladder is therefore a *build* decision. A **Rogue Cultivator** option trades all sect benefits for a freedom multiplier and black-market access (and pairs naturally with the demonic axis, §7.3).
- **Sect War** as a late-Act-I merit minigame (war merits as a counted-prestige ladder per §1.4), gating Sect Leader, gating transfer.

---

## 5. Signature mechanics by realm

One mechanic per realm. Realms without a listed support system still get milestones/keep-rules; the table is the *new* verb each realm introduces.

### Act I — Mortal Road

| Realm | Signature | Notes |
|---|---|---|
| Body Tempering (side) | Meridians + Tempering | Shipped in v0.1. |
| Qi Condensation | Numbered levels; **first Stance** | Breathing Trance (qi/sec down, Insight trickle up) seeds the lattice grammar early at near-zero cost. |
| Foundation Establishment | **Graded breakthrough** | Shipped. NG+ lives add a fourth grade input (Dao Seeds held) ⟨tune⟩. |
| Core Formation | **The Forge** | Shipped. The forge is instance #1 of the "set-piece" config type; tribulations reuse its skeleton. |
| Nascent Soul | **Soul Aspect** | The soul takes a form on first breakthrough: pick an aspect from your spiritual root elements or held Dao Seeds. Run-long passive identity + aspect technique line. Canon: the nascent soul acts independently, so NS also grants **Automation Tier 1** (auto-meridians, auto-q-prestige at threshold). |
| Soul Formation | **First Tribulation + Act Legacy Grade** | Full tribulation set-piece (§6.2). Act I Legacy Grade = f(core grade, aspect depth, Dao Seeds, sect rank, tribulation grade) ⟨tune weights⟩, stored eternal-scope (§8.1). |

### Act II — Severing the Mortal

| Realm | Signature | Notes |
|---|---|---|
| Spirit Severing | **The Severing** | The headline mechanic of the game. Three severances (canonical three attachments). Each severance: choose a *real piece of your build* (a Dao Manifestation, a profession, a technique school, a meridian set bonus) and sever it. It is gone this life, greyed in the UI with a severed mark, and you gain a transcendent multiplier scaled to the live contribution of what you cut (bigger sacrifice, bigger gain; net-positive **by construction**: the transcendent multiplier must cover a superset of the severed piece's effect domain at ratio k > 1 ⟨tune⟩, a formula *shape* the linter can verify; severance designs outside that shape are pacing-sim assertions over sampled builds, §8.8, never lint claims). Severed things return next life; severing the same attachment in three lives transcends it permanently (Samsara meta-achievement). |
| Void Refinement | **Law tier opens; Stance stacking** | Lattice ring 2. Maintaining two conflicting stances simultaneously ("walking the void between") becomes possible and is the premier Insight engine. |
| Body Integration | **Resonance** | The body ladder (Tempering tiers, reopened and extended in Act II) and qi ladder must converge: fusion progress keys off min(body stage, qi stage) with resonance bonuses at matched stages. Pays off body-lead and qi-lead builds differently. |
| Mahayana | **The Great Preparation** | You can scout the final tribulation's wave composition in advance (divination, profession synergy). Mahayana is spent building the answer: pill regimens (Alchemy), defensive gear (Artifice), a **formation grid** placement puzzle (TMT grid primitive, finally a legitimate use), karma cleansing (§7.3). Everything the player built converges here. |

### Act III — Immortal Ascension

| Realm | Signature | Notes |
|---|---|---|
| Tribulation Transcendence | **THE Tribulation** | Consumes the Mahayana prep. Entry to Act III; graded; scars on first crossing per §1.3. |
| Immortal Ascension | **Heaven's Orthodoxy vs Loose Immortal** | Join the celestial hierarchy (structure, stipends, duty checkpoints) or wander (freedom mult, hunted: periodic mini-tribulations). The orthodox/demonic axis at a higher octave. |
| True / Golden / Grand Immortal | **Faith economy + Authorities** | Mortal worlds generate **Faith** (incense/joss, canonical deity-path resource). Your *past reincarnated lives* become shrines: each completed life generates Faith scaled to its Legacy Grade. Old runs become farms; the meta loop closes into content. Authorities = woven Law pairs (lattice tier 4). |
| Dao Ancestor | **Legacy Inscription** | Endgame: inscribe your Dao into the world. NG++ that permanently modifies all future lives (a chosen global rule change ⟨design⟩), or the 1.0 win screen. |

---

## 6. Challenge-state taxonomy

Four classes. Only one touches the reset primitive.

### 6.1 Stances (voluntary, toggleable, no reset)
Global modifier toggles with opportunity cost, enterable and exitable freely. TMT: clickable toggles feeding the existing mult pipeline; zero new primitives.

Starter set ⟨design⟩: **Breathing Trance** (qi down, Insight up), **Sword Trance** (everything down, sword-line Insight way up), **Seclusion** (gathering up, sect contribution decays, events pause), **Devouring** (qi way up, karma down, heart demons up; demonic-axis gated). Stances are the *correct* implementation of what the reference's sect events wanted to be: "cultivate under pressure" as a state you occupy, not a reset you suffer.

### 6.2 Tribulations (scheduled set-pieces, performance-graded)
At graded breakthroughs and act transitions. Multi-wave bar drain against a prepared pool (tempering, talismans, formations, pills); player chooses when to trigger; performance grade (**Flawless / Scarred / Shaken / Failed**) feeds the breakthrough grade. Failure never destroys progress: it leaves a **Scar** (visible debuff + heal arc → permanent buff, §1.3). Intensity = f(power, **karma balance**, bloodline) ⟨tune⟩: heaven weighs your sins, the canonical pressure that makes karma a cost as well as a currency.

**Scar stacking:** Scars are typed slots, not a stacking debuff economy. Act-entry Scars are unique per act and arrive sequentially; the tribulation-failure Scar is a single slot that **deepens** on repeated failure instead of multiplying (heavier debuff, stronger healed buff, so failure keeps paying; depth ceiling ⟨tune⟩, §10.9). Heal objectives are asserted reachable under the union of all active Scar debuffs (sim assertion, §8.8).

TMT: bar + clickables, generalizing the forge's skeleton into a `SETPIECE_DATA` config type.

### 6.3 Demon Trials (involuntary stances, completability-linted)
Heart-demon threshold crossings (§7.4) force a debuff stance with a clear objective. Clearing grants a permanent **Dao Heart** stack. Objective is asserted reachable *under the trial's own modifiers* (extends `checkCompletability` to stance contexts). Failure isn't possible; only not-yet-cleared. **Concurrency:** heart-demon accumulation pauses while a trial is active (you are already facing the demon); overflow at trial start banks toward the next threshold, and a queued crossing fires on clear. One active trial maximum, so clearability is always linted solo. This converts the genre's inner-demon trope into the third challenge texture, and demonic builds will farm it on purpose.

### 6.4 Secret Realms (the legitimate reset-challenge)
Genuinely optional, repeatable expedition runs: enter a pocket world with rule modifiers, scoped sub-state resets on entry (expedition loadout only, never main progression), permanent rewards out (materials, techniques, Insight surges, Dao Glimpses). Modifier composition gives variety ("Inverted Spirit Land: qi gains from spending, not gathering"). Rotating availability gives idle session cadence. This is the one place TMT's challenge primitive runs as designed, and the snapshot disease never appears because nothing outside the expedition resets.

---

## 7. Meta progression

### 7.1 Spiritual Roots (the run seed)
Every life has a root configuration: element count, element identity, purity grade (Mortal / Earth / Heaven ⟨tune⟩). Roots discount matching Dao-lattice regions, bias profession affinity, and color the Soul Aspect menu. Single-element heaven roots are deep-and-narrow geniuses; five-element mortal roots are wide-and-slow (and secretly the best Authority weavers in Act III ⟨design⟩: trash-root protagonist energy, mechanically real).

### 7.2 Samsara (the outer loop)
**Reincarnation is the meta-prestige.** Unlocks at first Act I capstone; always optional (walls are tuned to be crossable without it; Samsara is acceleration and variety, never a ransom: map invariant §6.6, §3).

- **Karma** = f(realm reached, Legacy Grades, deeds, Daos comprehended, sins) ⟨tune⟩ on rebirth.
- **Spend on:** root quality/configuration, innate talents (perk rows), **memory fragments** (retain chosen techniques / Dao Seeds), starting boons.
- **Past lives persist as data:** they power Act III shrines (§5) and the three-lives severing transcendence (§5). The save's history *is* late-game content.
- Alignment (§7.3) resets each life: every rebirth is a fresh orthodox/demonic choice, which is the replay axis.

### 7.3 The Orthodox / Demonic axis
A continuous alignment value moved by actions (stances, sect choices, secret-realm decisions), with threshold-gated exclusives on both ends. Demonic: faster base gains, worse grade odds, heavier tribulations (karma debt), heart-demon accumulation, sect raiding instead of joining. Orthodox: slower, stabler, grade bonuses, sect support. Not a menu choice; a drift you steer.

### 7.4 Heart Demons
A corruption stat fed by rushed low-grade breakthroughs, reckless forge/tribulation pushes, and demonic stances; bled by orthodox practice and Dao Heart stacks. Thresholds trigger Demon Trials (§6.3). The permanent live tension that keeps grade-chasing vs rushing a real decision *forever*, not just at the v0.1 forge.

### 7.5 The automation ladder
Per §1.7: data-driven grants, frontier-minus-two coverage rule, linter-enforced. Acts automate acts: by mid-Act-II, Act I plays itself; by Act III, Act I is a glance.

### 7.6 Professions (economy tissue, not upgrade tabs)
Three exclusive Daos, slots opening one per act ⟨tune⟩: **Alchemy** (consumables: timed mults, breakthrough aids, tribulation pills), **Artifice** (equipment slots: persistent mults + automation devices), **Formations/Talismans** (cost reduction, tribulation defense grids, offline gains). Professions *consume* secret-realm materials and *produce* what every other system spends. They are the connective economy, and Mahayana (§5) is where all three pay off at once.

---

## 8. Architecture deltas

The v0.1 factory/data/linter stack scales to all of this. Specific additions:

1. **Persistence scopes + `TREE_DATA`** (§1.1): every layer (and stored value) declares a scope: **tree** (reset by its act's mega-prestige), **life** (survives every act transition, resets only at reincarnation: the Body layer with meridians, temper, and stored grades, plus the technique library), or **eternal** (survives reincarnation: Karma, Legacy Grades, past-life records, journal, meta achievements). `TREE_DATA` carries membership and scope; the factory compiles `doReset`; the linter proves the reset closure of each tree excludes life/eternal layers and the reincarnation closure excludes eternal ones. This resolves the v0.1.2 §6 landmine by declared topology: **Body is life-scoped, a member of no tree, untouched by the Severing mega-prestige.** Achievements are *not* uniformly eternal: scope rides the spec §8 `kind` tag — `kind: "checkpoint"` story gates are life-scoped (sect ladders, tournaments, and promotions re-fire each rebirth, preserving §7.2's fresh-choice replay axis), while meta achievements (Samsara milestones, three-lives transcendence) are eternal. Linter rule: no eternal achievement may gate a tree- or life-scoped layer.
2. **`KEEP_RULES`** (§1.2): declarative keep acquisition; linter proves milestone reachability and key existence.
3. **`SETPIECE_DATA`**: the forge config generalized (waves, pools, grades, scar table). Forge = instance 1, tribulations = instances 2..n.
4. **`STANCE_DATA` / `TRIAL_DATA`**: modifier sets + clear conditions; extend `checkCompletability` to assert clearability under own modifiers, and verify severing formulas match the net-positive-by-construction shape (§5).
5. **`HINT_DATA`** (§1.5): guidance cascade; lint asserts the unconditional catch-all row exists and sits last.
6. **`AUTOMATION_DATA`** (§1.7): grants + frontier-coverage lint rule.
7. **Lattice store:** the Dao graph is one data table (nodes, edges, conflicts, tiers, costs); rendering is a grid/canvas tab, not new TMT primitives.
8. **Pacing sim v2:** per-act time-budget asserts (Act I 8-15h to capstone ⟨tune⟩, etc.), plus a no-Samsara run proving map invariant §6.6, sampled-build severing assertions for designs outside the by-construction shape (§5), and Scar heal-arc reachability under active-Scar unions (§6.2).

---

## 9. Feature gap table

| Feature | Reference | Our map (current) | This doc proposes |
|---|---|---|---|
| Multi-tree acts | 3 tabs, hand-rolled isolation | 3 acts planned | `TREE_DATA` + scopes, mega-prestige + Scar entry |
| Story gates | Reset-challenges + snapshots | Achievements (§6.1) | Unchanged; journal carries flavor |
| Optional challenges | Blights (challenges) | Reserved primitive | Secret Realms, scoped resets only |
| Self-imposed difficulty | None (only penalties) | Not specified | **Stances** (new grammar) |
| Breakthrough set-pieces | None (button prestige) | Forge (v0.1) | **Tribulations** generalize forge |
| Grades | Core quality labels only | Foundation + Core grades | Grades fractal: realm → act → life |
| Dao/Domain | Flat boost picks per realm | Open question | **Full lattice tree** (decision made) |
| Failure handling | One scripted fall (great) | Crack-one-tier (forge) | Scars + Dao Hearts; failure always pays |
| Meta loop | None (single climb) | None yet | **Samsara/Karma/Roots**; lives → shrines |
| Build axes | Twin path choice, professions | Professions planned | + Orthodox/Demonic, Body/Qi resonance, Aspects |
| Anti-rush tension | None post-forge | Forge only | **Heart Demons** (permanent tension) |
| Automation | Milestone autobuy gates | Not specified | Data-driven ladder + lint rule |
| Guidance | `displayThings` cascade | None | `HINT_DATA` with catch-all lint |
| Anticipation UX | Journal + roadmap tab | None | Both, as data |

---

## 10. Open questions

1. **Lattice scale.** This doc commits to a full second tree. The fallback (medium lattice: ~25 nodes, Glimpse/Seed/Manifestation only, Laws folded into Act III realms) cuts scope ~40% if Act II slips. Decide at the Act I content-complete gate.
2. **Samsara unlock point.** First Act I capstone (proposed) vs first Nascent Soul (earlier variety, weaker capstone weight). ⟨tune⟩ after Act I pacing data.
3. **Severing scope.** Per-life permanent (proposed, the genre-honest version) vs late-game purchasable undo. Permanence is the point; revisit only if playtests show regret-quits.
4. **Alignment shape.** Continuous axis with threshold exclusives (proposed) vs discrete path pick. Continuous costs more UI but makes drift a story.
5. **Faith/shrine literalness.** Past-lives-as-shrines needs Samsara history in the save schema from day one even though Act III is far out. Schema now, content later: cheap insurance.
6. **Tribulation inputs.** Power-only vs power+karma+bloodline (proposed). The karma term is what makes the demonic path *cost* something at every breakthrough.
7. **Body ladder depth in Act II.** Resonance (§5) needs the body track extended past Marrow. Full parallel realm ladder vs a compact 5-tier extension. Lean compact until Body Integration proves fun.
8. **Grade transformation points.** Core grade persists life-long as a multiplier (map §5) and feeds Act I Legacy Grade, but canon offers fold points: the core consumed into the nascent soul at NS, or body/qi/core merging into an **Integration Grade** at Body Integration. Folding keeps late-act multiplier counts sane and is canon-resonant; persisting keeps §6.2 observability trivially satisfied. Lean: fold at Body Integration, with the Integration Grade inheriting the weight ⟨tune⟩.
9. **Scar bounds.** Depth ceiling on the failure Scar (lean 3 ⟨tune⟩), and whether an unhealed act-entry Scar blocks attempting the *next* act's tribulation. Lean no: a scarred ascent is a legitimate, harder line, and blocking would edge toward exactly the ransom §6.6 forbids.

---

## 11. Build order (extends map §7)

| # | Slice | Effort | Notes |
|---|---|---|---|
| 1 | v0.1 polish + ship the demo loop | low | Current path; forge is the proof of set-piece grammar. |
| 2 | Scopes + `TREE_DATA` + `KEEP_RULES` + `HINT_DATA` plumbing | moderate | Pure architecture; do before content multiplies. Ship a synthetic two-tree fixture in the lint tests so the cross-tree-leak rule is exercised from day one instead of running vacuously until slice 9. |
| 3 | Dao lattice v1 (Glimpse/Seed, ~15 nodes) + 2 stances | moderate | The second grammar, smallest honest version. |
| 4 | Nascent Soul + Soul Aspect + Automation Tier 1 | moderate | First post-demo realm; automation proves the ladder. |
| 5 | Sect v1: contribution, checkpoint events, techniques, 2 archetypes | moderate | No war yet. Journal ships here. |
| 6 | Soul Formation + Tribulation set-piece + Act I Legacy Grade | significant | Generalize forge → `SETPIECE_DATA`. Act I content-complete gate; revisit Q1. |
| 7 | Secret Realm v1 + Alchemy | moderate | First legitimate challenge use + first profession. |
| 8 | Heart Demons + Demon Trials | low-moderate | Mostly data on existing stance plumbing. |
| 9 | Act II tree: Spirit Severing (the Severing) | significant | The headline. Scar-on-entry ships here; cross-tree lint gets real work. |
| 10 | Samsara v1: Karma, roots, memory fragments | significant | Meta loop opens; pacing sim v2 proves §6.6. |
| 11 | Void Refinement + Body Integration + Mahayana | significant | Act II completion. |
| 12 | Act III + Faith + Authorities + Inscription | significant | Schema work from Q5 pays off here. |

Ship gates at #6 (Act I complete, public alpha) and #10 (the loop closes, the long tail begins).

---

*Provenance: all mechanics above are original implementations of genre-canonical concepts or independent designs. Reference-inspired structures (§1) are pattern-level only; no code, tuning values, or text were taken from the reference build.*
