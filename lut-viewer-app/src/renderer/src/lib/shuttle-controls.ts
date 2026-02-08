export type ShuttleDirection = 'stopped' | 'forward' | 'reverse'

export type ShuttleState = {
    direction: ShuttleDirection
    speed: number
    isPlaying: boolean
}

export type ShuttleKey = 'a' | 's' | 'd'

const maxSpeed = 2

export const createStoppedShuttleState = (): ShuttleState => ({
    direction: 'stopped',
    speed: 0,
    isPlaying: false
})

export const nextShuttleState = (state: ShuttleState, key: ShuttleKey): ShuttleState => {
    if (key === 's') {
        if (state.isPlaying) return createStoppedShuttleState()
        return { direction: 'forward', speed: 1, isPlaying: true }
    }

    if (key === 'd') {
        if (state.direction === 'forward') {
            return { direction: 'forward', speed: Math.min(maxSpeed, Math.max(1, state.speed + 1)), isPlaying: true }
        }
        return { direction: 'forward', speed: 1, isPlaying: true }
    }

    if (state.direction === 'reverse') {
        return { direction: 'reverse', speed: Math.min(maxSpeed, Math.max(1, state.speed + 1)), isPlaying: true }
    }

    return { direction: 'reverse', speed: 1, isPlaying: true }
}
