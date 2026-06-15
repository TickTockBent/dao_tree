# Changelog

All notable changes to **Dao Tree**. Versions track the itch.io releases;
**0.2** was the first public release, so earlier development is folded into it.

## 0.2.2 — unreleased

### Fixed
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
  a rising prestige-cost multiplier as the Foundation matures, and a clear "fully
  formed — resting; your Qi now banks freely" state. No more invisible behavior.
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
