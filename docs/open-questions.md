# Open questions

Each entry: what needs deciding, the **trigger** that forces it, and the
current lean. When decided, the entry moves to [decisions.md](decisions.md)
as a dated record.

*(Q1 — r value and tail register — decided 2026-07-02, moved to
[decisions.md](decisions.md) D21: r = 0.70, f = 0.05.)*

## Q2 — "Qi gains from spending" expedition modifier *(trigger: Act II realm sites)*

The Inverted Spirit Land design idea needs spend-path hooks the engine
doesn't have; v1 shipped an Insight inversion instead. The modifier family
(gain-from-spending, cost-from-time, progress-from-stillness) is recorded in
`secret-realm.ts`'s header. Build the plumbing when Act II adds its sites.

## Q3 — Dao Heart scope across reincarnation *(trigger: slice 10 Samsara design, FIRST)*

Currently life-scoped; the lean was eternal — but eternal + the repeat
ladder's farmability = an unbounded meta-currency across lives. That is
either the demonic fantasy fully expressed or the thing Samsara soft-caps —
and it is THE question Samsara's economy answers before any numbers are
written. Likely resolution shape: an instance of the accumulator math
(diminishing per axis, unbounded breadth — see
[architecture.md](architecture.md)).

## Q4 — Seclusion rungs across reincarnation *(trigger: slice 10 implementation)*

Not really open — a confirmation checkpoint. Shipped eternal by design
intent ("QoL is never clawed back"); the Samsara implementer must not
"helpfully" reset them.

## Q5 — Negation in `meets()` *(trigger: next hint-grammar touch)*

Nine hint-shadow keys now exist; the recorded rule-of-thumb says shadow-
grammar growth should have triggered a `not:` combinator two keys ago. One
combinator retires most shadow keys. Related: the achievement registry's
"not expressible" list (Q7) partly overlaps — negation would unlock "core at
its ceiling."

## Q6 — Eternal-scope differentiation audit *(trigger: slice 10 Samsara design)*

When Samsara differentiates today's `eternal` scope into `soul | world | dao`
(see architecture.md), every currently-eternal state needs an explicit
assignment: seclusion rungs (soul? dao?), Deep Meditation knowledge, legacy
grade (soul, or raw material for the world-side chronicle?), Dao Heart
(soul, presumably — but decided, not defaulted), achievements (file-scoped
by construction — the Steam-account analog). A named design task, not an
emergent discovery.

## Q7 — Event-driven achievements *(trigger: when a slice touches the relevant systems)*

The v1 registry is 100% meets()-expressible by lint rule. Conditions that
need `award()` call sites (documented in `src/data/achievements.ts`): a core
GRADE threshold, "core at its ceiling" (needs negation — see Q5), specific
forge-push outcomes (steady/forceful/reckless), tribulation grades
(flawless pass, scar taken/healed).

## Q8 — Weather-aware sim actors and sect's non-temporal metrics *(trigger: almanac/loot layer build)*

When the almanac lands, the sim needs surf/ignore actor policies, a
weather-off counterfactual, a seed-sweep for encounter variance, and the new
sect metrics (idle-efficiency-per-check-in, encounters-per-life) — plus the
loot-never-gate assertion (zero-rare Competent stays in band). Scoped in
[design-directions.md](design-directions.md); the Realistic band's banking
knob wakes when this lands, and the band re-derives rather than silently
widening (the pin's FAIL text says so).

*(Q9 — severing numbers — decided 2026-07-02, moved to
[decisions.md](decisions.md) D25: c = 0.5, k = 2.0, ramp driver = the
severance ritual; stance to v2.)*

*(Q10 — Breathing Trance trap? — probe run and closed 2026-07-03, moved to
[decisions.md](decisions.md) D29: POLICY ERROR, the stance data is fine —
the sim's always-on trance usage caused the inversion, 85.2% of the gap
closed by insight-binding-only engagement. No data change.)*
