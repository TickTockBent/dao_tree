# Design directions

Planned systems not yet scheduled into a slice. Each carries its binding
rules so the eventual implementer inherits the constraints with the idea.

## Celestial weather + the loot layer (the almanac)

Semi-predictable celestial cycles that modulate progression per path, in
**two tiers, two amplitudes, two emotional registers**:

- **The predictable cycle** (seasons of qi, new moons, eclipses, harvests,
  migrations) at moderate amplitude (1.3–2×) — the texture layer. Rewards
  planning, creates check-in context, and is what sect divination reads.
- **Rare spawns** (the thousand-year herb, the Wandering Sage, the
  once-in-a-lifetime alignment) at dramatic amplitude (3–10×) — the loot
  layer. Rewards presence, creates stories. Samsara is what licenses the
  drama: in a loop frame rarity is loot ("one more run"), not FOMO.

**Binding rules** (design-principles #22–26):
- **Loot, never gate** — the tribulation is reachable every life, every
  build, with zero rare spawns. Sim-enforced: Competent with rares disabled
  stays inside the pinned band.
- **Aggregate-certain, specific-rare** — near-certain *something* per life,
  low odds of the specific thing. A life with nothing unusual is a system
  failure. Testable via seeded multi-life sweep.
- **Determinism discipline** — seeded almanac (predictable tier = pure
  function of world-time) + per-life seeded encounter tables.
- **Lean: rare spawns roll on ENGAGEMENT, not wall-clock** — predictable
  windows are wall-clock (forecastable; missing one is a planning outcome),
  loot fires on check-in/action rolls so a sleeping player can't miss what
  only spawns in their presence. The elder is met, not scheduled.
- **Weather-ignorance bounded** — a choice-viability assertion caps what
  ignoring the sky entirely can cost.

Couplings: wakes the Realistic band's dead banking knob (the band becomes
cadence × timing — pre-labeled in the pin); completes D2's anti-static-beat
design (acceleration is deterministic variation, weather semi-stochastic —
they multiply); the counter-monopoly tension with alchemy resolves as
*weather is the world's schedule (exogenous), alchemy the player's timing
(endogenous)* — and alchemy gets the deepest weather interactions (brewing
under alignments, bottling a comet). Forecasting is earned horizon content
(diviner techniques, sect astrologers, ancestral star-records) — the
knowledge veil's most natural member. Timing: design inside the narrative-
spine pass, build with ambient rivals on the shared almanac substrate.

## The spirit garden — planted futures

A **first-class system, not a loot-table entry**. Plant a seed early (cheap,
every life can engage); it matures over the whole run; the decision is never
whether to engage but **when to harvest** — cash out now, or hold for
maximum value and risk the tribulation arriving first. A bet against your
own timeline, and a decision shape nothing else in the game has.

What makes it work: the uncertainty is **endogenous** — the maturity curve
is fully visible (veil-the-now perfectly satisfied); the unknown is the
player's own pace. Rarity attaches to WHAT you can plant, not whether:
common seeds every life, rare seeds (the thousand-year herb) as loot-tier
drops that create the big harvest dilemma.

**Cross-life meta (Samsara scope):** find seeds as a gatherer → donate to
the sect → available to future sect-member lives; or seed the wild to raise
future lives' encounter odds. This is the founding instance of the
world-scoped accumulator family ("the world remembers" — see
[architecture.md](architecture.md)). Coupling: the harvest-before-
tribulation dilemma is D4's held-breath moment — design them together.
Timing: system design in slice 10; a single-life v1 (common seeds only)
could land earlier as the loot layer's first citizen.

## Build sequencing — the dynasty metagame

Falls out of the two-accumulator structure without a separate dynasty
system: "this life a gatherer who seeds the wild; next life sect, harvesting
what I planted; the life after, a lattice hermit in a world made richer."
Lives are moves in a save-file-scale strategy; the chronicle (decision D8)
is the artifact that makes the strategy legible. Measurement requires the
multi-life harness (architecture.md) and its three dynasty assertions.

## The narrative spine — chronicle + veil

One design pass covering both duals (D8 + D11): the chronicle makes the past
legible as narrative; the veil makes the future illegible as mystery —
"memory accretes, foresight is earned," the emotional shape of cultivation
fiction. Scheduled with Samsara (chronicle) but designed as one posture;
sect's world-ownership (D1) and the loot layer's encounter provenance both
feed the chronicle's content.

## Ambient rivals

Decided direction (D10): ship events-without-interaction (a tribulation
lights the horizon, a breakthrough shakes the sky); interactive rivals are
v2. Now an expression of the almanac substrate — rivals' events are
almanac-scheduled, and the loot layer's elder encounter is an ambient-rival
event landing as loot. Sect reputation influencing which elders appear is
part of sect's world-ownership.
