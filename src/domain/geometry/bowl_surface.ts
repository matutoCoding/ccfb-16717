import type { Basin, BowlParams, Outline, Vec2 } from '../../types/domain'
import {
  catmullClosed,
  clamp,
  degToRad,
  nearestOnPolyline,
  pointInPolygon,
  polygonCentroid,
  quintic,
  type NearestInfo,
} from './curve'

export interface SurfaceNearest extends NearestInfo {
  outlineIndex: number
  distance: number
}

export class BowlSurface {
  readonly outlines: Outline[]
  readonly params: BowlParams
  readonly polylines: Vec2[][]
  readonly centroids: Vec2[]
  readonly centroid: Vec2
  readonly basins: Basin[]

  constructor(outlines: Outline[], params: BowlParams, samplesPerPoint = 48, basins: Basin[] = []) {
    this.outlines = outlines
    this.params = params
    this.basins = basins
    this.polylines = outlines.map((o) => catmullClosed(o.points, samplesPerPoint))
    this.centroids = this.polylines.map(polygonCentroid)
    this.centroid = this.centroids[0] ?? { x: 0, z: 0 }
  }

  contains(x: number, z: number): boolean {
    const p = { x, z }
    return this.polylines.some((poly) => pointInPolygon(p, poly))
  }

  nearest(x: number, z: number): SurfaceNearest | null {
    const p = { x, z }
    let best: SurfaceNearest | null = null
    this.polylines.forEach((poly, outlineIndex) => {
      if (!pointInPolygon(p, poly)) return
      const n = nearestOnPolyline(p, poly)
      if (!best || n.distance < best.distance) best = { ...n, outlineIndex }
    })
    return best
  }

  profileElevation(distance: number, x = 0, z = 0): number {
    const R = this.params.transitionRadius
    const H = this.params.verticalHeight
    if (distance < R) {
      const q = Math.max(0, R * R - (R - distance) * (R - distance))
      return -(H + Math.sqrt(q))
    }

    const blend = Math.max(0.001, this.params.bottomBlend)
    const t = quintic(0, blend, distance - R)
    const dir = degToRad(this.params.slopeDirectionDeg)
    const dx = x - this.centroid.x
    const dz = z - this.centroid.z
    const along = dx * Math.cos(dir) + dz * Math.sin(dir)
    const planeElevation = -(this.params.bottomSlopePercent / 100) * along
    let basinDrop = 0
    for (const basin of this.basins) {
      const bd = Math.hypot(x - basin.x, z - basin.z)
      const q = clamp(1 - bd / basin.radius, 0, 1)
      const falloff = q * q * q * (q * (q * 6 - 15) + 10)
      basinDrop += basin.depth * falloff * t
    }
    return -(H + R) + t * planeElevation - basinDrop
  }

  elevation(x: number, z: number): number {
    const n = this.nearest(x, z)
    if (!n) return 0
    return this.profileElevation(n.distance, x, z)
  }

  elevationFast(x: number, z: number): number {
    let inside = false
    let distance = Infinity
    const p = { x, z }
    for (const poly of this.polylines) {
      if (pointInPolygon(p, poly)) {
        inside = true
        const n = nearestOnPolyline(p, poly)
        if (n.distance < distance) distance = n.distance
      }
    }
    if (!inside) return 0
    return this.profileElevation(distance, x, z)
  }

  depth(x: number, z: number): number {
    return -this.elevation(x, z)
  }

  bounds() {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const poly of this.polylines) {
      for (const p of poly) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minZ = Math.min(minZ, p.z)
        maxZ = Math.max(maxZ, p.z)
      }
    }
    return { minX, maxX, minZ, maxZ }
  }
}
