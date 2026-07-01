// src/stores/pipelines.ts — the Qi/sec and Insight/sec composition getters.
//
// Port of `cultivationQiPerSecond()` / `insightPerSecond()` from the factory.
// Each multiplier is read from its owning store; the pipeline composes them.
// Each factor is identity (1) until its state exists, so a pre-NS / pre-sect /
// pre-tribulation save reads byte-identical to the prior product (the "no dead
// mult" invariant, §9.2).
//
// Order of factors (matches the factory for debugging parity; multiplication is
// commutative):
//   baseRate × meridianMult × temperMult × realmMult × gateMult ×
//   coreGradeMult × daoNodeQiMult × stanceQiMult × soulAspectQiMult ×
//   sectStipendQiMult × techniqueQiMult × scarQiMult × temperedQiMult ×
//   legacyQiMult × activePillQiMult × trialQiMult × daoHeartQiMult

import { defineStore } from 'pinia'
import { computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne } from '@/engine/decimal'
import { LATTICE_DATA } from '@/data/lattice'
import { STANCE_DATA } from '@/data/stances'
import { realmWithSoulAspect } from '@/data/realms'
import { TECHNIQUE_DATA } from '@/data/techniques'
import { SECT_DATA } from '@/data/sect'
import { useBodyStore } from './body'
import { useRealmStore } from './realm'
import { useDaoStore } from './dao'
import { useSectStore } from './sect'
import { useGateStore } from './gate'
import { useForgeStore } from './forge'
import { useScarStore } from './scar'
import { useLegacyStore } from './legacy'
import { useAlchemyStore } from './alchemy'
import { useHeartDemonsStore } from './heartDemons'

export const usePipelinesStore = defineStore('pipelines', () => {
  const body = useBodyStore()
  const realm = useRealmStore()
  const dao = useDaoStore()
  const sect = useSectStore()
  const gate = useGateStore()
  const forge = useForgeStore()
  const scar = useScarStore()
  const legacy = useLegacyStore()
  const alchemy = useAlchemyStore()
  const heartDemons = useHeartDemonsStore()

  // ---- Dao/stance/aspect/technique/legacy factors (identity until their slice lands) ----

  /** Dao node qiMult: product of every owned tier's qiMult across all nodes. */
  const daoNodeQiMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const node of LATTICE_DATA.nodes) {
      const owned = dao.nodeTierOwned(node.key)
      node.effects.forEach((effect, tierIndex) => {
        if ('qiMult' in effect && owned >= tierIndex + 1) {
          product = product.times(effect.qiMult)
        }
      })
    }
    return product
  })

  /** Dao node insightMult: product of every owned tier's insightMult. */
  const daoNodeInsightMult = computed<Decimal>(() => {
    let product = decimalOne()
    for (const node of LATTICE_DATA.nodes) {
      const owned = dao.nodeTierOwned(node.key)
      node.effects.forEach((effect, tierIndex) => {
        if ('insightMult' in effect && owned >= tierIndex + 1) {
          product = product.times(effect.insightMult)
        }
      })
    }
    return product
  })

  /** Active stance qiMult (1 if no stance active). */
  const stanceQiMult = computed<Decimal>(() => {
    const key = dao.activeStance
    if (!key) return decimalOne()
    const stance = STANCE_DATA.stances.find((s) => s.key === key)
    if (!stance || stance.modifiers.qiMult === undefined) return decimalOne()
    return new Decimal(stance.modifiers.qiMult)
  })

  /** Active stance insightMult (1 if no stance active). */
  const stanceInsightMult = computed<Decimal>(() => {
    const key = dao.activeStance
    if (!key) return decimalOne()
    const stance = STANCE_DATA.stances.find((s) => s.key === key)
    if (!stance || stance.modifiers.insightMult === undefined) return decimalOne()
    return new Decimal(stance.modifiers.insightMult)
  })

  /** Soul aspect qiMult (1 if unchosen). */
  const soulAspectQiMult = computed<Decimal>(() => {
    const aspectKey = body.soulAspect
    if (!aspectKey) return decimalOne()
    const realm = realmWithSoulAspect()
    if (!realm?.soulAspect) return decimalOne()
    const aspect = realm.soulAspect.aspects.find((a) => a.key === aspectKey)
    if (!aspect || aspect.effect.qiMult === undefined) return decimalOne()
    return new Decimal(aspect.effect.qiMult)
  })

  /** Soul aspect insightMult (1 if unchosen). */
  const soulAspectInsightMult = computed<Decimal>(() => {
    const aspectKey = body.soulAspect
    if (!aspectKey) return decimalOne()
    const realm = realmWithSoulAspect()
    if (!realm?.soulAspect) return decimalOne()
    const aspect = realm.soulAspect.aspects.find((a) => a.key === aspectKey)
    if (!aspect || aspect.effect.insightMult === undefined) return decimalOne()
    return new Decimal(aspect.effect.insightMult)
  })

  /** Sect stipend qiMult (1 if no stipend milestone earned). */
  const sectStipendQiMult = computed<Decimal>(() => {
    const stipendRow = SECT_DATA.milestones.find((m) => 'qiMult' in m.reward)
    if (!stipendRow) return decimalOne()
    const idx = SECT_DATA.milestones.indexOf(stipendRow)
    if (!sect.hasMilestone(idx)) return decimalOne()
    return new Decimal(stipendRow.reward.qiMult!)
  })

  /** Technique qiMult: product of owned techniques' qiMult effects. */
  const techniqueQiMult = computed<Decimal>(() => {
    let product = decimalOne()
    TECHNIQUE_DATA.forEach((tech, index) => {
      if ('qiMult' in tech.effect && sect.techniques.includes(index)) {
        product = product.times(tech.effect.qiMult)
      }
    })
    return product
  })

  /** Technique insightMult: product of owned techniques' insightMult effects. */
  const techniqueInsightMult = computed<Decimal>(() => {
    let product = decimalOne()
    TECHNIQUE_DATA.forEach((tech, index) => {
      if ('insightMult' in tech.effect && sect.techniques.includes(index)) {
        product = product.times(tech.effect.insightMult)
      }
    })
    return product
  })

  /** Legacy qiMult (1 if no Act I Legacy Grade stored). */
  const legacyQiMult = computed<Decimal>(() => legacy.legacyQiMult)

  // ---- The full Qi/sec pipeline ----
  const qiPerSecond = computed<Decimal>(() =>
    body.qiBaseRate
      .times(body.meridianMult)
      .times(body.temperMult)
      .times(realm.realmMult)
      .times(gate.gateMult)
      .times(forge.coreGradeMult)
      .times(daoNodeQiMult.value)
      .times(stanceQiMult.value)
      .times(soulAspectQiMult.value)
      .times(sectStipendQiMult.value)
      .times(techniqueQiMult.value)
      .times(scar.scarQiMult)
      .times(scar.temperedQiMult)
      .times(legacyQiMult.value)
      .times(alchemy.activePillQiMult)
      .times(heartDemons.trialQiMult)
      .times(heartDemons.daoHeartQiMult),
  )

  // ---- Insight/sec pipeline (M4 wires the dao trickle; stances/techniques compound it) ----
  const insightPerSecond = computed<Decimal>(() => {
    if (!dao.revealed) return decimalOne().times(0)
    const base = new Decimal(LATTICE_DATA.insight.baseRate)
    return base
      .times(daoNodeInsightMult.value)
      .times(stanceInsightMult.value)
      .times(soulAspectInsightMult.value)
      .times(techniqueInsightMult.value)
  })

  return { qiPerSecond, insightPerSecond }
})
