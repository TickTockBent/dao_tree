# Dao Tree — Horizons v0.1

*Dreaming document, drafted by Claude during the slice 7/8 autonomous run (2026-07-01), at Wes's request: "we want this to be rich with a long tail. this whole thing is the first vertical slice and we will broaden and deepen it later. spend some time dreaming on future goals." Everything here is proposal, not plan — react, cut, steal. Companion to `cultivation-design-expansion-v0.1.1.md` (the committed design) and the build order (§11 there). Items already scheduled in the build order are only mentioned where the dream goes BEYOND them.*

---

## 0. The frame

What exists after slice 8 is a **vertical slice of a life**: one act, one tree, every grammar represented at its smallest honest size — the climb (realms), the comprehension graph (lattice), the standing (sect), the set-pieces (forge/tribulation), the optional meta (secret realms, alchemy), the permanent tension (heart demons), the eternal record (journal, legacy). The long game is not more of these bolted sideways; it is the same grammars **recurring at larger scales with memory** — a life, then lives, then lineages, then the world itself as the progression surface.

The one-sentence north star I'd propose: **every number the player grows should eventually become a *choice* they spend.** Qi becomes breakthroughs; breakthroughs become grades; grades become legacy; legacy becomes the next life's shape; lives become the lineage's inheritance. Nothing terminal, everything convertible. That's what "long tail" means mechanically — no stat is ever done mattering.

## 1. Deepening the life (Act I broadening, post-alpha)

Cheap-to-build richness inside content that already exists:

- **Named lattice constellations.** Owning specific node *sets* (all five roots; sword+edge+stillness; life+death) grants named passive identities ("Five-Rooted", "the Quiet Blade") with small effects and journal recognition. Pure data over the existing graph; makes lattice choices feel like build *statements*. Cheap, high texture.
- **Sect life beyond the stipend.** Rotating sect *requests* (deliver N materials, clear a specific realm site, hold a stance for an hour) paying contribution multipliers — the sect asking things of *you* makes standing feel bilateral. Reuses the expedition/request shape.
- **Forge lineage.** The crack history of your core (how many Forceful/Reckless attempts, cracks taken) is already implicit state — surface it as the core's *temper story* in the journal and let a future act's set-piece read it ("a core that remembers being pushed").
- **The Inverted Spirit Land's real modifier.** The deferred "qi gains from spending" needs spend-path hooks — worth building eventually because inversion modifiers are a whole family (gain-from-spending, cost-from-time, progress-from-stillness) that make later realm sites feel alien rather than re-skinned.
- **Ancestral knowledge (Wes's planned system).** Family/lineage skills across lives; gate foundation/core *quality visibility* behind it — the first life you can't even see what a grade means; your descendants inherit the appraiser's eye. This is the model for a whole class of "knowledge as unlockable UI" features: the interface itself as progression.

## 2. The meta loop (Samsara and after — slices 10+ dreams)

The committed design has Samsara v1 (karma, roots, memory fragments). The dreams past it:

- **Lives as runs with shape, not just resets.** Root configuration + karma + legacy grade should make each life *feel* different in its first ten minutes, not just its ceilings: a five-element mortal-root life starts wide and slow with different early hints; a single-element heaven-root life rushes its lattice line. The hint cascade and journal are already per-state — they can narrate different lives differently for nearly free.
- **The Eternal Record as the true scoreboard.** Journal + legacy grades are eternal already. Extend to a *chronicle*: every life gets one generated epitaph line (realm reached, grade, how the tribulation went, what was severed). A hundred-life save should read like a dynasty history. This is the long tail's emotional engine — you're not grinding multipliers, you're writing a book.
- **Transcendence as the severing meta.** (Committed: sever the same attachment three lives → permanent.) Dream extension: transcended attachments become *Authorities* fuel in Act III — the thing you gave up three times is the thing you finally command. Loss literally converts to power, the genre's deepest loop.
- **Karma as a market, not a meter.** Demonic speed borrows against future tribulation intensity; orthodox patience lends. Let late-game players *see* the ledger and make informed deals with heaven. Pairs with heart demons: the same rush-vs-grade decision at life scale.

## 3. The world as progression surface (Act III+ dreams)

- **Sect wars & world events** on long real-time cadences (days) — the idle game's social heartbeat, even single-player: the world moves while you're away, and your standing/formations determine what you return to. Formations profession = your *offline defense*, finally making Formations mechanically distinct from Artifice.
- **Faith/Authorities** (committed for Act III) dream: authority over a *domain* (rivers, oaths, boundaries) changes global rules the way stances change personal ones — the player graduates from occupying states to *authoring* them. The five-element mortal-root "trash protagonist" payoff lands here.
- **Other cultivators as weather.** Not NPCs to fight — named rivals whose own climbs occasionally cross yours (they take a secret realm rotation slot, their tribulation lights the sky and surges ambient Insight). The world feels inhabited at data-table cost.

## 4. Keeping every value in range forever (the sim as the co-designer)

Wes's directive — "sim along the way to keep all values and choices in range" — deserves infrastructure, not vigilance:

- **Per-act pinned budget bands** (the Gate-D discipline, recurring): every act gets diligent/spine-only/max-adversity profiles with signed-off bands; `npm test` fails when content lands out of range. Acts II/III budgets get pinned at their own gates.
- **Choice-viability assertions, not just time bands.** "Every soul aspect is picked by at least one profitable policy"; "no lattice line is strictly dominated"; "Forceful forge has positive expected value for some real profile." The sim proving *choices stay choices* is the mechanical meaning of "rich": a dominated option is dead content the lint can catch.
- **A fuzz actor.** Alongside the named policies, a seeded deterministic actor making legal-but-arbitrary choices, asserting only invariants (never stuck, never NaN, every gate eventually reachable). Cheap coverage of the state-space corners the competent policies never visit.
- **Save-lineage harness.** Long tail = old saves must load forever. Golden saves from each shipped version, loaded and ticked in CI through every migration. Build it before 1.0, while the save count is small.

## 5. Production horizons

- **Ship cadence:** itch stable + Pages bleeding-edge is right. Alpha feedback wants one in-game touch: a feedback link + an export-save button next to it (bug reports with saves attached are gold). Steam is the eventual home for a long-tail idle game (achievements, cloud saves, the wishlist long game) — worth deciding *before* Act III scope-locks.
- **Devlog rhythm:** the journal entries are already written in a voice worth publishing; slice-by-slice devlogs on itch quoting them would market the game with content that already exists.
- **Accessibility/format:** the Vue port made mobile-web viable (the TMT UI never was). A phone-playable Dao Tree with offline progression is a different (larger) audience; worth a layout pass before broadening content.

## 6. Open questions for Wes (react when convenient)

1. **Chronicle/epitaph system** (§2): worth promoting into the Samsara slice itself? It's cheap there and shapes what state Samsara must keep.
2. **Rivals-as-weather** (§3): in or out of scope for this game's identity? It changes the fantasy from solitary to inhabited.
3. **Steam intent** (§5): a yes/no changes save-migration and achievement architecture *now*, cheaply; later, expensively.
4. **Choice-viability lint** (§4): I want to build the first one during the next tuning pass (aspect viability). Green-light?
5. **Ancestral knowledge** (§1): which act's gate does the first knowledge-veil land on — Act I grades hidden from life 1, or start gentler?

*Nothing above commits anything. The build order (§11) remains the plan of record through slice 12.*
