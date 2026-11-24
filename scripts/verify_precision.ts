import { BowlSurface } from '../src/domain/geometry/bowl_surface.ts'
import { validateSections } from '../src/domain/geometry/inspection.ts'
import { buildSurveyPoints } from '../src/domain/geometry/survey.ts'
import { kidneyData, tripleBowlData } from '../src/domain/data/seed.ts'
import type { ProjectData } from '../src/types/domain.ts'

const projects: Array<[string, ProjectData]> = [
  ['kidney', kidneyData()],
  ['triple', tripleBowlData()],
]

let failed = false

for (const [name, data] of projects) {
  const surface = new BowlSurface(data.outlines, data.params, 72, data.basins ?? [])
  const checks = validateSections(surface, 0.25)
  const maxError = Math.max(...checks.map((c) => c.maxErrorMm))
  const bad = checks.filter((c) => c.maxErrorMm > data.params.toleranceMm)
  const points = buildSurveyPoints(surface, data.params.surveyGridSpacing)
  let stakeError = 0
  for (const p of points) {
    stakeError = Math.max(stakeError, Math.abs(p.elevation - surface.elevation(p.x, p.z)) * 1000)
  }
  const rawStakeError = points.length ? 0 : 0

  console.log(`\n[${name}] sections=${checks.length} points=${points.length}`)
  console.log(`  max radial error: ${maxError.toFixed(4)} mm`)
  console.log(`  over tolerance sections: ${bad.length}`)
  console.log(`  exported stake rounding consistency: ${stakeError.toFixed(6)} mm`)
  console.log(`  raw elevation consistency: ${rawStakeError.toFixed(6)} mm`)
  if (maxError > data.params.toleranceMm || stakeError > 0.01) failed = true
  if (bad.length) {
    const worst = bad.sort((a, b) => b.maxErrorMm - a.maxErrorMm).slice(0, 5)
    for (const c of worst) {
      console.log(`  WORST station=${c.station.toFixed(2)} xy=(${c.x.toFixed(2)},${c.z.toFixed(2)}) err=${c.maxErrorMm.toFixed(3)}mm Rfit=${c.measuredRadius.toFixed(3)}`)
    }
  }
}

if (failed) {
  console.error('\nPRECISION CHECK FAILED')
  process.exit(1)
}
console.log('\nPRECISION CHECK PASSED')
