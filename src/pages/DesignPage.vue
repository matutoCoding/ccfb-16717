<script setup lang="ts">
import { computed, ref } from 'vue'
import PlanEditor from '../components/PlanEditor.vue'
import Viewport3D from '../components/Viewport3D.vue'
import { persistCurrent, restoreVersion, store, uid, updateCurrentData } from '../services/project_store'
import { go } from '../services/router'
import type { Basin, BowlParams } from '../types/domain'

const project = computed(() => store.current)
const view = ref<'perspective' | 'top'>('perspective')
const tab = ref<'plan' | 'split'>('split')

function updateNumber(key: keyof BowlParams, value: number) {
  if (!project.value || !Number.isFinite(value) || value < 0) return
  if (key === 'transitionRadius' && value < 0.5) return
  updateCurrentData((d) => {
    d.params[key] = value
  })
}

function onPointsChange(points: { x: number; z: number }[]) {
  updateCurrentData((d) => {
    d.outlines[0].points = points
  })
}

function addBasin() {
  updateCurrentData((d) => {
    d.basins ??= []
    d.basins.push({
      id: uid(),
      name: `深碗 ${d.basins.length + 1}`,
      x: 0,
      z: 0,
      depth: 0.55,
      radius: 2.6,
    })
  })
}

function updateBasin(basin: Basin, key: keyof Basin, value: number | string) {
  if (key !== 'name' && (!Number.isFinite(value as number) || (value as number) < 0)) return
  updateCurrentData((d) => {
    const target = d.basins?.find((item) => item.id === basin.id)
    if (target) Object.assign(target, { [key]: value })
  })
}

function removeBasin(id: string) {
  updateCurrentData((d) => {
    d.basins = d.basins?.filter((item) => item.id !== id) ?? []
  })
}

async function saveNow() {
  await persistCurrent('手动保存版本')
}

async function restore(id: string) {
  const version = store.versions.find((v) => v.id === id)
  if (version && window.confirm('恢复这个版本？当前未归档改动也会另存为新版本。')) await restoreVersion(version)
}

function formatTime(t: number) {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <section v-if="project" class="page design-page">
    <div class="page-head compact">
      <div>
        <p class="eyebrow">DESIGN</p>
        <h1>{{ project.name }}</h1>
        <p class="save-state">
          <span :class="['dot', store.saveState]"></span>
          {{ store.saveState === 'saving' ? '正在写入 IndexedDB…' : store.saveState === 'error' ? '保存失败' : `改动已自动保存 · ${store.versions.length} 个版本` }}
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="go('projects')">返回列表</button>
        <button class="btn" @click="go('inspection')">曲面检查</button>
        <button class="btn btn-primary" @click="saveNow">存为版本</button>
      </div>
    </div>

    <div class="design-layout">
      <aside class="panel params-panel">
        <h2>池型参数</h2>
        <label class="field">
          <span>过渡弧半径 R（m）</span>
          <input class="input" type="number" min="0.8" max="8" step="0.01" :value="project.data.params.transitionRadius" @input="updateNumber('transitionRadius', ($event.target as HTMLInputElement).valueAsNumber)" />
          <small>任意法向截面按该半径圆弧校验</small>
        </label>
        <label class="field">
          <span>垂直段高度 H（m）</span>
          <input class="input" type="number" min="0" max="3" step="0.01" :value="project.data.params.verticalHeight" @input="updateNumber('verticalHeight', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>
        <label class="field">
          <span>池底坡度（%）</span>
          <input class="input" type="number" min="0" max="5" step="0.1" :value="project.data.params.bottomSlopePercent" @input="updateNumber('bottomSlopePercent', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>
        <label class="field">
          <span>坡度方向（°）</span>
          <input class="input" type="number" min="0" max="360" step="1" :value="project.data.params.slopeDirectionDeg" @input="updateNumber('slopeDirectionDeg', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>
        <label class="field">
          <span>坡度过渡长度（m）</span>
          <input class="input" type="number" min="0.5" max="6" step="0.1" :value="project.data.params.bottomBlend" @input="updateNumber('bottomBlend', ($event.target as HTMLInputElement).valueAsNumber)" />
          <small>在弧脚后用五阶平滑接入坡度，避免折痕</small>
        </label>

        <div class="basin-head">
          <span>连通深碗 / 池底低点</span>
          <button class="btn btn-small" @click="addBasin">添加</button>
        </div>
        <div v-for="basin in project.data.basins ?? []" :key="basin.id" class="basin-card">
          <div class="basin-title">
            <input class="input basin-name" :value="basin.name" @input="updateBasin(basin, 'name', ($event.target as HTMLInputElement).value)" />
            <button class="btn btn-small btn-danger-ghost" @click="removeBasin(basin.id)">删除</button>
          </div>
          <div class="basin-grid">
            <label>X<input class="input" type="number" step="0.1" :value="basin.x" @input="updateBasin(basin, 'x', ($event.target as HTMLInputElement).valueAsNumber)" /></label>
            <label>Z<input class="input" type="number" step="0.1" :value="basin.z" @input="updateBasin(basin, 'z', ($event.target as HTMLInputElement).valueAsNumber)" /></label>
            <label>深<input class="input" type="number" min="0" max="2" step="0.05" :value="basin.depth" @input="updateBasin(basin, 'depth', ($event.target as HTMLInputElement).valueAsNumber)" /></label>
            <label>半径<input class="input" type="number" min="1" max="6" step="0.1" :value="basin.radius" @input="updateBasin(basin, 'radius', ($event.target as HTMLInputElement).valueAsNumber)" /></label>
          </div>
        </div>

        <label class="field">
          <span>混凝土壳厚（m）</span>
          <input class="input" type="number" min="0.1" max="0.6" step="0.01" :value="project.data.params.shellThickness" @input="updateNumber('shellThickness', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>
        <label class="field">
          <span>放样网格（m）</span>
          <input class="input" type="number" min="0.25" max="3" step="0.1" :value="project.data.params.surveyGridSpacing" @input="updateNumber('surveyGridSpacing', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>
        <label class="field">
          <span>精度阈值（mm）</span>
          <input class="input" type="number" min="1" max="10" step="0.5" :value="project.data.params.toleranceMm" @input="updateNumber('toleranceMm', ($event.target as HTMLInputElement).valueAsNumber)" />
        </label>

        <div class="material-block">
          <h3>单独构件</h3>
          <div class="check-row"><span>花岗岩 / 预制混凝土压顶石</span><b>已建</b></div>
          <div class="check-row"><span>镀锌金属护边 / 圆钢护角</span><b>已建</b></div>
          <p>压顶采用闭合样条扫掠，金属护边采用高密度 TubeGeometry，转角不产生折痕。</p>
        </div>
      </aside>

      <main class="center-panel">
        <div class="view-switch">
          <button :class="{ active: tab === 'split' }" @click="tab = 'split'">平面 + 3D</button>
          <button :class="{ active: tab === 'plan' }" @click="tab = 'plan'">仅平面</button>
          <div class="spacer"></div>
          <button class="btn btn-small" :class="{ active: view === 'perspective' }" @click="view = 'perspective'">透视</button>
          <button class="btn btn-small" :class="{ active: view === 'top' }" @click="view = 'top'">俯视</button>
        </div>
        <div :class="['workspace', tab]">
          <PlanEditor :points="project.data.outlines[0].points" :radius="project.data.params.transitionRadius" @change="onPointsChange" />
          <Viewport3D v-show="tab === 'split'" :data="project.data" :view="view" />
        </div>
      </main>

      <aside class="panel history-panel">
        <h2>历史版本</h2>
        <p class="hint">停止编辑约 0.9 秒后自动写入；复制项目会得到独立数据库记录。</p>
        <div class="version-list">
          <button v-for="v in store.versions.slice(0, 30)" :key="v.id" class="version-item" @click="restore(v.id)">
            <strong>{{ v.label }}</strong>
            <span>{{ formatTime(v.createdAt) }}</span>
          </button>
        </div>
      </aside>
    </div>
  </section>

  <section v-else class="page empty-page">
    <div class="empty-card">
      <h1>还没有打开项目</h1>
      <p>先去项目列表新建、复制或选择一个测试碗池。</p>
      <button class="btn btn-primary" @click="go('projects')">前往项目列表</button>
    </div>
  </section>
</template>

<style scoped>
.design-page { min-height: calc(100vh - 72px); display: flex; flex-direction: column; }
.design-layout { flex: 1; min-height: 720px; display: grid; grid-template-columns: 300px minmax(520px, 1fr) 280px; gap: var(--sp-4); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-5); overflow: auto; box-shadow: var(--shadow-sm); }
.panel h2 { font-size: var(--fs-base); font-weight: var(--fw-semibold); margin-bottom: var(--sp-4); }
.panel h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--sp-2); }
.params-panel { display: flex; flex-direction: column; gap: var(--sp-3); }
.params-panel .field small { color: var(--text-3); line-height: 1.4; }
.center-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.view-switch { display: flex; align-items: center; gap: var(--sp-2); }
.view-switch button { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); padding: 8px 12px; font-size: var(--fs-sm); cursor: pointer; }
.view-switch button.active { background: #0f172a; color: white; border-color: #0f172a; }
.spacer { flex: 1; }
.workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
.workspace.plan { grid-template-columns: 1fr; }
.workspace > * { min-height: 520px; }
.history-panel .hint { font-size: var(--fs-xs); color: var(--text-3); line-height: 1.6; margin-bottom: var(--sp-3); }
.version-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.version-item { text-align: left; border: 1px solid var(--border); background: #fff; border-radius: var(--radius); padding: var(--sp-3); cursor: pointer; transition: border-color .15s, background .15s; display: flex; flex-direction: column; gap: 4px; }
.version-item:hover { border-color: #93c5fd; background: #f8fbff; }
.version-item strong { font-size: var(--fs-sm); font-weight: var(--fw-medium); }
.version-item span { font-size: var(--fs-xs); color: var(--text-3); }
.material-block { margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
.basin-head { display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-2); }
.basin-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--sp-3); background: #f8fafc; display: flex; flex-direction: column; gap: var(--sp-2); }
.basin-title { display: flex; gap: var(--sp-2); align-items: center; }
.basin-name { min-height: 34px; font-size: var(--fs-xs); }
.basin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
.basin-grid label { font-size: var(--fs-xs); color: var(--text-3); display: flex; flex-direction: column; gap: 4px; }
.basin-grid .input { min-height: 34px; padding: 4px 8px; font-size: var(--fs-xs); }
.check-row { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: var(--fs-xs); padding: var(--sp-2) 0; }
.check-row b { color: #15803d; font-weight: var(--fw-semibold); white-space: nowrap; }
.material-block p { color: var(--text-3); font-size: var(--fs-xs); line-height: 1.6; margin-top: var(--sp-2); }
.save-state { display: flex; align-items: center; gap: 8px; color: var(--text-3); font-size: var(--fs-sm); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
.dot.saving { background: #f59e0b; }
.dot.saved { background: #22c55e; }
.dot.error { background: #ef4444; }
.empty-page { display: grid; place-items: center; }
.empty-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-7); text-align: center; box-shadow: var(--shadow); }
.empty-card h1 { font-size: var(--fs-xl); margin-bottom: var(--sp-3); }
.empty-card p { color: var(--text-2); margin-bottom: var(--sp-5); }
@media (max-width: 1280px) { .design-layout { grid-template-columns: 280px 1fr; } .history-panel { display: none; } }
@media (max-width: 900px) {
  .design-layout { grid-template-columns: 1fr; min-height: auto; }
  .workspace { grid-template-columns: 1fr; }
  .workspace > * { min-height: 460px; }
  .params-panel { overflow: visible; }
}
</style>
