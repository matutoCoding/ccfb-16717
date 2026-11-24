<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProjectRecord } from '../types/domain'
import { createProject, duplicateProject, openProject, removeProject } from '../services/project_store'
import { go } from '../services/router'

const props = defineProps<{ projects: ProjectRecord[] }>()
const query = ref('')
const showCreate = ref(false)
const form = ref({ name: '', client: '', location: '' })

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.projects
  return props.projects.filter((p) => [p.name, p.client, p.location].join(' ').toLowerCase().includes(q))
})

async function open(id: string) {
  await openProject(id)
  go('design')
}

async function copy(id: string) {
  const p = await duplicateProject(id)
  if (p) await open(p.id)
}

async function create() {
  if (!form.value.name.trim()) return
  const p = await createProject(form.value.name.trim(), form.value.client.trim(), form.value.location.trim())
  showCreate.value = false
  form.value = { name: '', client: '', location: '' }
  await open(p.id)
}

async function remove(p: ProjectRecord) {
  if (!window.confirm(`确定删除「${p.name}」？全部历史版本会一起删除。`)) return
  await removeProject(p.id)
}

function thumbPath(p: ProjectRecord) {
  const pts = p.data.outlines[0]?.points ?? []
  if (!pts.length) return ''
  const xs = pts.map((q) => q.x)
  const zs = pts.map((q) => q.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const w = maxX - minX || 1
  const h = maxZ - minZ || 1
  const scale = 150 / Math.max(w, h)
  const ox = 110 - ((minX + maxX) / 2) * scale
  const oy = 75 + ((minZ + maxZ) / 2) * scale
  return pts.map((q, i) => `${i ? 'L' : 'M'} ${(q.x * scale + ox).toFixed(1)} ${(-q.z * scale + oy).toFixed(1)}`).join(' ') + ' Z'
}

function formatDate(t: number) {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">PROJECTS</p>
        <h1>项目列表</h1>
        <p class="page-sub">方案、曲面精度、放样数据和历史版本都保存在本机 IndexedDB。</p>
      </div>
      <div class="head-actions">
        <input v-model="query" class="input search" placeholder="搜索项目 / 甲方 / 位置" />
        <button class="btn btn-primary" @click="showCreate = true">＋ 新建项目</button>
      </div>
    </div>

    <div class="project-grid">
      <article v-for="p in filtered" :key="p.id" class="project-card" @click="open(p.id)">
        <div class="thumb">
          <svg viewBox="0 0 220 150" aria-hidden="true">
            <defs>
              <linearGradient :id="`g-${p.id}`" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#dbeafe" />
                <stop offset="1" stop-color="#94a3b8" />
              </linearGradient>
            </defs>
            <rect width="220" height="150" rx="14" :fill="`url(#g-${p.id})`" opacity="0.35" />
            <path :d="thumbPath(p)" fill="rgba(37,99,235,.22)" stroke="#1d4ed8" stroke-width="2.4" stroke-linejoin="round" />
          </svg>
          <span class="badge">R {{ p.data.params.transitionRadius.toFixed(2) }}m</span>
        </div>
        <div class="card-body">
          <h2>{{ p.name }}</h2>
          <p class="meta">{{ p.client || '未填写甲方' }} · {{ p.location || '未填写位置' }}</p>
          <p class="desc">{{ p.description || '暂无项目说明' }}</p>
          <div class="card-foot">
            <span>更新 {{ formatDate(p.updatedAt) }}</span>
            <div class="card-actions" @click.stop>
              <button class="btn btn-small" @click="copy(p.id)">复制</button>
              <button class="btn btn-small btn-danger-ghost" @click="remove(p)">删除</button>
              <button class="btn btn-small btn-primary" @click="open(p.id)">打开</button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <h2>新建碗池项目</h2>
        <label class="field"><span>项目名称</span><input v-model="form.name" class="input" placeholder="例如：滨河公园二号碗" /></label>
        <label class="field"><span>甲方 / 运营方</span><input v-model="form.client" class="input" /></label>
        <label class="field"><span>位置</span><input v-model="form.location" class="input" /></label>
        <div class="modal-actions">
          <button class="btn" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" :disabled="!form.name.trim()" @click="create">创建并设计</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head-actions { display: flex; gap: var(--sp-3); align-items: center; }
.search { width: 260px; max-width: 100%; }
.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: var(--sp-5); }
.project-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.project-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: #bfdbfe; }
.thumb { position: relative; height: 168px; background: linear-gradient(135deg, #f8fafc, #e2e8f0); }
.thumb svg { width: 100%; height: 100%; }
.badge { position: absolute; right: var(--sp-3); top: var(--sp-3); padding: var(--sp-1) var(--sp-3); border-radius: 999px; background: rgba(15,23,42,.82); color: white; font-size: var(--fs-xs); font-weight: 600; }
.card-body { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); }
.card-body h2 { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
.meta { color: var(--text-2); font-size: var(--fs-sm); }
.desc { color: var(--text-3); font-size: var(--fs-sm); line-height: 1.6; min-height: 44px; }
.card-foot { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3); color: var(--text-3); font-size: var(--fs-xs); }
.card-actions { display: flex; gap: var(--sp-2); }
</style>
