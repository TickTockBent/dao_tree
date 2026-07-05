// src/stores/epitaph.ts — the chronicle's voice (slice 10 step 7 / D8 + D37).
//
// A pure, data-driven rendering of one chronicle entry into an epitaph in D8's
// register ("Life 3: Reached Core Formation. Forged an Upper core. Severed the
// Flowing Form. Endured the Hollow Crown. Crossed at 212 karma."). It records a
// strategy executed across lifetimes, not a stat dump.
//
// THE CURATION RULE IS SCHEMA-LEVEL (D37): the entry's own richnessTier gates
// the depth — this renderer OBEYS the tier, it does not decide it (the karma
// receipt decided it at the crossing, in richnessTierFor):
//   - 'chapter' — the full account: every field that carries content.
//   - 'summary' — realm + best grade + the single most notable deed.
//   - 'line'    — one clause: realm + karma.
// So a thousand-life save reads like a dynasty history, not a log file.
//
// The FULL narrative treatment belongs to the narrative-spine pass (D8); this is
// the modest listing. Pure functions only — no store, no state.

import type { ChronicleEntry, ChronicleGrades, RichnessTier } from '@/stores/chronicle'
import type { Element, SeverableKey, TribGradeKey } from '@/engine/types'
import { findRealm } from '@/data/realms'
import { findSeverable } from '@/data/severing'
import { findDemonTrial, type HeartDemonTrialKey } from '@/data/heart-demons'
import { tribGradeByKey } from '@/data/setpieces'
import type { PurityGrade } from '@/data/rebirth'

/**
 * One rendered sentence of an epitaph. `transcendence` marks the dynasty's
 * biggest event class (D39) — the UI renders it with weight.
 */
export interface EpitaphClause {
  readonly text: string
  readonly transcendence: boolean
}

/** A whole life rendered to its tier. */
export interface Epitaph {
  readonly heading: string
  readonly tier: RichnessTier
  readonly clauses: readonly EpitaphClause[]
}

// ---- clause constructors ----------------------------------------------------

function plain(text: string): EpitaphClause {
  return { text, transcendence: false }
}
function weighted(text: string): EpitaphClause {
  return { text, transcendence: true }
}

/** "a"/"an" for the following word (vowel-initial → "an"). */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

/** Capitalize the first letter (for element names: 'fire' → 'Fire'). */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * The severable's bare NOUN — the display name with any leading "Sever (the)"
 * removed, so "Sever the Flowing Form" reads "Flowing Form" in "Severed the …".
 */
function severableNoun(key: SeverableKey): string {
  return findSeverable(key).name.replace(/^Sever (the )?/i, '')
}

/** The trial's bare noun — "Trial of the Hollow Crown" → "Hollow Crown". */
function trialNoun(key: HeartDemonTrialKey): string {
  return findDemonTrial(key).name.replace(/^Trial of (the )?/i, '')
}

/** Prose join: "Fire", "Fire and Water", "Fire, Water, and Earth". */
function joinElements(elements: readonly Element[]): string {
  const names = elements.map(capitalize)
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const head = names.slice(0, -1).join(', ')
  return `${head}, and ${names[names.length - 1]}`
}

// ---- per-field clauses (null when the field carried nothing) -----------------

function realmClause(entry: ChronicleEntry): EpitaphClause | null {
  return entry.realmReached ? plain(`Reached ${findRealm(entry.realmReached).name}.`) : null
}

function rootClause(entry: ChronicleEntry): EpitaphClause | null {
  const config = entry.rootConfig
  if (!config || config.elements.length === 0) return null
  const purity = `${capitalize(config.purity as PurityGrade)}-grade`
  return plain(`Bore ${article(purity)} ${purity} root of ${joinElements(config.elements)}.`)
}

function legacyClause(grades: ChronicleGrades): EpitaphClause | null {
  return grades.legacy ? plain(`Left a ${grades.legacy}.`) : null
}
function foundationClause(grades: ChronicleGrades): EpitaphClause | null {
  return grades.foundation ? plain(`Built a ${grades.foundation} foundation.`) : null
}
function coreClause(grades: ChronicleGrades): EpitaphClause | null {
  return grades.core ? plain(`Forged ${article(grades.core)} ${grades.core} core.`) : null
}
function tribulationClause(outcome: TribGradeKey | null): EpitaphClause | null {
  if (!outcome) return null
  const grade = tribGradeByKey(outcome)
  return plain(grade.passes ? `Passed the tribulation, ${grade.label}.` : 'Fell to the tribulation.')
}

/** One "Endured the …" clause per distinct trial type endured this life. */
function trialClauses(entry: ChronicleEntry): EpitaphClause[] {
  return Object.keys(entry.trialsEndured).map((key) =>
    plain(`Endured the ${trialNoun(key as HeartDemonTrialKey)}.`),
  )
}

/** "Severed the …" for every cut that was NOT transcended (those read below). */
function severanceClauses(entry: ChronicleEntry): EpitaphClause[] {
  const transcended = new Set<SeverableKey>(entry.transcendences)
  return entry.severances
    .filter((key) => !transcended.has(key))
    .map((key) => plain(`Severed the ${severableNoun(key)}.`))
}

/** "Transcended the …" — the biggest event class (D39), rendered with weight. */
function transcendenceClauses(entry: ChronicleEntry): EpitaphClause[] {
  return entry.transcendences.map((key) =>
    weighted(`Transcended the ${severableNoun(key)} — gone from every life to come.`),
  )
}

function karmaClause(entry: ChronicleEntry): EpitaphClause {
  return plain(`Crossed at ${entry.firstsReceipt.total} karma.`)
}

// ---- tier-specific selection helpers ----------------------------------------

/** The most-advanced grade the life earned (tribulation > core > foundation > legacy). */
function bestGradeClause(entry: ChronicleEntry): EpitaphClause | null {
  return (
    tribulationClause(entry.tribulationOutcome) ??
    coreClause(entry.grades) ??
    foundationClause(entry.grades) ??
    legacyClause(entry.grades)
  )
}

/** The single most notable deed (transcendence > severance > trial). */
function mostNotableDeed(entry: ChronicleEntry): EpitaphClause | null {
  return (
    transcendenceClauses(entry)[0] ??
    severanceClauses(entry)[0] ??
    trialClauses(entry)[0] ??
    null
  )
}

function compact(clauses: readonly (EpitaphClause | null)[]): EpitaphClause[] {
  return clauses.filter((clause): clause is EpitaphClause => clause !== null)
}

// ---- the account, by tier ---------------------------------------------------

function chapterClauses(entry: ChronicleEntry): EpitaphClause[] {
  return compact([
    realmClause(entry),
    rootClause(entry),
    legacyClause(entry.grades),
    foundationClause(entry.grades),
    coreClause(entry.grades),
    tribulationClause(entry.tribulationOutcome),
    ...trialClauses(entry),
    ...severanceClauses(entry),
    ...transcendenceClauses(entry),
    karmaClause(entry),
  ])
}

function summaryClauses(entry: ChronicleEntry): EpitaphClause[] {
  return compact([realmClause(entry), bestGradeClause(entry), mostNotableDeed(entry)])
}

function lineClauses(entry: ChronicleEntry): EpitaphClause[] {
  const total = entry.firstsReceipt.total
  if (!entry.realmReached) return [plain(`Crossed at ${total} karma.`)]
  return [plain(`Reached ${findRealm(entry.realmReached).name} — crossed at ${total} karma.`)]
}

// ---- ordinal (for the living current-life line) -----------------------------

const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'] as const
const ORDINAL_MOD = 10
const ORDINAL_TEEN_BASE = 20

/** Ordinal form of a positive count: 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(value: number): string {
  const withinCentury = Math.abs(value) % 100
  const suffix =
    ORDINAL_SUFFIXES[(withinCentury - ORDINAL_TEEN_BASE) % ORDINAL_MOD] ??
    ORDINAL_SUFFIXES[withinCentury] ??
    ORDINAL_SUFFIXES[0]
  return `${value}${suffix}`
}

/**
 * Render a chronicle entry to its epitaph, gated by the entry's own richness
 * tier (D37). Pure — reads only the entry and the static data tables.
 */
export function epitaphFor(entry: ChronicleEntry): Epitaph {
  const byTier: Record<RichnessTier, () => EpitaphClause[]> = {
    chapter: () => chapterClauses(entry),
    summary: () => summaryClauses(entry),
    line: () => lineClauses(entry),
  }
  return {
    heading: `Life ${entry.lifeNumber}`,
    tier: entry.richnessTier,
    clauses: byTier[entry.richnessTier](),
  }
}
