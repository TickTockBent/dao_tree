# Changelog

All notable changes to **Dao Tree**. Versions track the itch.io releases;
**0.2** was the first public release, so earlier development is folded into it.

## 0.5.0 — unreleased — the second road

### Added
- **Act II opens: Spirit Severing.** Pass the First Tribulation and a sixth
  realm waits — and with it, the Three Corpses. Each demands a severance:
  choose a real piece of your build — your soul aspect, your profession, your
  extraordinary meridians, a Dao Manifestation — and cut it away. The cut is
  fully legible before you make it: the game shows exactly what you give up.
  What follows is a weakness window; the severance ritual carries the
  transcendent multiplier from half of what you lost to double it. Sequential
  by design — each corpse must be lived with before the next is chosen.
- **The Dao lattice deepens: Manifestation.** Every lattice truth can now go
  one tier further, and ten new comprehensions extend the element branches —
  Severing Intent, River of Time, Rebirth, and their kin. All of it is Act II
  content, sealed until the tribulation is crossed. At Manifestation depth,
  Flow and Stillness finally refuse to coexist: the conflict the lattice
  always hinted at now binds.
- **The core remembers.** Re-climbing Core Formation after an ascent
  accelerates: each ascent compounds the re-climb's prestige gain (up to
  20×), so the mountain you've mastered yields faster with every return.
  The ritual never vanishes — it becomes a breath.

## 0.4.2 — unreleased

### Added
- **Achievements — the eternal record.** A trophy shelf in the Journal tab:
  twenty-two deeds across the Path, the Vessel, the Crucible, the World, the
  Heart, and Mastery. What is earned here survives everything — no
  breakthrough, no tribulation, nothing resets it. Later horizons show only
  as ??? until reached; the road you are on is always legible.

### Changed
- **Every Soul Aspect is now a real choice.** The Sword and Flowing Souls were
  Insight-only — strictly worse than the free Formless Soul for anyone building
  around Qi, a trap dressed as a reward. Every earned (Seed-gated) aspect now
  carries the Formless foundation on both axes plus its elemental lean, so the
  aspect you unlocked is never the wrong pick — only a different one. A new
  design rule enforces this permanently: no earned aspect may punish the
  gatherer's path.

## 0.4.1 — 2026-07-02 — the door closes

### Added
- **Deep Meditation.** Offline progress is now something you *cultivate*. Deep
  meditation sustains you in secluded cultivation while you are away — and each
  realm you reach reveals a new meditation discipline to master (a one-time Qi
  cost) that permanently deepens how much secluded progress you can bank. Five
  disciplines across Act I take you from one hour to six. Once learned, a
  discipline is never lost — not to breakthrough, not to anything.

## 0.4.0 — 2026-07-02 — realms beyond, the cauldron, and the heart's price

### Fixed
- **Over-tempering can no longer lock you out of the forge.** Temper-tier
  requirements (like Core Formation's "Tendons") were checked as *exactly at*
  that tier, so tempering to Bones before reaching Foundation's Great Circle
  made the forge permanently unreachable. Tier requirements now mean
  *reached-or-above*, the way a body that only ever hardens deserves.

### Added
- **Secret Realms ("Realms Beyond").** Once your core is forged, hidden pocket
  worlds reveal themselves — three sites on a rotating cadence, each with its own
  rule: the Verdant Hollow feeds on your Qi flow, the Inverted Spirit Land answers
  only to Insight, and the Shattered Star Vault yields to nothing but time (and
  hides a Dao Glimpse for its first conqueror). Expeditions are timed runs; what
  you carry out — spirit herbs, essence crystals, beast cores, surges of Insight —
  is permanently yours. Entirely optional: an accelerant, never a requirement.
- **The Alchemy profession.** The Act I profession slot opens with your core
  (Artifice and Formations stay sealed for later acts). The cauldron turns realm
  materials into three pills: a Qi-Gathering Pill (double gathering, ten minutes),
  the Pill of Still Clarity (your next Nascent Soul or Soul Formation breakthrough
  lands half again as hard), and the Heaven-Warding Pill (carried into a
  tribulation, it dissolves into your preparedness pool).
- **Heart Demons.** Rushing now has a price that outlives the forge: weak-graded
  Foundation breakthroughs, forceful or reckless forge pushes, and bloody
  tribulation outcomes all feed a corruption that orthodox practice only slowly
  bleeds. Cross a threshold and a Demon Trial takes hold — an involuntary stance
  that debuffs your cultivation until you see its objective through. Trials cannot
  be failed, only endured; each one cleared hardens into a permanent Dao Heart.
- **New guidance and journal beats** for all three systems, including the demon's
  own voice while a trial holds you.

## 0.3.0 — 2026-07-01 — the engine rebuilt

The whole game was ported off The Modding Tree onto a purpose-built engine
(Vue 3 + TypeScript + Pinia): typed data tables, a real test suite, a headless
pacing simulation, and honest save handling. Everything below (previously staged
as 0.2.2) shipped inside it.

### Fixed
- **Forge fuel is labeled correctly.** The forge push options showed their fuel cost
  as "core formation" when the fuel is actually spent from your Foundation, so it
  looked like you could forge without paying — you were paying, just in Foundation.
  The cost now reads "foundation" in the buttons and the confirm prompt.
- **Progress bars are readable when full.** A full refinement ("Warm the Core") or
  tribulation bar rendered near-white text on the near-white theme fill. Both bars now
  fill with their own realm color, so a maxed bar (e.g. "Core at its Foundation
  ceiling") stays legible.
- **Auto-cultivation no longer soft-locks Core Formation.** The sect arsenal's
  auto-Foundation-prestige used to wipe your Qi forever (worse the better your
  Foundation grade), so you could never bank the 250,000 Qi to forge a core. It now
  follows a Foundation maturity model: it rebuilds your Foundation, then *rests* once
  it is fully formed, so your Qi banks freely toward the next breakthrough.
- **No more unlock-message spam on Foundation reset.** Once your Qi Condensation
  progress is kept through a Foundation breakthrough, its sub-stage unlocks stay
  earned instead of re-announcing all of them every reset.

### Added
- **Journal reflection rewards (groundwork).** Every journal entry now records the
  cultivation stage you were at when it unlocked, shown in the entry. Reflecting on
  an entry can also grant a one-time reward; the first two entries (First Breath, A
  Channel Opens) now give +100 Qi.
- **Foundation quality bar.** The Foundation screen now shows, at the top, the grade
  your current build would lock in (Flawed → Heaven-grade) and the headroom you can
  grind toward with meridians and temper. Always visible while building.
- **Foundation maturity readout.** Realms with auto-cultivation show a maturity bar,
  a rising (capped) prestige-cost multiplier as the Foundation matures, an estimated
  time to fully formed at your current pace, and a clear "fully formed — resting; your
  Qi now banks freely" state. No more invisible behavior.
- **Sect ranks now require cultivation.** The inner library opens only to a
  Foundation cultivator and the arsenal only to one who has forged a core; your
  contribution caps at each rank's ceiling until you advance, with the gate shown.
- Milestones that keep your progress through a breakthrough (e.g. Peak Foundation)
  now say so in their effect text, so the permanence is visible where it's earned.

### Changed
- Body tempering now shows the next tier you are working toward, and the +5% Qi/sec
  it grants, instead of a meaningless "x1.0" line. Past Marrow it reads "All tiers
  tempered."
- Pluralized the Tendons and Bones tempering tiers.
- Extraordinary and primary meridian effect lines now show the per-meridian bonus
  (+25% / +15%) so the payoff reads even before the first purchase.

### Notes
- Behind the scenes: the experimental GitHub Pages build now warns players it is the
  bleeding edge and points them at the stable itch.io release, and the deployment
  workflows were updated to current GitHub Actions.

## 0.2.1 — 2026-06-15

### Fixed
- Restored every in-game choice button. A grid-rendering bug had hidden the forge
  push options, the Soul Aspect picks, joining a sect and its technique library,
  the First Tribulation trigger, and the journal's Reflect button.
- The journal's new-entry glow now clears once you Reflect on the entries.
- Outer Disciple now requires actually joining a sect, matching its rank (Inner
  Disciple already did).

### Changed
- Reworded the body tempering milestones (for example, "Skin Tempered (level 1)").
- Text and wording polish across the journal, hint bar, tooltips, and the
  tribulation and legacy screens.

## 0.2 — 2026-06-14 — first public release

The complete Act I, the mortal road: from gathering your first breath of Qi to
enduring the First Tribulation.

### Added
- **Cultivation spine.** Gather Qi and break through Qi Condensation, Foundation
  Establishment, and Core Formation, each with its own named sub-stages.
- **The body.** Open meridians and temper your body from Skin through Marrow,
  permanent attributes that survive every reset.
- **Foundation Grade.** Your Foundation is graded from Flawed to Heaven-grade; a
  stronger foundation forges a finer core.
- **The forge.** Forge your Golden Core at the climax of Core Formation: push hard
  for a higher grade at the risk of a crack, or warm it slowly and safely.
- **The Dao Lattice.** Spend Insight on Glimpses and Seeds across the five
  elemental roots.
- **Stances.** Adopt Breathing Trance to trade Qi speed for Insight, or Sword
  Trance to run deeper into the blade.
- **Nascent Soul and Soul Aspect.** Reach Nascent Soul and give the soul a form:
  Formless, or an elemental aspect earned through the lattice.
- **Automation (Tier 1).** Meridian purchases and Qi Condensation prestige can run
  themselves once the Nascent Soul forms.
- **Sects.** Join the Azure Sword Sect or the Stone Formation Sect; earn
  Contribution, draw a stipend, study a technique library, gain an arsenal
  automation, and rise from Outer to Inner Disciple.
- **The journal.** A quiet narrative record that unlocks entries as you progress
  and never resets.
- **Soul Formation and the First Tribulation.** Ascend to Soul Formation and face
  the capstone tribulation, with your whole Act I build as your shield.
- **Scars and Legacy.** Survive a Scarred result and heal it into a permanent
  "Tempered by Ruin" buff; pass the tribulation to inscribe your eternal Act I
  Legacy Grade.

### Notes
- Dao Tree is a heavily reworked fork of The Modding Tree / The Prestige Tree.
- 0.2 also added the deployment pipeline: GitHub Pages tracks the bleeding edge,
  and an `itch-*` tag publishes the scoped build to itch.io.
