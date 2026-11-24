import type { BowlParams, ProjectData, ProjectRecord } from '../../types/domain'

export const DEFAULT_PARAMS: BowlParams = {
  transitionRadius: 2.4,
  verticalHeight: 0.35,
  bottomSlopePercent: 0.8,
  slopeDirectionDeg: 110,
  bottomBlend: 2.0,
  shellThickness: 0.22,
  surveyGridSpacing: 1,
  sectionSpacing: 2,
  toleranceMm: 2,
}

const kidneyPoints = Array.from({ length: 32 }, (_, i) => {
  const t = (i / 32) * Math.PI * 2
  return {
    x: Number((6.2 * Math.cos(t) + 1.6 * Math.cos(2 * t)).toFixed(3)),
    z: Number((4.4 * Math.sin(t) + 0.55 * Math.sin(2 * t)).toFixed(3)),
  }
})

function polarPoints(count: number, base: number, amp: number, phase: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2
    const r = base + amp * Math.cos(3 * (t - phase)) + 0.25 * Math.cos(t - 0.4)
    return { x: Number((r * Math.cos(t)).toFixed(3)), z: Number((r * Math.sin(t) * 0.88).toFixed(3)) }
  })
}

export function kidneyData(): ProjectData {
  return {
    schemaVersion: 1,
    outlines: [{ id: 'outline-kidney', name: '肾形碗池口', points: kidneyPoints }],
    basins: [{ id: 'basin-k-1', name: '肾形深碗', x: 0.8, z: 0.2, depth: 0.42, radius: 3.4 }],
    params: { ...DEFAULT_PARAMS, transitionRadius: 2.25, verticalHeight: 0.45, bottomSlopePercent: 0.9 },
  }
}

export function tripleBowlData(): ProjectData {
  return {
    schemaVersion: 1,
    outlines: [{ id: 'outline-triple', name: '三碗连通池口', points: polarPoints(32, 7.4, 2.1, 0.35) }],
    basins: [
      { id: 'basin-t-1', name: '东碗', x: 5.9, z: 1.7, depth: 0.72, radius: 3.0 },
      { id: 'basin-t-2', name: '西北碗', x: -4.7, z: 3.4, depth: 0.66, radius: 2.9 },
      { id: 'basin-t-3', name: '南碗', x: -1.4, z: -4.7, depth: 0.7, radius: 2.8 },
    ],
    params: { ...DEFAULT_PARAMS, transitionRadius: 2.65, verticalHeight: 0.5, bottomSlopePercent: 0.6, surveyGridSpacing: 1.2 },
  }
}

export function emptyProjectData(): ProjectData {
  return {
    schemaVersion: 1,
    outlines: [{
      id: `outline-${Math.round(Math.random() * 1e9)}`,
      name: '新建池口',
      points: [
        { x: -5, z: -3 },
        { x: -2, z: -4.5 },
        { x: 2.5, z: -4.2 },
        { x: 5.2, z: -2 },
        { x: 4.8, z: 2.4 },
        { x: 1.8, z: 4.3 },
        { x: -2.8, z: 4.1 },
        { x: -5.3, z: 1.8 },
      ],
    }],
    params: { ...DEFAULT_PARAMS },
  }
}

export function seedProjects(now: number): ProjectRecord[] {
  return [
    {
      id: 'demo-kidney',
      name: '青釉肾形碗',
      client: '西海岸滑板公园',
      location: 'A 区东侧',
      description: '训练型肾形碗，重点验证腰角内凹处过渡弧光顺度。',
      createdAt: now - 86400000 * 6,
      updatedAt: now - 3600000 * 3,
      data: kidneyData(),
    },
    {
      id: 'demo-triple',
      name: '三碗连通大池',
      client: '滨江极限运动中心',
      location: '二期 Bowl 区',
      description: '三个深碗通过宽颈连通，用于大体量混凝土、钢筋与放样出图演示。',
      createdAt: now - 86400000 * 3,
      updatedAt: now - 1800000,
      data: tripleBowlData(),
    },
  ]
}
