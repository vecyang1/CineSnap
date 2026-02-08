export interface ExposureZoneRatios {
    shadows: number
    midtones: number
    highlights: number
}

export interface ExposureDistribution {
    histogram: number[]
    totalSamples: number
    averageLuma: number
    clippedBlackRatio: number
    clippedWhiteRatio: number
    percentile10: number
    percentile90: number
    zoneRatios: ExposureZoneRatios
}

export interface AnalyzeExposureOptions {
    binCount?: number
    sampleStride?: number
    blackClipThreshold?: number
    whiteClipThreshold?: number
    shadowBoundary?: number
    highlightBoundary?: number
}

const DEFAULT_BIN_COUNT = 64

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const getPercentileFromHistogram = (histogram: number[], totalSamples: number, percentile: number): number => {
    if (totalSamples <= 0) return 0
    const clampedPercentile = clamp01(percentile)
    const target = totalSamples * clampedPercentile

    let cumulative = 0
    for (let index = 0; index < histogram.length; index += 1) {
        cumulative += histogram[index]
        if (cumulative >= target) {
            return (index + 0.5) / histogram.length
        }
    }

    return 1
}

export const createEmptyExposureDistribution = (binCount: number = DEFAULT_BIN_COUNT): ExposureDistribution => ({
    histogram: new Array(Math.max(4, Math.floor(binCount) || DEFAULT_BIN_COUNT)).fill(0),
    totalSamples: 0,
    averageLuma: 0,
    clippedBlackRatio: 0,
    clippedWhiteRatio: 0,
    percentile10: 0,
    percentile90: 0,
    zoneRatios: {
        shadows: 0,
        midtones: 0,
        highlights: 0
    }
})

export const analyzeExposureDistribution = (
    rgbaPixels: Uint8ClampedArray,
    options: AnalyzeExposureOptions = {}
): ExposureDistribution => {
    const binCount = Math.max(4, Math.floor(options.binCount ?? DEFAULT_BIN_COUNT))
    const sampleStride = Math.max(1, Math.floor(options.sampleStride ?? 1))
    const blackClipThreshold = clamp01(options.blackClipThreshold ?? 0.02)
    const whiteClipThreshold = clamp01(options.whiteClipThreshold ?? 0.98)
    const shadowBoundary = clamp01(options.shadowBoundary ?? 0.33)
    const highlightBoundary = clamp01(options.highlightBoundary ?? 0.66)

    if (!rgbaPixels || rgbaPixels.length < 4) {
        return createEmptyExposureDistribution(binCount)
    }

    const histogram = new Array(binCount).fill(0)

    let totalSamples = 0
    let sumLuma = 0
    let clippedBlackCount = 0
    let clippedWhiteCount = 0
    let shadowCount = 0
    let midtoneCount = 0
    let highlightCount = 0

    for (let index = 0; index <= rgbaPixels.length - 4; index += 4 * sampleStride) {
        const r = rgbaPixels[index] / 255
        const g = rgbaPixels[index + 1] / 255
        const b = rgbaPixels[index + 2] / 255

        const luma = clamp01((r * 0.2126) + (g * 0.7152) + (b * 0.0722))
        const binIndex = Math.min(binCount - 1, Math.floor(luma * binCount))

        histogram[binIndex] += 1
        totalSamples += 1
        sumLuma += luma

        if (luma <= blackClipThreshold) clippedBlackCount += 1
        if (luma >= whiteClipThreshold) clippedWhiteCount += 1

        if (luma < shadowBoundary) shadowCount += 1
        else if (luma < highlightBoundary) midtoneCount += 1
        else highlightCount += 1
    }

    if (totalSamples === 0) {
        return createEmptyExposureDistribution(binCount)
    }

    return {
        histogram,
        totalSamples,
        averageLuma: sumLuma / totalSamples,
        clippedBlackRatio: clippedBlackCount / totalSamples,
        clippedWhiteRatio: clippedWhiteCount / totalSamples,
        percentile10: getPercentileFromHistogram(histogram, totalSamples, 0.1),
        percentile90: getPercentileFromHistogram(histogram, totalSamples, 0.9),
        zoneRatios: {
            shadows: shadowCount / totalSamples,
            midtones: midtoneCount / totalSamples,
            highlights: highlightCount / totalSamples
        }
    }
}
