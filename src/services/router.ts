import { reactive } from 'vue'

export type PageName = 'projects' | 'design' | 'inspection' | 'ride' | 'loft' | 'settings'

export const route = reactive<{ page: PageName }>({ page: pageFromHash() })

function pageFromHash(): PageName {
  const hash = window.location.hash.replace('#/', '') as PageName
  const allowed: PageName[] = ['projects', 'design', 'inspection', 'ride', 'loft', 'settings']
  return allowed.includes(hash) ? hash : 'projects'
}

export function go(page: PageName) {
  window.location.hash = `/${page}`
  route.page = page
}

export function bindRoute() {
  window.addEventListener('hashchange', () => {
    route.page = pageFromHash()
  })
}
