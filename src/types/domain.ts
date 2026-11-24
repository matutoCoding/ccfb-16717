export interface Vec2 {
  x: number
  z: number
}

export interface Outline {
  id: string
  name: string
  points: Vec2[]
}

export interface Basin {
  id: string
  name: string
  x: number
  z: number
  depth: number
  radius: number
}

export interface BowlParams {
  transitionRadius: number
  verticalHeight: number
  bottomSlopePercent: number
  slopeDirectionDeg: number
  bottomBlend: number
  shellThickness: number
  surveyGridSpacing: number
  sectionSpacing: number
  toleranceMm: number
}

export interface ProjectData {
  schemaVersion: 1
  outlines: Outline[]
  basins?: Basin[]
  params: BowlParams
}

export interface ProjectRecord {
  id: string
  name: string
  client: string
  location: string
  description: string
  createdAt: number
  updatedAt: number
  thumbnail?: string
  data: ProjectData
}

export interface HistoryRecord {
  id: string
  projectId: string
  createdAt: number
  label: string
  data: ProjectData
}

export interface SurveyPoint {
  id: string
  gridX: number
  gridZ: number
  x: number
  z: number
  elevation: number
  depth: number
}

export interface SectionCheck {
  index: number
  station: number
  x: number
  z: number
  nx: number
  nz: number
  expectedRadius: number
  measuredRadius: number
  maxErrorM: number
  maxErrorMm: number
  passed: boolean
}

export interface CurvaturePoint {
  x: number
  z: number
  elevation: number
  curvature: number
  radius: number
  radiusErrorMm: number
  abrupt: boolean
  compliant: boolean
}

export interface QuantityResult {
  surfaceArea: number
  projectedArea: number
  concreteVolume: number
  excavationVolume: number
  rebarArea: number
  pointCount: number
}
