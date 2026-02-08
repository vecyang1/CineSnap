export type DetectedColorSpace = 's-log3' | 'apple-log' | 'hlg' | 'rec709' | 'rec709-bt2020' | 'unknown'
export type UnknownLutDecision = 'apply-lut' | 'skip-lut'

export type ColorGradeState = {
  exposure: number
  contrast: number
  saturation: number
  highlights: number
  shadows: number
}

export const DEFAULT_COLOR_GRADE: ColorGradeState = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  highlights: 0,
  shadows: 0
}

const EPSILON = 0.0001

export const hasColorGradeAdjustments = (colorGrade: ColorGradeState): boolean =>
  Math.abs(colorGrade.exposure - DEFAULT_COLOR_GRADE.exposure) > EPSILON ||
  Math.abs(colorGrade.contrast - DEFAULT_COLOR_GRADE.contrast) > EPSILON ||
  Math.abs(colorGrade.saturation - DEFAULT_COLOR_GRADE.saturation) > EPSILON ||
  Math.abs(colorGrade.highlights - DEFAULT_COLOR_GRADE.highlights) > EPSILON ||
  Math.abs(colorGrade.shadows - DEFAULT_COLOR_GRADE.shadows) > EPSILON

export const resolveLutPathForExport = ({
  activeLut,
  colorSpace,
  smartApplyLut,
  unknownDecision
}: {
  activeLut: string | null
  colorSpace: DetectedColorSpace
  smartApplyLut: boolean
  unknownDecision: UnknownLutDecision
}): string | null => {
  if (!activeLut) return null
  if (!smartApplyLut) return activeLut
  if (colorSpace === 'rec709' || colorSpace === 'rec709-bt2020') return null
  if (colorSpace === 'unknown') return unknownDecision === 'apply-lut' ? activeLut : null
  return activeLut
}

export const shouldSkipVideoExport = ({
  lutPath,
  hasGradeAdjustments
}: {
  lutPath: string | null
  hasGradeAdjustments: boolean
}): boolean => !lutPath && !hasGradeAdjustments
