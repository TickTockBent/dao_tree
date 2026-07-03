// src/data/trees.ts — persistence-scope + tree-membership registry (design §8.1, §1.1).
//
// Port of js/data/trees.js. ONE table replaces ~20 scattered per-layer reset
// guards: tree membership and reset scope are declared as data, compiled by
// engine/doReset.ts, and the linter proves no tree's reset closure leaks into a
// life/eternal layer.
//
// Every registered system/layer MUST appear in `layers` with a scope; the
// engine hard-fails (defense in depth ahead of the linter) if it encounters a
// layer with no entry here.

import type { CrossTreeKeepKey, LayerId, Scope, TreeId } from '@/engine/types'

export interface TreeRow {
  readonly id: TreeId
  readonly name: string
}

export interface LayerScopeEntry {
  /** "tree" | "life" | "eternal". */
  readonly scope: Scope
  /** Required iff scope === "tree"; references trees[].id. Forbidden for life/eternal. */
  readonly tree?: TreeId
}

export interface TreeData {
  readonly trees: readonly TreeRow[]
  /** Every registered layer id → its scope entry. */
  readonly layers: Readonly<Record<LayerId, LayerScopeEntry>>
}

export const TREE_DATA: TreeData = {
  trees: [
    { id: 'act1', name: 'Act I: The Mortal Road' },
    // Slice 9: Act II opens with Spirit Severing. A separate tree means the
    // doReset cascade can NEVER cross the act boundary in either direction
    // (same-tree guard in engine/doReset.ts) — Act I state survives Act II
    // resets topologically, not by keep-rule exception.
    { id: 'act2', name: 'Act II: Severing the Mortal' },
  ],
  layers: {
    q: { scope: 'tree', tree: 'act1' },
    f: { scope: 'tree', tree: 'act1' },
    c: { scope: 'tree', tree: 'act1' },
    n: { scope: 'tree', tree: 'act1' },
    s: { scope: 'tree', tree: 'act1' },
    x: { scope: 'tree', tree: 'act2' },
    b: { scope: 'life' },
    gate: { scope: 'life' },
    dao: { scope: 'life' },
    sect: { scope: 'life' },
    journal: { scope: 'eternal' },
    legacy: { scope: 'eternal' },
    // Slice 7: both survive every realm breakthrough (life-scoped, members of no
    // tree). The secret-realm EXPEDITION run-state additionally resets on
    // expedition entry — a LOCAL scope handled inside the store, deliberately
    // outside this registry (design §6.4: nothing outside the expedition resets).
    secret: { scope: 'life' },
    alchemy: { scope: 'life' },
    // Slice 8: corruption + Dao Heart stacks survive realm breakthroughs
    // (the permanent anti-rush tension, §7.4). Samsara carry is a slice-10
    // decision — eternal promotion recorded as an open question there.
    demons: { scope: 'life' },
    // Slice 8.5: Deep Meditation rungs are ETERNAL — QoL is never clawed back,
    // not by cascade and (design intent) not by reincarnation. The soul
    // learned to cultivate unattended; a new body does not unlearn it.
    seclusion: { scope: 'eternal' },
    // Slice 9: soul-scoped accumulators (ascent counter + severance ritual,
    // D21/D23/D25). 'eternal' here is the pre-Samsara encoding of the SOUL
    // accumulator scope (docs/architecture.md) — slice 10's differentiation
    // audit (open-questions Q6) assigns it explicitly.
    soul: { scope: 'eternal' },
    // Slice 9: active severances are LIFE-scoped — severed things return next
    // life (D23). The severance HISTORY (three-lives transcendence, D24)
    // lives on the soul slice, not here.
    severing: { scope: 'life' },
  },
}

// ---- §5 cross-tree keeps (docs/slice-9.md §5) ------------------------------
//
// "Act II's tree reads Act I state through explicit keep-rules — every
// Act I → Act II dependency is DECLARED, not emergent." KEEP_RULES (above,
// keep-rules.ts) is the exception mechanism WITHIN tree scope (a realm keeps
// a lower realm's `best`/`milestones` across its own tree's cascade).
// CROSS_TREE_KEEPS is a DIFFERENT, additional surface: it declares every
// place Act II code reads a fact that originated in Act I (or in a
// pre-existing life-scoped system Act I built out, e.g. the Dao lattice or
// the Alchemy profession slot) — regardless of whether that fact is
// tree-scoped, life-scoped, or eternal. Nothing about persistence scope
// forces this to be declared; only this table + the lint below does.
//
// DISCIPLINE: any future Act II addition that reads Act I (or Act-I-adjacent
// life-scoped) state MUST add a row here. The lint in rules.test.ts
// ('§5 cross-tree keeps') enforces the mechanically-checkable subset:
//   - every clause key an act2-tree realm's reveal/unlock condition uses must
//     appear as some row's `reads` value (auto-iterated off TREE_DATA/
//     REALM_DATA — a future act2 realm with an undeclared read fails);
//   - every row's `reads` value is itself well-formed: a valid
//     ConditionClauses key, or a dotted store descriptor ("store.field");
//   - the doReset cascade (engine/doReset.ts's treeResetKeepKeys) never
//     lets a realm reset a realm in a different tree — the runtime
//     same-tree guard, re-checked here as a data invariant over every
//     REALM_DATA pair.
// What the lint CANNOT check: that a store-level `reads` descriptor (e.g.
// "body.soulAspect") is actually the field a consumer reads — that's a
// code-review discipline, not a data-shape one. It also does not, and
// cannot without inventing false precision, distinguish an Act I entry that
// merely RECORDS a fact (e.g. the journal's own `tribulationPassed` entry)
// from an Act II entry that CONSUMES it (`actTwoOpens`) purely from the
// clause key — both use the same key. Only rows for genuine Act II
// consumers are declared below; Act I's own record-keeping of its own facts
// is not a cross-tree read and is deliberately NOT enumerated here.

export interface CrossTreeKeepRow {
  readonly key: CrossTreeKeepKey
  /**
   * The Act I (or Act-I-adjacent life-scoped) state read. Either a
   * ConditionClauses key (meets()-expressible — e.g. 'tribulationPassed') or
   * a dotted store descriptor ("store.field", e.g. 'body.soulAspect') for
   * reads that bypass meets() entirely (raw store getters).
   */
  readonly reads: string
  /** What Act II thing reads it. */
  readonly consumer: string
  /** One-line rationale. */
  readonly rationale: string
}

export const CROSS_TREE_KEEPS: readonly CrossTreeKeepRow[] = [
  {
    key: 'realmXTribulationGate',
    reads: 'tribulationPassed',
    consumer: 'realm x (Spirit Severing) reveal/unlock',
    rationale: 'Act II\'s first content only reveals/unlocks once Act I\'s tribulation is crossed (D11 — veil the ahead, never the now).',
  },
  {
    key: 'daoManifestationGate',
    reads: 'tribulationPassed',
    consumer: 'dao store tribulationGateMet() — Manifestation tier + ring-3 node buy gate',
    rationale: 'Manifestation-grade lattice power and whole ring-3 nodes are Act II-caliber content layered onto the pre-existing (Act I) lattice; gating them on the crossing keeps Act I\'s pinned pacing bands from moving.',
  },
  {
    key: 'journalActTwoOpens',
    reads: 'tribulationPassed',
    consumer: 'journal actTwoOpens entry',
    rationale: 'The journal entry announcing Act II\'s arrival latches on the same crossing that opens realm x.',
  },
  {
    key: 'severingSoulAspectRead',
    reads: 'body.soulAspect',
    consumer: 'severing store isAcquired/contributionOf (soulAspect severable)',
    rationale: 'The soulAspect severable\'s availability and its live contribution both read the Act I-chosen Nascent Soul aspect.',
  },
  {
    key: 'severingProfessionRead',
    reads: 'alchemy.professionChosen',
    consumer: 'severing store isAcquired (profession severable)',
    rationale: 'The profession severable is only available once Act I\'s profession slot has been picked.',
  },
  {
    key: 'severingExtraordinaryMeridiansRead',
    reads: 'body.extraordinaryMeridians',
    consumer: 'severing store isAcquired/contributionOf (extraordinaryMeridians severable)',
    rationale: 'The extraordinary-meridian severable\'s availability threshold and contribution magnitude both read the Act I body buyable count.',
  },
  {
    key: 'severingManifestationRead',
    reads: 'anyDaoNode',
    consumer: 'severing store isAcquired (manifestation severable)',
    rationale: 'The manifestation severable is available once any lattice node reaches the Manifestation tier (anyDaoNode >= 3) — the same tribulation-gated threshold as daoManifestationGate.',
  },
  {
    key: 'hintSeverSpiritRead',
    reads: 'anyDaoNode',
    consumer: 'hints severSpirit nudge',
    rationale: 'The hint pointing the player at Spirit Severing fires on the same Manifestation-reached signal (anyDaoNode >= 3) as the manifestation severable\'s own availability check.',
  },
]
