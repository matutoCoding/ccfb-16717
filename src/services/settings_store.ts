import { reactive, watch } from 'vue'

export interface AppSettings {
  surveyorName: string
  company: string
  coordinateSystem: string
  rebarLayers: number
  rebarLapPercent: number
  curvatureGridStep: number
  autoSaveSeconds: number
}

const KEY = 'bowl-studio-settings-v1'

const fallback: AppSettings = {
  surveyorName: '测量员',
  company: '碗池营造工作室',
  coordinateSystem: '独立施工坐标系 / m',
  rebarLayers: 2,
  rebarLapPercent: 8,
  curvatureGridStep: 0.25,
  autoSaveSeconds: 1,
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback }
  } catch {
    return { ...fallback }
  }
}

export const settings = reactive<AppSettings>(load())

watch(settings, (value) => {
  localStorage.setItem(KEY, JSON.stringify(value))
}, { deep: true })
