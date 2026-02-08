import * as React from 'react'
import { getSnapshotEntriesForVideo, useStore } from '../../store/useStore'
import { Play, Pause, SkipForward, SkipBack, Volume2, Camera } from 'lucide-react'
import { createTranslator } from '../../../../common/i18n'
import { SHORTCUTS } from '../../../../common/shortcuts'
import { buildSnapshotMarkers } from '../../lib/snapshot-timeline'

export const Controls: React.FC = () => {
    const { isPlaying, togglePlay, nextVideo, prevVideo, currentTime, duration, seek, playlist, currentIndex, snapshotLogs, uiLanguage } = useStore()
    const t = React.useMemo(() => createTranslator(uiLanguage), [uiLanguage])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = Math.floor(seconds % 60)
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const [isDragging, setIsDragging] = React.useState(false)
    const [localTime, setLocalTime] = React.useState(0)

    React.useEffect(() => {
        if (!isDragging) setLocalTime(currentTime)
    }, [currentTime, isDragging])

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTime(parseFloat(e.target.value))
    }

    const handleSeekCommit = () => {
        setIsDragging(false)
        seek(localTime)
    }

    const handleSeekStart = () => {
        setIsDragging(true)
    }

    const currentVideo = playlist[currentIndex]
    const snapshotMarkers = React.useMemo(
        () => buildSnapshotMarkers(currentVideo ? getSnapshotEntriesForVideo(snapshotLogs, currentVideo) : [], duration),
        [currentVideo, snapshotLogs, duration]
    )

    const handleMarkerClick = (time: number) => {
        setIsDragging(false)
        setLocalTime(time)
        seek(time)
    }

    // Hide snapshot dots that are very near the playhead so jump-to-marker
    // results in a single centered circle instead of a doubled visual.
    const markerEpsilon = 0.12

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 flex flex-col gap-4 shadow-2xl transition-all hover:bg-surface/90 min-w-[500px] z-50">
            {/* Progress Bar */}
            <div className="flex items-center gap-3 w-full">
                <span className="text-[10px] tabular-nums text-gray-400 w-10 text-right">{formatTime(localTime)}</span>
                <div className="relative flex-1 group h-8 flex items-center">
                    <div className="absolute inset-0 pointer-events-none z-20">
                        {snapshotMarkers.map((time) => {
                            if (Math.abs(time - localTime) <= markerEpsilon) return null
                            const left = `${(time / duration) * 100}%`
                            return (
                                <button
                                    key={`snap-marker-${time.toFixed(2)}`}
                                    type="button"
                                    onClick={() => handleMarkerClick(time)}
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-cyan-900/40 shadow-[0_0_0_2px_rgba(15,23,42,0.55)] pointer-events-auto hover:scale-125 transition-transform"
                                    style={{ left }}
                                    title={t('controls.snapshotMarker', { time: formatTime(time) })}
                                />
                            )
                        })}
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.01}
                        value={localTime}
                        onChange={handleSeekChange}
                        onMouseDown={handleSeekStart}
                        onMouseUp={handleSeekCommit}
                        className="slider-clean timeline-slider relative z-10 w-full"
                    />
                </div>
                <span className="text-[10px] tabular-nums text-gray-400 w-10">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button onClick={() => prevVideo()} className="btn-icon hover:bg-white/10 p-2 rounded-full">
                        <SkipBack size={20} fill="currentColor" />
                    </button>

                    <button
                        onClick={() => togglePlay()}
                        className="bg-white text-black p-4 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/20"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={() => nextVideo()} className="btn-icon hover:bg-white/10 p-2 rounded-full">
                        <SkipForward size={20} fill="currentColor" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 group relative">
                        <button
                            onClick={() => useStore.getState().setVolume(useStore.getState().volume === 0 ? 0.75 : 0)}
                            title={t('shortcut.toggleMute') || SHORTCUTS.toggleMute.title}
                        >
                            {useStore.getState().volume === 0 ? <Volume2 size={20} className="text-gray-500" /> : <Volume2 size={20} className="text-gray-400 group-hover:text-white transition-colors" />}
                        </button>

                        <div className="w-24 flex items-center ml-2">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={useStore.getState().volume}
                                onChange={(e) => useStore.getState().setVolume(parseFloat(e.target.value))}
                                className="slider-clean volume-slider w-full"
                            />
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    <button
                        onClick={() => useStore.getState().captureSnapshot()}
                        className="btn-icon hover:bg-white/10 p-2 rounded-full text-white/80 hover:text-cyan-400 transition-colors"
                        title={t('shortcut.captureSnapshot') || SHORTCUTS.captureSnapshot.title}
                    >
                        <Camera size={20} />
                    </button>
                </div>
            </div>
        </div>
    )
}
