<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Vec2 } from '../types/domain'
import { catmullClosed, boundsOf } from '../domain/geometry/curve'

const props = defineProps<{ points: Vec2[]; radius: number }>()
const emit = defineEmits<{ change: [points: Vec2[]]; select: [index: number] }>()

const svgRef = ref<SVGSVGElement | null>(null)
const dragIndex = ref<number | null>(null)
const selected = ref<number | null>(0)
const addMode = ref(false)

const view = computed(() => {
  const b = boundsOf(props.points.length ? props.points : [{ x: -8, z: -6 }, { x: 8, z: 6 }])
  const pad = 3
  const minX = b.minX - pad
  const maxX = b.maxX + pad
  const minZ = b.minZ - pad
  const maxZ = b.maxZ + pad
  return { x: minX, y: -maxZ, w: maxX - minX, h: maxZ - minZ }
})

const smooth = computed(() => catmullClosed(props.points, 16))
const outlinePath = computed(() => smooth.value.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${(-p.z).toFixed(2)}`).join(' ') + ' Z')
const controlPath = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${-p.z}`).join(' ') + ' Z')

const gridLines = computed(() => {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = []
  const v = view.value
  const x0 = Math.floor(v.x / 2) * 2
  const y0 = Math.floor(v.y / 2) * 2
  for (let x = x0; x <= v.x + v.w; x += 2) lines.push({ x1: x, y1: v.y, x2: x, y2: v.y + v.h, key: `x${x}` })
  for (let y = y0; y <= v.y + v.h; y += 2) lines.push({ x1: v.x, y1: y, x2: v.x + v.w, y2: y, key: `y${y}` })
  return lines
})

function toPlan(event: PointerEvent | MouseEvent): Vec2 {
  const svg = svgRef.value!
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()!
  const p = point.matrixTransform(ctm.inverse())
  return { x: Number(p.x.toFixed(2)), z: Number((-p.y).toFixed(2)) }
}

function startDrag(index: number, event: PointerEvent) {
  event.stopPropagation()
  dragIndex.value = index
  selected.value = index
  emit('select', index)
  ;(event.target as Element).setPointerCapture?.(event.pointerId)
}

function onMove(event: PointerEvent) {
  if (dragIndex.value === null) return
  const p = toPlan(event)
  const next = props.points.map((item, i) => i === dragIndex.value ? p : item)
  emit('change', next)
}

function endDrag() {
  dragIndex.value = null
}

function onCanvasClick(event: MouseEvent) {
  if (!addMode.value) return
  const p = toPlan(event)
  const next = [...props.points]
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < next.length; i++) {
    const a = next[i]
    const b = next[(i + 1) % next.length]
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
    const d = Math.hypot(mid.x - p.x, mid.z - p.z)
    if (d < bestD) { bestD = d; best = i + 1 }
  }
  next.splice(best, 0, p)
  emit('change', next)
  selected.value = best
  addMode.value = false
}

function insertPoint(event: MouseEvent) {
  if (addMode.value) return
  const p = toPlan(event)
  const next = [...props.points]
  let edge = 0
  let bestD = Infinity
  for (let i = 0; i < next.length; i++) {
    const a = next[i]
    const b = next[(i + 1) % next.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
    const qx = a.x + dx * t
    const qz = a.z + dz * t
    const d = Math.hypot(qx - p.x, qz - p.z)
    if (d < bestD) { bestD = d; edge = i }
  }
  next.splice(edge + 1, 0, p)
  emit('change', next)
  selected.value = edge + 1
}

function removeSelected() {
  if (selected.value === null || props.points.length <= 4) return
  emit('change', props.points.filter((_, i) => i !== selected.value))
  selected.value = null
}

defineExpose({ removeSelected })
</script>

<template>
  <div class="plan-editor">
    <div class="plan-toolbar">
      <button class="btn btn-small" :class="{ active: addMode }" @click="addMode = !addMode">加点模式</button>
      <button class="btn btn-small" @click="removeSelected" :disabled="selected === null || points.length <= 4">删除选中点</button>
      <span class="plan-hint">拖动顶点调整轮廓 · 开启加点后点击边线附近插入 · 至少保留 4 点</span>
    </div>
    <svg
      ref="svgRef"
      class="plan-svg"
      :viewBox="`${view.x} ${view.y} ${view.w} ${view.h}`"
      @pointermove="onMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @click="onCanvasClick"
    >
      <rect :x="view.x" :y="view.y" :width="view.w" :height="view.h" fill="#f8fafc" />
      <g>
        <line v-for="line in gridLines" :key="line.key" v-bind="line" stroke="#e2e8f0" stroke-width="0.03" />
      </g>
      <path :d="controlPath" fill="rgba(37,99,235,0.05)" stroke="#93c5fd" stroke-width="0.08" stroke-dasharray="0.25 0.18" />
      <path :d="outlinePath" fill="rgba(37,99,235,0.16)" stroke="#1d4ed8" stroke-width="0.12" stroke-linejoin="round" />
      <circle cx="0" cy="0" r="0.16" fill="#ef4444" />
      <text x="0.25" y="-0.25" font-size="0.62" fill="#64748b">原点</text>
      <g v-for="(p, i) in points" :key="i">
        <circle
          :cx="p.x"
          :cy="-p.z"
          :r="selected === i ? 0.28 : 0.2"
          :fill="selected === i ? '#f97316' : '#ffffff'"
          stroke="#1d4ed8"
          stroke-width="0.09"
          class="plan-point"
          @pointerdown="startDrag(i, $event)"
        />
        <text :x="p.x + 0.32" :y="-p.z - 0.28" font-size="0.58" fill="#334155">{{ i + 1 }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.plan-editor { display: flex; flex-direction: column; height: 100%; min-height: 420px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: #fff; }
.plan-toolbar { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3); border-bottom: 1px solid var(--border); background: #fff; }
.plan-hint { color: var(--text-3); font-size: var(--fs-xs); }
.plan-svg { width: 100%; flex: 1; min-height: 360px; touch-action: none; cursor: crosshair; }
.plan-point { cursor: grab; }
.plan-point:active { cursor: grabbing; }
</style>
