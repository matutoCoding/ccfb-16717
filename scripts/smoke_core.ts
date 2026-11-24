import { BowlSurface } from '../src/domain/geometry/bowl_surface.ts'
import { kidneyData, tripleBowlData } from '../src/domain/data/seed.ts'
import { computeQuantities } from '../src/domain/geometry/survey.ts'
import { buildCurvatureMap, validateSections } from '../src/domain/geometry/inspection.ts'
import { buildCrossTrack, createRideState, stepRide, pointAtS } from '../src/domain/geometry/ride.ts'
import { buildNormalTemplates, sectionSvg } from '../src/domain/geometry/loft.ts'

for (const [name, data] of [['kidney', kidneyData()], ['triple', tripleBowlData()]] as const) {
  const surface = new BowlSurface(data.outlines, data.params, 48, data.basins ?? [])
  const q = computeQuantities(surface, { gridStep: 0.4 })
  const curvature = buildCurvatureMap(surface, 0.4)
  const sections = validateSections(surface, 1)
  const track = buildCrossTrack(surface, 35, 0)
  const templates = buildNormalTemplates(surface, 3)
  const svg = templates[0] ? sectionSvg(templates[0]) : ''
  let state = createRideState(track, 4.5)
  for (let i = 0; i < 60 * 20; i++) state = stepRide(track, state, 1 / 60)
  const p = pointAtS(track, state.s)
  console.log(name, {
    area: Number(q.surfaceArea.toFixed(1)),
    concrete: Number(q.concreteVolume.toFixed(1)),
    rebar: Number(q.rebarArea.toFixed(1)),
    track: Number(track.length.toFixed(1)),
    curvaturePoints: curvature.length,
    abrupt: curvature.filter((p) => p.abrupt).length,
    sections: sections.length,
    templates: templates.length,
    svgLength: svg.length,
    sectionMax: Number(Math.max(...sections.map((s) => s.maxErrorMm)).toFixed(3)),
    finished: state.finished,
    maxClimb: Number(state.maxClimb.toFixed(2)),
    p: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
  })
  if (!Number.isFinite(q.concreteVolume) || track.points.length < 10 || !Number.isFinite(state.maxClimb) || svg.length < 500) process.exit(1)
}
