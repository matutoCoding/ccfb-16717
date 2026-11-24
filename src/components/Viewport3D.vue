<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProjectData } from '../types/domain'
import { BowlViewer } from '../three/BowlViewer'

const props = defineProps<{ data: ProjectData; view?: 'perspective' | 'top' | 'first' }>()
const emit = defineEmits<{ ready: [viewer: BowlViewer] }>()
const host = ref<HTMLDivElement | null>(null)
const errorMessage = ref('')
let viewer: BowlViewer | null = null
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!host.value) return
  try {
    viewer = new BowlViewer(host.value)
    viewer.loadProject(props.data)
    if (props.view) viewer.setView(props.view)
    emit('ready', viewer)
  } catch (error) {
    console.error(error)
    errorMessage.value = '当前浏览器无法初始化 WebGL 3D 视口；平面编辑、计算和导出仍可使用。'
  }
})

watch(() => JSON.stringify(props.data), () => {
  if (!viewer) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => viewer?.loadProject(props.data), 220)
})

watch(() => props.view, (view) => view && viewer?.setView(view))

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  viewer?.dispose()
  viewer = null
})

defineExpose({ getViewer: () => viewer })
</script>

<template>
  <div class="viewport-wrap">
    <div ref="host" class="viewport-host"></div>
    <div v-if="errorMessage" class="viewport-error">{{ errorMessage }}</div>
  </div>
</template>

<style scoped>
.viewport-wrap { position: relative; width: 100%; height: 100%; min-height: 420px; }
.viewport-host { width: 100%; height: 100%; min-height: 420px; border-radius: var(--radius); overflow: hidden; background: #eef3f7; }
.viewport-host :deep(canvas) { display: block; }
.viewport-error { position: absolute; inset: 0; display: grid; place-items: center; padding: var(--sp-5); text-align: center; color: var(--text-2); background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius); }
</style>
