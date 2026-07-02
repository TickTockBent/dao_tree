# Dao Tree — Deferred Decisions

*Compiled 2026-07-02 for Wes's review, at the close of the slice 7/8/8.5 run. Each entry: what's parked, why it matters, and my lean where I have one. Strike entries as you decide them; this file is the living ledger (the old design docs live in git history — `git show 5887814:docs/<name>`).*

## Design decisions — worth deciding before or during slice 9 (Act II)

1. **Aspect routes are lattice-locked.** Element Soul Aspects require a held lattice Seed, so sect-focused and pill-focused builds are structurally confined to Formless (the build-diversity sim run will price this in). Decide: is "the lattice owns aspect identity" intended build texture, or should other systems eventually offer an aspect route (e.g., a sect-bestowed aspect, a pill-awakened one)? *Lean: keep lattice-locked through Act II — it gives the lattice a monopoly worth having — but revisit if the cluster ratio shows sect/pill builds badly lagging and the Formless penalty is the cause.*

2. **Keep-rule topology gaps (found by the competent-actor sim).** No keep rule ever protects `c` (Core Formation climb), and the `foundationSurvivesNascentSoul` keep is immediately re-wiped by each cycle's own c-climbs — so late-game play re-climbs c forever. ~30% of the competent actor's n-climb time is this churn. Decide: add a c keep rule (e.g., n milestone), accept the churn as intended texture ("the core must be re-tempered each ascent"), or fold into Act II's keep design. *Lean: decide inside slice 9's keep-rule work, not before — Act II's Spirit Severing will restructure what "keeping" means anyway.*

3. **Corruption threshold ratchet.** Crossed heart-demon thresholds never re-arm: bleed corruption to zero and the old trials don't re-fire; the ladder only ratchets upward (then repeats its final trial every +120). Intended reading: each demon is faced once, then only the deepest returns. Alternative: cyclical trials (re-arm on full bleed-out) for farmability. *Lean: current ratchet is correct — Dao Heart farming already exists via the repeat ladder; re-arming would make bleed-out a farming exploit.*

4. **Tribulation banked-Qi fuel vs automation.** The preparedness pool's banked-Qi term rewards holding a large pile at trigger time, while auto-q-prestige (Automation Tier 1) continuously spends the pile. Currently self-resolving in practice (the maturity model rests when formed), but nothing *guarantees* automation never eats a tribulation bank. Carried from the TMT-era review as "acceptable v1, flag for design." *Lean: leave until a real player report; a guard (automation pauses while `tribulationIsReady`) is a two-line data/store change if it ever bites.*

5. **"Qi gains from spending" expedition modifier.** The design doc's Inverted Spirit Land example needs spend-path hooks the engine doesn't have; v1 shipped an Insight-driven inversion instead. The idea is recorded in `secret-realm.ts`'s header as a modifier family (gain-from-spending, cost-from-time, progress-from-stillness) for future sites. *Lean: build the spend-hook plumbing when Act II adds its realm sites, not before.*

## Decisions scheduled for slice 10 (Samsara)

6. **Dao Heart stacks across reincarnation.** Currently life-scoped. Promote to eternal (the trials were faced by the soul), or reset per life (each life faces its own demons)? *Lean: eternal — matches the "permanent" language in the design and the demonic-build farming fantasy; but this is exactly the kind of choice Samsara's economy design should make holistically.*

7. **Seclusion rungs across reincarnation.** Shipped eternal by design intent ("QoL is never clawed back") — Samsara's implementation must honor it; recorded so the slice-10 implementer doesn't "helpfully" reset them. *Not really open — a confirmation checkpoint.*

8. **Chronicle / epitaph system** (horizons §2). One generated epitaph line per life; a hundred-life save reads as a dynasty history. Promoting it INTO the Samsara slice is cheap there and shapes what state Samsara must keep from each life. *Lean: yes, promote — it's the emotional engine of the meta loop and costs a data table + one formatter if designed alongside Samsara rather than after.*

## Strategic (timing matters more than the answer)

9. **Steam intent.** The research doc's Melvor case validates premium-Steam for exactly this design. Deciding *now* is cheap and shapes save-migration + achievement architecture before Act II content multiplies; deciding later is expensive. Also gates which pacing number we polish (the Realistic experience band is the Steam-defensible figure).

10. **Rivals-as-weather** (horizons §3). Named NPC cultivators whose climbs occasionally intersect yours (take a rotation slot, light the sky). Changes the fantasy from solitary to inhabited — identity-level call, in or out.

11. **Knowledge-veil / ancestral knowledge** (Wes's planned system). Which act boundary gets the first veil — Act I grades hidden from life 1 (aggressive), or a gentler first application? Shapes UI architecture (interface-as-progression).

## Technical debt (recorded, not urgent)

12. **Negation in `meets()`.** Nine hint-shadow keys now exist (`sectUnjoined`, `secretRealmUnexplored`, `demonTrialActive`, …); the recorded rule-of-thumb said shadow-grammar growth should have triggered adding negation to the core grammar two keys ago. Next hint-grammar touch should pay this down: one `not:` combinator retires most shadow keys. (Noted in `meets.ts`.)

13. **Pacing bands — pin after calibration.** Three bands, three jobs, pending the build-diversity run now in flight: cluster-ratio band (build diversity), Competent band (regression floor), Realistic band (experience target). Numbers come to you for sign-off before any assertion hardens.

14. **Sim coverage notes.** Extraordinary meridians (up to ~×7.45) engaged by no profile; the Heaven-Warding pill's pool effect is smoke-tested but outside the sim (sim stops at the tribulation trigger); gate achievements' store is never ticked by the sim. All are honest-coverage gaps, none block.

## Housekeeping

15. **README rewrite.** Still TMT boilerplate + a Verification section; last file describing the project as something it isn't. *Offered — on your nod.*

16. **`LICENSE` + `Prestige-tree-license`.** Both upstream MIT. HEAD contains no TMT code since 0.3.0, but repo history distributes it. *Lean: keep both — zero cost, removes a legal judgment call.*
