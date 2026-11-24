import * as THREE from 'three'
import type { Vec2 } from '../types/domain'
import { inwardNormalAt } from '../domain/geometry/curve'

export function createMetalCoping(poly: Vec2[]): THREE.Mesh {
  const points = poly.map((p, i) => {
    const n = inwardNormalAt(poly, i)
    return new THREE.Vector3(p.x + n.x * 0.035, 0.055, p.z + n.z * 0.035)
  })
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.4)
  const geometry = new THREE.TubeGeometry(curve, Math.min(700, poly.length * 2), 0.045, 14, true)
  const material = new THREE.MeshStandardMaterial({
    color: '#dbe4ea',
    metalness: 0.86,
    roughness: 0.22,
  })
  return new THREE.Mesh(geometry, material)
}

export function createStoneCoping(poly: Vec2[]): THREE.Mesh {
  const profile: Array<[number, number]> = [
    [-0.26, -0.08],
    [0.2, -0.08],
    [0.25, 0.01],
    [0.2, 0.13],
    [-0.21, 0.13],
    [-0.27, 0.04],
  ]
  const positions: number[] = []
  const indices: number[] = []
  const m = profile.length

  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const n = inwardNormalAt(poly, i)
    for (const [u, y] of profile) positions.push(p.x + n.x * u, y, p.z + n.z * u)
  }

  for (let i = 0; i < poly.length; i++) {
    const next = (i + 1) % poly.length
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m
      const a = i * m + j
      const b = next * m + j
      const c = i * m + j2
      const d = next * m + j2
      indices.push(a, b, c, c, b, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ color: '#c8c0b4', roughness: 0.82, metalness: 0.02 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createCopingJoints(poly: Vec2[]): THREE.LineSegments {
  const positions: number[] = []
  const every = Math.max(8, Math.round(0.9 / averageEdge(poly)))
  for (let i = 0; i < poly.length; i += every) {
    const p = poly[i]
    const n = inwardNormalAt(poly, i)
    positions.push(p.x - n.x * 0.25, 0.136, p.z - n.z * 0.25)
    positions.push(p.x + n.x * 0.19, 0.136, p.z + n.z * 0.19)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({ color: '#7d7468', transparent: true, opacity: 0.7 })
  return new THREE.LineSegments(geometry, material)
}

function averageEdge(poly: Vec2[]) {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += Math.hypot(a.x - b.x, a.z - b.z)
  }
  return sum / poly.length
}
