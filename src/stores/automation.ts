// src/stores/automation.ts — the automation ladder (design §1.7/§7.5).
//
// Port of the factory's automation readers + maturity model. Automation is a
// REWARD: a row becomes ACTIVE the moment its milestone is earned and stays on
// forever. The reverse-pass tick fires autoPrestige (via maturity model) and
// autoBuy (for buyable grants). Temper is deliberately NOT automated (§4b).

import { defineStore } from 'pinia'
import { computed } from 'vue'
import Decimal from 'break_eternity.js'
import { decimalOne, decimalZero } from '@/engine/decimal'
import { AUTOMATION_DATA } from '@/data/automation'
import { findRealm } from '@/data/realms'
import { SETPIECE_DATA } from '@/data/setpieces'
import { useRealmStore } from '@/stores/realm'
import { useBodyStore } from '@/stores/body'
import type { RealmId } from '@/engine/types'
import type { MaturityConfig } from '@/data/automation'

/** Clamp a Decimal to [0,1]. */
function clampUnit(d: Decimal): Decimal {
  if (d.lt(0)) return decimalZero()
  if (d.gt(1)) return decimalOne()
  return d
}

export const useAutomationStore = defineStore('automation', () => {
  const realm = useRealmStore()
  const body = useBodyStore()

  // ---- Grant checking -----------------------------------------------------

  /** True once an automation row's milestone is earned. */
  function automationGranted(row: typeof AUTOMATION_DATA[number]): boolean {
    const grant = row.grantedBy
    return realm.hasMilestone(grant.layer, grant.milestone)
  }

  /** All granted automation rows. */
  const grantedRows = computed(() => AUTOMATION_DATA.filter(automationGranted))

  // ---- Maturity model -----------------------------------------------------

  /** Top sub-stage `at` for a realm (the fully-climbed mark). */
  function realmTopSubstageAt(layerId: RealmId): Decimal {
    const r = findRealm(layerId)
    const last = r.substages[r.substages.length - 1]
    const top = new Decimal(last?.at ?? 1)
    return top.lte(0) ? decimalOne() : top
  }

  /** Max fuel a single forge push can spend (the Reckless push). */
  function forgeMaxPushFuel(): Decimal {
    const forge = SETPIECE_DATA.forge
    let maxFuel = new Decimal(forge.fuelBase)
    for (const option of forge.pushOptions) {
      const cost = new Decimal(forge.fuelBase).times(option.fuelMult)
      if (cost.gt(maxFuel)) maxFuel = cost
    }
    return maxFuel.lte(0) ? decimalOne() : maxFuel
  }

  /** How fully formed a realm is, in [0,1] (1 = rest). */
  function realmAutoCompleteness(layerId: RealmId, maturityCfg: MaturityConfig): Decimal {
    const best = realm.realmBest(layerId)
    let completeness = clampUnit(best.div(realmTopSubstageAt(layerId)))
    if (maturityCfg.fuelFromForge) {
      const points = new Decimal(realm.stateOf(layerId).points)
      const fuelRatio = clampUnit(points.div(forgeMaxPushFuel()))
      if (fuelRatio.lt(completeness)) completeness = fuelRatio
    }
    return completeness
  }

  /**
   * The per-prestige cost multiplier on the worth-it fraction, rising as the
   * realm matures. Returns null when completeness is within restEpsilon of 1
   * (the signal to REST — also dodges the asymptote at the very top).
   */
  function autoPrestigeCostMultiplier(completeness: Decimal, maturityCfg: MaturityConfig): Decimal | null {
    const headroom = decimalOne().sub(completeness)
    if (headroom.lte(new Decimal(maturityCfg.restEpsilon))) return null
    const rawMultiplier = decimalOne().div(headroom).pow(maturityCfg.costExponent)
    const cap = new Decimal(maturityCfg.costCap)
    return rawMultiplier.gt(cap) ? cap : rawMultiplier
  }

  /** Should the auto-prestige fire this tick? */
  function autoPrestigeFires(layerId: RealmId, maturityCfg: MaturityConfig): boolean {
    const completeness = realmAutoCompleteness(layerId, maturityCfg)
    const costMultiplier = autoPrestigeCostMultiplier(completeness, maturityCfg)
    if (costMultiplier === null) return false // fully formed → resting
    const effectiveFraction = new Decimal(maturityCfg.baseFraction).times(costMultiplier)
    const currentPoints = new Decimal(realm.stateOf(layerId).points)
    const pendingGain = realm.resetGain(layerId)
    return pendingGain.gte(currentPoints.times(effectiveFraction))
  }

  /** The maturity config for a granted prestige automation targeting `layerId`, or null. */
  function prestigeMaturityConfig(layerId: RealmId): MaturityConfig | null {
    for (const row of grantedRows.value) {
      const auto = row.automates
      if (auto.action === 'prestige' && auto.layer === layerId) return auto.maturity
    }
    return null
  }

  // ---- Reverse-pass tick (autoPrestige + autoBuy) -------------------------

  /** Run all automation: prestige bells + buyable autobuy. Called in the reverse pass. */
  function automate(diff: number): void {
    void diff
    // AutoPrestige: fire any granted prestige automation whose maturity says fire.
    for (const row of grantedRows.value) {
      const auto = row.automates
      if (auto.action !== 'prestige') continue
      if (autoPrestigeFires(auto.layer, auto.maturity)) {
        realm.prestige(auto.layer)
      }
    }
    // AutoBuy: buy any granted buyable automation.
    for (const row of grantedRows.value) {
      const auto = row.automates
      if (auto.action !== 'buyable') continue
      if (body.canAffordBuyable(auto.buyableKey)) {
        body.buyBuyable(auto.buyableKey)
      }
    }
  }

  // ---- Display reads ------------------------------------------------------

  /** Completeness percentage for a realm's auto-prestige (for UI display). */
  function realmCompletenessPercent(layerId: RealmId): number {
    const cfg = prestigeMaturityConfig(layerId)
    if (!cfg) return 0
    return realmAutoCompleteness(layerId, cfg).times(100).toNumber()
  }

  /** True if the auto-prestige bell is resting (fully formed). */
  function autoPrestigeIsResting(layerId: RealmId): boolean {
    const cfg = prestigeMaturityConfig(layerId)
    if (!cfg) return false
    return autoPrestigeCostMultiplier(realmAutoCompleteness(layerId, cfg), cfg) === null
  }

  /** Is a specific automation key granted? */
  function isGranted(key: string): boolean {
    return grantedRows.value.some((r) => r.key === key)
  }

  function update(_diff: number): void {
    // Automation runs in the reverse pass via automate(), not the forward pass.
  }

  return {
    grantedRows,
    automationGranted,
    realmAutoCompleteness,
    autoPrestigeCostMultiplier,
    autoPrestigeFires,
    prestigeMaturityConfig,
    automate,
    realmCompletenessPercent,
    autoPrestigeIsResting,
    isGranted,
    update,
  }
})
