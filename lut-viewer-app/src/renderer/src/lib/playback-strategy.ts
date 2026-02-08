type ColorGrade = {
    exposure: number
    contrast: number
    saturation: number
    highlights: number
    shadows: number
}

type PlaybackStrategyInput = {
    activeLut: string | null
    isLutBypassed: boolean
    showDebugBars: boolean
    colorGrade: ColorGrade
}

const isNeutralColorGrade = (grade: ColorGrade): boolean =>
    Math.abs(grade.exposure) < 1e-6 &&
    Math.abs(grade.contrast - 1) < 1e-6 &&
    Math.abs(grade.saturation - 1) < 1e-6 &&
    Math.abs(grade.highlights) < 1e-6 &&
    Math.abs(grade.shadows) < 1e-6

export const shouldUseProcessingPipeline = (input: PlaybackStrategyInput): boolean => {
    if (input.showDebugBars) return true
    if (input.activeLut && !input.isLutBypassed) return true
    return !isNeutralColorGrade(input.colorGrade)
}
