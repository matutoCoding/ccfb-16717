import type { Vec2 } from '../../types/domain'

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const quintic = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const degToRad = (deg: number) => (deg * Math.PI) / 180

export function catmullClosed(points: Vec2[], perSegment = 40): Vec2[] {
  const n = points.length
  if (n < 3) return points.map((p) => ({ ...p }))
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let j = 0; j < perSegment; j++) {
      const t = j / perSegment
      const t2 = t * t
      const t3 = t2 * t
      const x = 0.5 * (
        2 * p1.x
        + (-p0.x + p2.x) * t
        + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
        + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      )
      const z = 0.5 * (
        2 * p1.z
        + (-p0.z + p2.z) * t
        + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2
        + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
      )
      out.push({ x, z })
    }
  }
  return out
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const intersects = ((a.z > p.z) !== (b.z > p.z))
      && (p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
    if (intersects) inside = !inside
  }
  return inside
}

export interface NearestInfo {
  distance: number
  x: number
  z: number
  edgeIndex: number
  t: number
}

export function nearestOnPolyline(p: Vec2, poly: Vec2[]): NearestInfo {
  let best = Infinity
  let bx = poly[0]?.x ?? 0
  let bz = poly[0]?.z ?? 0
  let bestEdge = 0
  let bestT = 0
  const count = poly.length
  for (let i = 0; i < count; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % count]
    const vx = b.x - a.x
    const vz = b.z - a.z
    const len2 = vx * vx + vz * vz
    let t = len2 === 0 ? 0 : ((p.x - a.x) * vx + (p.z - a.z) * vz) / len2
    t = clamp(t, 0, 1)
    const x = a.x + vx * t
    const z = a.z + vz * t
    const dx = p.x - x
    const dz = p.z - z
    const d2 = dx * dx + dz * dz
    if (d2 < best) {
      best = d2
      bx = x
      bz = z
      bestEdge = i
      bestT = t
    }
  }
  return { distance: Math.sqrt(best), x: bx, z: bz, edgeIndex: bestEdge, t: bestT }
}

export function polygonArea(poly: Vec2[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += a.x * b.z - b.x * a.z
  }
  return sum / 2
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  let area2 = 0
  let cx = 0
  let cz = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a.x * b.z - b.x * a.z
    area2 += cross
    cx += (a.x + b.x) * cross
    cz += (a.z + b.z) * cross
  }
  if (Math.abs(area2) < 1e-9) return averagePoint(poly)
  return { x: cx / (3 * area2), z: cz / (3 * area2) }
}

export function averagePoint(poly: Vec2[]): Vec2 {
  const n = poly.length || 1
  return poly.reduce((acc, p) => ({ x: acc.x + p.x / n, z: acc.z + p.z / n }), { x: 0, z: 0 })
}

export function polylineLength(poly: Vec2[]): number {
  let length = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    length += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return length
}

export function inwardNormalAt(poly: Vec2[], index: number): Vec2 {
  const n = poly.length
  const prev = poly[(index - 1 + n) % n]
  const next = poly[(index + 1) % n]
  let tx = next.x - prev.x
  let tz = next.z - prev.z
  const len = Math.hypot(tx, tz) || 1
  tx /= len
  tz /= len
  const areaSign = polygonArea(poly) >= 0 ? 1 : -1
  if (areaSign > 0) return { x: -tz, z: tx }
  return { x: tz, z: -tx }
}

export function boundsOf(points: Vec2[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ }
}
