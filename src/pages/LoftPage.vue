<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Viewport3D from '../components/Viewport3D.vue'
import { store } from '../services/project_store'
import { go } from '../services/router'
import { settings } from '../services/settings_store'
import { BowlSurface } from '../domain/geometry/bowl_surface'
import { buildSurveyPoints, computeQuantities, surveyCsv } from '../domain/geometry/survey'
import { buildNormalTemplates, downloadText, sectionSvg } from '../domain/geometry/loft'
import type { BowlViewer } from '../three/BowlViewer'

const viewer = ref<BowlViewer | null>(null)
const spacing = ref(store.current?.data.params.surveyGridSpacing ?? 1)
const sectionSpacing = ref(store.current?.data.params.sectionSpacing ?? 2)
const selectedName = ref('')
const safeSpacing = computed(() => Number.isFinite(spacing.value) && spacing.value >= 0.2 ? spacing.value : 1)
const safeSectionSpacing = computed(() => Number.isFinite(sectionSpacing.value) && sectionSpacing.value >= 0.5 ? sectionSpacing.value : 2)

const surface = computed(() => {
  if (!store.current) return null
  return new BowlSurface(store.current.data.outlines, store.current.data.params, 56, store.current.data.basins ?? [])
})
const points = computed(() => surface.value ? buildSurveyPoints(surface.value, safeSpacing.value) : [])
const quantities = computed(() => surface.value ? computeQuantities(surface.value, { rebarLayers: settings.rebarLayers, rebarLapPercent: settings.rebarLapPercent }) : null)
const sections = computed(() => surface.value ? buildNormalTemplates(surface.value, safeSectionSpacing.value) : [])
const selectedSection = computed(() => sections.value.find((s) => s.name === selectedName.value) ?? sections.value[0] ?? null)
const svg = computed(() => selectedSection.value ? sectionSvg(selectedSection.value) : '')
const consistencyMm = computed(() => {
  if (!surface.value) return 0
  return points.value.reduce((max, p) => Math.max(max, Math.abs(p.elevation - surface.value!.elevation(p.x, p.z)) * 1000), 0)
})

watch(sections, (list) => {
  if (!selectedName.value && list[0]) selectedName.value = list[0].name
}, { immediate: true })

function onReady(v: BowlViewer) {
  viewer.value = v
  v.showSurveyPoints(points.value)
}

watch(points, (list) => viewer.value?.showSurveyPoints(list))

function exportCsv() {
  if (!store.current) return
  const csv = surveyCsv(points.value, safeSpacing.value, {
    projectName: store.current.name,
    surveyor: settings.surveyorName,
    company: settings.company,
    coordinateSystem: settings.coordinateSystem,
  })
  downloadText(`${store.current.name}-放样点-${safeSpacing.value}m.csv`, `﻿${csv}`, 'text/csv;charset=utf-8')
}

function exportSvg() {
  if (!selectedSection.value) return
  downloadText(`${store.current?.name}-${selectedSection.value.name}.svg`, sectionSvg(selectedSection.value), 'image/svg+xml;charset=utf-8')
}

function exportAllTemplates() {
  if (!store.current) return
  const body = sections.value.map(sectionSvg).join('<hr style="margin:32px 0;border:0;border-top:1px dashed #94a3b8"/>')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${store.current.name} 截面模板</title><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;padding:24px;background:#f1f5f9}svg{max-width:100%;height:auto;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.12);border-radius:12px}@media print{body{background:#fff;padding:0}svg{page-break-after:always;box-shadow:none}}</style></head><body><h1>${store.current.name} · 截面切片模板</h1><p>测量/施工坐标单位 m；蓝色为设计切片，红色虚线为 R=${store.current.data.params.transitionRadius}m 理论圆弧。</p>${body}</body></html>`
  downloadText(`${store.current.name}-全部截面模板.html`, html, 'text/html;charset=utf-8')
}

function exportQuantityCsv() {
  if (!quantities.value || !store.current) return
  const q = quantities.value
  const rows = [
    ['项目', store.current.name],
    ['曲面面积_m2', q.surfaceArea.toFixed(3)],
    ['投影面积_m2', q.projectedArea.toFixed(3)],
    ['混凝土方量_m3', q.concreteVolume.toFixed(3)],
    ['开挖方量_m3', q.excavationVolume.toFixed(3)],
    ['钢筋网面积_m2', q.rebarArea.toFixed(3)],
    ['统计网格点数', String(q.pointCount)],
  ].map((r) => r.join(',')).join('\n')
  downloadText(`${store.current.name}-方量统计.csv`, `﻿${rows}`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <section v-if="store.current" class="page loft-page">
    <div class="page-head compact">
      <div>
        <p class="eyebrow">SETTING OUT</p>
        <h1>施工放样</h1>
        <p class="page-sub">规则网格标高、法向截面模板、混凝土与钢筋网统计均来自同一个曲面内核。</p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="go('inspection')">精度报告</button>
        <button class="btn" @click="exportQuantityCsv">导方量</button>
        <button class="btn" @click="exportAllTemplates">全部模板</button>
        <button class="btn btn-primary" @click="exportCsv">导出测量 CSV</button>
      </div>
    </div>

    <div class="loft-layout">
      <aside class="left-column">
        <div class="panel">
          <h2>放样网格</h2>
          <label class="field"><span>网格间距（m）</span><input class="input" type="number" min="0.25" max="3" step="0.1" v-model.number="spacing" /></label>
          <div class="mini-stats">
            <div><span>点数</span><strong>{{ points.length }}</strong></div>
            <div><span>标高一致性</span><strong class="ok">{{ consistencyMm.toFixed(4) }} mm</strong></div>
          </div>
          <div class="table-wrap points">
            <table>
              <thead><tr><th>点号</th><th>X</th><th>Z</th><th>标高</th></tr></thead>
              <tbody>
                <tr v-for="p in points.slice(0, 160)" :key="p.id">
                  <td>{{ p.id }}</td><td>{{ p.x.toFixed(2) }}</td><td>{{ p.z.toFixed(2) }}</td><td>{{ p.elevation.toFixed(4) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="quantities" class="panel quantity-panel">
          <h2>方量与钢筋</h2>
          <div class="q-grid">
            <div><span>曲面面积</span><strong>{{ quantities.surfaceArea.toFixed(1) }}<em>㎡</em></strong></div>
            <div><span>投影面积</span><strong>{{ quantities.projectedArea.toFixed(1) }}<em>㎡</em></strong></div>
            <div><span>混凝土方量</span><strong class="accent">{{ quantities.concreteVolume.toFixed(1) }}<em>m³</em></strong></div>
            <div><span>开挖方量</span><strong>{{ quantities.excavationVolume.toFixed(1) }}<em>m³</em></strong></div>
            <div><span>钢筋网面积</span><strong class="accent">{{ quantities.rebarArea.toFixed(1) }}<em>㎡</em></strong></div>
            <div><span>钢筋层数 / 搭接</span><strong>{{ settings.rebarLayers }}<em>层 / {{ settings.rebarLapPercent }}%</em></strong></div>
          </div>
          <p class="formula">混凝土 = 曲面面积 × 壳厚 {{ store.current.data.params.shellThickness }}m；钢筋网 = 曲面面积 × 层数 × 搭接系数。</p>
        </div>
      </aside>

      <main class="right-column">
        <div class="panel viewer-panel">
          <Viewport3D :data="store.current.data" @ready="onReady" />
        </div>
        <div class="panel template-panel">
          <div class="template-head">
            <div>
              <h2>截面切片模板</h2>
              <p>每 {{ sectionSpacing }}m 环向站位生成法向截面，可导出 SVG 或包含全部切片的打印 HTML。</p>
            </div>
            <div class="template-actions">
              <select class="input" v-model="selectedName">
                <option v-for="s in sections" :key="s.name" :value="s.name">{{ s.name }} · K{{ s.station.toFixed(2) }}</option>
              </select>
              <input class="input small" type="number" min="0.5" max="5" step="0.1" v-model.number="sectionSpacing" />
              <button class="btn btn-primary" @click="exportSvg">导出当前 SVG</button>
            </div>
          </div>
          <div class="svg-wrap" v-html="svg"></div>
        </div>
      </main>
    </div>
  </section>
  <section v-else class="page empty-page"><div class="empty-card"><h1>请先打开项目</h1><button class="btn btn-primary" @click="go('projects')">项目列表</button></div></section>
</template>

<style scoped>
.loft-layout { display: grid; grid-template-columns: 390px minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
.left-column, .right-column { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); box-shadow: var(--shadow-sm); }
.panel h2 { font-size: var(--fs-base); font-weight: var(--fw-semibold); margin-bottom: var(--sp-3); }
.mini-stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin: var(--sp-4) 0; }
.mini-stats div, .q-grid div { border: 1px solid var(--border); background: #f8fafc; border-radius: var(--radius); padding: var(--sp-3); }
.mini-stats span, .q-grid span { display: block; color: var(--text-3); font-size: var(--fs-xs); margin-bottom: 6px; }
.mini-stats strong { font-size: var(--fs-base); }
.ok { color: #15803d; }
.table-wrap { border: 1px solid var(--border); border-radius: var(--radius); overflow: auto; max-height: 310px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-xs); }
th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: var(--sp-3); }
td { padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--border); white-space: nowrap; }
.q-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.q-grid strong { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
.q-grid em { font-style: normal; font-size: var(--fs-xs); color: var(--text-3); margin-left: 4px; }
.accent { color: #1d4ed8; }
.formula { margin-top: var(--sp-3); color: var(--text-3); font-size: var(--fs-xs); line-height: 1.6; }
.viewer-panel { padding: var(--sp-2); height: 460px; }
.viewer-panel :deep(.viewport-host) { min-height: 420px; height: 420px; }
.template-head { display: flex; justify-content: space-between; gap: var(--sp-4); align-items: flex-start; margin-bottom: var(--sp-4); }
.template-head p { color: var(--text-3); font-size: var(--fs-xs); line-height: 1.6; margin-top: 4px; }
.template-actions { display: flex; gap: var(--sp-2); align-items: center; }
.input.small { width: 86px; }
.svg-wrap { overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: #f8fafc; padding: var(--sp-3); }
.svg-wrap :deep(svg) { display: block; min-width: 720px; width: 100%; height: auto; background: white; border-radius: var(--radius); }
@media (max-width: 1100px) {
  .loft-layout { grid-template-columns: 1fr; }
  .template-head { flex-direction: column; }
  .template-actions { flex-wrap: wrap; }
}
</style>
