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

## Dao strands — the inner loop *(workshop capture 2026-07-04; vocabulary provisional; post-slice-10 arc)*

Wes's raw shape, captured with its binding rules. A **strand of the larger
Dao taken within you** — a mental framework, a worldview, the compass of the
soul. NOT a technique, skill, or stat: "how do you see the world," made
mechanical. The founding citizen of the **dao accumulator scope**
(architecture.md — the reserved third scope finally gets its instance).

**The loop.** A strand is fragile and responds to you. Let it wither and
lose nothing; nurture it and gain new paths. Nurture is **mental exercise
apart from Qi cultivation** — journal reflection, revisitation (below),
debate, wide reading — routed through the game's existing reflective
surfaces, never a new daily chore. Years to mature in the best
circumstances; the specifics depend on the strand itself. Mature strands
**weave into mental tapestries**; a failed strand **rips, shreds, and blows
away on the dao wind** — and the wind comes around again (almanac-cycled
availability: failure is deferral, never destruction).

**Sources.** Transmission, cultivator to cultivator, once fully formed
(sect lineages — D1's world-between-lives; family inheritance — the
ancestral-knowledge channel; a dying rogue cultivator's last transmission).
Fresh ideation only in extraordinary circumstances — loot-register:
aggregate-certain exposure, specific-rare genesis, the once-in-a-dynasty
epitaph line.

**The Samsara gate.** No strand ever appears in the first life-cycle —
only after the first full Samsara reset. A mind that has never died cannot
perceive a framework as a framework. (Also the onboarding shield: new
players never see this layer.)

**Journal revisitation (the flagship nurture channel).** The journal — pure
output since 0.2, already recording stage-at-unlock since 0.3.0 — becomes
INPUT: memory as terrain. Entries grow a "revisit" affordance while a
strand is carried ("Visit the spring"); what you find keys to the strand
you follow (dried up / corrupted / a peaceful echo of the larger dao, the
world continuing on without you); what you *choose to do* with what you
find feeds the strand (dao), becomes who you are (soul), and can write
world state a future life inherits (world — heal the spring and your
dynasty finds it healed).

**Effects.** Never a flat bonus — a **leaning**. Aligned paths cheaper,
misaligned paths orders of magnitude harder; true blocks rare and reserved
for definitionally exclusive identities. Strand-exclusive options exist:
things only thinkable inside that framework, including (dream tier)
post-game hidden paths gated on *perception* — content invisible without
the worldview to see it (D11's deepest expression).

**Binding rules** (the implementer inherits these with the idea):
- **Ritual, not tax.** Its own loop with its own reward structure;
  withering costs nothing (secret-realm optionality clause; invariant §6.6
  — never a ransom). If nurture ever becomes a daily-click chore, delete it.
- **Leanings never punish the strandless path** (the aspect-trap lesson);
  no strand is correct for all builds (counter-monopoly test).
- **Exclusions bind at maturity, not at planting** (the flow/stillness
  Manifestation precedent). Uprooting an immature strand is possible at
  cost; full costs legible at choice time, restated at the binding
  threshold (D32 grammar).
- **Failure is cyclical, not destructive** — the dao wind returns (almanac
  substrate; scar grammar).
- **Perception-gating only for optional horizon content** (D11; the
  achievements lint precedent — nothing hidden gates the early loop).
- **Content-matrix discipline:** few locations × few strands, deep
  outcomes. Three springs with real consequences beat thirty with flavor
  text.

**What slice 10 reserves (cheap, in-passing):** the `dao` scope enum seat
(planned anyway, now with a named intended citizen); the rebirth counter as
a core `meets()` clause (the Samsara gate is then one condition row);
chronicle per-life fields for strands held / matured / transmitted / torn
(schema-now-content-later, the D24 insurance pattern).

**Timing:** after Samsara AND the almanac/narrative era — genesis events
want the almanac's event machinery, nurture wants the ambient texture
layer, and this is the most narrative mechanic yet proposed. The strand's
own rule, applied to itself: it needs years and the right soil.

Couplings: journal (stage-at-unlock shipped 0.3.0), spirit garden (the
visible-maturity decision shape, turned inward), Authorities rhyme (weave
Laws outwardly : weave strands inwardly), heart demons (speculative: your
framework shapes which demons come), sect world-ownership (D1), ancestral
knowledge, the almanac (the dao wind).
