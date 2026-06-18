# Cultivation Progression Map

*A design skeleton for a xianxia cultivation incremental, built on the genre-standard realm ladder.*

**Provenance & scope.** The realm ladder below uses the **genre-canonical** cultivation progression — the "lingua franca" spine recognizable across the vast majority of cultivation fiction — rather than any single work's idiosyncratic naming or a custom setting. This is a deliberate choice: in an incremental, recognition *is* the progress feedback. A reference build (a TMT-based incremental) informed the **macro-pacing** (act structure) and the **support-system shape** (sect ranks, domains, professions), but its realm *names* were one author's specific upper-tier invention and have been replaced with standard terms. No code, numbers, or text were taken from it. Sections marked **[CANON]** are genre-standard; **[STRUCTURE]** are our pacing/organization choices; **[OURS]** are mechanical expansions.

**Two adjustable knobs**, flagged inline: (A) the **upper-tier realm selection** (the genre forks after Soul Formation — several standard options), and (B) **three-act trees vs. one flat ladder**. The draft below picks defaults; both are cheap to change because everything is data (§6.4).

---

## 1. Macro structure — three acts [STRUCTURE]

The canonical ladder is a flat ~10–13 realm sequence. We group it into three acts, each a prestige *tree* on its own tab, because the genre's own breakpoints fall naturally at these seams and the act-breaks give an incremental three clean "new game+" pivots instead of one long slog.

| Act | Tree / tab | Spans | Capstone |
|-----|-----------|-------|----------|
| **Act I — Mortal Road** | Main tree | Body Tempering → Soul Formation | **Soul Formation** (last mortal-tier realm) |
| **Act II — Severing the Mortal** | Second tree | Spirit Severing → Mahayana | **Mahayana** (peak before immortality) |
| **Act III — Immortal Ascension** | Third tree | Tribulation → the Immortal tiers | **Dao Ancestor / Transcendence** (endgame) |

*Knob B:* collapse to a single continuous ladder if we'd rather lean pure-canon-flat. The cost is losing the act-pivot pacing; the gain is a more "honest" single tree.

---

## 2. The realm ladder [CANON] + sub-stage detail

Every major realm subdivides into minor stages (standard pattern: **Early / Mid / Late / Peak / Great Circle**, with named exceptions noted).

### Act I — Mortal Road

| Realm | Notes / sub-stage pattern |
|-------|---------------------------|
| **Body Tempering** | Prelude realm. Tiered as **Skin → Flesh → Tendon → Bone → Marrow** — the native home for the early-game systems in §4. |
| **Qi Condensation** | Numbered levels (1st → ~13th), the classic "layers." |
| **Foundation Establishment** | Standard 5 sub-stages. *Graded* (see §4 quality coupling). |
| **Core Formation / Golden Core** | *Quality grades*: Cracked → Lower → Middle → Upper → **Perfect**. The core is a permanent carried artifact (see §5). |
| **Nascent Soul** | Early … Great Circle / Apex / Perfected (7). The soul gains independence. |
| **Soul Formation** *(a.k.a. Spirit/Deity Transformation)* | Extended sub-stages. **Act I capstone.** |

### Act II — Severing the Mortal *(knob A — standard upper-tier picks)*

| Realm | Notes |
|-------|-------|
| **Spirit Severing** | Cutting the three mortal corpses/attachments. |
| **Void Refinement** *(a.k.a. Dao Seeking)* | Direct perception of the void. |
| **Body Integration** *(a.k.a. Unity)* | Self and energy fuse. |
| **Mahayana** *(Great Vehicle)* | Preparation for tribulation. **Act II capstone.** |

### Act III — Immortal Ascension

| Realm | Notes |
|-------|-------|
| **Tribulation Transcendence** | The Heavenly Tribulation gate — a set-piece, not a grind. |
| **Immortal Ascension** | Crossing into immortality. |
| **True Immortal → Golden Immortal → Grand Immortal** | The recognizable "Immortal +N" tiers. |
| **Dao Ancestor / Transcendence** | Endgame — cultivation itself ceases to apply. |

Branch system running alongside the whole ladder: **Domain / Heavenly Concept** — see §3.

---

## 3. Support systems [STRUCTURE, informed by reference]

Orthogonal systems that gate and texture the vertical climb.

- **Sect ranks.** Descending ladder (Rank 9/10 = newest disciple → Rank 1 = peak), roles tiering with realm: Outer → Inner → Core → Elder → Leader. High realms claim single-digit ranks. *Implemented as checkpoints, not resets (§6.1).*
- **Domain / Heavenly Concept.** One concept-pick per major realm reached; effects stack. A branch tree parallel to the ladder — the build-defining specialization axis. **Open design question:** light flavor-pick vs. a full second tree on the scale of the cultivation ladder. This single decision determines whether Act I is one tree or two interleaved.
- **Professions.** Three exclusive crafting Daos unlocked mid-game (≈ Nascent Soul): **Alchemy** (pills → faster qi), **Artificer** (automation), **Talisman/Formation Master** (cheaper breakthroughs). One slot now, more open at higher realms.
- **Techniques.** Permanent learnable arts granted by clearing gate-events; small stacking multipliers and passive-generation unlocks.
- **Sect conflict / transfer.** Late macro layers — large-scale sect war and inter-sect rank portability.

---

## 4. Body Tempering & early cultivation — full ladder [OURS, expansion]

The canonical **Body Tempering** prelude is the natural home for the early systems the genre implies but most incrementals skip. Three interleaved sub-tracks, each a small loop gating the next breakthrough:

**a. Qi gathering (the spine).** Ambient qi → condensed/dantian qi → liquid qi. The visible "numbers go up." Baseline currency loop.

**b. Meridian clearing.** A discrete grid/sequence (canonically **twelve primary + eight extraordinary** — clean tier counts). Each cleared meridian permanently lifts a *cap or rate* on qi throughput (a multiplier with a real domain — you operate below it for a long stretch, satisfying §6.2) and gates minor stages (can't reach QC nth Level until N meridians open). Clearing costs qi + a consumable (impurity-flush), creating the first sink that competes with raw gathering — the early game's first real decision.

**c. Body purification / tempering (the canonical Body Tempering realm itself).** The "hard path" parallel to qi. Removes impurities in tiers (**Skin → Flesh → Tendon → Bone → Marrow**); each tier raises a *foundation-quality* stat that determines how high your eventual Core can be graded.

**Quality coupling (the hook).** Breakthroughs aren't pass/fail, they're *graded*. Foundation grade = f(meridians cleared, body-tempering tier, qi purity) at breakthrough; Foundation grade then sets the ceiling on Core grade (§2 quality ladder). Early diligence compounds 100+ realms later — the strongest fantasy the genre offers and the thing flat incrementals lack.

---

## 5. Core Formation & refinement [OURS, expansion]

Make the first formed core the early game's strategic set-piece, since you carry it upward forever.

- **A forge, not a breakthrough.** Spend accumulated liquid qi + materials in a one-time condensation whose *output grade* (Cracked → Perfect) is set by §4 prep plus a controllable **risk/reward push** (spend more → higher expected grade, higher crack chance → core drops a grade rather than destroying progress; never a hard wall, per §6.3).
- **Refinement loop.** Post-formation, the core is slowly refinable upward (warming/tempering through use) — a reason to *linger* in Core Formation and a sink for overflow qi. Caps one grade below "perfect-via-reforge," so early diligence still matters most.
- **Stat hub.** Core grade is a global multiplier feeding Nascent Soul and up — observable across many later states (no dead multiplier).

---

## 6. Design constraints — hard invariants [OURS]

The failures diagnosed in the reference, turned into rules.

1. **Story gates are not challenges.** Narrative breakthroughs (tournaments, promotions, tribulations) are *checkpoints* that read live state and reset nothing. The challenge/trial primitive — inherently reset-based — is reserved for genuinely optional, repeatable runs that grant permanent buffs. (The reference soft-locked because it forced story beats through a reset-based primitive, then papered over the reset with a snapshot system that fought the goals.)
2. **No dead multipliers.** Any cost/gain multiplier keyed on condition X and applied only to things reachable under X is a price floor in disguise — fold it into the base. Lint the balance table for this in one pass.
3. **Completability invariant.** For every gated objective, assert the goal is reachable *under that gate's own active modifiers* from a fresh entry. No "win condition requires the resource the gate suppresses."
4. **Balance as data.** Realm costs, sub-stage thresholds, multiplier sources, gate conditions, and the realm ladder itself live in one typed config driving both UI and math — so invariants 2–3 are machine-checkable and knobs A/B are config flips, not rewrites.
5. **Early choices echo late.** Body-tempering / meridian / qi-purity decisions in the first hour set ceilings (core grade → realm grades) still felt in Acts II–III.
6. **Meta-prestige is never a ransom.** Optional meta systems (reincarnation loops, optional challenge runs, stances) are accelerants and variety, never requirements: every gated objective is reachable, within its act's tuned pacing budget, without engaging any optional meta system. Distinct from invariant 3 (completability under a single gate's own modifiers) — this constrains the meta loop as a whole. Machine-checked by a no-meta pacing-sim run. *(Added per `cultivation-design-expansion-v0.1.1.md` §3.)*

---

## 7. Build order [OURS]

1. Data layer + invariant linter (nothing dead or uncompletable can ship).
2. Act I main tree, vertical only (Body Tempering → Soul Formation), graded breakthroughs.
3. Early sub-systems (§4–5): meridians, body tempering, core forge/refine — the part the reference can't teach us.
4. Sect ranks as *checkpoints* (§6.1), then Domain + Professions as the specialization layer.
5. Act II once the Act I economy is tuned and provably completable end-to-end.
