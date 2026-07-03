# Slice 9 — Act II opens: Spirit Severing

**Status: CORE BUILT 2026-07-03 (overnight pipeline).** Signed off
2026-07-02 (D25); scope cut approved 2026-07-02; shape decisions in
[decisions.md](decisions.md) D21–D25; probe evidence in
[calibration.md](calibration.md).

Built (commits `6b0a94d`/`12f159b` skeleton+seams, `f7a7812` keep rule +
pin migration, `f8bb2ba` severing system, `e215a64` medium lattice):
§1 keep rule (see the migration note below — Realistic did NOT re-pin),
§2 severing (store, ceremony panel, ramp, sequential gating, 15 tests),
§4 medium lattice (25 nodes, Manifestation, conflict binding, Act I
provably untouched). 320 tests, all gates green, Pages serving current.

**Remaining from this spec — sequenced by Wes (2026-07-03): §5 → §3 → §6.**
§5 cross-tree lint FIRST (structural safety net, smallest, no design
questions — every subsequent Act II addition gets checked automatically);
§3 scar-on-entry second (self-contained, reuses the shipped scar system,
produces the entry grade §6's actors will want; confirm no band
interaction — one-time event at a threshold, not before it); §6 LAST —
the only one with a real blocker (today's actors never pass the
tribulation). Do not rush actors into existence against moving data:
express the three mechanical assertions (lifetime net ≥ 1, bounded
weakness window, ≥3 live severables) as **lint-shape checks on the data
tables now**; dynamic sim assertions wait for Act II actors + stable
severing content; the ⊘ rate-share model bridges analytically. Also
queued by D27: rework realm-x substages to severance-gated (the corpse
names already assume it) + a ritual-step design proposal for sign-off.
Watch Q5 (meets negation) — it may fire if §3 or §5 touches hint grammar.

## Scope

**In:** the Spirit Severing realm + the Severing set-piece (forge-skeleton
reuse); the three-attachment system over the v1 severable list; the ascent
counter and the severance ritual as the first two typed accumulator
instances (soul scope); keep-rule restructure with D21 constants + pin
migration in the same commit; scar-on-entry; medium lattice ring
(Manifestation tier, flow/stillness conflict binding); narrative-spine
hooks only (severing events recorded as chronicle-grade material, rendered
later); per-attachment severance history recorded from day one (D24).

**Out:** Void Refinement, Body Integration, Mahayana (slice 11); the
narrative-spine design pass itself; three-lives transcendence *mechanics*
(Samsara — the data is recorded now, the payoff ships there); Laws tier
(folded into Act III per D22).

## 1. The keep-rule restructure (the core remembers, made real)

Implements D2/D21: re-climb clock scale = max(r^(k−1), f) with **r = 0.70,
f = 0.05**, where k is the ascent counter. The counter is the first typed
accumulator instance: scope `soul`, diminishing-returns descriptor =
geometric (r), persistence rule = survives tribulation and severing
(invert-survival-lists: the counter is on the KEEPS list, explicitly).
Deliberate pin migration in the same commit: Realistic re-pins at
~[28–35h] cadence-labeled with r final, Competent re-pins wherever it lands
(regression instrument), cluster re-checked with r live.

> **Built (2026-07-02).** Migration measured differently than predicted:
> Competent re-pinned 74,041s → 41,659s; Realistic held byte-identical at
> 53.25h / [48.5–62.4h] — check-in quantization absorbs the gain rule for
> the experience actor (the ~[28–35h] figure was a counterfactual
> artifact). Cluster 1.392. See D13's migration note + calibration.md.
> **Resolved by D26 (2026-07-03): 53h stands; keep-rule legibility UI
> ships; wall-clock compression deferred to the almanac/banking layer.**

## 2. The Severing (D23)

**Structure — the three corpses.** The realm has three sub-stages, each
gated by one severance: choose a real piece of your build, perform the
severing set-piece (forge skeleton: charge → commit → outcome), live with
it. Sequential by construction — the next sub-stage does not open until the
current severance has been **lived with = breakeven crossed** (the ritual
has carried the multiplier past what was cut; 5–8 ritual steps at the
candidate parameters below — probe-confirmed as a felt but bounded window).

**The severance choice is fully legible (D11 — never veil the now).** The
menu shows each candidate's measured live contribution — the game tells you
exactly what you are giving up. What severing *feels like* ahead of the
realm stays veiled; the choice inside it never is.

**v1 severable list, probe-revised** (criterion: legible, isolatable
effect domain; probe results in [calibration.md](calibration.md)):

- **In:** soul aspect (12.3h Lattice / 6.0h Realistic, clean 1.5×),
  profession (26.6–30.5h, the biggest Realistic sacrifice), extraordinary-
  meridian track (26.9h, clean 5.96× — replaces the spec's "meridian set
  bonuses," which don't exist as a distinct effect), lattice Manifestation
  (new this slice; probed once it exists in data).
- **Out (v2 pending redesign):** stance — the probe found severing
  Breathing Trance's effect makes the lattice build 7.1h FASTER; a
  severance with no weakness window is a pure buff and violates D23's
  shape. (Side-flag, rule 0.1: is the trance itself a trap for qi-focused
  play, or is the sim policy just using it badly? Separate question.)
- **New shipping assertion:** every viable build must have **≥3 live
  severables** (three sequential severances require it; Realistic has
  exactly 2 today — the Manifestation is what makes the third exist for
  non-meridian builds, so it is load-bearing, not decoration).

**The multiplier.** Severing grants a transcendent multiplier over a
superset of the severed piece's effect domain (lint verifies the shape).
It RAMPS: starts at c·m (felt weakness window), grows with each
severance-ritual completion, crosses breakeven at step n\*, caps at k·m by
step 12. The probe's grid says the viable corner is **c ≥ 0.5, k ≥ 1.5–2.0**
(c = 0.25 never recovers inside the ramp window). **Signed off (D25):
c = 0.5, k = 2.0** — breakeven at step 7, in-window net 1.10, the deepest
cut that still honors lifetime-net-positive. Sim asserts pacing over
sampled builds; lint never makes pacing claims.

**The severance ritual — the second mountain.** The ramp's driver is the
severance ritual, the second soul-scoped accumulator: "you've mastered the
core; now master the severance." Its own acceleration curve, its own
mastery arc; one mechanic serves as both the multiplier's clock and Act
II's ritual content. (Confirmed at sign-off, D25.)

**Recorded from day one (D24):** per-attachment severance history
(attachment identity, life number) — the three-lives transcendence promise
is data-real immediately, mechanics ship with Samsara. Steam launch
postdates transcendence implementation.

## 3. Scar-on-entry

Entering Spirit Severing scars per the tribulation crossing rule (§1.3 of
the retired spec): the first crossing into Act II is graded and leaves a
scar — the wound that severing thematically answers. Mechanics reuse the
shipped scar system; the entry grade feeds the Act legacy grade.

## 4. The medium lattice ring (D22)

~25 nodes, Glimpse → Seed → Manifestation only. The Manifestation tier is
the new severable-grade power (and the flow/stillness conflict binding
lands here — maintaining conflicting bindings is Void Refinement's premier
Insight engine LATER; slice 9 only makes the conflict exist and legible).
Laws are Act III realm content, not lattice nodes.

## 5. Cross-tree keeps

Act II's tree reads Act I state through explicit keep-rules (the exception
mechanism within tree scope — architecture.md). Cross-tree lint goes real:
every Act I → Act II dependency is declared, not emergent.

## 6. Calibration plan

- k-probe results recorded in [calibration.md](calibration.md) (2026-07-02;
  probe flag ⊘ `counterfactualSeverEffect`, base output pure-insertion).
- New assertions when the mechanic lands: severing is never a strict loss
  over a life (lifetime net ≥ 1 on sampled builds); the weakness window is
  bounded (breakeven within the ramp horizon on every sampled build);
  **every viable build has ≥3 live severables**; pinned-band migration
  per §1.
- Sim actors gain a severing policy (which attachment each archetype cuts,
  and when). Probe guidance: Realistic's natural cut order is profession-
  last (its biggest piece); the ext track is only live for meridian-leaning
  builds; the Manifestation must be probed the moment it exists in data.

## 7. Build order

Skeleton-first as established: types + data tables + store stubs + both
registrations + panel mounts committed green by the lead; parallel agents
own disjoint files (severing store/set-piece, lattice ring data, keep-rule
restructure + accumulator type); lead verifies, gates, commits. Golden
0.4.2 tags before slice-9 work merges anything player-visible (release
discipline).
