<script setup lang="ts">
// DaoLatticeGraph.vue — the Dao lattice as a real SVG graph.
//
// 4 concentric rings (roots innermost, ring-2, ring-2b, ring-3 outermost —
// slice 9 / D22) with 5-fold radial symmetry (one element per spoke). Ring-3
// carries TWO nodes per element (one continuing the ring-2 lineage, one
// continuing ring-2b), so its two siblings are angularly offset off the
// shared spoke to avoid overlapping. Edges drawn from `requires`. Nodes
// colored by element, sized by tier owned (now up to 3 — Manifestation).
// Click a node to buy its next tier; a blocked buy shows its reason (D22
// Manifestation gate / flow-stillness conflict) as a hover title + badge.

import { computed } from 'vue'
import { useDaoStore } from '@/stores/dao'
import { usePipelinesStore } from '@/stores/pipelines'
import { LATTICE_DATA, findLatticeNode } from '@/data/lattice'
import { format } from '@/engine/format'
import type { Element, LatticeNodeKey } from '@/engine/types'

const dao = useDaoStore()
const pipelines = usePipelinesStore()

// ---- Layout constants (named per §11) --------------------------------------
// Sized to fit the full graph (outermost ring at radius 290 + node + label);
// 500 clipped the outer Manifestation ring. The SVG scales this to the panel.
const VIEWBOX_SIZE = 700
const CENTER = VIEWBOX_SIZE / 2
const ROOT_RING_RADIUS = 90
const RING2_RADIUS = 175
const RING2B_RADIUS = 235
const RING3_RADIUS = 290
const NODE_RADIUS_BASE = 18
const NODE_RADIUS_OWNED_BONUS = 4
const ELEMENT_ORDER: Element[] = ['metal', 'wood', 'water', 'fire', 'earth']
const SPOKE_ANGLE_STEP = 360 / ELEMENT_ORDER.length
const TOP_OFFSET_DEG = -90
/** Ring-3 has 2 siblings per element (ring-2 lineage + ring-2b lineage); split off the shared spoke. */
const RING3_SIBLING_OFFSET_DEG = 12

const ELEMENT_COLORS: Record<Element, { fill: string; stroke: string }> = {
  metal: { fill: '#b8b8c8', stroke: '#8a8a9a' },
  wood: { fill: '#5aa85a', stroke: '#3a8a3a' },
  water: { fill: '#5a8ad8', stroke: '#3a6ab8' },
  fire: { fill: '#d85a5a', stroke: '#b83a3a' },
  earth: { fill: '#b89a5a', stroke: '#8a7a3a' },
}

// ---- Node positioning ------------------------------------------------------
// Ring index boundaries by array position: roots 0-4, ring-2 5-9, ring-2b
// 10-14, ring-3 15-24 (slice 9 / D22 — 2 siblings per element).
const RING2_START = ELEMENT_ORDER.length
const RING2B_START = ELEMENT_ORDER.length * 2
const RING3_START = ELEMENT_ORDER.length * 3

function spokeAngle(element: Element): number {
  const index = ELEMENT_ORDER.indexOf(element)
  return ((TOP_OFFSET_DEG + index * SPOKE_ANGLE_STEP) * Math.PI) / 180
}

function ringRadius(key: LatticeNodeKey): number {
  const node = findLatticeNode(key)
  const index = LATTICE_DATA.nodes.indexOf(node)
  if (index < RING2_START) return ROOT_RING_RADIUS
  if (index < RING2B_START) return RING2_RADIUS
  if (index < RING3_START) return RING2B_RADIUS
  return RING3_RADIUS
}

/**
 * Node angle in radians. Ring-3 nodes share a spoke in pairs (one continuing
 * the ring-2 lineage, one continuing ring-2b) — offset each sibling off the
 * shared spoke by its parent's ring so they don't overlap.
 */
function nodeAngle(key: LatticeNodeKey): number {
  const node = findLatticeNode(key)
  const baseAngle = spokeAngle(node.element)
  const index = LATTICE_DATA.nodes.indexOf(node)
  if (index < RING3_START) return baseAngle
  const parentKey = node.requires[0]
  const parentIndex = parentKey ? LATTICE_DATA.nodes.findIndex((n) => n.key === parentKey) : -1
  const fromRing2Lineage = parentIndex >= RING2_START && parentIndex < RING2B_START
  const offsetRad = (RING3_SIBLING_OFFSET_DEG * Math.PI) / 180
  return fromRing2Lineage ? baseAngle - offsetRad : baseAngle + offsetRad
}

interface PositionedNode {
  key: LatticeNodeKey
  name: string
  element: Element
  x: number
  y: number
  tier: number
  radius: number
  color: { fill: string; stroke: string }
  nextCost: string
  canBuy: boolean
  requirementsMet: boolean
  isMaxed: boolean
  /** Why the next-tier purchase is refused right now, or null if buyable/maxed. */
  blockReason: string | null
  /** True when the refusal is specifically the flow/stillness-style Manifestation conflict. */
  conflictBlocked: boolean
}

const positionedNodes = computed<PositionedNode[]>(() =>
  LATTICE_DATA.nodes.map((node) => {
    const angle = nodeAngle(node.key)
    const radius = ringRadius(node.key)
    const x = CENTER + radius * Math.cos(angle)
    const y = CENTER + radius * Math.sin(angle)
    const tier = dao.nodeTierOwned(node.key)
    const isMaxed = tier >= node.costs.length
    return {
      key: node.key,
      name: node.name,
      element: node.element,
      x,
      y,
      tier,
      radius: NODE_RADIUS_BASE + tier * NODE_RADIUS_OWNED_BONUS,
      color: ELEMENT_COLORS[node.element],
      nextCost: isMaxed ? '' : format(dao.nodeCost(node.key)),
      canBuy: dao.canAffordNode(node.key),
      requirementsMet: dao.nodeRequirementsMet(node.key),
      isMaxed,
      blockReason: isMaxed ? null : dao.nodeBuyBlockReason(node.key),
      conflictBlocked: !isMaxed && dao.manifestationConflictBlocks(node.key),
    }
  }),
)

// ---- Edges (requires relationships) ----------------------------------------
interface Edge {
  x1: number
  y1: number
  x2: number
  y2: number
}

const edges = computed<Edge[]>(() => {
  const result: Edge[] = []
  for (const node of LATTICE_DATA.nodes) {
    const target = positionedNodes.value.find((n) => n.key === node.key)!
    for (const reqKey of node.requires) {
      const source = positionedNodes.value.find((n) => n.key === reqKey)!
      result.push({ x1: source.x, y1: source.y, x2: target.x, y2: target.y })
    }
  }
  return result
})

// ---- Conflicts (dashed red arcs) -------------------------------------------
const conflictPairs = computed(() =>
  LATTICE_DATA.conflicts.map(([a, b]) => {
    const nodeA = positionedNodes.value.find((n) => n.key === a)!
    const nodeB = positionedNodes.value.find((n) => n.key === b)!
    return { x1: nodeA.x, y1: nodeA.y, x2: nodeB.x, y2: nodeB.y }
  }),
)

function onNodeClick(key: LatticeNodeKey): void {
  dao.buyNodeTier(key)
}

const insightPerSec = computed(() => format(pipelines.insightPerSecond))

/** Legible conflict-pair labels, derived from LATTICE_DATA.conflicts (no hardcoded names). */
const conflictLabel = computed(() =>
  LATTICE_DATA.conflicts
    .map(([a, b]) => `${findLatticeNode(a).name} ↔ ${findLatticeNode(b).name}`)
    .join(', '),
)
</script>

<template>
  <div class="dao-lattice">
    <div class="dao-header">
      <span class="insight-label">Insight: <b>{{ format(dao.insight) }}</b></span>
      <span class="insight-rate">(+{{ insightPerSec }}/s)</span>
    </div>
    <svg :viewBox="`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`" class="lattice-svg">
      <!-- Edges (requires) -->
      <line
        v-for="(edge, i) in edges"
        :key="`edge-${i}`"
        :x1="edge.x1"
        :y1="edge.y1"
        :x2="edge.x2"
        :y2="edge.y2"
        class="lattice-edge"
      />
      <!-- Conflicts (dashed red) -->
      <line
        v-for="(pair, i) in conflictPairs"
        :key="`conflict-${i}`"
        :x1="pair.x1"
        :y1="pair.y1"
        :x2="pair.x2"
        :y2="pair.y2"
        class="lattice-conflict"
      />
      <!-- Nodes -->
      <g
        v-for="node in positionedNodes"
        :key="node.key"
        :transform="`translate(${node.x}, ${node.y})`"
        :class="[
          'lattice-node',
          { buyable: node.canBuy, locked: !node.requirementsMet, maxed: node.isMaxed, 'conflict-blocked': node.conflictBlocked },
        ]"
        @click="onNodeClick(node.key)"
      >
        <title>{{ node.blockReason ?? node.name }}</title>
        <circle
          :r="node.radius"
          :fill="node.color.fill"
          :stroke="node.conflictBlocked ? '#d44' : node.color.stroke"
          :stroke-width="node.tier > 0 ? 3 : 1"
        />
        <text class="node-label" text-anchor="middle" dy="0.35em">{{ node.name.charAt(0) }}</text>
        <text class="node-tier" text-anchor="middle" :dy="node.radius + 14">
          {{ node.tier > 0 ? LATTICE_DATA.tiers[node.tier - 1]!.label : (node.requirementsMet ? node.nextCost : '?') }}
        </text>
      </g>
    </svg>
    <p v-if="positionedNodes.every((n) => n.tier === 0)" class="hint-text">
      Click a root node (inner ring) to glimpse it for {{ format(dao.nodeCost('metal')) }} Insight.
    </p>
    <p v-if="conflictPairs.length > 0" class="conflict-legend">
      Conflicting pairs (Manifestation only): {{ conflictLabel }}
    </p>
  </div>
</template>

<style scoped>
.dao-lattice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.dao-header {
  font-size: 1.1rem;
  color: #dfdfdf;
}
.insight-label b {
  color: #8a6fd8;
}
.insight-rate {
  color: #5fc9e0;
  font-size: 0.9em;
  margin-left: 0.5rem;
}
/* Fit-to-view: the viewBox (0..700) scales to the panel, so the whole lattice
   is always visible with no scrolling. Nodes shrink on narrow screens. */
.lattice-svg {
  width: 100%;
  max-width: 700px;
  height: auto;
}
.lattice-edge {
  stroke: #444;
  stroke-width: 1.5;
  opacity: 0.6;
}
.lattice-conflict {
  stroke: #d44;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  opacity: 0.5;
}
.lattice-node {
  cursor: pointer;
  transition: opacity 0.15s;
}
.lattice-node.locked {
  opacity: 0.35;
  cursor: not-allowed;
}
.lattice-node.maxed {
  cursor: default;
}
.lattice-node.buyable:hover circle {
  filter: brightness(1.3);
}
.lattice-node.conflict-blocked {
  cursor: not-allowed;
}
.lattice-node.conflict-blocked circle {
  stroke-dasharray: 3 2;
}
.node-label {
  fill: #1a1a1a;
  font-size: 14px;
  font-weight: bold;
  pointer-events: none;
}
.node-tier {
  fill: #aaa;
  font-size: 10px;
  pointer-events: none;
}
.hint-text {
  color: #888;
  font-size: 0.85rem;
  text-align: center;
}
.conflict-legend {
  color: #d44;
  font-size: 0.8rem;
  text-align: center;
  opacity: 0.8;
}
</style>
