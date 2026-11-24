import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ProjectData, SurveyPoint } from '../types/domain'
import { BowlSurface } from '../domain/geometry/bowl_surface'
import type { CurvaturePoint } from '../types/domain'
import {
  createBottomGeometry,
  createDeckGeometry,
  createTransitionGeometry,
  createVerticalWallGeometry,
} from './bowl_geometry'
import { createCopingJoints, createMetalCoping, createStoneCoping } from './coping_builder'
import type { TrackPoint } from '../domain/geometry/ride'

export type ViewMode = 'perspective' | 'top' | 'first'

export class BowlViewer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly container: HTMLElement
  bowlSurface: BowlSurface | null = null
  private designGroup = new THREE.Group()
  private heatGroup = new THREE.Group()
  private surveyGroup = new THREE.Group()
  private rideGroup = new THREE.Group()
  private skier = new THREE.Group()
  private trail: THREE.Line | null = null
  private frameId = 0
  private resizeObserver: ResizeObserver
  private viewMode: ViewMode = 'perspective'
  private fpvPose: { x: number; y: number; z: number; yaw: number } | null = null
  onFrame: ((dt: number) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color('#eef3f7')
    this.scene.fog = new THREE.Fog('#eef3f7', 45, 95)
    this.camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.05, 200)
    this.camera.position.set(15, 12, 17)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.target.set(0, -1.4, 0)
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.minDistance = 3
    this.controls.maxDistance = 60

    this.addLights()
    this.scene.add(this.designGroup, this.heatGroup, this.surveyGroup, this.rideGroup)
    this.buildSkier()
    this.rideGroup.add(this.skier)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.loop()
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#94a3b8', 1.6)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight('#ffffff', 2.4)
    sun.position.set(12, 18, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -24
    sun.shadow.camera.right = 24
    sun.shadow.camera.top = 24
    sun.shadow.camera.bottom = -24
    this.scene.add(sun)
  }

  loadProject(data: ProjectData) {
    this.clearGroup(this.designGroup)
    this.clearGroup(this.heatGroup)
    this.clearGroup(this.surveyGroup)
    this.bowlSurface = new BowlSurface(data.outlines, data.params, 56, data.basins ?? [])

    const deck = new THREE.Mesh(
      createDeckGeometry(this.bowlSurface),
      new THREE.MeshStandardMaterial({ color: '#d8d3c8', roughness: 0.92, side: THREE.DoubleSide }),
    )
    deck.rotation.x = -Math.PI / 2
    deck.receiveShadow = true
    this.designGroup.add(deck)

    const bowlMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
    const bottom = new THREE.Mesh(createBottomGeometry(this.bowlSurface, 0.18), bowlMaterial)
    bottom.receiveShadow = true
    this.designGroup.add(bottom)

    const transition = new THREE.Mesh(
      createTransitionGeometry(this.bowlSurface),
      new THREE.MeshStandardMaterial({
        color: '#8fa9b8',
        roughness: 0.86,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    transition.receiveShadow = true
    this.designGroup.add(transition)

    const wall = new THREE.Mesh(
      createVerticalWallGeometry(this.bowlSurface),
      new THREE.MeshStandardMaterial({ color: '#7f98a8', roughness: 0.9, side: THREE.DoubleSide }),
    )
    this.designGroup.add(wall)

    for (const poly of this.bowlSurface.polylines) {
      const stone = createStoneCoping(poly)
      const joints = createCopingJoints(poly)
      const metal = createMetalCoping(poly)
      stone.userData.kind = 'coping'
      joints.userData.kind = 'coping'
      metal.userData.kind = 'coping'
      this.designGroup.add(stone, joints, metal)
    }

    const grid = new THREE.GridHelper(80, 80, '#94a3b8', '#cbd5e1')
    grid.position.y = 0.006
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.28
    this.designGroup.add(grid)
    this.fitCamera()
  }

  showCurvature(points: CurvaturePoint[]) {
    this.clearGroup(this.heatGroup)
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    for (const p of points) {
      positions.push(p.x, p.elevation + 0.06, p.z)
      const color = p.abrupt ? new THREE.Color('#ef233c') : curvatureColor(p.curvature)
      colors.push(color.r, color.g, color.b)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true })
    this.heatGroup.add(new THREE.Points(geometry, material))
  }

  showSurveyPoints(points: SurveyPoint[]) {
    this.clearGroup(this.surveyGroup)
    const geometry = new THREE.SphereGeometry(0.055, 10, 8)
    const material = new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#7c2d12', emissiveIntensity: 0.25 })
    const mesh = new THREE.InstancedMesh(geometry, material, points.length)
    const matrix = new THREE.Matrix4()
    points.forEach((p, i) => {
      matrix.makeTranslation(p.x, p.elevation + 0.08, p.z)
      mesh.setMatrixAt(i, matrix)
    })
    this.surveyGroup.add(mesh)
  }

  setTrail(points: TrackPoint[]) {
    if (this.trail) {
      this.rideGroup.remove(this.trail)
      this.trail.geometry.dispose()
      ;(this.trail.material as THREE.Material).dispose()
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y + 0.08, p.z)))
    this.trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ff3d71', linewidth: 3 }))
    this.rideGroup.add(this.trail)
  }

  updateSkier(p: TrackPoint, yaw: number) {
    this.skier.position.set(p.x, p.y + 0.05, p.z)
    this.skier.rotation.y = yaw
    this.fpvPose = { x: p.x, y: p.y, z: p.z, yaw }
  }

  setLayer(name: 'surface' | 'coping' | 'heat' | 'survey' | 'ride', visible: boolean) {
    if (name === 'heat') this.heatGroup.visible = visible
    else if (name === 'survey') this.surveyGroup.visible = visible
    else if (name === 'ride') this.rideGroup.visible = visible
    else if (name === 'coping') {
      this.designGroup.children.forEach((child) => {
        if (child.userData.kind === 'coping') child.visible = visible
      })
    } else this.designGroup.visible = visible
  }

  setView(mode: ViewMode) {
    this.viewMode = mode
    this.controls.enabled = mode !== 'first'
    if (mode === 'top') {
      this.camera.position.set(0, 34, 0.01)
      this.controls.target.set(0, -1, 0)
      this.camera.lookAt(this.controls.target)
    } else if (mode === 'perspective') {
      this.fitCamera()
    }
  }

  fitCamera() {
    if (!this.bowlSurface) return
    const b = this.bowlSurface.bounds()
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ)
    this.camera.position.set(cx + size * 0.72, size * 0.62, cz + size * 0.82)
    this.controls.target.set(cx, -1.3, cz)
    this.controls.update()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private buildSkier() {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.92), new THREE.MeshStandardMaterial({ color: '#111827' }))
    board.position.y = 0.08
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 6, 12), new THREE.MeshStandardMaterial({ color: '#ff5c8a' }))
    body.position.y = 0.58
    body.rotation.x = 0.18
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: '#f2c9a0' }))
    head.position.y = 1.05
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#2563eb' }))
    helmet.position.y = 1.08
    this.skier.add(board, body, head, helmet)
    this.skier.scale.setScalar(1.15)
  }

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clockDelta())
    this.onFrame?.(dt)
    if (this.viewMode === 'first' && this.fpvPose) {
      const p = this.fpvPose
      const ahead = 7
      this.camera.position.set(p.x, p.y + 1.55, p.z)
      this.camera.lookAt(
        p.x + Math.sin(p.yaw) * ahead,
        p.y + 1.15,
        p.z + Math.cos(p.yaw) * ahead,
      )
    } else {
      this.controls.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  private lastTime = performance.now()
  private clockDelta() {
    const now = performance.now()
    const dt = (now - this.lastTime) / 1000
    this.lastTime = now
    return dt
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length) {
      const child = group.children.pop()!
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material?.dispose()
      })
    }
  }

  dispose() {
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    this.clearGroup(this.designGroup)
    this.clearGroup(this.heatGroup)
    this.clearGroup(this.surveyGroup)
    this.clearGroup(this.rideGroup)
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

function curvatureColor(k: number) {
  const t = Math.min(1, k / 0.62)
  return new THREE.Color('#22c55e').lerp(new THREE.Color('#facc15'), Math.min(0.5, t * 1.4)).lerp(new THREE.Color('#ef4444'), Math.max(0, t - 0.45) * 1.8)
}
