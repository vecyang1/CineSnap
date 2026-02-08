import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { getSnapshotEntriesForVideo, useStore } from '../../store/useStore'
import { createTranslator } from '../../../../common/i18n'
import { LUTRenderer } from '../../lib/webgl-utils'
import { parseCubeLut } from '../../lib/lut-parser'
import { resolveVideoIdentity } from '../../lib/video-identity'
import { electronApi } from '../../lib/electron-api'
import { createStoppedShuttleState, nextShuttleState, type ShuttleKey } from '../../lib/shuttle-controls'
import { getOnEndedAction } from '../../lib/playback-mode'
import { shouldUseProcessingPipeline } from '../../lib/playback-strategy'
import { accumulateReversePendingSeconds, calculateReverseStepSeconds } from '../../lib/reverse-shuttle'
import { analyzeExposureDistribution } from '../../lib/exposure-histogram'
import { isShortcutTypingTarget } from '../../lib/keyboard-target'
import { buildSnapshotFilename } from '../../lib/snapshot-filename'
import { buildSnapshotMarkers, findSnapshotJumpTarget } from '../../lib/snapshot-timeline'
import { useAnalysisStore } from '../../store/useAnalysisStore'
import { SHORTCUTS, type MenuAction } from '../../../../common/shortcuts'
import { vertexShaderSource, fragmentShaderSource } from './shaders'

const EXPOSURE_SAMPLE_INTERVAL_MS = 260
const EXPOSURE_SAMPLE_WIDTH = 160
const HOLD_TO_MOMENTARY_SHUTTLE_MS = 180

export const VideoPlayer: React.FC = () => {
    const { playlist, currentIndex, isPlaying, isLutBypassed, activeLut, nextVideo, playbackRate, showDebugBars, playbackMode, uiLanguage } = useStore()
    const snapshotTrigger = useStore((s) => s.snapshotTrigger)
    const seekTrigger = useStore((s) => s.seekTrigger)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<LUTRenderer | null>(null)
    const lutReadyRef = useRef(false)
    const animationFrameRef = useRef<number>(0)
    const hasRenderedFrameRef = useRef(false)
    const [showCanvas, setShowCanvas] = useState(false)
    const [rendererReady, setRendererReady] = useState(false)
    const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null)
    const [speedNotice, setSpeedNotice] = useState<number | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const reverseTimerRef = useRef<number | null>(null)
    const reverseLastTickRef = useRef<number | null>(null)
    const reversePendingSeekRef = useRef(0)
    const lastNonZeroVolumeRef = useRef(0.75)
    const shuttleStateRef = useRef(createStoppedShuttleState())
    const pausedShuttlePressRef = useRef<{ key: ShuttleKey | null; startedAt: number }>({ key: null, startedAt: 0 })
    const momentaryShuttleKeyRef = useRef<ShuttleKey | null>(null)
    const pipelineActiveRef = useRef<boolean>(false)
    const exposureSampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const exposureSampleContextRef = useRef<CanvasRenderingContext2D | null>(null)
    const lastExposureSampleAtRef = useRef(0)

    const currentVideo = playlist[currentIndex]
    const currentVideoIdentity = currentVideo ? resolveVideoIdentity(currentVideo) : ''
    const t = createTranslator(uiLanguage)

    useEffect(() => {
        useAnalysisStore.getState().resetExposureDistribution()
    }, [currentVideo?.id])

    const applyPlaybackMode = (mode: 'once' | 'sequence' | 'repeat-one') => {
        useStore.getState().setPlaybackMode(mode)
        const label = mode === 'repeat-one' ? t('player.playbackModeRepeatOne')
            : mode === 'sequence' ? t('player.playbackModeSequence')
                : t('player.playbackModeOnce')
        setSnapshotNotice(t('player.playbackModeNotice', { mode: label }))
        setTimeout(() => setSnapshotNotice(null), 1200)
    }

    const toggleMute = () => {
        const { volume, setVolume } = useStore.getState()
        if (volume > 0.001) {
            lastNonZeroVolumeRef.current = volume
            setVolume(0)
            return
        }
        const restored = Math.min(1, Math.max(0.05, lastNonZeroVolumeRef.current || 0.75))
        setVolume(restored)
    }

    const formatTimestamp = (seconds: number): string => {
        const clamped = Math.max(0, Math.floor(seconds))
        const h = Math.floor(clamped / 3600)
        const m = Math.floor((clamped % 3600) / 60)
        const s = clamped % 60
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    // Playback control
    useEffect(() => {
        if (!videoRef.current) return
        if (!isPlaying) {
            if (reverseTimerRef.current !== null) {
                window.cancelAnimationFrame(reverseTimerRef.current)
                reverseTimerRef.current = null
                reverseLastTickRef.current = null
                reversePendingSeekRef.current = 0
            }
            shuttleStateRef.current = createStoppedShuttleState()
            videoRef.current.pause()
            return
        }
        if (reverseTimerRef.current !== null) {
            videoRef.current.pause()
            return
        }
        videoRef.current.play().catch(e => console.error("Play failed", e))
    }, [isPlaying])

    useEffect(() => {
        return () => {
            if (reverseTimerRef.current !== null) {
                window.cancelAnimationFrame(reverseTimerRef.current)
                reverseTimerRef.current = null
                reverseLastTickRef.current = null
                reversePendingSeekRef.current = 0
            }
        }
    }, [])

    useEffect(() => {
        if (reverseTimerRef.current !== null) return
        if (isPlaying) {
            shuttleStateRef.current = {
                direction: 'forward',
                speed: playbackRate >= 2 ? 2 : 1,
                isPlaying: true
            }
        } else {
            shuttleStateRef.current = createStoppedShuttleState()
        }
    }, [isPlaying, playbackRate])

    // Playback Rate Sync
    useEffect(() => {
        if (!videoRef.current) return
        videoRef.current.playbackRate = playbackRate
    }, [playbackRate])

    // Snapshot Trigger
    useEffect(() => {
        if (snapshotTrigger > 0) {
            void captureFrame()
        }
    }, [snapshotTrigger]) // Listen to changes


    // Video Source Update
    useEffect(() => {
        if (!videoRef.current || !currentVideo) return

        let cancelled = false
        if (reverseTimerRef.current !== null) {
            window.cancelAnimationFrame(reverseTimerRef.current)
            reverseTimerRef.current = null
            reverseLastTickRef.current = null
            reversePendingSeekRef.current = 0
        }
        shuttleStateRef.current = createStoppedShuttleState()

        const loadVideo = async () => {
            const exists = await electronApi.pathExists(currentVideo.path)
            useStore.getState().setVideoMissing(currentVideo.path, !exists)
            if (cancelled) return
            if (!exists) {
                setSnapshotNotice(t('player.missingFile', { name: currentVideo.name }))
                useStore.getState().setPlaying(false)
                return
            }

            const wasPlaying = useStore.getState().isPlaying
            hasRenderedFrameRef.current = false
            setShowCanvas(false)
            const encodedPath = encodeURI(currentVideo.path).replace(/#/g, '%23').replace(/\?/g, '%3f')
            videoRef.current!.src = `media://${encodedPath}`

            if (wasPlaying) videoRef.current!.play().catch(e => console.error("Play failed", e))
        }

        void loadVideo()
        return () => {
            cancelled = true
        }
    }, [currentVideo])

    // Seek Handler
    useEffect(() => {
        const { currentTime } = useStore.getState()
        if (videoRef.current && seekTrigger > 0) {
            videoRef.current.currentTime = currentTime
        }
    }, [seekTrigger])

    const [glError, setGlError] = useState<string | null>(null)

    // WebGL Loop & Event Listeners
    useEffect(() => {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return

        // New canvas/context may be created on clip switch; reset readiness so LUT is reloaded for this renderer.
        lutReadyRef.current = false
        setRendererReady(false)

        const isHlg = currentVideo?.colorSpace === 'hlg'
        const colorSpace = isHlg ? 'display-p3' : 'srgb'

        console.log('Initializing WebGL context. ColorSpace:', colorSpace, 'Is HLG:', isHlg)

        // @ts-ignore - colorSpace is valid in modern browsers but TS might not know it yet
        const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, colorSpace }) as WebGL2RenderingContext | null
        if (!gl) {
            const msg = "Failed to get WebGL2 context"
            console.error(msg)
            setGlError(msg)
            return
        }

        const renderer = new LUTRenderer(gl)
        renderer.init(vertexShaderSource, fragmentShaderSource)

        if (renderer.lastError) {
            setGlError("Init Error: " + renderer.lastError)
        }

        rendererRef.current = renderer
        setRendererReady(Boolean(renderer.program))

        const handleTimeUpdate = () => {
            useStore.getState().setProgress(video.currentTime, video.duration || 0)
        }

        const handleLoadedMetadata = () => {
            useStore.getState().setProgress(video.currentTime, video.duration || 0)
        }

        const sampleExposureFromSource = (source: HTMLVideoElement | HTMLCanvasElement, sourceWidth: number, sourceHeight: number) => {
            if (sourceWidth <= 0 || sourceHeight <= 0) return

            const now = performance.now()
            if ((now - lastExposureSampleAtRef.current) < EXPOSURE_SAMPLE_INTERVAL_MS) return
            lastExposureSampleAtRef.current = now

            let sampleCanvas = exposureSampleCanvasRef.current
            if (!sampleCanvas) {
                sampleCanvas = document.createElement('canvas')
                exposureSampleCanvasRef.current = sampleCanvas
            }

            const targetWidth = EXPOSURE_SAMPLE_WIDTH
            const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth))

            if (sampleCanvas.width !== targetWidth || sampleCanvas.height !== targetHeight) {
                sampleCanvas.width = targetWidth
                sampleCanvas.height = targetHeight
                exposureSampleContextRef.current = null
            }

            let sampleContext = exposureSampleContextRef.current
            if (!sampleContext) {
                sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
                exposureSampleContextRef.current = sampleContext
            }
            if (!sampleContext) return

            sampleContext.drawImage(source, 0, 0, targetWidth, targetHeight)
            const imageData = sampleContext.getImageData(0, 0, targetWidth, targetHeight)
            const { exposureConfig, setExposureDistribution } = useAnalysisStore.getState()
            setExposureDistribution(analyzeExposureDistribution(imageData.data, {
                binCount: 64,
                sampleStride: exposureConfig.sampleStride,
                blackClipThreshold: exposureConfig.blackClipThreshold,
                whiteClipThreshold: exposureConfig.whiteClipThreshold
            }))
        }

        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('loadedmetadata', handleLoadedMetadata)

        const render = () => {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                const renderState = useStore.getState()
                const processingEnabled = shouldUseProcessingPipeline({
                    activeLut: renderState.activeLut,
                    isLutBypassed: renderState.isLutBypassed,
                    showDebugBars: renderState.showDebugBars,
                    colorGrade: renderState.colorGrade
                })

                if (!processingEnabled) {
                    if (pipelineActiveRef.current) {
                        pipelineActiveRef.current = false
                        hasRenderedFrameRef.current = false
                        setShowCanvas(false)
                    }
                    sampleExposureFromSource(video, video.videoWidth, video.videoHeight)
                    animationFrameRef.current = requestAnimationFrame(render)
                    return
                }

                // Resize if needed
                const vw = video.videoWidth
                const vh = video.videoHeight

                if (vw > 0 && vh > 0) {
                    if (canvas.width !== vw || canvas.height !== vh) {
                        canvas.width = vw
                        canvas.height = vh
                        gl.viewport(0, 0, canvas.width, canvas.height)
                    }

                    if (!renderer.program) {
                        // Retry init if program is missing
                        renderer.init(vertexShaderSource, fragmentShaderSource)
                        if (renderer.program) {
                            setRendererReady(true)
                            setGlError(null)
                        } else {
                            // Only set error if it wasn't already set to avoid flickering
                            if (renderer.lastError) setGlError("Retry Error: " + renderer.lastError)
                        }
                    }

                    try {
                        renderer.updateVideoTexture(video)
                        const { lutIntensity, isLutBypassed, activeLut, colorGrade, showDebugBars } = renderState

                        // Force bypass if no LUT is loaded OR if explicitly bypassed
                        const effectiveBypass = isLutBypassed || !activeLut || !lutReadyRef.current

                        renderer.draw(lutIntensity, effectiveBypass, colorGrade, showDebugBars)
                        sampleExposureFromSource(canvas, canvas.width, canvas.height)

                        pipelineActiveRef.current = true

                        if (!hasRenderedFrameRef.current) {
                            hasRenderedFrameRef.current = true
                            setShowCanvas(true)
                        }
                    } catch (e: any) {
                        console.error("WebGL Draw Error:", e)
                        setGlError("Draw Error: " + e.message)
                    }
                }
            } else {
                // Video not ready
            }

            animationFrameRef.current = requestAnimationFrame(render)
        }

        render()

        return () => {
            cancelAnimationFrame(animationFrameRef.current)
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            rendererRef.current = null
            lutReadyRef.current = false
        }
    }, [currentVideoIdentity, currentVideo?.colorSpace])

    const [lastLutError, setLastLutError] = useState<string | null>(null)

    // Load LUT when activeLut changes
    useEffect(() => {
        if (!rendererRef.current || !rendererReady) return
        lutReadyRef.current = false
        setLastLutError(null)
        if (!activeLut) return
        let isCancelled = false

        console.log("Loading LUT:", activeLut)

        electronApi.readLutFile(activeLut)
            .then((text) => {
                if (isCancelled) return

                if (!text || text.length === 0) {
                    const err = "Empty LUT file content"
                    console.error(err)
                    setLastLutError(err)
                    return
                }

                const result = parseCubeLut(text)
                if (!result) {
                    const err = `Failed to parse LUT: ${activeLut}`
                    console.error(err)
                    setLastLutError(err)
                    return
                }

                try {
                    rendererRef.current?.loadLut(result.data, result.size)
                    lutReadyRef.current = true
                    setLastLutError(null) // Clear error on success
                } catch (e: any) {
                    const err = "WebGL Load Error: " + e.message
                    console.error(err)
                    setLastLutError(err)
                }
            })
            .catch((err) => {
                console.error("Failed to load LUT", err)
                setLastLutError("Load Failed: " + (err.message || String(err)))
            })

        return () => {
            isCancelled = true
            lutReadyRef.current = false
        }
    }, [activeLut, rendererReady, currentVideoIdentity])

    // Snapshot Function
    const captureFrame = async () => {
        try {
            if (isCapturing) return
            if (!currentVideo) {
                setSnapshotNotice(t('player.noVideoSelected'))
                setTimeout(() => setSnapshotNotice(null), 1200)
                return
            }

            setIsCapturing(true)
            const { snapshotDirectory, setSnapshotDirectory } = useStore.getState()
            let targetFolder = snapshotDirectory

            // If no folder set, ask once
            if (!targetFolder) {
                const folders = await electronApi.openFileDialog({
                    properties: ['openDirectory', 'createDirectory'],
                    title: t('player.selectSnapshotFolderTitle')
                })
                if (folders && folders.length > 0) {
                    targetFolder = folders[0]
                    setSnapshotDirectory(targetFolder)
                } else {
                    setSnapshotNotice(t('player.snapshotCanceled'))
                    setTimeout(() => setSnapshotNotice(null), 1200)
                    return // User cancelled
                }
            }

            // WYSIWYG Snapshot using Canvas (includes Color Grade & LUT)
            // We must use the canvas because backend ffmpeg does not support the custom color grading shaders easily.
            const snapshotCanvas = canvasRef.current
            const renderer = rendererRef.current
            const video = videoRef.current
            let base64Data: string | null = null
            let appliedLutPath: string | null = null

            if (snapshotCanvas && renderer && video && snapshotCanvas.width > 0 && snapshotCanvas.height > 0) {
                if (!hasRenderedFrameRef.current && video.readyState >= 2) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                }

                try {
                    const { lutIntensity, isLutBypassed, activeLut, colorGrade, showDebugBars } = useStore.getState()
                    const effectiveBypass = isLutBypassed || !activeLut || !lutReadyRef.current

                    renderer.updateVideoTexture(video)
                    renderer.draw(lutIntensity, effectiveBypass, colorGrade, showDebugBars)
                    rendererRef.current?.gl.finish()
                    base64Data = snapshotCanvas.toDataURL('image/png')
                    appliedLutPath = !effectiveBypass && lutIntensity > 0 ? activeLut : null
                } catch (error) {
                    console.error("Failed to capture from WebGL canvas, falling back to video frame", error)
                }
            }

            if (!base64Data && videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                // Fallback: This capture won't have the LUT/Grade if canvas is missing, but better than crash
                const fallbackCanvas = document.createElement('canvas')
                fallbackCanvas.width = videoRef.current.videoWidth
                fallbackCanvas.height = videoRef.current.videoHeight
                const ctx = fallbackCanvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, fallbackCanvas.width, fallbackCanvas.height)
                    base64Data = fallbackCanvas.toDataURL('image/png')
                }
            }

            if (!base64Data) {
                setSnapshotNotice(t('player.frameNotReady'))
                setTimeout(() => setSnapshotNotice(null), 1200)
                setIsCapturing(false)
                return
            }

            const filename = buildSnapshotFilename({
                timestampIso: new Date().toISOString(),
                appliedLutPath
            })
            const { currentTime } = useStore.getState()

            const result = await electronApi.saveSnapshot({
                base64Data,
                folderPath: targetFolder,
                filename
            })

            if (result.success) {
                console.log("Snapshot saved to:", result.path)
                useStore.getState().addSnapshotLog(currentVideo, {
                    timestampSec: currentTime,
                    snapshotPath: result.path || '',
                    createdAt: Date.now()
                })
                setSnapshotNotice(t('player.snapshotSaved', { filename }))
                window.dispatchEvent(new CustomEvent('snapshot-saved'))
                setTimeout(() => setSnapshotNotice(null), 1800)
            } else {
                console.error("Failed to save snapshot:", result.error)
                alert(t('player.failedSaveSnapshotAlert', { error: result.error || 'Unknown error' }))
            }
        } catch (e: any) {
            console.error("Snapshot capture failed:", e)
            alert(t('player.snapshotCaptureFailedAlert', { error: e?.message || String(e) }))
        } finally {
            setIsCapturing(false)
        }
    }

    // Volume Sync
    const volume = useStore((s) => s.volume)
    useEffect(() => {
        if (volume > 0.001) {
            lastNonZeroVolumeRef.current = volume
        }
        if (videoRef.current) {
            videoRef.current.volume = volume
        }
    }, [volume])

    // Keyboard Shortcuts
    useEffect(() => {
        const clearMomentaryShuttleState = () => {
            pausedShuttlePressRef.current = { key: null, startedAt: 0 }
            momentaryShuttleKeyRef.current = null
        }

        const stopReverseShuttle = () => {
            if (reverseTimerRef.current !== null) {
                window.cancelAnimationFrame(reverseTimerRef.current)
                reverseTimerRef.current = null
            }
            reverseLastTickRef.current = null
            reversePendingSeekRef.current = 0
        }

        const startReverseShuttle = (speed: number) => {
            stopReverseShuttle()
            const video = videoRef.current
            if (!video) return

            video.pause()
            const reverseLoop = (now: number) => {
                const activeVideo = videoRef.current
                if (!activeVideo) {
                    stopReverseShuttle()
                    return
                }

                if (shuttleStateRef.current.direction !== 'reverse' || !shuttleStateRef.current.isPlaying) {
                    stopReverseShuttle()
                    return
                }

                const lastTick = reverseLastTickRef.current ?? now
                const deltaMs = Math.max(0, Math.min(120, now - lastTick))
                reverseLastTickRef.current = now

                if (activeVideo.readyState < 2) {
                    reverseTimerRef.current = window.requestAnimationFrame(reverseLoop)
                    return
                }

                if (activeVideo.seeking) {
                    reversePendingSeekRef.current = accumulateReversePendingSeconds(reversePendingSeekRef.current, speed, deltaMs)
                    reverseTimerRef.current = window.requestAnimationFrame(reverseLoop)
                    return
                }

                const stepSeconds = calculateReverseStepSeconds(speed, deltaMs, reversePendingSeekRef.current)
                reversePendingSeekRef.current = 0
                const target = Math.max(0, activeVideo.currentTime - stepSeconds)
                activeVideo.currentTime = target
                useStore.getState().setProgress(target, activeVideo.duration || 0)
                if (target <= 0) {
                    stopReverseShuttle()
                    useStore.getState().setPlaying(false)
                    shuttleStateRef.current = createStoppedShuttleState()
                    return
                }

                reverseTimerRef.current = window.requestAnimationFrame(reverseLoop)
            }

            reverseTimerRef.current = window.requestAnimationFrame(reverseLoop)
        }

        const applyShuttleState = (direction: 'stopped' | 'forward' | 'reverse', speed: number, isPlayingNext: boolean) => {
            const store = useStore.getState()
            shuttleStateRef.current = { direction, speed, isPlaying: isPlayingNext }

            if (!isPlayingNext || direction === 'stopped') {
                clearMomentaryShuttleState()
                stopReverseShuttle()
                store.setPlaybackRate(1.0)
                store.setPlaying(false)
                setSpeedNotice(null)
                return
            }

            if (direction === 'forward') {
                stopReverseShuttle()
                store.setPlaybackRate(speed)
                store.setPlaying(true)
                videoRef.current?.play().catch(e => console.error('Play failed', e))
                setSpeedNotice(speed)
                setTimeout(() => setSpeedNotice(null), 1000)
                return
            }

            store.setPlaybackRate(1.0)
            store.setPlaying(true)
            startReverseShuttle(speed)
            setSpeedNotice(speed)
            setTimeout(() => setSpeedNotice(null), 1000)
        }

        const resolveShuttleDirectionKey = (code: string): ShuttleKey | null => {
            if (code === SHORTCUTS.shuttleReverse.keyCode || code === 'ArrowLeft') return 'a'
            if (code === SHORTCUTS.shuttleForward.keyCode || code === 'ArrowRight') return 'd'
            return null
        }

        const armMomentaryShuttleOnHold = (shuttleDirectionKey: ShuttleKey, wasPaused: boolean) => {
            momentaryShuttleKeyRef.current = null
            if (!wasPaused) {
                pausedShuttlePressRef.current = { key: null, startedAt: 0 }
                return
            }

            pausedShuttlePressRef.current = { key: shuttleDirectionKey, startedAt: performance.now() }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isShortcutTypingTarget(e.target)) return

            if (e.code === SHORTCUTS.captureSnapshotAlternative.keyCode && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                useStore.getState().captureSnapshot()
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.code === SHORTCUTS.playbackModeRepeatOne.keyCode) {
                e.preventDefault()
                applyPlaybackMode('repeat-one')
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.code === SHORTCUTS.playbackModeSequence.keyCode) {
                e.preventDefault()
                applyPlaybackMode('sequence')
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.code === SHORTCUTS.playbackModeOnce.keyCode) {
                e.preventDefault()
                applyPlaybackMode('once')
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === SHORTCUTS.toggleMute.keyCode) {
                e.preventDefault()
                toggleMute()
                return
            }

            if ((e.metaKey || e.ctrlKey) && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                e.preventDefault()
                const state = useStore.getState()
                const activeVideo = state.playlist[state.currentIndex]
                if (!activeVideo) return

                const entries = getSnapshotEntriesForVideo(state.snapshotLogs, activeVideo)
                const effectiveDuration = state.duration > 0
                    ? state.duration
                    : (videoRef.current?.duration || 0)
                const markerDuration = effectiveDuration > 0
                    ? effectiveDuration
                    : Math.max(0.01, ...entries.map((entry) => entry.timestampSec))
                const markers = buildSnapshotMarkers(
                    entries,
                    markerDuration
                )

                if (markers.length === 0) {
                    setSnapshotNotice(t('player.noSnapshotTimestampsForVideo'))
                    setTimeout(() => setSnapshotNotice(null), 1200)
                    return
                }

                const direction = e.code === 'ArrowUp' ? 'previous' : 'next'
                const target = findSnapshotJumpTarget(markers, state.currentTime, direction)
                if (target == null) {
                    setSnapshotNotice(direction === 'previous' ? t('player.alreadyAtFirstTimestamp') : t('player.alreadyAtLastTimestamp'))
                    setTimeout(() => setSnapshotNotice(null), 1200)
                    return
                }

                state.seek(target)
                setSnapshotNotice(t('player.jumpedToTimestamp', { time: formatTimestamp(target) }))
                setTimeout(() => setSnapshotNotice(null), 1000)
                return
            }

            // Space: Toggle Play/Pause
            if (e.code === 'Space') {
                e.preventDefault()
                useStore.getState().togglePlay()
                return
            }

            // F: Toggle LUT bypass
            if (e.code === SHORTCUTS.toggleLutBypass.keyCode) {
                e.preventDefault()
                const current = useStore.getState().isLutBypassed
                useStore.getState().setBypassLut(!current)
                return
            }

            // R: Reset Grading
            if (e.code === 'KeyR') {
                e.preventDefault()
                useStore.getState().resetColorGrade()
                setSnapshotNotice(t('player.gradingReset')) // reuse notification
                setTimeout(() => setSnapshotNotice(null), 1200)
                return
            }

            const shuttleDirectionKey = resolveShuttleDirectionKey(e.code)
            if (e.repeat && (
                e.code === SHORTCUTS.shuttleReverse.keyCode ||
                e.code === SHORTCUTS.shuttleToggle.keyCode ||
                e.code === SHORTCUTS.shuttleForward.keyCode ||
                e.code === SHORTCUTS.toggleLutBypass.keyCode ||
                e.code === SHORTCUTS.toggleMute.keyCode ||
                e.code === SHORTCUTS.captureSnapshot.keyCode ||
                e.code === 'ArrowLeft' ||
                e.code === 'ArrowRight'
            )) return

            if (e.code === SHORTCUTS.shuttleReverse.keyCode) {
                e.preventDefault()
                const store = useStore.getState()
                const wasPaused = !store.isPlaying
                const next = nextShuttleState(shuttleStateRef.current, 'a')
                if (wasPaused && shuttleDirectionKey) armMomentaryShuttleOnHold('a', true)
                else clearMomentaryShuttleState()
                applyShuttleState(next.direction, next.speed, next.isPlaying)
                return
            }

            if (e.code === SHORTCUTS.shuttleToggle.keyCode) {
                e.preventDefault()
                clearMomentaryShuttleState()
                const next = nextShuttleState(shuttleStateRef.current, 's')
                applyShuttleState(next.direction, next.speed, next.isPlaying)
                return
            }

            if (e.code === SHORTCUTS.shuttleForward.keyCode) {
                e.preventDefault()
                const store = useStore.getState()
                const wasPaused = !store.isPlaying
                const next = nextShuttleState(shuttleStateRef.current, 'd')
                if (wasPaused && shuttleDirectionKey) armMomentaryShuttleOnHold('d', true)
                else clearMomentaryShuttleState()
                applyShuttleState(next.direction, next.speed, next.isPlaying)
                return
            }

            if (e.code === SHORTCUTS.captureSnapshot.keyCode) {
                e.preventDefault()
                useStore.getState().captureSnapshot()
                return
            }

            // Keep arrow keys as optional aliases.
            if (e.code === 'ArrowLeft') {
                e.preventDefault()
                const store = useStore.getState()
                const wasPaused = !store.isPlaying
                const next = nextShuttleState(shuttleStateRef.current, 'a')
                armMomentaryShuttleOnHold('a', wasPaused)
                applyShuttleState(next.direction, next.speed, next.isPlaying)
                return
            }

            if (e.code === 'ArrowRight') {
                e.preventDefault()
                const store = useStore.getState()
                const wasPaused = !store.isPlaying
                const next = nextShuttleState(shuttleStateRef.current, 'd')
                armMomentaryShuttleOnHold('d', wasPaused)
                applyShuttleState(next.direction, next.speed, next.isPlaying)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (isShortcutTypingTarget(e.target)) return
            const shuttleDirectionKey = resolveShuttleDirectionKey(e.code)
            if (!shuttleDirectionKey) return

            if (pausedShuttlePressRef.current.key !== shuttleDirectionKey) return
            const heldMs = performance.now() - pausedShuttlePressRef.current.startedAt
            pausedShuttlePressRef.current = { key: null, startedAt: 0 }
            if (heldMs < HOLD_TO_MOMENTARY_SHUTTLE_MS) {
                momentaryShuttleKeyRef.current = null
                return
            }
            momentaryShuttleKeyRef.current = shuttleDirectionKey
            if (momentaryShuttleKeyRef.current !== shuttleDirectionKey) return
            if (!useStore.getState().isPlaying) {
                momentaryShuttleKeyRef.current = null
                return
            }
            e.preventDefault()
            clearMomentaryShuttleState()
            applyShuttleState('stopped', 0, false)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            stopReverseShuttle()
            clearMomentaryShuttleState()
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    useEffect(() => {
        const ipc = window.electron?.ipcRenderer
        if (!ipc?.on) return

        const unsubscribe = ipc.on('menu-action', (action: MenuAction) => {
            if (action === 'captureSnapshot') {
                useStore.getState().captureSnapshot()
                return
            }

            if (action === 'toggleLutBypass') {
                const current = useStore.getState().isLutBypassed
                useStore.getState().setBypassLut(!current)
                return
            }

            if (action === 'toggleMute') {
                toggleMute()
                return
            }

            if (action === 'shuttleReverse' || action === 'shuttleToggle' || action === 'shuttleForward') {
                const code =
                    action === 'shuttleReverse' ? SHORTCUTS.shuttleReverse.keyCode
                        : action === 'shuttleToggle' ? SHORTCUTS.shuttleToggle.keyCode
                            : SHORTCUTS.shuttleForward.keyCode

                window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.replace('Key', '').toLowerCase() }))
                return
            }

            if (action === 'setPlaybackModeRepeatOne') {
                applyPlaybackMode('repeat-one')
                return
            }

            if (action === 'setPlaybackModeSequence') {
                applyPlaybackMode('sequence')
                return
            }

            if (action === 'setPlaybackModeOnce') {
                applyPlaybackMode('once')
            }
        })

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe()
        }
    }, [])

    return (
        <div
            className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group"
            onClick={() => useStore.getState().togglePlay()} // Click to toggle play
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onEnded={() => {
                    const action = getOnEndedAction(playbackMode, currentIndex, playlist.length)
                    if (action === 'repeat') {
                        const video = videoRef.current
                        if (!video) return
                        video.currentTime = 0
                        useStore.getState().setPlaying(true)
                        video.play().catch((e) => console.error('Play failed', e))
                        return
                    }
                    if (action === 'next') {
                        nextVideo()
                        return
                    }
                    useStore.getState().setPlaying(false)
                }}
                playsInline
                muted={false}
                crossOrigin="anonymous"
            />
            <canvas
                key={`${currentVideoIdentity}-${currentVideo?.colorSpace || 'srgb'}`}
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity ${showCanvas ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Playback Overlay */}
            {isLutBypassed && (
                <div className="absolute top-8 right-8 bg-red-500/80 px-4 py-2 rounded-lg text-white text-sm font-bold pointer-events-none backdrop-blur shadow-lg z-50">
                    {t('player.originalNoLut')}
                </div>
            )}

            {snapshotNotice && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-emerald-500/85 px-4 py-2 rounded-lg text-white text-xs font-semibold pointer-events-none backdrop-blur shadow-lg z-50">
                    {snapshotNotice}
                </div>
            )}

            {speedNotice && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-500/85 px-4 py-2 rounded-lg text-white text-xs font-semibold pointer-events-none backdrop-blur shadow-lg z-50">
                    {t('player.speedNotice', { speed: speedNotice })}
                </div>
            )}

            {/* Debug Overlay */}
            {showDebugBars && (
                <div className="absolute bottom-4 right-4 bg-black/50 p-2 text-[10px] text-white font-mono rounded pointer-events-none z-50">
                    <div>{t('player.debugLut')}: {activeLut ? activeLut.split(/[/\\]/).pop() : t('common.none')}</div>
                    <div>{t('player.debugReady')}: {rendererReady ? t('common.yes') : t('common.no')} | {t('player.debugLoaded')}: {lutReadyRef.current ? t('common.yes') : t('common.no')}</div>
                    <div>{t('player.debugBypass')}: {isLutBypassed ? t('common.yes') : t('common.no')} | {t('player.debugIntensity')}: {useStore.getState().lutIntensity.toFixed(2)}</div>
                    <div>{t('player.debugCanvas')}: {showCanvas ? t('common.visible') : t('common.hidden')}</div>
                    <div>{t('player.debugVideo')}: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}</div>
                    {lastLutError && <div className="text-red-400 font-bold">LutErr: {lastLutError}</div>}
                    {glError && <div className="text-red-500 font-bold text-[10px]">GL: {glError}</div>}
                </div>
            )}
        </div>
    )
}
