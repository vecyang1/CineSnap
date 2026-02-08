export type ColorGradeState = {
  exposure: number
  contrast: number
  saturation: number
  highlights: number
  shadows: number
}

export type VideoGradeTarget = {
  path: string
  identity?: string | null
}

const PATH_IDENTITY_PREFIX = 'path:'

const toPathIdentity = (filePath: string): string => `${PATH_IDENTITY_PREFIX}${filePath}`

const resolveVideoIdentity = (video: VideoGradeTarget): string => {
  if (typeof video.identity === 'string' && video.identity.trim().length > 0) {
    return video.identity
  }
  return toPathIdentity(video.path)
}

export const DEFAULT_COLOR_GRADE: ColorGradeState = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  highlights: 0,
  shadows: 0
}

const getColorGradeAliases = (video: VideoGradeTarget): string[] => {
  const aliases = [resolveVideoIdentity(video), video.path, toPathIdentity(video.path)]
  return aliases.filter((alias, index, all) => alias.length > 0 && all.indexOf(alias) === index)
}

export const cloneColorGrade = (grade: ColorGradeState): ColorGradeState => ({ ...grade })

export const isNeutralColorGrade = (grade: ColorGradeState): boolean =>
  Math.abs(grade.exposure) < 1e-6 &&
  Math.abs(grade.contrast - 1) < 1e-6 &&
  Math.abs(grade.saturation - 1) < 1e-6 &&
  Math.abs(grade.highlights) < 1e-6 &&
  Math.abs(grade.shadows) < 1e-6

export const getColorGradeForVideo = (
  colorGrades: Record<string, ColorGradeState>,
  video: VideoGradeTarget
): ColorGradeState => {
  for (const alias of getColorGradeAliases(video)) {
    const grade = colorGrades[alias]
    if (grade) return { ...DEFAULT_COLOR_GRADE, ...grade }
  }
  return cloneColorGrade(DEFAULT_COLOR_GRADE)
}

export const replaceColorGradeForVideo = (
  colorGrades: Record<string, ColorGradeState>,
  video: VideoGradeTarget,
  grade: ColorGradeState
): Record<string, ColorGradeState> => {
  const next = { ...colorGrades }
  for (const alias of getColorGradeAliases(video)) {
    delete next[alias]
  }
  if (!isNeutralColorGrade(grade)) {
    next[resolveVideoIdentity(video)] = { ...DEFAULT_COLOR_GRADE, ...grade }
  }
  return next
}

export const mergeColorGradeForVideo = (
  colorGrades: Record<string, ColorGradeState>,
  video: VideoGradeTarget,
  patch: Partial<ColorGradeState>
): Record<string, ColorGradeState> => {
  const current = getColorGradeForVideo(colorGrades, video)
  return replaceColorGradeForVideo(colorGrades, video, { ...current, ...patch })
}

export const clearColorGradeForVideo = (
  colorGrades: Record<string, ColorGradeState>,
  video: VideoGradeTarget
): Record<string, ColorGradeState> => {
  const next = { ...colorGrades }
  for (const alias of getColorGradeAliases(video)) {
    delete next[alias]
  }
  return next
}
