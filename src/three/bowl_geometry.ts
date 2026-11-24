import * as THREE from 'three'
import type { BowlSurface } from '../domain/geometry/bowl_surface'
import { inwardNormalAt } from '../domain/geometry/curve'

export function createBottomGeometry(surface: BowlSurface, step = 0.2): THREE.BufferGeometry {
  const b = surface.bounds()
  const nx = Math.ceil((b.maxX - b.minX) / step)
  const nz = Math.ceil((b.maxZ - b.minZ) / step)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const depths: number[] = []
  const distances: number[] = []

  for (let iz = 0; iz <= nz; iz++) {
    const z = b.minZ + iz * step
    for (let ix = 0; ix <= nx; ix++) {
      const x = b.minX + ix * step
      const n = surface.nearest(x, z)
      const y = n ? surface.profileElevation(n.distance, x, z) : 0
      positions.push(x, y, z)
      depths.push(-y)
      distances.push(n?.distance ?? -1)
      uvs.push(ix / nx, iz / nz)
    }
  }

  const row = nx + 1
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * row + ix
      const b0 = a + 1
      const c = a + row
      const d = c + 1
      const clearOfArc = Math.min(distances[a], distances[b0], distances[c], distances[d])
        >= surface.params.transitionRadius + 0.08
      if (!clearOfArc) continue
      indices.push(a, c, b0, b0, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  colorByDepth(geometry, depths)
  return geometry
}

export function createTransitionGeometry(surface: BowlSurface): THREE.BufferGeometry {
  const R = surface.params.transitionRadius
  const H = surface.params.verticalHeight
  const arcSegments = 64
  const flatSegments = 8
  const vCount = arcSegments + flatSegments + 1
  const positions: number[] = []
  const indices: number[] = []

  surface.polylines.forEach((poly) => {
    const baseIndex = positions.length / 3
    const uStep = Math.max(1, Math.floor(poly.length / 420))
    const uCount = Math.ceil(poly.length / uStep)
    for (let ui = 0; ui < uCount; ui++) {
      const i = (ui * uStep) % poly.length
      const p = poly[i]
      const n = inwardNormalAt(poly, i)
      for (let j = 0; j < vCount; j++) {
        let d: number
        let y: number
        let x = p.x
        let z = p.z
        if (j <= arcSegments) {
          const theta = (j / arcSegments) * Math.PI / 2
          d = R * (1 - Math.cos(theta))
          y = -H - R * Math.sin(theta)
          x += n.x * d
          z += n.z * d
        } else {
          const t = (j - arcSegments) / flatSegments
          d = R + 0.65 * t
          x += n.x * d
          z += n.z * d
          y = surface.contains(x, z) ? surface.elevation(x, z) : -H - R
        }
        positions.push(x, y, z)
      }
    }
    for (let i = 0; i < uCount; i++) {
      const next = (i + 1) % uCount
      for (let j = 0; j < vCount - 1; j++) {
        const a = baseIndex + i * vCount + j
        const b = baseIndex + next * vCount + j
        const c = a + 1
        const d = b + 1
        indices.push(a, b, c, c, b, d)
      }
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createVerticalWallGeometry(surface: BowlSurface): THREE.BufferGeometry {
  const H = surface.params.verticalHeight
  const positions: number[] = []
  const indices: number[] = []
  surface.polylines.forEach((poly) => {
    const base = positions.length / 3
    for (const p of poly) positions.push(p.x, 0.002, p.z, p.x, -H, p.z)
    for (let i = 0; i < poly.length; i++) {
      const n = (i + 1) % poly.length
      const a = base + i * 2
      const b = a + 1
      const c = base + n * 2
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function colorByDepth(geometry: THREE.BufferGeometry, depths: number[]) {
  const colors: number[] = []
  const maxDepth = 4
  const shallow = new THREE.Color('#b9d7e8')
  const deep = new THREE.Color('#315a72')
  for (const depth of depths) {
    const c = shallow.clone().lerp(deep, Math.min(1, depth / maxDepth))
    colors.push(c.r, c.g, c.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

export function createDeckGeometry(surface: BowlSurface): THREE.ShapeGeometry {
  const b = surface.bounds()
  const margin = 10
  const shape = new THREE.Shape()
  shape.moveTo(b.minX - margin, -b.maxZ - margin)
  shape.lineTo(b.maxX + margin, -b.maxZ - margin)
  shape.lineTo(b.maxX + margin, -b.minZ + margin)
  shape.lineTo(b.minX - margin, -b.minZ + margin)
  shape.closePath()

  for (const poly of surface.polylines) {
    const hole = new THREE.Path()
    poly.forEach((p, i) => {
      const x = p.x
      const y = -p.z
      if (i === 0) hole.moveTo(x, y)
      else hole.lineTo(x, y)
    })
    hole.closePath()
    shape.holes.push(hole)
  }
  return new THREE.ShapeGeometry(shape, 18)
}
