<script setup lang="ts">
import { ref } from 'vue'
import { settings } from '../services/settings_store'
import { store, uid } from '../services/project_store'
import { dbClearAll, dbPutProject, dbPutVersion } from '../services/db'
import { seedProjects } from '../domain/data/seed'
import { downloadText } from '../domain/geometry/loft'

const importInput = ref<HTMLInputElement | null>(null)
const message = ref('')

async function resetDemo() {
  if (!window.confirm('会清空当前 IndexedDB 并重建两个测试项目，确定？')) return
  await dbClearAll()
  const now = Date.now()
  for (const p of seedProjects(now)) {
    await dbPutProject(p)
    await dbPutVersion({
      id: uid(),
      projectId: p.id,
      createdAt: now,
      label: '出厂测试项目',
      data: p.data,
    })
  }
  window.location.hash = '#/projects'
  window.location.reload()
}

function exportAll() {
  downloadText('bowl-studio-backup.json', JSON.stringify(store.projects, null, 2), 'application/json')
}

async function importJson(file: File) {
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    const list = Array.isArray(json) ? json : [json]
    for (const project of list) {
      if (!project.id || !project.data?.outlines) continue
      await dbPutProject(project)
    }
    message.value = `已导入 ${list.length} 个项目，即将刷新`
    setTimeout(() => window.location.reload(), 700)
  } catch (error) {
    message.value = `导入失败：${(error as Error).message}`
  }
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void importJson(file)
}
</script>

<template>
  <section class="page settings-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>设置</h1>
        <p class="page-sub">测量交付信息、钢筋统计参数和本机数据管理。</p>
      </div>
    </div>

    <div class="settings-grid">
      <div class="panel">
        <h2>交付信息</h2>
        <label class="field"><span>测量员</span><input class="input" v-model="settings.surveyorName" /></label>
        <label class="field"><span>单位 / 坐标系</span><input class="input" v-model="settings.coordinateSystem" /></label>
        <label class="field"><span>公司 / 项目部</span><input class="input" v-model="settings.company" /></label>
      </div>

      <div class="panel">
        <h2>统计与检查</h2>
        <label class="field"><span>钢筋网层数</span><input class="input" type="number" min="1" max="4" v-model.number="settings.rebarLayers" /></label>
        <label class="field"><span>搭接 / 损耗（%）</span><input class="input" type="number" min="0" max="25" v-model.number="settings.rebarLapPercent" /></label>
        <label class="field"><span>曲率网格步长（m）</span><input class="input" type="number" min="0.1" max="0.5" step="0.05" v-model.number="settings.curvatureGridStep" /></label>
        <div class="precision-note">
          <strong>硬精度口径</strong>
          <p>过渡弧检查使用理论圆弧的径向距离，阈值固定按项目容差（测试项目 2mm）。放样 CSV 标高直接来自 BowlSurface.elevation。</p>
        </div>
      </div>

      <div class="panel data-panel">
        <h2>数据管理</h2>
        <p>所有项目与历史版本仅保存在当前浏览器 IndexedDB，不会上传。清理浏览器站点数据会删除项目，请定期导出 JSON 备份。</p>
        <div class="button-row">
          <button class="btn btn-primary" @click="exportAll">导出全部备份</button>
          <button class="btn" @click="importInput?.click()">导入 JSON</button>
          <button class="btn btn-danger" @click="resetDemo">重建测试项目</button>
          <input ref="importInput" type="file" accept="application/json" hidden @change="onFileChange" />
        </div>
        <p v-if="message" class="message">{{ message }}</p>
        <div class="demo-list">
          <div><b>肾形碗</b><span>腰角内凹 + R2.25m</span></div>
          <div><b>三碗连通大池</b><span>三叶外轮廓 + R2.65m</span></div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr)); gap: var(--sp-5); max-width: 1100px; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-6); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: var(--sp-4); }
.panel h2 { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
.data-panel { grid-column: 1 / -1; }
.data-panel p { color: var(--text-2); line-height: 1.8; font-size: var(--fs-sm); }
.button-row { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
.btn-danger { color: #b91c1c; border-color: #fecaca; background: #fff1f2; }
.precision-note { border-radius: var(--radius); background: #eff6ff; padding: var(--sp-4); border: 1px solid #bfdbfe; }
.precision-note strong { color: #1d4ed8; font-size: var(--fs-sm); }
.precision-note p { margin-top: 8px; color: #1e40af; font-size: var(--fs-xs); line-height: 1.7; }
.message { color: #15803d; font-size: var(--fs-sm); }
.demo-list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.demo-list div { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); background: #f8fafc; }
.demo-list span { color: var(--text-3); font-size: var(--fs-xs); }
@media (max-width: 820px) {
  .settings-grid { grid-template-columns: 1fr; }
  .demo-list { grid-template-columns: 1fr; }
}
</style>
