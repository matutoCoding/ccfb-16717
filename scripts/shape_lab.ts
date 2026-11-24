import { BowlSurface } from '../src/domain/geometry/bowl_surface.ts'
import { validateSections } from '../src/domain/geometry/inspection.ts'
import { DEFAULT_PARAMS } from '../src/domain/data/seed.ts'
import type { Vec2 } from '../src/types/domain.ts'

function fromFn(fn: (t: number) => Vec2, count = 28): Vec2[] {
  return Array.from({ length: count }, (_, i) => fn((i / count) * Math.PI * 2))
}

function test(name: string, points: Vec2[], R: number) {
  const surface = new BowlSurface([{ id: 'x', name: 'x', points }], { ...DEFAULT_PARAMS, transitionRadius: R, toleranceMm: 2 }, 96)
  const checks = validateSections(surface, 1)
  const max = Math.max(...checks.map((c) => c.maxErrorMm))
  const bad = checks.filter((c) => c.passed === false).length
  console.log(name, 'R', R, 'sections', checks.length, 'max', max.toFixed(3), 'bad', bad)
  const worst = checks.sort((a, b) => b.maxErrorMm - a.maxErrorMm)[0]
  if (worst) console.log('  worst', worst.x.toFixed(2), worst.z.toFixed(2), worst.maxErrorMm.toFixed(2))
}

for (const k of [1.6, 1.8, 2.0]) {
  const pts = fromFn((t) => ({
    x: 6.2 * Math.cos(t) + k * Math.cos(2 * t),
    z: 4.4 * Math.sin(t) + 0.55 * Math.sin(2 * t),
  }), 32)
  test(`kidney-k${k}-R225`, pts, 2.25)
}

for (const amp of [1.8, 2.1, 2.3]) {
  const pts = fromFn((t) => {
    const r = 7.4 + amp * Math.cos(3 * (t - 0.35)) + 0.25 * Math.cos(t - 0.4)
    return { x: r * Math.cos(t), z: r * Math.sin(t) * 0.88 }
  }, 32)
  test(`triple-a${amp}-R265`, pts, 2.65)
}
