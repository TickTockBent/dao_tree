# Decision record

Settled design calls, with rationale. Append-only: a reversal is a new dated
entry, not an edit. (Numbering preserved from the original ledger where one
existed; the pre-split ledger with full annotation history is in git history.)

## D1 — The aspect lock stands; sect owns the world (final form)

*2026-07-02, three passes.* Element Soul Aspects stay lattice-Seed-gated.
The build-diversity run **exonerated the lock**: counterfactual probes gave
sect/pill builds an element aspect for free and they came out *no faster* —
the lag was systemic, and the real side-finding (metalSoul/waterSoul were
insight-only trap aspects, strictly worse than Formless for Qi builds) was
fixed same day (`562c6ad`, lint-pinned: *no earned aspect punishes the default
grammar*).

The counter-monopoly question ("what does sect own?") closed in its final
form during the build-sequencing pass: **lattice owns your personal aspect
identity; pill owns your throughput within a life; sect owns the world
BETWEEN lives.** Sect is the institution that persists across lives — the
vessel for "the world remembers" (seed donations, reputation attracting
elders, territory development) and the magic-find build (encounter rate and
quality, sky-reading). It is a category difference, not a slower competitor
on the same axis: sect's payoff is measured in world-state, and the sim
measures runs. **The 40.72h sect pace is canon** — do not de-sublinearize the
contribution mults. Sect is a main driver of world-remembered change, not the
sole holder.

## D2 — The core re-climb: partial keep, "the core remembers"

*2026-07-02.* The c-churn decomposition (see [calibration.md](calibration.md))
showed the re-climb tax is **72.7% of an optimal run** — which disqualified
both clean options from opposite sides. **Tax (add a c-keep) is out**: the
optimizer floor collapses 3.7× to 5.6h, and deleting three-quarters of
optimal play proves the churn was load-bearing structure — removal relocates
the rebuild into slice 9 at higher cost. **Pure ritual is out**: no static
felt beat survives being 73% of a run's repetition ("the forge-glow that's
moving at hour two is wallpaper by hour twelve").

**The mechanic, named:** *re-tempering the core fuels the ascent, and mastery
means the fueling gets faster* — the literal xianxia trope, and the sim
showed it is also the math. Re-climbs stay but accelerate across ascents via
an explicit per-ascent compounding term (an **ascent counter** — the
milestones-only keep was probed and produces a flat coupon, no curve). The
acceleration curve IS Act I's felt progression.

Probe-established facts (full data in calibration.md): the actors invert —
the optimizer's 1,344 re-climbs already self-accelerate to zero while the
human's 12 re-climbs *decelerate* (0.50× first/last), so the mechanic serves
the human's lived hours; fixed r ∈ [0.65, 0.75] keeps the tail BRIEF (felt),
r=0.8 and floor f=0.1 are HEAVY, r=0.5 vanishes it; the Realistic actor's
lapse-recovery segments provide a natural tail floor. **The optimizer floor
is a regression instrument, not a pacing claim** — the Realistic band is the
number defended at planning time. Remaining pick (r value + brief-vs-moment
register) is an open question for slice 9's keep-rule work.

Fallback pre-named: if the shipped curve proves too thin to feel inside
Act I, Act II's Spirit Severing inherits and extends it across acts — never
more churn, never abandoning the middle path.

## D3 — Corruption threshold ratchet stays

Crossed heart-demon thresholds never re-arm; only the deepest trial repeats.
Re-arming on bleed-out would make bleeding a farming exploit — Dao Heart
farming already exists via the repeat ladder. (The ratchet's farmability is
an input to Samsara's economy question — see open-questions Q6.)

## D4 — Tribulation bank vs automation: leave, reframed for feel

Nothing guarantees auto-q-prestige never eats a tribulation bank; in practice
the maturity model rests when formed. Leave until a real player report — and
if the guard is ever built, build it for FEEL (the game holds its breath
while the tribulation is ready; automation pausing reads as reverence) and
bank-safety comes free. Related: the spirit garden's harvest-before-
tribulation dilemma is the same held-breath moment — design them together.

## D8 — Chronicle: pillar, closed

The chronicle/epitaph system is **a pillar, not a formatter** — the artifact
that makes a multi-life strategy legible ("Life 3: Joined the Verdant Peak
sect. Planted three Millennial Ginseng in the Eastern Wilds. Donated the
Star-Root to the herbarium. Reached Core Formation."). It records a strategy
executed across lifetimes, not a sequence of stat summaries — a chapter in a
story only that save file can tell. It must record world-state and encounter
provenance from day one of the loot layer. Bound to the knowledge veil (D11)
as one narrative-spine design pass: "memory accretes, foresight is earned."

## D9 — Steam: soft yes, architect for it

Commitment to launch deferred; the architecture is not. Consequences:
**(a) golden-save lineage harness in CI — DONE** and **(b) achievements as a
Steam-mappable registry — DONE** (both landed 2026-07-02, `36556ac`; see
[architecture.md](architecture.md)). (c) README matters now — done earlier
same day.

## D10 — Rivals: ambient ships first, interactive is v2

Split at the cheap/expensive seam: ambient rivals (another cultivator's
tribulation lights the horizon — no interaction) deliver most of the
inhabited-world payoff at fraction cost; contested-resource interactive
rivals are a v2 pillar. Architect ambient events so interaction can hook in
later — realized as the shared almanac substrate (see design-directions).
The "revered elder" loot encounter validated this architecture from the loot
side: an ambient event landing as loot.

## D11 — Knowledge veil: veil the ahead, never the now

The axis is WHAT gets veiled, not how aggressively. Grades and the current
loop's optimization language are never hidden — incremental players are
optimizers first and read hidden grades as hiding the ball. Veiling is for
flavor-critical, optimization-optional horizon content: unreached realms,
unmet things, what Spirit Severing is actually like. Enforced concretely in
the achievement registry (hidden entries lint-blocked from gating early-loop
content).

## D13 — Pacing bands: pinned

Pinned 2026-07-02 in `npm run sim` ("PINNED BANDS", Gate-D signed off):
Competent floor **74,041s (20.57h)** at 1s resolution; Realistic
**[48.5h … 62.4h] at 24–36min late-game check-in cadence** (the cadence
assumption is part of the pin — the band is cadence-shaped and its width is
a feature, the spread between a twice-a-day checker and an every-few-hours
checker both finishing); cluster ratio **≤ 1.5** (observed 1.418). CI
enforces the FAIL lines. **Pin migration pre-agreed**: when slice 9's keep
mechanic lands, Realistic re-pins at ~[28–35h] (cadence-labeled, r final),
Competent re-pins wherever it lands as a regression instrument, cluster
re-checked with r in place. Numbers and probes: [calibration.md](calibration.md).

## D14 — Extraordinary meridians: competitive standalone content

MeridianProbe landed 30.45h — clusters with the focused builds, beats
SectFocused, doesn't dominate Competent. Not a trap, not must-buy. Closed.

## D15 / D16 — Housekeeping

README rewritten (D9 set the urgency). Both `LICENSE` and
`Prestige-tree-license` stay: HEAD contains no TMT code since 0.3.0, but repo
history distributes it.

*(D17–D20 are intentionally skipped: those old ledger numbers live in
design-directions.md and architecture.md per the README's numbering map.
Post-split decisions continue from D21.)*

## D21 — Keep-rule constants: r = 0.70, floor f = 0.05

*2026-07-02, slice-9 design pass; closes Q1.* The core-remembers curve ships
at **r = 0.70 with scale floor f = 0.05** — the "moment" register: Act I's
re-temper ends at ~9 minutes, a mastered-but-still-visible ritual, never
experientially vanished at Realistic cadence ("a brief ritual is 'I still do
this, but I've mastered it'"). The floor doubles as D2's open optimizer
bound: Competent's 1,344 re-climbs cannot compound below 5% scale, so one
knob answers both the register question and the bound lever. Curve data in
[calibration.md](calibration.md).

## D22 — Lattice scale: medium

*2026-07-02, the Act I content-complete gate decision (retired expansion
doc's open item #1, due exactly now).* **Medium lattice**: ~25 nodes,
Glimpse → Seed → Manifestation tiers only; Laws fold into Act III realms.
Severing gets the whole stage — the Act II tree must not compete with the
slice's headline mechanic for attention.

## D23 — Spirit Severing v1 shape

*2026-07-02, slice-9 design pass.* On top of the committed spec (three
severances of real build pieces; transcendent multiplier covering a superset
of the severed piece's effect domain; lint verifies the formula *shape*, sim
asserts the pacing; severed pieces return next life; three-lives
transcendence):

- **Sequential, not simultaneous.** Three set-pieces spaced across the
  realm, not a build-planner form. Each severance is *lived with* before the
  next is chosen.
- **Lifetime net-positive, not immediately.** The transcendent multiplier
  **ramps** — starts below breakeven, crosses above over time — so each
  severance opens a felt weakness window. **Breakeven timing is the tuning
  lever, not k alone**; the k-probe measures breakeven timing alongside
  lifetime net (Q9).
- **The ascent counter is untouched.** Severing neither resets nor extends
  Act I's curve. Spirit Severing introduces **its own ritual with its own
  acceleration curve** — a second soul-scoped accumulator ("you've mastered
  the core; now master the severance"). The pattern extends across acts with
  new content, never by resetting the old curve. (This also retires Q1's
  r-as-a-function-of-k residue: Act II gets a new curve, not an extension.)
- **Severable criterion:** a severable must have a legible, isolatable
  effect domain — that is what makes the k > 1 superset rule verifiable.
  v1 candidates: soul aspect, stance, profession, meridian set bonuses,
  lattice Manifestation. Final list and numbers ride on the k-probe (Q9).

## D24 — Steam launch gate: transcendence first

*2026-07-02, extends D9.* Three-lives transcendence creates an implicit
promise the moment severing ships. Per-attachment severance data is recorded
from day one (schema now, content later), and the Steam-readiness checklist
gains a hard item: **Steam launch must postdate transcendence
implementation**, not merely Act II content. Fine on itch, not fine on
Steam.
