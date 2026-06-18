// src/stores/nav.ts — typed navigation state (replaces TMT's stringly-typed
// player.tab / navTab / subtabs / prevTab / lastSafeTab).
//
// Tab ids are a union, not bare strings. Split-screen logic mirrors the old
// engine: when window width >= 1024, !forceOneTab, and navTab is set, the
// tree shows on the left and the active tab on the right.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LayerId } from '@/engine/types'

export type TabId = LayerId | 'tree-tab' | 'none'

export const useNavStore = defineStore('nav', () => {
  const currentTab = ref<TabId>('tree-tab')
  const currentNavTab = ref<TabId>('none')
  const subtabs = ref<Record<string, Record<string, string>>>({})
  const lastSafeTab = ref<TabId>('tree-tab')
  const forceOneTab = ref(false)
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

  const splitScreen = computed(
    () =>
      windowWidth.value >= 1024 &&
      !forceOneTab.value &&
      currentNavTab.value !== 'none',
  )

  function showTab(name: TabId): void {
    if (name !== 'none' && name !== 'tree-tab') lastSafeTab.value = name
    currentTab.value = name
  }

  function showNavTab(name: TabId): void {
    currentNavTab.value = name
    if (name === 'none') showTab('tree-tab')
  }

  function goBack(): void {
    if (currentNavTab.value !== 'none') {
      currentNavTab.value = 'none'
      showTab('tree-tab')
    } else if (currentTab.value !== 'none' && currentTab.value !== 'tree-tab') {
      showTab(lastSafeTab.value)
    }
  }

  function setWindowWidth(width: number): void {
    windowWidth.value = width
  }

  function setForceOneTab(value: boolean): void {
    forceOneTab.value = value
  }

  return {
    currentTab,
    currentNavTab,
    subtabs,
    lastSafeTab,
    forceOneTab,
    windowWidth,
    splitScreen,
    showTab,
    showNavTab,
    goBack,
    setWindowWidth,
    setForceOneTab,
  }
})
