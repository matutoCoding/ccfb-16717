import type { BowlSurface } from './bowl_surface'
import { inwardNormalAt, polylineLength } from './curve'

export interface TemplateSection {
  name: string
  station: number
  x: number
  z: number
  nx: number
  nz: number
  verticalHeight: number
  radius: number
  points: Array<{ s: number; elevation: number }>
}

export function buildNormalTemplates(surface: BowlSurface, spacing: number): TemplateSection[] {
  const R = surface.params.transitionRadius
  const reach = R + Math.max(1.2, surface.params.bottomBlend)
  const sections: TemplateSection[] = []

  surface.polylines.forEach((poly, outlineIndex) => {
    const total = polylineLength(poly)
    const count = Math.max(4, Math.round(total / spacing))
    for (let k = 0; k < count; k++) {
      const index = Math.floor((k / count) * poly.length)
      const p = poly[index]
      const n = inwardNormalAt(poly, index)
      const points: Array<{ s: number; elevation: number }> = []
      for (let s = 0; s <= reach; s += 0.04) {
        const x = p.x + n.x * s
        const z = p.z + n.z * s
        if (!surface.contains(x, z)) break
        points.push({ s: Number(s.toFixed(3)), elevation: surface.elevation(x, z) })
      }
      sections.push({
        name: `SEC-${outlineIndex + 1}-${String(k + 1).padStart(2, '0')}`,
        station: (k / count) * total,
        x: p.x,
        z: p.z,
        nx: n.x,
        nz: n.z,
        verticalHeight: surface.params.verticalHeight,
        radius: R,
        points,
      })
    }
  })
  return sections
}

export function sectionSvg(section: TemplateSection): string {
  const margin = 64
  const scale = 82
  const dataMaxS = Math.max(...section.points.map((p) => p.s), section.radius + 0.8)
  const dataMaxD = Math.max(...section.points.map((p) => -p.elevation), section.verticalHeight + section.radius + 0.4)
  const maxS = dataMaxS + 0.35
  const maxD = dataMaxD + 0.45
  const width = Math.max(820, margin * 2 + maxS * scale + 30)
  const height = 78 + maxD * scale
  const X = (s: number) => margin + s * scale
  const Y = (elevation: number) => 42 + (-elevation) * scale
  const path = section.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(p.s).toFixed(1)} ${Y(p.elevation).toFixed(1)}`).join(' ')
  const arc: string[] = []
  for (let i = 0; i <= 80; i++) {
    const theta = (i / 80) * Math.PI / 2
    const s = section.radius * (1 - Math.cos(theta))
    const elevation = -section.verticalHeight - section.radius * Math.sin(theta)
    arc.push(`${i === 0 ? 'M' : 'L'} ${X(s).toFixed(1)} ${Y(elevation).toFixed(1)}`)
  }
  const gridLines: string[] = []
  for (let d = 0; d <= maxD; d += 0.5) {
    gridLines.push(`<line x1="${margin}" y1="${Y(-d)}" x2="${X(maxS)}" y2="${Y(-d)}" stroke="#e2e8f0"/>`)
    gridLines.push(`<text x="12" y="${Y(-d) + 4}" font-size="14" fill="#64748b">${d.toFixed(1)}m</text>`)
  }
  for (let s = 0; s <= maxS; s += 0.5) {
    gridLines.push(`<line x1="${X(s)}" y1="40" x2="${X(s)}" y2="${Y(-maxD)}" stroke="#eef2f7"/>`)
    gridLines.push(`<text x="${X(s) - 8}" y="${height - 18}" font-size="14" fill="#64748b">${s.toFixed(1)}</text>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${margin}" y="24" font-size="18" font-weight="600" fill="#0f172a">${section.name} 法向截面模板</text>
  <text x="${width - 250}" y="24" font-size="14" fill="#475569">R=${section.radius.toFixed(3)}m / 直壁=${section.verticalHeight.toFixed(3)}m</text>
  ${gridLines.join('\n  ')}
  <path d="M ${X(0)} ${Y(0)} L ${X(0)} ${Y(-section.verticalHeight)}" stroke="#0f172a" stroke-width="3" fill="none"/>
  <path d="${arc.join(' ')}" stroke="#f43f5e" stroke-width="2" stroke-dasharray="8 6" fill="none"/>
  <path d="${path}" stroke="#2563eb" stroke-width="4" fill="none"/>
  <circle cx="${X(section.radius)}" cy="${Y(-section.verticalHeight)}" r="4" fill="#f43f5e"/>
  <text x="${X(section.radius) + 8}" y="${Y(-section.verticalHeight) - 8}" font-size="14" fill="#be123c">圆心 / R${section.radius.toFixed(2)}</text>
  <text x="${margin}" y="${height - 4}" font-size="14" fill="#64748b">水平进尺 s(m)；蓝色为设计曲面切片，红色虚线为设定半径圆弧</text>
</svg>`
}

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
