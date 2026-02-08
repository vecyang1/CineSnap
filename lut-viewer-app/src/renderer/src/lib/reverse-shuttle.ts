const MIN_REVERSE_FRAME_STEP_SECONDS = 0.03
const MAX_REVERSE_STEP_SECONDS = 0.45
const REVERSE_RATE_MULTIPLIER = 1.45

const clamp = (value: number, min: number, max: number): number => {
    if (Number.isNaN(value)) return min
    return Math.min(max, Math.max(min, value))
}

export const accumulateReversePendingSeconds = (
    pendingSeconds: number,
    speed: number,
    deltaMs: number
): number => {
    const boundedSpeed = clamp(speed, 1, 4)
    const boundedDeltaMs = clamp(deltaMs, 0, 120)
    const additional = (boundedDeltaMs / 1000) * boundedSpeed * REVERSE_RATE_MULTIPLIER
    return clamp(pendingSeconds + additional, 0, MAX_REVERSE_STEP_SECONDS)
}

export const calculateReverseStepSeconds = (
    speed: number,
    deltaMs: number,
    pendingSeconds = 0
): number => {
    const boundedSpeed = clamp(speed, 1, 4)
    const boundedDeltaMs = clamp(deltaMs, 0, 120)
    const dynamicStep = (boundedDeltaMs / 1000) * boundedSpeed * REVERSE_RATE_MULTIPLIER
    const minimumStep = MIN_REVERSE_FRAME_STEP_SECONDS * boundedSpeed
    const step = Math.max(dynamicStep, minimumStep) + Math.max(0, pendingSeconds)
    return Math.min(MAX_REVERSE_STEP_SECONDS, step)
}

