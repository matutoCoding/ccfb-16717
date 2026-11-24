<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Viewport3D from '../components/Viewport3D.vue'
import { store } from '../services/project_store'
import { go } from '../services/router'
import { BowlSurface } from '../domain/geometry/bowl_surface'
import { buildCurvatureMap, validateSections } from '../domain/geometry/inspection'
import type { CurvaturePoint, SectionCheck } from '../types/domain'
import type { BowlViewer } from '../three/BowlViewer'
import { settings } from '../services/settings_store'

const viewer = ref<BowlViewer | null>(null)
const checks = ref<SectionCheck[]>([])
const curvature = ref<CurvaturePoint[]>([])
const loading = ref(false)
const showHeat = ref(true)
const selected = ref<SectionCheck | null>(null)

const surface = computed(() => store.current ? new BowlSurface(store.current.data.outlines, store.current.data.params, 72, store.current.data.basins ?? []) : null)
const failed = computed(() => checks.value.filter((c) => !c.passed))
const maxError = computed(() => checks.value.reduce((m, c) => Math.max(m, c.maxErrorMm), 0))
const passRate = computed(() => checks.value.length ? ((checks.value.length - failed.value.length) / checks.value.length) * 100 : 0)
const abruptCount = computed(() => curvature.value.filter((p) => p.abrupt).length)

async function runChecks() {
  if (!surface.value || !store.current) return
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 30))
  checks.value = validateSections(surface.value, 0.45)
  const curvatureStep = Number(settings.curvatureGridStep)
  curvature.value = buildCurvatureMap(
    surface.value,
    Number.isFinite(curvatureStep) && curvatureStep >= 0.1 ? curvatureStep : 0.25,
  )
  viewer.value?.showCurvature(curvature.value)
  viewer.value?.setLayer('heat', showHeat.value)
  loading.value = false
}

function onReady(v: BowlViewer) {
  viewer.value = v
  if (curvature.value.length) {
    v.showCurvature(curvature.value)
    v.setLayer('heat', showHeat.value)
  }
}

onMounted(() => {
  void runChecks()
})

function toggleHeat() {
  showHeat.value = !showHeat.value
  viewer.value?.setLayer('heat', showHeat.value)
}

function selectCheck(c: SectionCheck) {
  selected.value = c
}
</script>

<template>
  <section v-if="store.current" class="page inspection-page">
    <div class="page-head compact">
      <div>
        <p class="eyebrow">INSPECTION</p>
        <h1>曲面检查</h1>
        <p class="page-sub">按环向站位生成法向截面，逐点与设定 R 的理论圆弧比较；曲率由曲面二阶差分计算。</p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="go('design')">返回设计</button>
        <button class="btn" :class="{ active: showHeat }" @click="toggleHeat">{{ showHeat ? '隐藏曲率云图' : '显示曲率云图' }}</button>
        <button class="btn btn-primary" :disabled="loading" @click="runChecks">{{ loading ? '计算中…' : '重新检查' }}</button>
      </div>
    </div>

    <div class="inspection-layout">
      <aside class="panel report-panel">
        <div class="stat-grid">
          <div class="stat">
            <span>检查截面</span>
            <strong>{{ checks.length }}</strong>
          </div>
          <div class="stat">
            <span>通过率</span>
            <strong :class="passRate === 100 ? 'ok' : 'warn'">{{ passRate.toFixed(1) }}%</strong>
          </div>
          <div class="stat">
            <span>最大半径偏差</span>
            <strong :class="maxError <= store.current.data.params.toleranceMm ? 'ok' : 'bad'">{{ maxError.toFixed(3) }}<em>mm</em></strong>
          </div>
          <div class="stat">
            <span>曲率突变点</span>
            <strong :class="abruptCount ? 'bad' : 'ok'">{{ abruptCount }}</strong>
          </div>
        </div>

        <div :class="['precision-banner', maxError <= 2 ? 'pass' : 'fail']">
          <strong>{{ maxError <= 2 ? '硬精度满足：任意受检法向截面 < 2 mm' : '存在超过 2 mm 的截面' }}</strong>
          <p>最大径向偏差 {{ maxError.toFixed(4) }} mm；放样点与 Three.js 曲面共用同一 elevation 函数。</p>
        </div>

        <div class="issue-head">
          <h2>{{ failed.length ? '半径不符位置' : '偏差最大站位' }}</h2>
          <span>{{ failed.length }} 处</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>站位</th><th>坐标</th><th>实测 R</th><th>偏差</th></tr></thead>
            <tbody>
              <tr v-for="c in failed.length ? failed : checks.slice().sort((a,b) => b.maxErrorMm - a.maxErrorMm).slice(0, 18)" :key="c.index" :class="{ badrow: !c.passed }" @click="selectCheck(c)">
                <td>K{{ c.station.toFixed(2) }}</td>
                <td>{{ c.x.toFixed(2) }}, {{ c.z.toFixed(2) }}</td>
                <td>{{ c.measuredRadius.toFixed(3) }}m</td>
                <td :class="c.passed ? 'ok' : 'bad'">{{ c.maxErrorMm.toFixed(3) }}mm</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!failed.length" class="all-pass">ふふ~没有超差位置，转角样条和距离场都很乖呢。</p>
      </aside>

      <main class="viewer-card panel">
        <Viewport3D :data="store.current.data" @ready="onReady" />
        <div class="legend">
          <span>低曲率</span>
          <i class="gradient"></i>
          <span>急弯 / 突变</span>
          <b class="red-dot"></b><span>标红</span>
        </div>
      </main>
    </div>
  </section>
  <section v-else class="page empty-page"><div class="empty-card"><h1>请先打开项目</h1><button class="btn btn-primary" @click="go('projects')">项目列表</button></div></section>
</template>

<style scoped>
.inspection-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 430px 1fr; gap: var(--sp-4); }
.report-panel { overflow: auto; }
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-bottom: var(--sp-4); }
.stat { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--sp-3); background: #f8fafc; }
.stat span { display: block; color: var(--text-3); font-size: var(--fs-xs); margin-bottom: 6px; }
.stat strong { font-size: var(--fs-xl); font-weight: var(--fw-semibold); }
.stat em { font-size: var(--fs-xs); font-style: normal; color: var(--text-3); margin-left: 4px; }
.ok { color: #15803d; } .warn { color: #d97706; } .bad { color: #dc2626; }
.precision-banner { border-radius: var(--radius); padding: var(--sp-4); margin-bottom: var(--sp-4); border: 1px solid; }
.precision-banner.pass { background: #f0fdf4; border-color: #bbf7d0; }
.precision-banner.fail { background: #fef2f2; border-color: #fecaca; }
.precision-banner strong { font-size: var(--fs-sm); }
.precision-banner p { font-size: var(--fs-xs); color: var(--text-2); margin-top: 6px; line-height: 1.5; }
.issue-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-2); }
.issue-head h2 { font-size: var(--fs-base); font-weight: var(--fw-semibold); }
.issue-head span { font-size: var(--fs-xs); color: var(--text-3); }
.table-wrap { border: 1px solid var(--border); border-radius: var(--radius); overflow: auto; max-height: 430px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-xs); }
th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: var(--sp-3); color: var(--text-2); font-weight: var(--fw-semibold); }
td { padding: var(--sp-3); border-top: 1px solid var(--border); white-space: nowrap; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #f8fafc; }
.badrow { background: #fff1f2; }
.all-pass { margin-top: var(--sp-3); color: #15803d; font-size: var(--fs-sm); }
.viewer-card { padding: var(--sp-2); position: relative; min-height: 560px; }
.viewer-card :deep(.viewport-host) { min-height: calc(100vh - 210px); }
.legend { position: absolute; left: var(--sp-6); bottom: var(--sp-5); display: flex; align-items: center; gap: var(--sp-2); background: rgba(255,255,255,.9); border: 1px solid var(--border); padding: var(--sp-2) var(--sp-3); border-radius: 999px; font-size: var(--fs-xs); color: var(--text-2); backdrop-filter: blur(8px); }
.gradient { width: 120px; height: 8px; border-radius: 999px; background: linear-gradient(90deg,#22c55e,#facc15,#ef4444); }
.red-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef233c; }
.head-actions .btn.active { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
@media (max-width: 1100px) {
  .inspection-layout { grid-template-columns: 1fr; }
  .viewer-card { min-height: 480px; }
  .viewer-card :deep(.viewport-host) { min-height: 460px; }
}
</style>
