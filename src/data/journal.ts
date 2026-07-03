// src/data/journal.ts — the narrative journal (design §1.6, ETERNAL scope).
//
// Port of js/data/journal.js. The journal is the game's story-gate flavor
// channel (§1.6). It is the first ETERNAL-scoped side layer: entries latch
// into journal state once their `when` condition is met and NEVER re-lock, even
// across reincarnations (§8.1 — journals and achievements are eternal).
//
// Ordering: chronological by when a player would unlock them, earliest first.

import type { HintCondition } from '@/engine/meets'
import type { JournalEntryKey } from '@/engine/types'

/** Optional reflection reward (SCAFFOLD); delivered ONCE on first Reflect. */
export type JournalBonus =
  | { readonly qi: number }
  | { readonly achievement: [string, number] }

export interface JournalEntry {
  readonly key: JournalEntryKey
  /** Latch condition (HintCondition grammar — supports shadow keys). */
  readonly when: HintCondition
  readonly title: string
  /** 1-3 sentences. Second person, restrained, genre-honest. */
  readonly text: string
  readonly bonus?: JournalBonus
}

export interface JournalData {
  readonly id: 'journal'
  readonly name: string
  readonly symbol: string
  readonly color: string
  readonly entries: readonly JournalEntry[]
}

export const JOURNAL_DATA: JournalData = {
  id: 'journal',
  name: 'Journal',
  symbol: '卷',
  color: '#8ab87a',
  entries: [
    {
      key: 'firstBreath',
      when: { layerUnlocked: 'q' },
      title: 'First Breath',
      text: 'You draw in the ambient qi and feel it, for the first time, listen. It is thin and reluctant, but it moves. That is enough.',
      bonus: { qi: 100 },
    },
    {
      key: 'firstMeridian',
      when: { meridians: 1 },
      title: 'A Channel Opens',
      text: 'The first meridian yields after long persistence. A cold brightness runs the length of your arm, then settles. The body remembers what the mind barely grasps.',
      bonus: { qi: 100 },
    },
    {
      // Slice 8.5: the first Deep Meditation rung is purchasable minutes in
      // (q reached, 500 Qi) — the entry sits early with the other firsts.
      key: 'deepMeditation',
      when: { seclusionRungs: 1 },
      title: 'The Door Closes',
      text: 'You learn to leave the breath running like a banked fire and step away from yourself. When you return, the qi has kept its own count. Seclusion, the old texts call it — the discipline of trusting your own depths unattended.',
    },
    {
      key: 'foundationReached',
      when: { realm: ['f', 'Early Foundation'] },
      title: 'Foundation Laid',
      text: 'The Foundation is the first honest reckoning with what you are made of. What you built these past weeks either holds now, or it doesn\'t.',
    },
    {
      key: 'corruptionTouched',
      when: { corruption: 1 },
      title: 'A Voice That Is Not Yours',
      text: 'Somewhere beneath the breath you rushed, something takes root and starts to count. It says nothing yet. You find yourself listening for it anyway.',
    },
    {
      key: 'outerDisciple',
      when: { achievement: ['gate', 11] },
      title: 'Outer Disciple',
      text: 'A sect elder looks you over, says nothing for a long moment, then nods. You are Outer Disciple now, the lowest rung and the first foothold. You have been seen.',
    },
    {
      key: 'firstGlimpse',
      when: { realm: ['q', '4th Level'] },
      title: 'A Shape in the Dark',
      text: 'Between breaths, in the space where qi thins to nothing, something vast and nameless holds still just long enough to be noticed. You do not understand what you saw. You know you will look again.',
    },
    {
      key: 'coreForged',
      when: { realm: ['c', 'Core Forged'] },
      title: 'The Core Holds',
      text: 'The furnace-light fades. In your dantian, something crystalline and permanent settles into place. The Golden Core is yours alone, the weight of every meridian you opened and every impurity you burned away. This is the thing that will outlast the rest.',
    },
    {
      key: 'firstDaoHeart',
      when: { daoHeartStacks: 1 },
      title: 'What Did Not Break You',
      text: 'The voice pressed its case and you sat with it until it had nothing left to say. It does not leave for good — nothing that far in ever does — but something in you has hardened where it used to give. Call it a scar with a better shape.',
    },
    {
      key: 'firstExpedition',
      when: { secretRealmClears: 1 },
      title: 'Between the Folds',
      text: 'The hidden site closed behind you the way a held breath closes, and what you carried out was real: herb, crystal, or something stranger, warm still with a world that should not exist. You will go back. It will not be there when you look for it the same way twice.',
    },
    {
      key: 'professionChosen',
      when: { professionChosen: true },
      title: 'The Alchemist\'s Bench',
      text: 'You choose the cauldron over the forge-hammer and the ward-brush, not because the others call less loudly, but because this is the one whose failures you can already taste. A profession is a second discipline grafted onto the first. It asks for its own patience.',
    },
    {
      key: 'sectJoined',
      when: { sectJoined: true },
      title: 'You Belong Somewhere Now',
      text: 'The formalities are brief: a token, a bow, a name written in a ledger. What lingers is the weight of it. You have chosen a path among paths, and the sect has chosen you back.',
    },
    {
      key: 'nascentSoul',
      when: { realm: ['n', 'Early Nascent Soul'] },
      title: 'The Soul Stirs',
      text: 'You expected a wall. Instead there is a door, and on the other side of it something looks back at you. Not a stranger, but a version of yourself you have not yet earned. The nascent soul has awakened. It is waiting.',
    },
    {
      key: 'aspectChosen',
      when: { realm: ['n', 'Early Nascent Soul'], anyDaoNode: 1 },
      title: 'A Form in the Formless',
      text: 'The soul does not announce what it has become. You simply notice, one morning, that your qi moves differently, shaped now by something that has always been you but was never spoken aloud.',
    },
    {
      key: 'lateNascentSoul',
      when: { realm: ['n', 'Late Nascent Soul'] },
      title: 'The Long Interior',
      text: 'The soul matures in silence. You have stopped counting the breakthroughs; what matters now is the quality of attention you bring to each one. The mountain has not gotten smaller. You have gotten larger.',
    },
    {
      key: 'allMeridians',
      when: { primaryMeridiansAll: true },
      title: 'The Twelve Channels',
      text: 'The last primary meridian opens with less drama than you expected, a quiet unlocking, like remembering a word you always knew. The body is as ready as it can make itself. The rest is up to the soul.',
    },
    {
      key: 'soulFormationEntered',
      when: { layerUnlocked: 's' },
      title: 'The Shape of the Final Step',
      text: 'The soul does not complete its formation by climbing. It completes it by enduring. You have reached the Apex of the Nascent Soul. What waits beyond is not a wall but a question: what are you made of, when heaven itself decides to find out?',
    },
    {
      key: 'tribulationPassed',
      when: { tribulationPassed: true },
      title: 'Through the Storm',
      text: 'The final wave broke and the pool held. Not without cost. Your qi ran thin, your soul bent in ways it had never bent. But it held. The tribulation is behind you, and something it left in you will not leave.',
    },
    {
      key: 'scarTaken',
      when: { scarActive: true },
      title: 'The Mark It Left',
      text: 'The wound is not visible from the outside. You know it by the way your qi moves differently now, heavier in one place, thinner where it was not thin before. The scar is real. So is the path through it.',
    },
    {
      key: 'scarHealed',
      when: { scarHealed: true },
      title: 'Tempered by Ruin',
      text: 'The weight is gone. Not just the wound. Something settled where the wound was. What the tribulation scarred, cultivation healed into something harder, and what is harder now will not crack the same way again.',
    },
    {
      key: 'actOneLegacy',
      when: { tribulationPassed: true },
      title: 'What the Road Records',
      text: 'The road does not forget what you did on it. The core you forged, the aspect your soul chose, the tribulation you survived: all of it written now in the eternal record. This is the first line of your legacy. There will be more.',
    },
    {
      // Slice 9: Act II's arrival. tribulationPassed is now core meets()
      // grammar (promoted from the hint shadow set in slice 9) — the second
      // act opens on the same crossing that writes the Act I legacy.
      key: 'actTwoOpens',
      when: { tribulationPassed: true },
      title: 'The Second Road',
      text: 'Soul Formation behind you, the mortal road ends and a stranger one begins. Three corpses wait at Spirit Severing\'s gate, each one a piece of what you built. What you cut away will not be gone. It will only be waiting, three lives from now, transcended.',
    },
    {
      key: 'firstManifestation',
      when: { anyDaoNode: 3 },
      title: 'A Truth Made Real',
      text: 'The lattice yields something it has never given before: not a Glimpse, not a Seed, but a Manifestation, a Dao truth wearing flesh. You did not know comprehension could go this deep. Now you do, and it can be severed.',
    },
  ],
}

export function findJournalEntry(key: JournalEntryKey): JournalEntry {
  const row = JOURNAL_DATA.entries.find((e) => e.key === key)
  if (!row) throw new Error(`Unknown journal entry key: ${key}`)
  return row
}
