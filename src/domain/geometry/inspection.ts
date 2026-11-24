import type { CurvaturePoint, SectionCheck } from '../../types/domain'
import { BowlSurface } from './bowl_surface'
import { inwardNormalAt, polylineLength } from './curve'

function fitCircle(points: Array<{ s: number; y: number }>): number {
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  let srhs = 0
  let yrhs = 0
  let rhsSum = 0
  for (const p of points) {
    const x = p.s
    const y = p.y
    const rhs = -(x * x + y * y)
    sx += x
    sy += y
    sxx += x * x
    syy += y * y
    sxy += x * y
    srhs += x * rhs
    yrhs += y * rhs
    rhsSum += rhs
  }
  const n = points.length
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ]
  const b = [srhs, yrhs, rhsSum]
  for (let i = 0; i < 3; i++) {
    let pivot = i
    for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[pivot][i])) pivot = k
    ;[A[i], A[pivot]] = [A[pivot], A[i]]
    ;[b[i], b[pivot]] = [b[pivot], b[i]]
    for (let k = i + 1; k < 3; k++) {
      const f = A[k][i] / A[i][i]
      for (let j = i; j < 3; j++) A[k][j] -= f * A[i][j]
      b[k] -= f * b[i]
    }
  }
  const d = new Array(3).fill(0)
  for (let i = 2; i >= 0; i--) {
    d[i] = (b[i] - A[i].slice(i + 1).reduce((sum, v, j) => sum + v * d[i + 1 + j], 0)) / A[i][i]
  }
  const centerS = -d[0] / 2
  const centerY = -d[1] / 2
  const radiusSq = (d[0] * d[0] + d[1] * d[1]) / 4 - d[2]
  void centerS
  void centerY
  return Math.sqrt(Math.max(1e-8, radiusSq))
}

export function validateSections(surface: BowlSurface, targetSpacing = 0.5): SectionCheck[] {
  const R = surface.params.transitionRadius
  const H = surface.params.verticalHeight
  const tolerance = surface.params.toleranceMm / 1000
  const result: SectionCheck[] = []

  surface.polylines.forEach((poly) => {
    const cumulative = [0]
    let averageEdge = 0
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      cumulative.push(cumulative[i] + len)
      averageEdge += len
    }
    averageEdge /= poly.length
    const indexStep = Math.max(1, Math.round(targetSpacing / Math.max(averageEdge, 1e-6)))

    for (let i = 0; i < poly.length; i += indexStep) {
      const p = poly[i]
      const normal = inwardNormalAt(poly, i)
      const samples: Array<{ s: number; y: number }> = []
      let maxError = 0
      const step = 0.02
      for (let s = 0.02; s <= R - 0.02; s += step) {
        const x = p.x + normal.x * s
        const z = p.z + normal.z * s
        if (!surface.contains(x, z)) continue
        const y = surface.elevation(x, z)
        samples.push({ s, y })
        const radial = Math.hypot(s - R, y + H)
        maxError = Math.max(maxError, Math.abs(radial - R))
      }
      if (samples.length > 12) {
        const measuredRadius = fitCircle(samples)
        result.push({
          index: result.length,
          station: cumulative[i],
          x: p.x,
          z: p.z,
          nx: normal.x,
          nz: normal.z,
          expectedRadius: R,
          measuredRadius,
          maxErrorM: maxError,
          maxErrorMm: maxError * 1000,
          passed: maxError <= tolerance && Math.abs(measuredRadius - R) * 1000 <= surface.params.toleranceMm * 2,
        })
      }
    }
  })

  return result
}

interface CurvatureCell extends CurvaturePoint {
  ix: number
  iz: number
}

export function buildCurvatureMap(surface: BowlSurface, step = 0.25): CurvaturePoint[] {
  const b = surface.bounds()
  const nx = Math.ceil((b.maxX - b.minX) / step)
  const nz = Math.ceil((b.maxZ - b.minZ) / step)
  const cells = new Map<string, CurvatureCell>()
  const R = surface.params.transitionRadius

  for (let iz = 1; iz < nz; iz++) {
    for (let ix = 1; ix < nx; ix++) {
      const x = b.minX + ix * step
      const z = b.minZ + iz * step
      const nearest = surface.nearest(x, z)
      if (!nearest || nearest.distance < 0.08 || nearest.distance > R + 0.35) continue
      const h = 0.035
      const xm = x - h
      const xp = x + h
      const zm = z - h
      const zp = z + h
      if (!surface.contains(xm, z) || !surface.contains(xp, z) || !surface.contains(x, zm) || !surface.contains(x, zp)) continue

      const f = surface.elevation(x, z)
      const fxl = surface.elevation(xm, z)
      const fxr = surface.elevation(xp, z)
      const fzl = surface.elevation(x, zm)
      const fzr = surface.elevation(x, zp)
      const fx = (fxr - fxl) / (2 * h)
      const fz = (fzr - fzl) / (2 * h)
      const fxx = (fxr - 2 * f + fxl) / (h * h)
      const fzz = (fzr - 2 * f + fzl) / (h * h)
      const fxz = (surface.elevation(xp, zp) - surface.elevation(xp, zm) - surface.elevation(xm, zp) + surface.elevation(xm, zm)) / (4 * h * h)
      const w2 = 1 + fx * fx + fz * fz
      const mean = ((1 + fz * fz) * fxx - 2 * fx * fz * fxz + (1 + fx * fx) * fzz) / (2 * Math.pow(w2, 1.5))
      const gaussian = (fxx * fzz - fxz * fxz) / (w2 * w2)
      const disc = Math.max(0, mean * mean - gaussian)
      const k1 = mean + Math.sqrt(disc)
      const k2 = mean - Math.sqrt(disc)
      const curvature = Math.max(Math.abs(k1), Math.abs(k2))

      const dl = nearest.distance
      const df = profileDerivative(surface, dl)
      const d2f = profileSecondDerivative(surface, dl)
      const transitionRadius = Math.pow(1 + df * df, 1.5) / Math.max(1e-6, Math.abs(d2f))
      const radiusErrorMm = Math.abs(transitionRadius - R) * 1000
      cells.set(`${ix}:${iz}`, {
        ix,
        iz,
        x,
        z,
        elevation: f,
        curvature,
        radius: 1 / Math.max(curvature, 1e-6),
        radiusErrorMm,
        abrupt: false,
        compliant: nearest.distance > 0.12 && nearest.distance < R - 0.08 ? radiusErrorMm <= surface.params.toleranceMm : true,
      })
    }
  }

  const list = [...cells.values()]
  for (const cell of list) {
    let diffSum = 0
    let count = 0
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = cells.get(`${cell.ix + dx}:${cell.iz + dz}`)
      if (n) {
        diffSum += Math.abs(n.curvature - cell.curvature)
        count++
      }
    }
    const localDiff = count ? diffSum / count : 0
    cell.abrupt = localDiff > 0.42 || !cell.compliant
  }
  return list.map(({ ix: _ix, iz: _iz, ...p }) => p)
}

function profileDerivative(surface: BowlSurface, d: number) {
  const R = surface.params.transitionRadius
  if (d >= R) return 0
  return (R - d) / Math.sqrt(Math.max(1e-8, R * R - (R - d) * (R - d)))
}

function profileSecondDerivative(surface: BowlSurface, d: number) {
  const R = surface.params.transitionRadius
  if (d >= R - 1e-4) return 0
  const denom = Math.pow(Math.max(1e-8, R * R - (R - d) * (R - d)), 1.5)
  return -(R * R) / denom
}
