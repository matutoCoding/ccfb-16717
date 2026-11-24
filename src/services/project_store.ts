import { reactive } from 'vue'
import type { HistoryRecord, ProjectData, ProjectRecord } from '../types/domain'
import {
  dbAllProjects,
  dbDeleteProject,
  dbDeleteVersion,
  dbGetProject,
  dbPutProject,
  dbPutVersion,
  dbVersions,
} from './db'
import { emptyProjectData, seedProjects } from '../domain/data/seed'

export const uid = () => globalThis.crypto?.randomUUID?.()
  ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

interface StoreState {
  ready: boolean
  projects: ProjectRecord[]
  current: ProjectRecord | null
  versions: HistoryRecord[]
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: number | null
}

export const store = reactive<StoreState>({
  ready: false,
  projects: [],
  current: null,
  versions: [],
  saveState: 'idle',
  lastSavedAt: null,
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSerialized = ''

export async function initStore() {
  let projects = await dbAllProjects()
  if (projects.length === 0) {
    const now = Date.now()
    projects = seedProjects(now)
    for (const p of projects) {
      await dbPutProject(p)
      await dbPutVersion({
        id: uid(),
        projectId: p.id,
        createdAt: p.updatedAt,
        label: '出厂测试项目',
        data: structuredClone(p.data),
      })
    }
  }
  store.projects = projects.sort((a, b) => b.updatedAt - a.updatedAt)
  store.ready = true
}

export async function refreshProjects() {
  store.projects = (await dbAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function openProject(id: string) {
  const project = await dbGetProject(id)
  if (!project) throw new Error('项目不存在')
  store.current = project
  store.versions = await dbVersions(id)
  lastSerialized = JSON.stringify(project.data)
  store.lastSavedAt = project.updatedAt
  return project
}

export function closeProject() {
  store.current = null
  store.versions = []
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
}

export async function createProject(name: string, client = '', location = '') {
  const now = Date.now()
  const project: ProjectRecord = {
    id: uid(),
    name,
    client,
    location,
    description: '',
    createdAt: now,
    updatedAt: now,
    data: emptyProjectData(),
  }
  await dbPutProject(project)
  await dbPutVersion({ id: uid(), projectId: project.id, createdAt: now, label: '创建项目', data: structuredClone(project.data) })
  await refreshProjects()
  return project
}

export async function duplicateProject(id: string) {
  const source = await dbGetProject(id)
  if (!source) return null
  const now = Date.now()
  const copy: ProjectRecord = {
    ...structuredClone(source),
    id: uid(),
    name: `${source.name} 副本`,
    createdAt: now,
    updatedAt: now,
    data: structuredClone(source.data),
  }
  await dbPutProject(copy)
  await dbPutVersion({ id: uid(), projectId: copy.id, createdAt: now, label: '由项目复制', data: structuredClone(copy.data) })
  await refreshProjects()
  return copy
}

export async function removeProject(id: string) {
  const versions = await dbVersions(id)
  await dbDeleteProject(id)
  await Promise.all(versions.map((v) => dbDeleteVersion(v.id)))
  if (store.current?.id === id) closeProject()
  await refreshProjects()
}

export function updateCurrentData(mutator: (data: ProjectData) => void) {
  if (!store.current) return
  mutator(store.current.data)
  store.current.updatedAt = Date.now()
  queueAutoSave()
}

export function queueAutoSave() {
  if (!store.current) return
  store.saveState = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persistCurrent('自动保存')
  }, 900)
}

export async function persistCurrent(label = '手动保存') {
  if (!store.current) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const serialized = JSON.stringify(store.current.data)
  if (serialized === lastSerialized && label === '自动保存') {
    store.saveState = 'saved'
    return
  }
  store.saveState = 'saving'
  try {
    store.current.updatedAt = Date.now()
    const snapshot = JSON.parse(JSON.stringify(store.current)) as ProjectRecord
    await dbPutProject(snapshot)
    await dbPutVersion({
      id: uid(),
      projectId: store.current.id,
      createdAt: store.current.updatedAt,
      label,
      data: JSON.parse(JSON.stringify(store.current.data)) as ProjectData,
    })
    store.versions = await dbVersions(store.current.id)
    lastSerialized = serialized
    store.lastSavedAt = store.current.updatedAt
    store.saveState = 'saved'
    await refreshProjects()
  } catch (error) {
    console.error(error)
    store.saveState = 'error'
  }
}

export async function restoreVersion(version: HistoryRecord) {
  if (!store.current) return
  store.current.data = structuredClone(version.data)
  await persistCurrent(`恢复至 ${new Date(version.createdAt).toLocaleString('zh-CN')}`)
}
