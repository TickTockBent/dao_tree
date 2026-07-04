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

**Migration executed (2026-07-02, slice 9):** the measured re-pin moved only
Competent (74,041s → **41,659s**, 11.57h); Realistic held at 53.25h,
band unchanged [48.5–62.4h], all nine jitter-grid points byte-identical —
the ~[28–35h] prediction was an artifact of the clock-compression
counterfactual, which the real check-in-quantized gain rule cannot
reproduce (Realistic's single overkill prestige absorbs even the 20× cap
in one step). The mechanic accelerates the optimizer's Act I, not the
experience actor's wall-clock; its felt effect for Realistic is
sub-check-in re-temper. Cluster re-checked at 1.392. Full finding:
[calibration.md](calibration.md) "Keep-mechanic migration finding".
Flagged for Wes's design review (does the 53h Act I stand, or does the
felt-acceleration goal need a cadence-visible lever?).

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

## D25 — Severing numbers + slice-9 entry: signed off

*2026-07-02, closes Q9; k-probe evidence in
[calibration.md](calibration.md).* The transcendent multiplier ramps from
**c = 0.5** of the severed contribution to a cap of **k = 2.0**, geometric,
reaching cap by ritual step 12 — breakeven at step 7, in-window net 1.10:
the deepest cut that still honors lifetime-net-positive. **The ramp driver
is the severance ritual** (D23's second soul accumulator): mastering the
severance is what crosses breakeven — the weakness window and the second
mountain are one mechanic with one clock. **v1 severable list, final:**
soul aspect, profession, extraordinary-meridian track, lattice
Manifestation. Stance drops to v2 pending redesign (probe inversion:
severing its effect made the lattice build 7.1h *faster* — no weakness
window, no severance). Ships with the assertion that every viable build
has ≥3 live severables. The full slice design is
[slice-9.md](slice-9.md), signed off same day.

## D26 — Act I's 53h stands; keep-rule legibility over wall-clock compression

*2026-07-03, resolves the D13 migration flag.* The keep mechanic left the
Realistic band untouched (53.25h, [48.5–62.4h] byte-identical) because the
experience actor's Act I is **attendance-bound, not work-bound** — the
churn decomposition already said the Realistic−Competent gap splits 75.4%
idle / 24.6% churn, and a gain rule compresses work only (the optimizer
got its full 20.57h → 11.57h). The ~[28–35h] target was an artifact of the
clock-compression counterfactual; the measured 53h is the cadence-shaped
truth and **it stands** — the band remains a one-knob function of session
cadence, which is what a semi-idle player's Act I honestly is.

**Ruling (Wes):** keep the hours, ship legibility. "The core remembers"
becomes visible where it lives: a readout on the Core Formation section
(ascent count + current re-climb gain multiplier + the ×20 cap) so the
human perceives the mastery even though their wall-clock is governed by
attendance. **Wall-clock compression is explicitly deferred to the
almanac/banking mechanics** (design-directions #17) — the jitter sweep
showed the banking knob is dead until bankable events exist; when that
layer lands, attendance economics get tuned by a mechanic built for them
and the band re-derives. No pacing data changes; no pins move.

## D27 — Realm-x progression: severances are the spine

*2026-07-03, resolves slice-9B's coupling note.* Spirit Severing's
sub-stages are gated by the three severances themselves — **no parallel
qi climb**. The register break is the point: Spirit Severing is the first
realm where the verb changes from **"accumulate" to "sacrifice."**

Ritual steps are the interstitial content (the ramp from c·m through
breakeven to cap), and they must **engage existing resource systems**
(qi, insight, pills, lattice) rather than being a standalone counter:
"perform the ritual" means *do familiar things in a new configuration*,
not *click a new button twelve times*. This keeps build diversity alive
inside the realm instead of suspending it.

**Implementation status:** the shipped skeleton shape (realm-x as a
qi-climb whose prestige advances the ritual clock, substages at prestige
counts) is now known to be a placeholder that violates this ruling's
verb-change. Rework queued: substage index derives from severance count
(the corpse names already assume this); the ritual-step mechanic gets a
concrete design proposal brought back for sign-off (rule 0.1) before any
data changes — the "new configuration" of familiar systems is a design
choice, not an implementation detail.

## D28 — The Offering: ritual steps are sacrifices (signed off)

*2026-07-03, implements D27's shape; approved without notes.* A severance
ritual step completes when the player makes an **offering** — a basket of
existing resources, consumed. Not a qi threshold crossed, not a standalone
counter: the Act I engine's output, burned. The verb is sacrifice all the
way down.

**Corpse-colored baskets.** Each corpse's rite weights its basket
differently: the Past (the body's memory) leans **qi**; the Present (the
life being lived) leans **consumables** — an active pill discounts the
offering; the Future (the promise) leans **insight** — comprehension
itself, the lattice's currency. Any basket is fillable by any build (qi
and insight are universal); each corpse's rite is *cheaper* for the build
that speaks its language — build diversity as which offerings come easy,
never as which are possible (counter-monopoly inside the realm).

**The second mountain, mechanically.** Offering costs grow geometrically
per step within a severance; the soul-scoped severance-ritual accumulator
— never reset — discounts all future offerings as it grows, on the SAME
typed-accumulator math as the ascent counter (cost scale
max(r^rituals, f), r/f ⟨tune⟩ on ACCUMULATOR_DATA.severanceRitual — the
accumulator finally carries its own acceleration curve, exactly D23's
staging intent). First severance: expensive, slow. Third: practiced.

**Plumbing consequences:** prestige('x') becomes the offering action
(canReset = basket affordable; consumes qi/insight explicitly; the
existing recordSeveranceRitual hook is unchanged). Realm-x's qi reqBase,
gainExp, and points-based substages RETIRE — substages derive from
severance count (the corpse names already assumed it, D27). Realm-x
points retire for honesty. All new numbers ⟨tune⟩-flagged pending Act II
sim evidence (rule 0.1); Act I bands must stay byte-identical (realm x is
statically unreachable by sim actors). Side payoffs: builds Q2's
spend-path hooks; gives future Act II actors an analytically tractable
offering policy (§6).

## D29 — Breathing Trance is not a trap; the sim policy was (Q10 closed)

*2026-07-03, executes the Q10 probe ruling as pre-stated by Wes.* The
attribution probe (⊕, observation-only, live sim): the base Lattice
actor held the trance **77.6%** of its run — including after all Seeds
were bought and during pure qi-banking, where the ×0.7 qi cost buys
nothing. A smart policy (engage ONLY while insight is the binding
constraint: a wanted node unaffordable; disengage while qi-banking) cut
engagement to **22.9%** and closed **85.2%** of the inversion gap
(threshold 70%): base 15.97h → smart 13.15h vs ⊘ ablation 12.66h.
**Verdict: POLICY ERROR — the stance data is fine; no data change**
(rule 0.1 satisfied by evidence; the D1 trap-fix precedent does not
apply). Numbers are live post-keep-mechanic (the ledger's 28.71/21.59h
were pre-migration; the inversion is same-signed either way).

Two follow-ups deliberately NOT taken now: (a) smartening the pinned
LatticeFocused actor's own trance policy would move the pinned cluster —
that is a Gate-D re-pin, deferred to the next deliberate calibration
pass; (b) the finding suggests a PLAYER-facing lesson (the trance
punishes always-on use) — whether the game should teach it (a hint, a
journal beat) is a content question for the narrative-spine pass, not a
balance fix.

## D30 — Offerings bill at the corpse just cut

*2026-07-03, amends D28's billing detail; prompted by the Act II spine
model's finding #2.* D28's implementation billed each offering at
`nextCorpse` — the corpse AHEAD — so living with the Past's cut was
billed at the Present's rite, and the insight-heavy Future basket
carried 12 of 18 offerings while the qi-heavy Past basket was
unreachable for an optimal player.

**Ruling (Wes):** bill at the corpse **just cut**. You sever the Past,
you pay the Past's qi-heavy rite for twelve turnings while mastering
that loss — the resource you burn matches the thing you gave up. "The
doing of it while diminished was the severance" (D27): you severed your
relationship to qi, and now you burn qi to master that severance. The
verb and the cost speak the same language.

**Complete rule:** offeringCorpse = the most recent severance's corpse;
pre-first-cut practice offerings bill at the Past (the rite being
practiced toward — qi-heavy, universally affordable, the right on-ramp);
post-third-cut offerings stay at the Future (the last cut, still being
mastered to cap).

**Calibration consequence:** finding #1 (the insight bottleneck) is
partly a billing artifact — under this rule the insight-heavy load drops
from ~18 offerings to the Future's 12, redistributing Past→qi,
Present→consumables, Future→insight at 12 steps each. The billing fix
lands and RE-MEASURES before any basket base is touched (rule 0.1:
separate the artifact from the real pricing problem first).

## D31 — The ≥3-severables assertion stands; expand coverage, don't cheapen

*2026-07-03, rules on the Act II roster's PREVIEW-BREACHes.* MeridianProbe
(no Seeds → no Manifestation) and LatticeFocused (no profession, no ext
track) each land 2 live severables — each specialist lacks exactly what
the other build's identity provides. **That is the counter-monopoly
working as intended**: builds are genuinely different, and the difference
extends to what they can sacrifice.

**Ruling (Wes):** the shipping assertion as written (≥3 live severables
per viable build) is correct — and the fix is **expanding what counts as
a severable**, never cheapening existing ones (no discounting the
Manifestation, no free professions). The named candidate: **the stance**
(dropped to v2 by D25's probe inversion). D29 has since attributed that
inversion to sim policy error — the trance's design is sound — so the
stance-severable redesign is UNBLOCKED and would close both breaches
simultaneously. Caveat carried from D29's numbers: even smart-used, the
trance is ~net-neutral for the lattice optimizer, so the v2 redesign must
still earn D23's shape (a felt weakness window), not merely re-list the
stance. Tracked as open-questions Q11.

## D32 — Deep weakness windows are a feature only if seen: recovery math at choice time

*2026-07-03, rules on the Meridian 80h sub-breakeven window.* The 80-hour
window on the ext-track cut (clean 5.96×, the deepest sacrifice in the
game) **is the intended price — but only if the player chose it
knowingly.** An informed player betting their Act II on the ramp is a
dramatic, good story; a player discovering 80 hours in that they are
still weaker than before the cut is a trap wearing a feature's clothes.

**Ruling (Wes; D11 applied):** the severance menu must show the RECOVERY
MATH at choice time, before the cut — not just the multipliers lost and
the c→k promise, but the breakeven timeline: ritual turnings to breakeven
and what those turnings will cost (the offering trajectory), so the depth
of the window is legible when the choice is made. Veil the ahead, never
the now — and the recovery timeline is part of NOW once the knife is in
hand. UI work item queued on SeveringPanel's menu.

## D33 — Realm-x substage qiMults stripped; the transition IS the event (Q12 closed)

*2026-07-03, approves Q12's decouple lean with the post-D30 numbers in
hand.* The substage qiMults (2.0/2.4/2.8) were doing two conflicting
jobs — Act II qi scaling AND early-ramp compensation — and the scaling
overwhelmed the severance cost: qi ROSE at every trough. The knife cut
and nothing hurt, contradicting D23's emotional design outright.

**Ruling (Wes):** strip the realm-x substage qiMults; the transcendent
ramp (c=0.5 → k=2.0) is the ONLY compensation for a cut. In Spirit
Severing the substage transitions are the severance gates and the reward
is the ramp STARTING — the transition doesn't need a separate bonus
because the transition is the event.

**Schema consequence (explicit, not placeholder):** the substage reward
becomes NULLABLE — `qiMult: number | null`, where null means "this
substage's reward is the severance itself, not a modifier." A
placeholder 1.0 that technically does nothing is rejected as data
clutter; consumers must handle null explicitly so nothing no-ops
silently. Act I realms keep their numeric rewards; Act I output must
stay byte-identical.

**Sequence (one pass, one Gate-D ruling):** strip → re-measure the full
roster → bring insight-pricing + Manifestation-cost to the settled
numbers; the pill-discount and Act II band calls ride on that re-measure.

## D34 — Act II insight retune: bring the prices to the faucet (tune #1/#2/#3/#4 ruled)

*2026-07-03, the Gate-D tune pass on D33's settled numbers.*

**#1/#2 together — lower the prices, don't build a new mechanic.** An
Act II insight-rate mechanic ("severances feed the faucet they drink
from") is a feedback loop, and feedback loops are the hardest thing to
tune in an incremental — complexity bought to fix something with a
simpler fix. If a future act needs an insight-rate mechanic (almanac
divination, dao-scoped comprehension), it lands then on its own merits,
never as a pricing patch. The Lattice specialist being 100% insight-bound
is the tell that the faucet-to-demand ratio is wrong for EVERYONE.

Two moves:
- **Manifestation cost → the 15–25k range** (was ~75k — "a modest
  multiplier behind a fortress price," and more than a full Act I bank).
  Its price is a SHIPPING-ASSERTION CONSTRAINT (≥3-severables floor for
  non-meridian builds), not a free tuning variable. Sizing test: a
  Realistic actor entering with a MODERATE insight bank (not the 296k
  hoard) affords it within the first severance's ritual window.
- **Offering insight bases scaled proportionally** — the offering is a
  ritual, not a purchase; it should feel like burning incense, not buying
  a house. The Future's twelve-turning insight total ≈ ONE ring-3 node
  purchase, not three, so insight splits roughly evenly between lattice
  nodes and offerings.

**Acceptance criteria (the agent finds exact numbers against these):**
Lattice drops below 95% insight-bound (target ~70–80% — primary
constraint, not only constraint); ≥3-live-severables holds across the
roster at every candidate price; Realistic-with-moderate-bank affords the
Manifestation in the first ritual window. Old-vs-new brought for
verification; one commit.

**#3 — pill-discount gap: CLOSED as build flavor.** Non-alchemists
aren't binding on its absence; the Present costing more for them is the
intended texture.

**#4 — Act II band: DEFERRED to the retune's settled numbers.** Pinning
against numbers about to move is what principle #15 exists to prevent.
When pinned: an observation INSTRUMENT at the settled spread (like
Competent's floor — "if it moves, the data changed"), never an experience
target — Act II's Realistic 9h is a number that will move as content
fills in, not a band to defend. The inversion (experience actor fastest)
is a fact to observe, revisited when the almanac/loot layer add texture
to Act II's idle windows.

## D35 — Sever the Flowing Form: the stance-lock severable (Q11 closed)

*2026-07-03, the Q11 design pass; all three calls ruled.* Option A (sever
the stance system, m = best stance mult) is PROVABLY dead: a toggle's
contribution was never passive, so nullifying it changes nothing and the
ramp starts at 0.5×2.0 = 1.0 exactly — a pure buff, D25's inversion
derived from arithmetic instead of discovered by probe. Generalized as
design principle #35.

**The shape (Option C):** you must be WEARING a stance to sever it. The
knife makes the form flesh — permanent, involuntary, its modifiers
captured verbatim as the m (trance: qi 0.7 / insight 2.0) and run through
the STANDARD ramp on both axes: qi ×0.35 at the cut (the deepest window
in the game) healing through ×0.7 (where the toggle used to be) to ×1.4
at cap; insight ×1.0 → ×4.0.

**Call 1 — full ramp, both axes.** The tamer variant (downside constant)
is a permanent tax, not a severance — no recovery arc, no mastery path
back. The severity is what makes the recovery meaningful. Constraint: the
×0.35 trough must be SURVIVABLE — the actor must still fill the first
offering step and make forward progress (measured in the sim before
shipping; if it can't, the number is wrong regardless of the design).
D32's recovery projection is the informed-consent safety net.

**Call 2 — the lock is a floor, not a cage.** Other stances stack on top
of the locked form's passive base. Mechanically: killing Sword Trance to
pay for the lock is an invisible cost the ramp never compensates.
Thematically: the cultivator practices other forms FROM the locked one —
depth, not restriction; stacking Sword Trance over the trance-lock during
the window is emergent strategy from two existing systems.

**Call 3 — the name ships:** "Sever the Flowing Form" — the form is made
permanent, not destroyed.

**Assertion form (new class, generalized now):** conditional-contribution
severables assert **cap·m > 1 on every axis + breakeven within horizon**
(baseline 1, not m — a novel cost imposed rather than a benefit removed).
Roster consequence: Lattice closes its 2-live breach via the Flowing Form
(it is the stance user); Meridian's honest route is the post-D34 cheap
Manifestation path (~12k insight) — both breaches close through CHOICES
(D31), and the sim policies learn both.

## D36 — Karma pays for firsts; Dao Heart splits at the death boundary (DQ1 / Q3 closed)

*2026-07-04, the slice-10 design pass, first ruling.*

**Karma income prices novelty.** Every income source is an accumulator row
paying `base × rⁿ` (n = prior lives that already earned it) with **floor
f = 0** — and the zero floor is the design, not a tuning value. Every other
accumulator in the game floors above zero (ascents f = 0.05, the severance
ritual f = 0.25) because those mechanics should never vanish — a breath,
never nothing. Karma is the one accumulator where hitting zero is correct:
doing the same thing again genuinely isn't a first anymore and shouldn't
pay like one. The game doesn't pretend the tenth identical life is as
interesting as the first. Grade-class sources pay **personal-best deltas
only** (the actTwoEntryGrade latch mechanic).

**Consequence: karma is the engine of the build-sequencing dynasty
metagame** (principle #30). "Gatherer this life, sect the next, lattice
hermit after" is now the karma-optimal path *by the math* — each life
encounters firsts the previous builds couldn't reach — with the incentive
stated by the income table rather than enforced by a rule. Repeating a
favorite build is never punished; it just doesn't re-earn the repeated
parts. Diminishing novelty, honestly priced.

**Granularity requirement (spec-blocking):** firsts must be granular
enough that a similar build in different circumstances still generates
them — "first Nascent Soul as a meridian build," "first Wandering Sage met
during Core Formation," and "first Flowing Form severed" are distinct
firsts, never collapsed into their coarse parents. The granularity of the
firsts table is THE tuning lever for how hard karma pushes exploration
versus tolerating build loyalty. **The granularity scheme goes into the
slice-10 spec before the firsts table is written.**

**Dao Heart splits at the death boundary (Q3 closed).** Q3's tension
(eternal + farmable = unbounded meta-currency) dissolves once Dao Heart is
recognized as two things wearing one name. The farmable stacks — power
gained from facing heart demons — are **body-state**: built in flesh, they
die with it (life-scoped, as today). The endurance record — which trials
the soul has faced — is **soul-state** and carries forever: identity,
chronicle material, karma deed-rows (full on the soul's first clear of
each trial type, decaying to zero on repeats), and a potential gate for
future demonic content. Principle #20's question ("unbounded
meta-currencies are explicit decisions") is answered concretely: **no** —
power is bounded per-life by construction, identity is bounded by
wider-not-taller math. The demonic fantasy survives whole: each life
rebuilds its demon-fighting power from scratch (so each life's demons are
real challenges, never stomped by carried stacks), while the soul's record
of having faced the deepest trials persists.

**The death boundary generalizes** into design principle #36 and becomes
the Q6 audit criterion: for every currently-eternal state, ask "did the
body build this, or does the soul know it?" Body-state dies; soul-state
carries; what belongs to neither is probably world-scoped.

**Enforcement:** lint-shape — every karma income row has r < 1 and f = 0,
grade rows are delta-typed (boundedness provable from the data shape);
dynasty-harness assertion (when pinned) — a repeat-sequence of N identical
lives earns strictly less than any breadth-sequence of equal length; §6.6
no-Samsara run unchanged.

## D37 — The scope audit: the death boundary sorts it; the chronicle founds the world scope (Q4/Q6 closed, DQ3 folded)

*2026-07-04, the slice-10 design pass, second ruling. The audit table
"turned an item-by-item judgment call into a mechanical sort" (Wes).*

**The table (ruled as delivered):**
- **Life-scoped, unchanged** (body-built, dies at rebirth): body
  (meridians/temper/soul aspect — aspect is a per-life configuration,
  re-chosen fresh), gate checkpoint deeds (re-fire per §8.1), sect
  personal standing, alchemy profession choice, secret, severing actives
  (D23), demons' corruption + daoHeartStacks (D36).
- **Promoted eternal → soul** (the soul knows it): the soul store
  (already the harness bridge), seclusion rungs + Deep Meditation
  knowledge (Q4 confirmed — "a new body does not unlearn it"), legacy
  grades/personal bests (karma's delta inputs; read by the chronicle,
  owned by the soul), and the **journal** — the soul's accreted memory.
  The strand workshop decided this row: revisitation only works if a new
  life can visit the spring a past life saw. Entries never re-announce.
- **Splits at the boundary (#36 applied):** demons (D36); the dao lattice
  at rebirth — Glimpses carry free, Seeds carry only via memory-fragment
  purchase, Manifestations die but re-walk at a steep discount driven by
  a new soul accumulator ("the walked path"); insight banks and stance
  toggles die.
- **Neither body nor soul:** achievements stay file-scoped (D9b); the
  **chronicle is world-scoped and is the founding world-scope instance**
  — the DQ7/DQ8 merger. "The chronicle was always the world's record
  dressed up as a player feature" (Wes): epitaphs, encounter provenance,
  what the springs remember — persists after death, belongs to no soul.
  One structure, three consumers: epitaph rendering, karma computation at
  death, future shrine/strand reads. Sect seed-stores wait for the
  almanac era.
- **New states:** karma balance → soul; rebirth counter → soul (doubles
  as the strand gate clause); roots (pending DQ5) → life-scoped
  configuration purchased at rebirth; studied techniques → life, retained
  only via memory fragments.

**The Seed-recovery karma cost is the continuity lever (⟨tune⟩, ruled
direction):** it controls how much build-continuity a player can buy
across lives versus how much they must rebuild. Too cheap → every life
starts with a near-complete lattice (kills the re-discovery arc); too
expensive → persistence feels vestigial. Sweet spot: **one life's worth
of karma buys back a few Seeds, not all of them** — enough that WHICH
Seeds to carry expresses a real preference, never so much that carrying
is automatic. Tune with dynasty-harness evidence.

**The chronicle curation rule (schema-level, not a post-hoc filter):** as
a world-scope accumulator the chronicle obeys wider-not-taller (#21) — and
for the chronicle the diminishing return is a VOLUME constraint expressed
as curation. A thousand-life save must not produce a thousand-entry
chronicle nobody reads: later lives' entries are briefer and more
selective **unless something genuinely novel happened — which karma
already measures**. The karma receipt is the curation signal. The dynasty
history reads the way real ones do: founding lives get chapters, the
middle era gets summaries, only exceptional late lives get full
treatment. The data shape must support per-entry richness tiers from day
one.

**DQ3 folded (the rebirth cut):** fully determined by the table plus the
committed graded lattice rule — everything life-scoped resets, soul/world/
file-scoped state is topologically unreachable by the rebirth cascade.
Enforcement: the reincarnation closure lint (§8.1 committed design) —
rebirth is a compiled cascade tier over TREE_DATA's differentiated scope
enum, never a hand-written reset list.

## D38 — The rebirth economy: two-item menu, escalating fragments, shape/purchase roots (DQ4/DQ5 ruled)

*2026-07-04, the slice-10 design pass, third ruling. "Ships as written,"
with six shaping reads recorded.*

**The menu is two items — memory fragments and roots — and the cut is the
design:** boons overlap roots, and a four-item screen where two items are
filler dilutes the rebirth moment instead of sharpening it. Every karma
point goes to a real choice: *what do I carry, and what body do I build.*

**Fragments escalate, and the real payoff is separation of concerns.**
Flat pricing makes "how many Seeds can I carry" a function of karma
income — every karma retune implicitly retunes the continuity lever and
vice versa. Escalation decouples them: **the curve's shape controls
continuity, karma income controls how far up the curve you reach —
independently tunable. Two knobs for two jobs.** The self-enforcing
ceiling is the mechanical payoff; the player-feel payoff is "I can afford
three Seeds — which three?": the build-sequencing metagame at its
smallest scale, stating what you valued about your last life's lattice.

**Techniques ride a separate flat-or-shallow track.** Tools, not
comprehension — less identity-defining than Seeds, so cheaper, and never
competing with Seeds for the escalation curve's expensive upper slots.
"Carry a technique" must never crowd out "carry a Seed" at the margin.

**Roots: count + identity are configuration (free-ish), purity is the
purchase.** Three reads ruled in:
1. **The first rebirth decision is a genre choice, not a power choice.**
   Single-element deep-and-narrow vs five-element wide-and-slow is a
   playstyle declaration; gating it behind karma would punish exactly the
   exploration karma's income rewards. Nominal cost prevents thoughtless
   clicking; the power axis is purity. (Five-element Act III Authority
   payoff: recorded, not built.)
2. **Purity is the dynasty project** — Mortal → Earth → Heaven grade-ups
   are dynasty-scale prestige events, dozens of lives out, **recorded by
   the chronicle**. Retention without new content: the genre's core
   pleasure at the meta level. Because purity scales discount MAGNITUDE
   (never unlocks new discounts), Heaven-grade single-element and
   Heaven-grade five-element are different shapes at the same power level
   — no dominant strategy by construction.
3. **Discounts are speed, never access.** A root never unlocks a lattice
   node an unrooted cultivator can't reach — only makes reaching it
   faster. v1 effect domain: lattice-region discounts ONLY (profession
   affinity and aspect-menu coloring are separate future domains that add
   without conflicting).

**The baseline invariant is the most important line:** an unspent rebirth
is byte-identical to today's game — zero discounts with no root, zero
fragments with no carry — so every existing test, pinned band, and
calibrated number stays valid by construction. Loot-never-gate applied to
the meta-economy: karma spending is loot for the NEXT life, never a gate
on the current one. **Verified, not assumed:** the unspent-rebirth path
runs through the existing sim roster and byte-identity is confirmed.

**Pins (dynasty-harness-measured):** no root configuration dominates —
swept across count/identity/purity combinations **at every purity grade**
(dominance emerges at Heaven where discounts are large, not at Mortal
where everything looks equal); the wider-not-taller dynasty bound — a
maxed save (Heaven purity, full carry) finishes lives faster but never
trivially, the bounded multiple keeping the game recognizable at dynasty
endgame.

**Measure-first directive (spec-blocking, tuning order):** karma income
must be measurable per-life BEFORE spending is priced. The dynasty
harness's first job is measuring karma income distributions across the
build roster (each actor's firsts profile differs, so each actor's income
differs); the pricing grid is then tuned against measured incomes — first
fragment affordable on a modest life, Heaven purity requiring many lives'
surplus, the escalation knee at the typical single-life income.
**Measure-first, price-against-measurement produces numbers you can
defend.** Price-first produces the tribulation-bank kind of debt.
