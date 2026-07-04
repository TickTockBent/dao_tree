# Slice 10 — Samsara: the outer loop

**Status: DESIGN SIGNED OFF 2026-07-04 (D36–D40). Build not started.**
This spec compiles the five rulings into an operational plan; the full
rationale for every call lives in [decisions.md](decisions.md) D36–D40,
with D37's audit table as the topology and D24 as the Steam gate this
slice closes. Constitution articles in play: #20, #21, #28–#31, #36.

Reincarnation is the meta-prestige — always optional (§6.6: never a
ransom), unlocked at the first tribulation crossing, voluntary forever.
The slice has two halves: the **soul side** (karma, the rebirth screen,
fragments + roots, transcendence) and the **world side** (the chronicle,
founding the world scope). The death boundary (#36) is the organizing
principle throughout: what the body built dies; what the soul knows
carries; what belongs to neither is the world's.

---

## §1 Scope differentiation (D37 — the topology ships first)

`eternal` differentiates into **soul | world | file**; with `tree` and
`life` the scope enum is complete (`dao` scope: enum seat + paragraph
only, per #28 — its first citizen is the strand system, post-slice).

**The ruled table:**

| Assignment | State |
|---|---|
| life (unchanged) | body (meridians/temper/aspect), gate deeds (re-fire per §8.1), sect standing, alchemy profession, secret, severing actives (D23), demons' corruption + daoHeartStacks (D36), studied techniques |
| soul (promoted from eternal) | soul store (ascents/rituals/history), seclusion + Deep Meditation (Q4), legacy grades/personal bests, **journal** (the soul's accreted memory — strand-revisitation decided it; entries never re-announce) |
| soul (new) | karma balance + per-life ledger, rebirth counter (doubles as the strand gate clause), demons' **endurance record** (per-trial-type, D36), the lattice **walked-path** accumulator (Manifestation re-walk discount) |
| world (new) | **the chronicle** (founding world instance — see §5) |
| file (unchanged) | achievements (D9b) |

**The rebirth cut (DQ3, folded into D37):** everything life-scoped
resets; the lattice follows the committed graded rule — Glimpses carry
free, Seeds carry only via memory fragments, Manifestations die but
re-walk at the walked-path discount; insight banks and stance toggles
die. Severed things return (D23) minus transcendences (§4).

**Enforcement:** rebirth is a **compiled cascade tier** over TREE_DATA's
differentiated enum — never a hand-written reset list (#32). The
**reincarnation-closure lint** (committed §8.1) proves soul/world/file
state is topologically unreachable by the rebirth cascade, the same way
tree-scope leaks are proven today.

## §2 Karma (D36 + D40 — the heavens pay for firsts)

**Income.** Earned once per life at the crossing, computed from the
life's record (which IS the chronicle entry — one schema, two consumers).
Every source is a `KARMA_DATA` row: `base × rⁿ` (n = prior lives that
earned that exact first), **floor f = 0** — the one accumulator where
hitting zero is correct. Grade-class rows pay personal-best deltas only.

**Granularity (D40):** a first = event key × declared qualifier tuple.
Axes (typed, closed, per-row opt-in): `rootShape` (declared),
`buildMark` (derived, one fixed rule, the sim-actor vocabulary:
gatherer/meridian/lattice/sect/pill/balanced), `realmEra`, `worldContext`
(reserved, zero instances). **Headline plus echoes:** bare event pays
full base once ever; each qualified variant pays `variantShare × base`.
Exploration-vs-loyalty = `variantShare` + the axis vocabulary, both
explicit knobs. The ledger's value fields are
**signed by type** — the schema supports negative entries, and ALL v1
rows are positive: no placeholder negative-income rows, no zero-base dead
data in the table or in the expansion-count pin. The demonic axis adds
its rows when it ships content (§8).

**Lint:** typed-union axes; per-class allowed-axes; **expansion count
pinned** (Gate-D style); every row r < 1, f = 0; grade rows delta-typed
and unqualified. Boundedness is provable from the data shape — no future
row can reintroduce the infinite grind by accident.

**All bases ⟨tune⟩ and NOT priced in this spec** — see §7's measure-first
order. v0 bases are relative class weights for measurement only.

## §3 The rebirth screen (D38 + D39)

Unlock: `tribulationPassed` latch, first Act I capstone. A voluntary
prestige — available whenever the player judges the life complete,
nothing ever forces it. Mid-Act-II rebirth: no special case; the topology
handles it.

**The moment, in order (D32 grammar end-to-end):**
1. **The receipt** — the ledger read before the crossing: firsts earned
   (headlines rung, echoes noted), what repeats paid nothing, the karma
   total. Legible BEFORE commitment, restated at the armed confirm.
2. **The two-item menu** — every karma point goes to a real choice:
   - **Memory fragments.** Seeds carry on an **escalating curve** (first
     cheap, `× growth` each additional — the curve's shape controls
     continuity, income controls reach: two knobs for two jobs).
     Techniques ride a **separate flat-or-shallow track** (tools, not
     comprehension — never competing with Seeds at the margin).
   - **Roots.** Count + identity are **configuration** (nominal cost — a
     genre choice, not a power choice); **purity (Mortal/Earth/Heaven) is
     the karma sink** and the dynasty project, grade-ups recorded by the
     chronicle. Effects v1: **lattice-region discounts only**, and
     discounts are **speed, never access** — no root unlocks anything.
3. The crossing: the cascade fires, the chronicle writes the life, the
   new life begins with its carried soul + purchased configuration.

**The baseline invariant (the most important line):** an unspent rebirth
is **byte-identical to today's game** — zero discounts rootless, zero
fragments uncarried. Every existing test, pinned band, and calibrated
number stays valid by construction. Loot-never-gate at the meta-economy:
karma spending is loot for the NEXT life, never a gate on the current
one. **Verified, not assumed** — the unspent-rebirth path runs through
the existing sim roster and byte-identity is confirmed (§6).

## §4 Transcendence (D39 — the D24 Steam gate closes here)

Sever the same attachment in **any three lives** (the soul's severance
history is the record, already threading the harness) → transcended
permanently. Every subsequent life starts with the piece **already
severed at full ramp** — gone, cap × contribution from breath one, no
trough (the window was lived three times; that was the price). D23's one
designed exception.

- **D31 interaction:** transcended pieces leave the severance menu
  forever; the ≥3-live-severables assertion counts only non-transcended
  severables. Expanding the roster is the pressure valve.
- **D32 moment:** the THIRD cut announces the transcendence — permanent,
  across all future lives — at choice time and at the armed confirm.
- Transcending is itself a headline first (karma deed row).

## §5 The chronicle v1 (D37 — the founding world instance)

The world's record of your lives: per-life entries (realm reached,
grades, tribulation outcome, root config, severances, trials endured,
firsts receipt) — **one schema, three consumers**: karma computation at
death, epitaph rendering, future shrine/strand reads. Strand reserve
fields ship in the schema: strands held / matured / transmitted / torn
(all zero until the strand arcs).

**The curation rule is schema-level, not a post-hoc filter (D37):** the
chronicle obeys #21 as a VOLUME constraint. Entries carry **richness
tiers driven by the karma receipt** — the novelty measure already exists.
Founding lives get chapters, the middle era gets summaries, only
exceptional late lives get full treatment. A thousand-life save reads
like a dynasty history, not a log file.

**v1 UI: a modest chronicle listing** (Journal tab — one epitaph line
per life, richness-tiered). The full narrative treatment belongs to the
narrative-spine pass (D8); the data must be complete from day one.

## §6 Sim + assertions (all PREVIEW until the tune sign-off — slice-9 discipline)

Dynasty harness extensions (harness shipped `12595f1`):
1. **Karma instrumentation (FIRST — the measure-first order):** actors
   generate firsts profiles; income measured per-actor **decomposed by
   class** — milestone headlines / milestone echoes / deed+encounter /
   grade deltas — alongside totals (D40: the total prices the menu; the
   shape tells whether karma is a novelty-incentive or has collapsed into
   a performance-incentive).
2. Rebirth modeling in `runDynasty`: spend policies (fragment-carry
   strategies, root shapes) as dynasty-sequence parameters.
3. **Baseline byte-identity:** the unspent-rebirth roster run diffs clean
   against pre-slice output (pure insertion, as always).
4. **Assertion candidates for the eventual Gate-D pinning** (PREVIEW
   lines until then; NEVER the FAIL token):
   - §6.6 no-Samsara run inside the pinned bands (unchanged by
     construction; verified anyway).
   - Repeat < breadth **at equal competence**: as played by the sim
     actors (constant competence by construction), N identical lives
     earn strictly less karma than a breadth sequence of equal length;
     farm income converges. NOT a universal law — a mastered repeat
     build setting fresh grade personal-bests can legitimately out-earn
     incompetent breadth (deltas latch; they don't decay like repeats).
     The assertion is scoped to what the sim can actually prove.
   - Root dominance sweep **at every purity grade** (dominance emerges at
     Heaven, not Mortal).
   - Wider-not-taller dynasty bound: a maxed save (Heaven purity, full
     carry) stays within a bounded multiple of the cold-file band.
   - Act I pinned bands byte-identical throughout (Gate-D).

## §7 Build order (the proven pipeline: skeleton → sequential agents → my gates → commit)

1. **SKELETON (me):** scope enum + TREE_DATA differentiation + the
   reincarnation cascade tier + closure lint; KARMA_DATA table shape
   (rows, axes, expansion-count pin) with relative-weight v0 bases;
   soul-side stubs (karma balance, ledger, rebirth counter, endurance
   record, walked-path); chronicle schema with richness tiers + strand
   fields; store registrations + test-setup mirror.
2. **Harness instrumentation** (agent): §6.1–6.3. Deliverable: measured
   income distributions per actor, decomposed by class.
3. **⟸ Gate-D pause: Wes prices against the measurements** (D38's
   measure-first, D40's shape check) — class bases, variantShare,
   fragment curve, purity grid. Rule 0.1: evidence + sign-off.
   **Steps 4–7 are strictly sequential on this pause:** every later
   agent builds against the signed-off prices, never against v0
   measurement weights. No UI is built twice; the receipt and menu
   display real numbers from their first commit.
4. **Rebirth mechanics** (agent): cascade wiring, prestige path, receipt
   + menu UI, the crossing.
5. **Fragments + roots** (agent): data + menu behavior + lattice
   discount hookup (speed-only).
6. **Transcendence** (agent): detection, life-start application, D31
   assertion change, D32 third-cut announcements.
7. **Chronicle v1** (agent): writer at the crossing + the modest listing.
8. **Assertion hardening + pins** (me + Wes): PREVIEWs → FAIL-able where
   signed off; golden save; re-pin anything that deliberately moved.

Each numbered item: one sequential agent, my verification, all four
gates, commit. No parallel work agents. No game-data change without
evidence + sign-off.

## §8 Non-goals (recorded so nobody "helpfully" builds them)

Orthodox/demonic axis (sins schema signed, content deferred); world
seed-stores + spirit garden (almanac era); talents/starting boons (v2);
the strand system (post-slice arcs — only the §1/§5 reserves ship);
root profession-affinity and aspect-menu coloring (future effect
domains); Act III shrines (the chronicle schema is their insurance);
rebirth mortality flavor (almanac era); the §6 Act II PREVIEW hardening
from slice 9 (separate Gate-D item, unblocked whenever Wes calls it).
