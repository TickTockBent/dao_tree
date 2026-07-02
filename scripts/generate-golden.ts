// scripts/generate-golden.ts — golden-save fixture generator.
//
// Usage: npx tsx scripts/generate-golden.ts <version> > src/save/goldens/<version>.json
//
// Boots the full store stack headlessly (bootTestStores, same wiring as the
// app), drives a DETERMINISTIC scripted progression through the real store
// APIs to a representative mid/late-Act-I state, then prints the fixture JSON
// (format: src/save/goldens/README.md) to stdout. Run this against HEAD right
// before tagging a release; for backfills, copy it into a worktree at the tag
// and adapt to that tag's store APIs.
//
// The progression script must be:
//   - deterministic (no Date.now/Math.random in what it captures — the save's
//     time/timePlayed fields are stamped but excluded from golden `expect`s)
//   - representative (exercise every slice the version ships: realms climbed,
//     meridians/temper bought, lattice nodes, sect joined + contribution,
//     forge done, and for 0.4.x: a secret-realm clear, crafted pills, some
//     corruption, seclusion rungs)
//   - cheap (< a few seconds — it runs per release, not per test)
//
// IMPLEMENTATION: skeleton stub — the implement pass fills runProgression()
// with the scripted state drive and the expect-block derivation.

function main(): void {
  const version = process.argv[2]
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Usage: npx tsx scripts/generate-golden.ts <x.y.z>')
    process.exit(1)
  }
  console.error('generate-golden: not implemented yet (skeleton stub)')
  process.exit(1)
}

main()
