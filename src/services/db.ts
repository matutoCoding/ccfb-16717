import type { HistoryRecord, ProjectRecord } from '../types/domain'

const DB_NAME = 'bowl-studio-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'id' })
        store.createIndex('projectId', 'projectId')
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = run(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

export const dbPutProject = (project: ProjectRecord) => tx('projects', 'readwrite', (s) => s.put(project))
export const dbGetProject = (id: string) => tx<ProjectRecord | undefined>('projects', 'readonly', (s) => s.get(id))
export const dbDeleteProject = (id: string) => tx('projects', 'readwrite', (s) => s.delete(id))
export const dbAllProjects = () => tx<ProjectRecord[]>('projects', 'readonly', (s) => s.getAll())
export const dbPutVersion = (version: HistoryRecord) => tx('versions', 'readwrite', (s) => s.put(version))
export const dbDeleteVersion = (id: string) => tx('versions', 'readwrite', (s) => s.delete(id))

export async function dbVersions(projectId: string): Promise<HistoryRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('versions', 'readonly')
    const index = transaction.objectStore('versions').index('projectId')
    const request = index.getAll(IDBKeyRange.only(projectId))
    request.onsuccess = () => {
      const list = request.result as HistoryRecord[]
      resolve(list.sort((a, b) => b.createdAt - a.createdAt))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function dbClearAll() {
  const db = await openDb()
  await Promise.all(['projects', 'versions'].map((name) => new Promise<void>((resolve, reject) => {
    const req = db.transaction(name, 'readwrite').objectStore(name).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })))
}
