<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import Viewport3D from '../components/Viewport3D.vue'
import { store } from '../services/project_store'
import { go } from '../services/router'
import { BowlSurface } from '../domain/geometry/bowl_surface'
import {
  buildCrossTrack,
  createRideState,
  pointAtS,
  stepRide,
  type RideState,
  type RideTrack,
} from '../domain/geometry/ride'
import type { BowlViewer } from '../three/BowlViewer'

const viewer = ref<BowlViewer | null>(null)
const angle = ref(28)
const offset = ref(0)
const initialSpeed = ref(4.5)
const friction = ref(0.018)
const playing = ref(true)
const cameraMode = ref<'perspective' | 'first'>('perspective')
const hud = ref({ speed: 0, time: 0, climb: 0, elevation: 0, distance: 0, finished: false })

let track: RideTrack | null = null
let ride: RideState | null = null

const energyHeight = computed(() => (initialSpeed.value ** 2) / (2 * 9.81))

function rebuild(autoPlay = true) {
  if (!store.current || !viewer.value) return
  const surface = new BowlSurface(store.current.data.outlines, store.current.data.params, 56, store.current.data.basins ?? [])
  track = buildCrossTrack(surface, angle.value, offset.value)
  ride = createRideState(track, initialSpeed.value)
  viewer.value.setTrail(track.points)
  const p = pointAtS(track, 0)
  const next = track.points[1] ?? p
  viewer.value.updateSkier(p, Math.atan2(next.x - p.x, next.z - p.z))
  playing.value = autoPlay
  syncHud()
}

function onReady(v: BowlViewer) {
  viewer.value = v
  v.onFrame = frame
  rebuild(true)
}

function frame(dt: number) {
  if (!viewer.value || !track || !ride) return
  if (playing.value) {
    ride = stepRide(track, ride, dt, { friction: friction.value })
    if (ride.finished) playing.value = false
  }
  const p = pointAtS(track, ride.s)
  const sign = ride.speed < -0.05 ? -1 : 1
  const ahead = pointAtS(track, Math.max(0, Math.min(track.length, ride.s + 0.45 * sign)))
  const yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z)
  viewer.value.updateSkier(p, yaw)
  if (playing.value) viewer.value.setTrail(ride.trail)
  syncHud()
}

function syncHud() {
  if (!ride) return
  hud.value = {
    speed: Math.abs(ride.speed) * 3.6,
    time: ride.time,
    climb: ride.maxClimb,
    elevation: ride.maxElevation,
    distance: ride.distance,
    finished: ride.finished,
  }
}

function togglePlay() {
  if (ride?.finished) rebuild(true)
  else playing.value = !playing.value
}

function reset() {
  rebuild(true)
}

function changeCamera(mode: 'perspective' | 'first') {
  cameraMode.value = mode
  viewer.value?.setView(mode)
}

onBeforeUnmount(() => {
  if (viewer.value) viewer.value.onFrame = null
})
</script>

<template>
  <section v-if="store.current" class="page ride-page">
    <div class="page-head compact">
      <div>
        <p class="eyebrow">RIDE PREVIEW</p>
        <h1>滑行预览</h1>
        <p class="page-sub">滑手被约束在同一曲面函数上，重力沿切向做功；动能决定碗壁爬升高度。</p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="go('design')">调整池型</button>
        <button :class="['btn', cameraMode === 'perspective' ? 'btn-primary' : '']" @click="changeCamera('perspective')">第三人称</button>
        <button :class="['btn', cameraMode === 'first' ? 'btn-primary' : '']" @click="changeCamera('first')">第一视角</button>
      </div>
    </div>

    <div class="ride-layout">
      <aside class="panel ride-controls">
        <h2>滑行参数</h2>
        <label class="field">
          <span>穿越截面方向：{{ angle }}°</span>
          <input type="range" min="0" max="180" step="1" v-model.number="angle" @change="reset" />
        </label>
        <label class="field">
          <span>截面偏移：{{ offset.toFixed(1) }} m</span>
          <input type="range" min="-4" max="4" step="0.2" v-model.number="offset" @change="reset" />
        </label>
        <label class="field">
          <span>初始速度：{{ initialSpeed.toFixed(1) }} m/s</span>
          <input type="range" min="1" max="10" step="0.1" v-model.number="initialSpeed" @change="reset" />
        </label>
        <label class="field">
          <span>滚动阻力系数：{{ friction.toFixed(3) }}</span>
          <input type="range" min="0" max="0.06" step="0.002" v-model.number="friction" />
        </label>
        <div class="button-row">
          <button class="btn btn-primary" @click="togglePlay">{{ playing ? '暂停' : hud.finished ? '再滑一次' : '继续' }}</button>
          <button class="btn" @click="reset">重置</button>
        </div>

        <div class="hud-grid">
          <div><span>瞬时速度</span><strong>{{ hud.speed.toFixed(1) }}<em>km/h</em></strong></div>
          <div><span>滑行时间</span><strong>{{ hud.time.toFixed(1) }}<em>s</em></strong></div>
          <div><span>最大爬升</span><strong class="accent">{{ hud.climb.toFixed(2) }}<em>m</em></strong></div>
          <div><span>最高标高</span><strong>{{ hud.elevation.toFixed(2) }}<em>m</em></strong></div>
          <div><span>累计路径</span><strong>{{ hud.distance.toFixed(1) }}<em>m</em></strong></div>
          <div><span>无损耗能量高度</span><strong>{{ energyHeight.toFixed(2) }}<em>m</em></strong></div>
        </div>
        <div class="tip-card">
          <h3>怎么看过渡弧</h3>
          <p>切第一视角后，如果视野在弧脚附近明显下压或出现连续抖动，说明 R 相对速度偏小；曲率检查页会给出对应站位。</p>
        </div>
      </aside>

      <main class="viewer-card panel">
        <Viewport3D :data="store.current.data" @ready="onReady" />
        <div v-if="cameraMode === 'first'" class="fpv-hint">第一视角 · Esc 后可切换回第三人称旋转视角</div>
      </main>
    </div>
  </section>
  <section v-else class="page empty-page"><div class="empty-card"><h1>请先打开项目</h1><button class="btn btn-primary" @click="go('projects')">项目列表</button></div></section>
</template>

<style scoped>
.ride-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 340px 1fr; gap: var(--sp-4); }
.ride-controls { overflow: auto; display: flex; flex-direction: column; gap: var(--sp-4); }
.ride-controls h2 { font-size: var(--fs-base); font-weight: var(--fw-semibold); }
input[type='range'] { width: 100%; accent-color: #2563eb; }
.button-row { display: flex; gap: var(--sp-3); }
.button-row .btn { flex: 1; }
.hud-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.hud-grid div { border: 1px solid var(--border); background: #f8fafc; border-radius: var(--radius); padding: var(--sp-3); }
.hud-grid span { display: block; color: var(--text-3); font-size: var(--fs-xs); margin-bottom: 6px; }
.hud-grid strong { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
.hud-grid em { font-style: normal; font-size: var(--fs-xs); color: var(--text-3); margin-left: 4px; }
.accent { color: #e11d48; }
.tip-card { border-radius: var(--radius); background: #0f172a; color: #cbd5e1; padding: var(--sp-4); }
.tip-card h3 { color: white; font-size: var(--fs-sm); margin-bottom: 8px; }
.tip-card p { font-size: var(--fs-xs); line-height: 1.7; }
.viewer-card { padding: var(--sp-2); position: relative; min-height: 580px; }
.viewer-card :deep(.viewport-host) { min-height: calc(100vh - 210px); }
.fpv-hint { position: absolute; top: var(--sp-5); left: 50%; transform: translateX(-50%); background: rgba(15,23,42,.78); color: white; padding: var(--sp-2) var(--sp-4); border-radius: 999px; font-size: var(--fs-xs); }
@media (max-width: 1100px) {
  .ride-layout { grid-template-columns: 1fr; }
  .viewer-card { min-height: 480px; }
  .viewer-card :deep(.viewport-host) { min-height: 460px; }
}
</style>
