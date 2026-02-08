import { create } from 'zustand'
import { createEmptyExposureDistribution, type ExposureDistribution } from '../lib/exposure-histogram'

interface ExposureConfig {
    blackClipThreshold: number
    whiteClipThreshold: number
    sampleStride: number
}

interface AnalysisState {
    exposureDistribution: ExposureDistribution
    exposureConfig: ExposureConfig
    setExposureDistribution: (distribution: ExposureDistribution) => void
    setExposureConfig: (config: Partial<ExposureConfig>) => void
    resetExposureDistribution: () => void
}

export const useAnalysisStore = create<AnalysisState>()((set) => ({
    exposureDistribution: createEmptyExposureDistribution(),
    exposureConfig: {
        blackClipThreshold: 0.02,
        whiteClipThreshold: 0.98,
        sampleStride: 1
    },
    setExposureDistribution: (distribution) => set({ exposureDistribution: distribution }),
    setExposureConfig: (config) => set((state) => ({
        exposureConfig: {
            ...state.exposureConfig,
            ...config
        }
    })),
    resetExposureDistribution: () => set({ exposureDistribution: createEmptyExposureDistribution() })
}))
