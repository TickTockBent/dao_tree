# Golden saves — the version lineage

One fixture per shipped version, capturing a real mid/late-progress save **as
that version's own code serialized it**. `golden-saves.test.ts` loads every
fixture through the full revive path (migrations → merge over fresh defaults →
Decimal hydration → `applySave`) on current HEAD, ticks the game, and asserts
the run survives. This is the Steam soft-yes consequence (ledger #9a): save
compatibility is proven in CI before every change, not discovered by players.

## Rules

1. **Never edit a shipped fixture.** A golden is a historical artifact; if it
   fails, HEAD broke compatibility — fix HEAD or write a migration, and only
   change the fixture's `expect` block if the migration legitimately transforms
   the expected value (say so in the commit).
2. **Every release adds a golden.** Before tagging `itch-x.y.z`, run
   `npx tsx scripts/generate-golden.ts x.y.z > src/save/goldens/x.y.z.json`
   and commit it with the release.
3. Backfilled goldens (0.3.0, 0.4.0, 0.4.1) were generated from git worktrees
   at their `itch-*` tags using each tag's own store code — authentic
   serializations, not reconstructions.

## Fixture format

```json
{
  "version": "0.4.1",
  "note": "one line describing the progression state captured",
  "save": { "...": "the serialized PlayerSave exactly as writeSave stores it" },
  "expect": [
    { "path": "realms.c.best", "gte": 3 },
    { "path": "seclusion.rungs.0", "equals": "q" }
  ]
}
```

- `save` — the raw serialized save (Decimals as strings) as written by that
  version. Must include `versionType: "dao-tree"` and its `saveVersion`.
- `expect` — dotted-path assertions evaluated against the save **rebuilt from
  live stores after loading** (`buildSave()` post-`applySave`), proving the
  state survived the round trip into current HEAD. `gte` compares numerically
  (Decimal-aware for string values); `equals` is strict deep equality.
