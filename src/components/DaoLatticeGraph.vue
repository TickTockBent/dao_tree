<script setup lang="ts">
// DaoLatticeGraph.vue — the Dao lattice as a real SVG graph.
//
// 3 concentric rings (roots innermost, ring-2 mid, ring-2b outer) with 5-fold
// radial symmetry (one element per spoke). Edges drawn from `requires`. Nodes
// colored by element, sized by tier owned. Click a node to buy its next tier.

import { computed } from 'vue'
import { useDaoStore } from '@/stores/dao'
import { usePipelinesStore } from '@/stores/pipelines'
import { LATTICE_DATA, findLatticeNode } from '@/data/lattice'
import { format } from '@/engine/format'
import type { Element, LatticeNodeKey } from '@/engine/types'

const dao = useDaoStore()
const pipelines = usePipelinesStore()

// ---- Layout constants (named per §11) --------------------------------------
const VIEWBOX_SIZE = 500
const CENTER = VIEWBOX_SIZE / 2
const ROOT_RING_RADIUS = 90
const RING2_RADIUS = 175
const RING2B_RADIUS = 235
const NODE_RADIUS_BASE = 18
const NODE_RADIUS_OWNED_BONUS = 4
const ELEMENT_ORDER: Element[] = ['metal', 'wood', 'water', 'fire', 'earth']
const SPOKE_ANGLE_STEP = 360 / ELEMENT_ORDER.length
const TOP_OFFSET_DEG = -90

const ELEMENT_COLORS: Record<Element, { fill: string; stroke: string }> = {
  metal: { fill: '#b8b8c8', stroke: '#8a8a9a' },
  wood: { fill: '#5aa85a', stroke: '#3a8a3a' },
  water: { fill: '#5a8ad8', stroke: '#3a6ab8' },
  fire: { fill: '#d85a5a', stroke: '#b83a3a' },
  earth: { fill: '#b89a5a', stroke: '#8a7a3a' },
}

// ---- Node positioning ------------------------------------------------------
function spokeAngle(element: Element): number {
  const index = ELEMENT_ORDER.indexOf(element)
  return ((TOP_OFFSET_DEG + index * SPOKE_ANGLE_STEP) * Math.PI) / 180
}

function ringRadius(key: LatticeNodeKey): number {
  const node = findLatticeNode(key)
  const index = LATTICE_DATA.nodes.indexOf(node)
  // Roots are nodes 0-4, ring-2 are 5-9, ring-2b are 10-14.
  if (index < ELEMENT_ORDER.length) return ROOT_RING_RADIUS
  if (index < ELEMENT_ORDER.length * 2) return RING2_RADIUS
  return RING2B_RADIUS
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
}

const positionedNodes = computed<PositionedNode[]>(() =>
  LATTICE_DATA.nodes.map((node) => {
    const angle = spokeAngle(node.element)
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
        :class="['lattice-node', { buyable: node.canBuy, locked: !node.requirementsMet, maxed: node.isMaxed }]"
        @click="onNodeClick(node.key)"
      >
        <circle
          :r="node.radius"
          :fill="node.color.fill"
          :stroke="node.color.stroke"
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
.lattice-svg {
  width: 100%;
  max-width: 500px;
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
</style>
