<script setup lang="ts">
import { onMounted } from 'vue'
import ProjectListPage from './pages/ProjectListPage.vue'
import DesignPage from './pages/DesignPage.vue'
import InspectionPage from './pages/InspectionPage.vue'
import RidePage from './pages/RidePage.vue'
import LoftPage from './pages/LoftPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import { bindRoute, go, route, type PageName } from './services/router'
import { initStore, openProject, store } from './services/project_store'

const nav: Array<{ key: PageName; label: string; icon: string }> = [
  { key: 'projects', label: '项目列表', icon: 'M4 7h16M4 12h16M4 17h10' },
  { key: 'design', label: '池型设计', icon: 'M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10Z' },
  { key: 'inspection', label: '曲面检查', icon: 'M3 12h4l2-7 4 14 2-7h6' },
  { key: 'ride', label: '滑行预览', icon: 'M13 3 4 14h6l-1 7 9-11h-6l1-7Z' },
  { key: 'loft', label: '施工放样', icon: 'M4 20V4m0 16h16M8 16l3-4 3 2 4-6' },
  { key: 'settings', label: '设置', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L15 3H9l-.3 2.4a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3L9 21h6l.3-2.4a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z' },
]

onMounted(async () => {
  bindRoute()
  await initStore()
  if (route.page !== 'projects' && !store.current && store.projects[0]) {
    await openProject(store.projects[0].id)
  }
})

function navigate(key: PageName) {
  if (key !== 'projects' && !store.current && store.projects[0]) {
    void openProject(store.projects[0].id).then(() => go(key))
  } else {
    go(key)
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 15c3 0 3-8 9-8s6 8 9 8" />
            <path d="M3 18h18" />
          </svg>
        </div>
        <div>
          <strong>Bowl Studio</strong>
          <span>碗池曲面与放样台</span>
        </div>
      </div>

      <nav class="nav">
        <button v-for="item in nav" :key="item.key" class="nav-item" :class="{ active: route.page === item.key }" @click="navigate(item.key)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path :d="item.icon" /></svg>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="side-card">
        <strong>2 mm 曲面精度</strong>
        <p>法向截面圆弧径向偏差校验 · 放样标高与设计内核同源</p>
      </div>
    </aside>

    <main class="content">
      <ProjectListPage v-if="route.page === 'projects'" :projects="store.projects" />
      <DesignPage v-else-if="route.page === 'design'" />
      <InspectionPage v-else-if="route.page === 'inspection'" />
      <RidePage v-else-if="route.page === 'ride'" />
      <LoftPage v-else-if="route.page === 'loft'" />
      <SettingsPage v-else-if="route.page === 'settings'" />
    </main>
  </div>
</template>
