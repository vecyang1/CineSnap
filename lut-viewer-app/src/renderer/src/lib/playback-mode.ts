import type { PlaybackMode } from '../store/useStore'

export type OnEndedAction = 'stop' | 'next' | 'repeat'

export const getOnEndedAction = (
    mode: PlaybackMode,
    currentIndex: number,
    totalVideos: number
): OnEndedAction => {
    if (totalVideos <= 0 || currentIndex < 0) return 'stop'
    if (mode === 'repeat-one') return 'repeat'
    if (mode === 'sequence' && currentIndex < totalVideos - 1) return 'next'
    return 'stop'
}
