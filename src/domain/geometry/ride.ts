import { BowlSurface } from './bowl_surface'
import { degToRad } from './curve'

export interface TrackPoint {
  x: number
  y: number
  z: number
  s: number
}

export interface RideTrack {
  points: TrackPoint[]
  length: number
  bottomY: number
  startY: number
  endY: number
}

export interface RideState {
  time: number
  s: number
  speed: number
  maxClimb: number
  maxElevation: number
  distance: number
  running: boolean
  finished: boolean
  trail: TrackPoint[]
}

export function buildCrossTrack(surface: BowlSurface, angleDeg: number, offset = 0): RideTrack {
  const dir = { x: Math.cos(degToRad(angleDeg)), z: Math.sin(degToRad(angleDeg)) }
  const normal = { x: -dir.z, z: dir.x }
  const c = surface.centroid
  const origin = { x: c.x + normal.x * offset, z: c.z + normal.z * offset }
  const extent = 80
  const step = 0.05
  let first: number | null = null
  let last: number | null = null
  let bestFirst = 0
  let bestLast = -1
  let bestLength = 0

  for (let t = -extent; t <= extent; t += step) {
    const x = origin.x + dir.x * t
    const z = origin.z + dir.z * t
    const inside = surface.contains(x, z)
    if (inside && first === null) first = t
    if (inside) last = t
    if ((!inside || t === extent) && first !== null && last !== null) {
      const len = last - first
      if (len > bestLength) {
        bestLength = len
        bestFirst = first
        bestLast = last
      }
      first = null
      last = null
    }
  }

  const horizontal: Array<{ x: number; y: number; z: number }> = []
  for (let t = bestFirst; t <= bestLast + 1e-6; t += step) {
    const x = origin.x + dir.x * t
    const z = origin.z + dir.z * t
    horizontal.push({ x, z, y: surface.elevation(x, z) })
  }
  if (horizontal.length < 2) {
    horizontal.push({ x: c.x - 1, z: c.z, y: surface.elevation(c.x - 1, c.z) })
    horizontal.push({ x: c.x + 1, z: c.z, y: surface.elevation(c.x + 1, c.z) })
  }

  const firstP = horizontal[0]
  const lastP = horizontal[horizontal.length - 1]
  const raw: Array<{ x: number; y: number; z: number }> = []
  for (let i = 4; i >= 1; i--) raw.push({ x: firstP.x, z: firstP.z, y: -surface.params.verticalHeight * (1 - i / 4) })
  raw.push(...horizontal)
  for (let i = 1; i <= 4; i++) raw.push({ x: lastP.x, z: lastP.z, y: -surface.params.verticalHeight * (1 - i / 4) })

  const points: TrackPoint[] = []
  let s = 0
  let bottomY = 0
  raw.forEach((p, i) => {
    if (i > 0) {
      const prev = raw[i - 1]
      s += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)
    }
    points.push({ ...p, s })
    bottomY = Math.min(bottomY, p.y)
  })

  return {
    points,
    length: s,
    bottomY,
    startY: points[0].y,
    endY: points[points.length - 1].y,
  }
}

export function pointAtS(track: RideTrack, s: number): TrackPoint {
  const clamped = Math.max(0, Math.min(track.length, s))
  const pts = track.points
  let lo = 0
  let hi = pts.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid].s < clamped) lo = mid
    else hi = mid
  }
  const a = pts[lo]
  const b = pts[Math.min(lo + 1, pts.length - 1)]
  const t = b.s === a.s ? 0 : (clamped - a.s) / (b.s - a.s)
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    s: clamped,
  }
}

export function slopeAtS(track: RideTrack, s: number): number {
  const a = pointAtS(track, Math.max(0, s - 0.12))
  const b = pointAtS(track, Math.min(track.length, s + 0.12))
  const ds = Math.max(1e-6, b.s - a.s)
  return (b.y - a.y) / ds
}

export function createRideState(track: RideTrack, initialSpeed: number): RideState {
  const p = pointAtS(track, 0)
  return {
    time: 0,
    s: 0,
    speed: initialSpeed,
    maxClimb: 0,
    maxElevation: p.y,
    distance: 0,
    running: true,
    finished: false,
    trail: [p],
  }
}

export function stepRide(
  track: RideTrack,
  state: RideState,
  dt: number,
  options: { gravity?: number; friction?: number; drag?: number } = {},
): RideState {
  if (!state.running || state.finished) return state
  const g = options.gravity ?? 9.81
  const rr = options.friction ?? 0.018
  const dragCoef = options.drag ?? 0.004
  const sub = 4
  const h = dt / sub
  let { s, speed, time, distance } = state

  for (let i = 0; i < sub; i++) {
    const slope = slopeAtS(track, s)
    const gravityAcc = -g * slope
    const resistance = rr * g * Math.sign(speed) + dragCoef * speed * Math.abs(speed)
    const nextSpeed = speed + (gravityAcc - resistance) * h
    if (speed !== 0 && Math.sign(nextSpeed) !== Math.sign(speed) && Math.abs(gravityAcc) < rr * g * 1.2) {
      speed = 0
    } else {
      speed = nextSpeed
    }
    const before = s
    s += speed * h
    if (s <= 0) {
      s = 0
      speed = 0
    }
    if (s >= track.length) {
      s = track.length
      speed = 0
    }
    distance += Math.abs(s - before)
    if (speed === 0 && (s === 0 || s === track.length || Math.abs(gravityAccSafe(track, s, g)) < rr * g)) {
      if (time > 2) {
        const p = pointAtS(track, s)
        return finishState(state, track.bottomY, { time: time + h, s, speed, distance, p })
      }
    }
    time += h
  }

  const p = pointAtS(track, s)
  const climb = p.y - track.bottomY
  const trail = state.trail
  const last = trail[trail.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.12) trail.push(p)
  if (trail.length > 5000) trail.splice(0, trail.length - 5000)

  return {
    ...state,
    time,
    s,
    speed,
    distance,
    maxElevation: Math.max(state.maxElevation, p.y),
    maxClimb: Math.max(state.maxClimb, climb),
    trail,
  }
}

function gravityAccSafe(track: RideTrack, s: number, g: number) {
  return -g * slopeAtS(track, s)
}

function finishState(
  old: RideState,
  bottomY: number,
  v: { time: number; s: number; speed: number; distance: number; p: ReturnType<typeof pointAtS> },
): RideState {
  return {
    ...old,
    time: v.time,
    s: v.s,
    speed: 0,
    distance: v.distance,
    running: false,
    finished: true,
    maxElevation: Math.max(old.maxElevation, v.p.y),
    maxClimb: Math.max(old.maxClimb, v.p.y - bottomY),
  }
}
