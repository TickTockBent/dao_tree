# Dao Tree — design documentation

The suite that grew out of the original `deferred-decisions.md` ledger (split
2026-07-02 when it outgrew its purpose; the full pre-split ledger lives in git
history). Each file has one job:

| File | Job |
|---|---|
| [decisions.md](decisions.md) | **The decision record.** Every settled design call, with rationale and date. Append-only; entries are never reopened silently. |
| [open-questions.md](open-questions.md) | **What still needs a call**, each with its trigger (the slice or event that forces it) and the current lean. |
| [design-principles.md](design-principles.md) | **The design constitution** — Wes's standing principles from the 2026-07-02 review passes. Checked before recommending anything that touches their territory. |
| [architecture.md](architecture.md) | **Engine-shaping structures**: typed accumulators, scope model, save lineage, the multi-life harness plan. |
| [design-directions.md](design-directions.md) | **Planned/parked systems** not yet scheduled into a slice: the celestial almanac + loot layer, the spirit garden, build sequencing, the narrative spine. |
| [calibration.md](calibration.md) | **The sim record**: pinned pacing bands, probe results, and the measurement methods that produced them. |

Older design docs (the original spec suite) were retired at `0c75e51`;
retrieve any of them with `git show 5887814:docs/<name>`.

Code comments that cite "ledger #N" / "deferred-decision #N" predate the
split: #1–#16 resolve to the matching **D-number in decisions.md** (numbering
preserved); #17/#18 live in design-directions.md (almanac, spirit garden);
#19/#20 in architecture.md (accumulators, dynasty harness).

Working rules that span the suite:
- **Rule 0.1** — no game-data change ships without evidence and Wes's sign-off.
- **Gate-D** — pacing bands are never pinned unreviewed; calibrate first, Wes signs off, pins move only in deliberate, signed-off commits.
- Decisions get **dated entries** in decisions.md when made; open-questions entries move there rather than being edited in place.
