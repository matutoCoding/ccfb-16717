import type { QuantityResult, SurveyPoint } from '../../types/domain'
import { BowlSurface } from './bowl_surface'
import { polylineLength } from './curve'

export function buildSurveyPoints(surface: BowlSurface, spacing: number): SurveyPoint[] {
  const b = surface.bounds()
  const points: SurveyPoint[] = []
  const startX = Math.ceil(b.minX / spacing) * spacing
  const startZ = Math.ceil(b.minZ / spacing) * spacing
  const endX = Math.floor(b.maxX / spacing) * spacing
  const endZ = Math.floor(b.maxZ / spacing) * spacing
  let serial = 1

  for (let iz = Math.round(startZ / spacing); iz <= Math.round(endZ / spacing); iz++) {
    const z = iz * spacing
    for (let ix = Math.round(startX / spacing); ix <= Math.round(endX / spacing); ix++) {
      const x = ix * spacing
      if (!surface.contains(x, z)) continue
      const elevation = surface.elevation(x, z)
      points.push({
        id: `P${String(serial).padStart(4, '0')}`,
        gridX: ix,
        gridZ: iz,
        x: Number(x.toFixed(4)),
        z: Number(z.toFixed(4)),
        elevation: Number(elevation.toFixed(5)),
        depth: Number((-elevation).toFixed(5)),
      })
      serial++
    }
  }
  return points
}

export function surveyCsv(
  points: SurveyPoint[],
  spacing: number,
  meta: { projectName?: string; surveyor?: string; company?: string; coordinateSystem?: string } = {},
): string {
  const header = 'point_id,grid_x,grid_z,east_x_m,north_z_m,design_elevation_m,depth_from_coping_m'
  const comments = [
    `# project=${meta.projectName ?? 'bowl-studio-project'}`,
    `# company=${meta.company ?? ''}`,
    `# surveyor=${meta.surveyor ?? ''}`,
    `# coordinate_system=${meta.coordinateSystem ?? 'local-meter'}`,
    `# grid_spacing_m=${spacing}`,
    '# elevation_source=BowlSurface.elevation',
  ]
  const rows = points.map((p) => [
    p.id,
    p.gridX,
    p.gridZ,
    p.x.toFixed(4),
    p.z.toFixed(4),
    p.elevation.toFixed(5),
    p.depth.toFixed(5),
  ].join(','))
  return `${comments.join('\n')}\n${header}\n${rows.join('\n')}`
}

export function computeQuantities(
  surface: BowlSurface,
  options: { gridStep?: number; rebarLayers?: number; rebarLapPercent?: number } = {},
): QuantityResult {
  const step = options.gridStep ?? 0.2
  const layers = options.rebarLayers ?? 2
  const lap = 1 + (options.rebarLapPercent ?? 8) / 100
  const b = surface.bounds()
  const nx = Math.ceil((b.maxX - b.minX) / step)
  const nz = Math.ceil((b.maxZ - b.minZ) / step)
  let surfaceArea = 0
  let projectedArea = 0
  let excavationVolume = 0
  let count = 0

  const elev = (ix: number, iz: number) => {
    const x = b.minX + ix * step
    const z = b.minZ + iz * step
    return { x, z, y: surface.elevation(x, z), inside: surface.contains(x, z) }
  }

  const addTriangle = (
    a: { x: number; y: number; z: number },
    c: { x: number; y: number; z: number },
    d: { x: number; y: number; z: number },
  ) => {
    const ux = c.x - a.x
    const uy = c.y - a.y
    const uz = c.z - a.z
    const vx = d.x - a.x
    const vy = d.y - a.y
    const vz = d.z - a.z
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    surfaceArea += Math.hypot(cx, cy, cz) / 2
  }

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const p00 = elev(ix, iz)
      const p10 = elev(ix + 1, iz)
      const p01 = elev(ix, iz + 1)
      const p11 = elev(ix + 1, iz + 1)
      const cx = (p00.x + p11.x) / 2
      const cz = (p00.z + p11.z) / 2
      if (!surface.contains(cx, cz)) continue
      projectedArea += step * step
      excavationVolume += Math.max(0, -surface.elevation(cx, cz)) * step * step
      count++
      if (p00.inside && p10.inside && p11.inside) addTriangle(p00, p10, p11)
      if (p00.inside && p11.inside && p01.inside) addTriangle(p00, p11, p01)
    }
  }

  const verticalWallArea = surface.polylines.reduce(
    (sum, poly) => sum + polylineLength(poly) * surface.params.verticalHeight,
    0,
  )
  surfaceArea += verticalWallArea

  return {
    surfaceArea,
    projectedArea,
    concreteVolume: surfaceArea * surface.params.shellThickness,
    excavationVolume,
    rebarArea: surfaceArea * layers * lap,
    pointCount: count,
  }
}
