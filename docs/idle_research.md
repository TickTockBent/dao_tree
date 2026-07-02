# Designing "Dao Tree": A Progression-Timeline Research Report for a Design-Pure Cultivation Incremental on Steam

## TL;DR
- **The cultivation genre is a near-perfect thematic skin for nested prestige incrementals**: realms → prestige layers, breakthrough bottlenecks → soft/hard walls, tribulations → gated reset events, qi accumulation → primary currency, and reincarnation → the deepest meta-reset. Map your realms directly onto reset layers and you get thematic justification for the genre's core mechanics "for free."
- **Beloved incrementals gate the first prestige at roughly 2–5 hours (Antimatter Dimensions) up to days/weeks (Cookie Clicker, NGU Idle), then stretch total content across weeks-to-months**; the winning pattern is a fast, satisfying first reset that teaches the loop, followed by progressively longer layers, generous offline progress (6–24h caps are standard), and constant automation unlocks so the "wall" always has an escape hatch.
- **The features players love most are meaningful automation, generous offline progress, satisfying build-changing prestige, and QoL (bulk-buy, autobuyers, notation options, cloud/export saves); the things that kill engagement are unrewarding resets, un-escapable grind walls, forced manual clicking, and any pay-to-win/energy/ad monetization.** A premium, monetization-free Steam release (Melvor Idle's model) is both critically and commercially validated.

## Key Findings

1. **First-prestige timing varies by an order of magnitude, and that is a deliberate design choice.** Antimatter Dimensions reaches its first Infinity in "a few hours to a couple days," with speedrun-style runs achievable in 2–5 hours; Cookie Clicker's first ascension realistically takes days to weeks (1 trillion cookies for the first prestige level). NGU Idle expects sub-hour early rebirths escalating to multi-day "long rebirths." The best-loved games front-load a *reachable* first reset to teach the loop.

2. **Layered/nested prestige is the genre's structural backbone.** Antimatter Dimensions stacks Infinity → Eternity → Reality → meta-layers, each resetting everything below it and introducing a new currency and mechanic. This "the game plays differently after prestige" design is repeatedly cited as the single biggest retention driver.

3. **Exponential cost curves against polynomial/linear production is the core math.** Costs grow as `cost_next = cost_base × growth_rate^owned` while production grows linearly/polynomially; prestige multipliers periodically "slide the player up the curve." Designers tune growth rates (commonly ~1.07–1.15 per step) and insert softcaps/dilation to slow runaway growth.

4. **Offline progress is expected, and its cap is a key pacing lever.** Antimatter Dimensions marks its offline threshold at 6 hours (its achievement "Don't you dare sleep" is earned by being offline over 6 hours in a row); Trimps offers 24 hours with different offline modes; Melvor Idle's cap is disputed (its official wiki states 24 hours as of July 2025, while Steam player complaints cite an 18-hour cap — see Caveats). Offline is generally "linear" while active reinvestment compounds — you don't lose progress, you lose acceleration.

5. **Cultivation realms map cleanly onto gating.** Xianxia's canonical ladder (Body Refinement/Qi Condensation → Foundation Establishment → Core/Golden Core → Nascent Soul → Soul Formation → … → Tribulation Transcendence/Ascension), with 6–12 major realms each subdivided into minor stages, plus comprehension-based *bottlenecks* and *tribulations* at major breakthroughs, is a ready-made prestige/wall/reset architecture.

6. **A premium, zero-monetization Steam incremental can be a major success.** Melvor Idle holds a Very Positive rating with a 90/100 Player Score from 15,753 total Steam reviews (14,222 positive, 1,531 negative, per Steambase, 2026), explicitly ships with no microtransactions ("Melvor Idle does not contain microtransactions. We believe everyone who plays should be on a level playing field"), and is published by Jagex — validating the design-pure premium model the user wants.

7. **Existing cultivation idlers already reveal the pitfalls.** Steam's *Idle Cultivation* draws complaints of massive late-game slowdowns (7 hours to cultivate one stage in the Heaven realm) and requests for "less tiered, more free" progression — a caution against walls with no player agency to overcome them.

## Details

### AREA 1 — TIME GATES AND TIME ALLOCATION

#### Concrete numbers: hours to first prestige/reset

- **Antimatter Dimensions (Infinity):** The community guide states your first Infinity can be reached "on the order of a few hours to a couple days"; optimized routes hit it in 2–5 hours. The achievement "That's FAST!" rewards going infinite in under 2 hours (reward: start with 5,000 antimatter), and "That's FASTER!" rewards Infinity in 10 minutes or less. The subsequent layers escalate: first Eternity "a couple days to a week," first Reality "a week to a month," and "The End" in "one to three months" (the guide author's personal record was about four weeks). This is the gold-standard pacing curve: hours → days → weeks → months.
- **Cookie Clicker (Ascension):** The first prestige level requires 1 trillion cookies baked all-time; guides note this "could take days or weeks." Prestige level scales cubically — per the Cookie Clicker Wiki, "Prestige Level 1 needing 1 trillion cookies baked (all time) (1³ × 1 trillion), Prestige Level 2 needing 8 trillion (2³ × 1 trillion)." Community consensus is *not* to ascend at the first available chip — wait for ~100–200 prestige levels (some pros wait for 2,337). One player reported the first "pro-guide" ascension took 3–4 weeks.
- **NGU Idle (Rebirth):** Early rebirths are meant to be short — "reincarnate at intervals of about an hour" at the start — escalating to multi-day "long rebirths" of 3+ days to break the "Mega Lands wall," which "usually takes players a few days to get through." One player reported 20 days from beating Boss 90 to Titan 4.
- **Melvor Idle:** No traditional prestige/reset; progression is skill-grind based across 20+ skills with "thousands of hours of content."
- **Trimps:** First soft-reset (Portal/Helium) unlocks after zone 20 + the Dimension of Anger map.

#### Layer/tier duration before a new mechanic unlocks
The AD model is instructive: each prestige layer lasts progressively longer than the last (hours → days → weeks), and each unlocks a genuinely new system (Infinity Dimensions, Time Dimensions/Time Study tree, Replicanti, Dilation, Glyphs/Reality). The design principle from the Better Than Wolves design analysis: "certain core game features will only become visible after months of play," and discovering mechanics that "completely rebalance … the optimal way to play" is often the sole reason players continue.

#### Offline progress windows
- Antimatter Dimensions: **6 hours** is the marked offline threshold; offline "usually gets you to the next Prestige."
- Trimps: **24 hours**, with selectable modes (Trustworthy Trimps = loot only; Time Warp = simulated real progression; Hybrid).
- Melvor Idle: **disputed** — the official wiki (July 2025) states 24 hours; Steam player complaints cite 18 hours ("REQUIRED to interact … EVERY SINGLE DAY") and note it was historically 12. Verify against the current build.
- **Rule:** offline yields linear/simulated progress; active reinvestment compounds. The design intent (Eric Guan's "Idle Game Design Principles") is *reengagement clocks*: short-cycle resources (minutes) reward frequent check-ins; long-cycle resources (hours/days) reward the idle player. Stagger multiple "clocks" with exponentially longer optimal wait times to serve both playstyles.

#### Soft-cap walls and hard walls
- Walls are intentional: "after reaching a seeming wall, where progress becomes slow, the player is offered to reset … in return for a small boost in speed." The wall is the *trigger* for prestige.
- Named examples: NGU Idle's "Mega Lands wall" (takes days to overcome, sometimes via a 3+ day rebirth); Idle Cultivation's Heaven-realm slowdown (7 hours per stage).
- **Critical churn insight:** A player recalling a Playsaurus statement claims "over 70% of Clicker Heroes 1's new players stop playing before they even reach lvl 50." Churn concentrates where players stall ~60% of the way to the next unlock. The design lesson: never let a wall be un-escapable — always pair it with a reset/automation/mechanic that provides a visible path through.

#### Total expected playtime and active vs. idle pacing
- Universal Paperclips / SpacePlan: finishable in a weekend / ~8 hours (games with endings).
- Cookie Clicker: "satisfying" around 40 hours but effectively endless.
- NGU Idle, Antimatter Dimensions: hundreds of hours each.
- Melvor Idle: thousands of hours.
- **Active vs. idle:** AD explicitly alternates "times for heavy active interaction … as well as times for leaving the game idle." Early game is manual-intensive; automation is dripped in so later phases can be idled. The Better Than Wolves analysis identifies a "grind phase" (active) and an "idle/cycle phase," and notes players quit when they misunderstand which phase they're in — an onboarding/communication design problem.

#### Design mechanisms behind gating

**Prestige/reset loops (nested layers).** Per Anthony Pecorella (Kongregate, GDC 2015/2016; "The Math of Idle Games"), prestige serves two purposes: the "ladder-climbing" effect and giving the designer control over the growth curve (prestige currency effectively "takes a log" of total growth). Layered games nest these: each higher reset wipes lower layers but grants a persistent currency/multiplier.

**Exponential cost curves and tuning.** Costs: `cost_next = cost_base × growth_rate^owned`; production linear: `prod = prod_base × n_owned`. Because any exponential eventually outpaces any polynomial, walls are guaranteed; balancing sets *when*. Practical tuning values: Idle Idol used ~1.1× cost growth (11–19% per step) with slower reward growth to decelerate pacing; Eric Guan used ×1.1 production vs ×1.15 cost per level. Softcaps, hardcaps (AD caps Antimatter Galaxies at 11), and "dilation" (raising numbers to a power <1) tame runaway growth.

**Cultivation→incremental mapping (in depth).** This is the report's central creative thesis:

| Cultivation concept | Incremental mechanic |
|---|---|
| Qi / spiritual energy accumulation | Primary currency (generated per tick) |
| Meditation / cultivation techniques | Generators / production upgrades |
| Minor stages within a realm (Early/Mid/Late/Peak) | Tiered upgrades / soft milestones |
| Major realm breakthrough | Prestige reset (gain a persistent "Dao/insight" currency) |
| Bottleneck (comprehension wall) | Soft-cap wall that a reset or new mechanic overcomes |
| Heavenly Tribulation | Gated reset "event" / challenge with a pass/fail check |
| Dao comprehension | Meta-currency / skill-tree unlocks (persistent) |
| Pills / alchemy | Consumables / temporary boosters |
| Reincarnation | Deepest meta-reset layer (the AD "Reality" analogue) |
| Lifespan | Optional run-timer / pacing constraint |
| Spiritual root / talent | Starting-build modifiers / class choice for build diversity |

Xianxia bottlenecks are explicitly "comprehension problems, not resource problems" — a perfect narrative justification for a wall that raw currency can't break, forcing the player to unlock a new mechanic (insight) or reset. Tribulations, which "restructure the body at a fundamental level" and can be survived using artifacts/formations, map onto a challenge-gate that grants a permanent structural bonus. Note the standard structure: nearly every xianxia system shares a mortal starting point, qi-refining stages, a transformative middle tier, and ascending immortal tiers — with 6–12 major realms, each divided into minor layers (Early/Mid/Late/Peak or numbered levels).

**Design-pure cooldown/timing (no pay-to-skip).** Time-based accumulation (qi builds per tick), breakthrough attempts (a chance/threshold check on demand), and meditation cycles (reengagement clocks) all respect purity. The key is that time can be *compressed by progression* (upgrades, resets, automation) but never by payment.

### AREA 2 — BELOVED & COMMONLY REQUESTED FEATURES / METAPROGRESSION

#### Most beloved / requested features
- **Meaningful automation.** Autobuyers/auto-clickers are considered *necessary* by serious idle players; Pecorella argues that needing an external auto-clicker "reflects a design flaw rather than cheating." AD gates autobuyers behind challenges (a reward loop) and adds bulk-buy scaling (×2 up to ×512). Build automation as an *earned unlock*, not an afterthought.
- **Generous offline progress** (see caps above) — a genre-defining differentiator from energy-gated games.
- **QoL:** bulk-buy / "buy max," notation options (scientific, engineering, letters, even novelty), cloud saves + manual save export. Melvor is praised for cloud saves + cross-platform; players note "clearing your browser cache could mean losing everything" without cloud saves.
- **Achievements with in-game effects** and **statistics tracking** — "achievements that affect the game" (bonus multipliers) are singled out as loved.
- **Satisfying number growth** and **build diversity / meaningful choices.** Per Quantic Foundry (Nick Yee), of three idle clickers surveyed, "a mere 10% identified as casual gamers, with 70% identifying as core gamers and 20% as hardcore gamers"; players were "most driven by completion … and power … and least driven by excitement … and fantasy." Design so players *feel* the power growth and can collect/complete.

#### Metaprogression players love
- **Persistent currency + skill trees across resets** (AD's Time Study tree, perks; NGU's permanent NGU levels, Augments, Beards). The satisfying pattern: reset wipes the run but a growing permanent layer means each run reaches the old wall faster and then goes further.
- **"The game plays differently after prestige"** — new mechanics that rebalance optimal play (the single most-cited retention hook).
- **Flexible reset timing** — players praise systems (e.g., Tap Titans) where "you can prestige whenever you like but the higher the stage … the higher the reward." Avoid forcing a fixed reset point.

#### What players HATE (anti-patterns to avoid)
- **Unrewarding prestige / resets that lose too much with too little payback.** Direct player quote on Endless World Idle RPG: "we need lower time needed per reset, we need more boni for resets … dont you guys have any idea how idle games work?"
- **Tedious prestige execution.** Unnamed Space Idle players: prestiging is "incredibly tedious. Having to switch utilities, boosts, shards … I can't see myself doing that every other day." Automate or streamline the reset ritual.
- **Un-escapable grind walls** ("the wall" that ends engagement) — the #1 churn driver.
- **Forced manual clicking / lack of automation**; **boring waiting** with nothing to optimize.
- **Pay-to-win, energy systems, forced ads, gacha, time-warp purchases** — the exact monetization patterns the genre originally satirized (Cow Clicker) and that core players "view critically."
- **Poorly explained mechanics / opaque direction** — "it's not clear to a new player … you just have to learn how this game works." Onboarding and legibility matter as much as balance (Idle Idol's "too slow" complaint was actually a hidden-UI/tutorial problem, not a curve problem).
- **Resets that lose too much progress** and **content droughts** ("No more content. So sad." — Idle Cultivation review).

#### Cultivation-specific features that resonate
Existing cultivation idlers (Idle Cultivation, Idle Xanxia, Cultivation Idle, Immortal IDLE) collectively feature and players engage with: **sect management** (recruit disciples, missions, structures), **alchemy/pill refining**, **spiritual root/talent systems**, **technique/manual collection** (cultivation manuals found in dungeons), **Dao comprehension/Dao paths**, **tribulation survival**, **lifespan mechanics**, and **reincarnation** (Idle Cultivation's "Soul Power" reincarnation unlocks new skill ceilings, weapons, multiple actions, artifacts). Idle Xanxia builds explicitly around "stats, Dao paths, and rebirth" with "build experimentation."

#### Commercial/critical success factors (design-pure premium)
- **Melvor Idle** is the flagship case: Very Positive across 15,753 Steam reviews (90/100 Player Score per Steambase), "no microtransactions … everyone who plays should be on a level playing field," cloud saves, regular expansions (best-value DLC in the genre), published by Jagex. Praised for **deep skill synergy, meaningful long-term progression, offline progression, clean information-rich UI**. Criticized for **heavy late-game grind, repetitive/passive combat, and punishing death (item loss)** — informative for what to avoid.
- Community also esteems **zero-monetization labor-of-love browser titles** (Kittens Game, Trimps, Antimatter Dimensions, Universal Paperclips) — proof the audience prizes design integrity.

#### Retention / long-tail design
- Frequent small rewards (achievements), staggered reengagement clocks, and layered prestige sustain weeks-to-months engagement.
- Endgame/post-completion content: additional prestige layers, challenge modes (NGU's challenges, AD's Eternity/Infinity Challenges, Kittens Game's Iron Will/1000 Years/Winter Has Come), and expansions.
- The low-pressure loop (no failure states, steady progress, frequent feedback) is itself the retention engine — "progress is always felt, it always feels rewarding to come back."

## Recommendations (staged, for the Dao Tree progression timeline)

**Stage 0 — First session (0–20 min): Hook.** Open with a single meditate/click action generating Qi. Reveal the first generator within seconds and the first upgrade within a minute. Establish tone (the Dao Tree metaphor) with strong narrative framing up front while mechanics are simple. *Benchmark to change plan:* if playtesters can't tell within 10 minutes whether they like it, the opening is too slow.

**Stage 1 — First breakthrough/reset (target 2–4 hours): Teach the loop.** Gate the first *major realm breakthrough* (your first prestige) at 2–4 active hours — the AD "few hours" model, not the Cookie Clicker "days" model — so players learn resets are good. The first reset should grant a visible, immediately impactful "insight/Dao" currency. Make the post-reset rebuild to the old wall take <20% of the original time (Cookie Clicker's "trivially reach previous status in a day"). *Benchmark:* if <50% of testers voluntarily reach the first reset, the wall is too far or too opaque.

**Stage 2 — Minor stages within realms (days): Ladder-climbing.** Subdivide each realm into Early/Mid/Late/Peak minor stages as tiered milestones. Use exponential cost growth (~1.08–1.12 per step for primary generators) vs. linear production so walls arrive predictably. Drip an automation unlock at each realm (auto-meditate, auto-buy, auto-breakthrough attempt) as an *earned reward* tied to a tribulation or challenge.

**Stage 3 — New mechanics per realm (weeks): Rebalance play.** Every 1–2 realms, introduce a genuinely new system (e.g., alchemy/pill refining, sect/disciples, technique collection, Dao-path skill tree) that changes optimal play — this is your strongest retention lever. Escalate layer duration hours → days → weeks. Add offline progress from the start; cap at 12–24 hours (start generous, tune down only if pacing breaks).

**Stage 4 — Reincarnation meta-layer (the deep reset): Long tail.** Implement reincarnation as the AD-"Reality" analogue: a rare, deep meta-reset that wipes realm progress but grants a permanent meta-currency and unlockable mechanics ("the game plays differently"). This is your months-long endgame. Add challenge modes (restricted-technique runs, no-pill runs, tribulation-gauntlet) for post-completion content.

**QoL non-negotiables (ship at launch):** bulk-buy/buy-max, autobuyers (earned), multiple number-notation options, manual save export **and** cloud saves, statistics tab, achievements with in-game bonuses, and a streamlined one-click reset ritual (avoid the "retrofitting every prestige is tedious" trap).

**Monetization:** premium one-time purchase, zero microtransactions/energy/ads (the Melvor model). Consider paid content expansions post-launch as the only additional revenue.

**Anti-patterns to explicitly avoid:** un-escapable walls (always pair a wall with a reset/automation/mechanic escape); resets that feel unrewarding; tedious multi-step reset rituals; opaque mechanics (invest in onboarding + legible UI); punishing progress-loss on death; and any late-game slowdown as severe as Idle Cultivation's 7-hours-per-stage without a player-agency lever.

**Change-your-plan thresholds:** If beta retention data shows a churn spike at a specific realm/wall (as the Clicker Heroes ~70%-before-lvl-50 pattern warns), shorten that wall or add an earlier automation/mechanic unlock. If testers report "too slow," first check whether a key feature is under-communicated (Idle Idol lesson) before re-tuning the curve.

## Caveats
- **The "70% quit before level 50" Clicker Heroes figure is second-hand** — a player recalling a Playsaurus developer statement, not a primary citation. Treat as directional, not authoritative.
- **Melvor Idle's offline cap is genuinely conflicting across sources**: the official wiki (July 2025) states 24 hours, while multiple Steam player posts cite 18 hours (historically 12). Confirm the current build value before using it as a benchmark.
- **First-prestige hours are player-reported and playstyle-dependent** (active vs. idle, guide-following vs. blind); ranges given are typical, not fixed.
- **Some cultivation idlers surveyed are Early Access, AI-assisted, and small-studio**, so their reception may not predict a polished premium title's outcome; they are useful as pitfall indicators more than success models.
- **Pecorella's data and much idle-design literature originate in free-to-play mobile monetization contexts**; the retention/loop lessons transfer to premium Steam, but the monetization advice deliberately does not.
- Direct r/incremental_games verbatim quotes were limited by access restrictions during research; community sentiment here is triangulated from Steam discussions, enthusiast design forums, and GDC/Wikipedia/Quantic Foundry synthesis, which align consistently.