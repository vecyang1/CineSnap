import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_UI_LANGUAGE, type UiLanguage } from '../../../common/i18n'
import { resolveActiveLut } from '../lib/lut-selection'
import { cleanSnapshotEntries } from '../lib/snapshot-timeline'
import { DEFAULT_SIDEBAR_TAB_ORDER, normalizeSidebarTabOrder, type SidebarTab } from '../lib/sidebar-tab-order'
import { resolveVideoIdentity, toPathIdentity } from '../lib/video-identity'
import {
    DEFAULT_COLOR_GRADE,
    type ColorGradeState,
    clearColorGradeForVideo,
    cloneColorGrade,
    getColorGradeForVideo,
    mergeColorGradeForVideo,
    replaceColorGradeForVideo
} from '../lib/color-grade'

export interface PlaylistItem {
    id: string
    path: string
    identity?: string
    name: string
    size: number
    colorSpace: 's-log3' | 'apple-log' | 'hlg' | 'rec709' | 'rec709-bt2020' | 'unknown'
    duration?: number
    thumbnail?: string
}

export interface SnapshotLogEntry {
    timestampSec: number
    snapshotPath: string
    createdAt: number
}

type VideoSnapshotTarget = Pick<PlaylistItem, 'path' | 'identity'>

const MAX_SNAPSHOT_LOG_ENTRIES = 100
const MAX_COLOR_GRADE_HISTORY = 100

const normalizePlaylistItem = (item: PlaylistItem): PlaylistItem => ({
    ...item,
    identity: resolveVideoIdentity(item)
})

export const getSnapshotLogAliases = (video: VideoSnapshotTarget): string[] => {
    const aliases = [resolveVideoIdentity(video), video.path, toPathIdentity(video.path)]
    return aliases.filter((alias, index, all) => alias.length > 0 && all.indexOf(alias) === index)
}

const limitSnapshotEntries = (entries: SnapshotLogEntry[]): SnapshotLogEntry[] => {
    return [...entries]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_SNAPSHOT_LOG_ENTRIES)
}

const replaceSnapshotEntriesForVideo = (
    snapshotLogs: Record<string, SnapshotLogEntry[]>,
    video: VideoSnapshotTarget,
    entries: SnapshotLogEntry[]
): Record<string, SnapshotLogEntry[]> => {
    const aliases = getSnapshotLogAliases(video)
    const key = resolveVideoIdentity(video)
    const next = { ...snapshotLogs }
    for (const alias of aliases) {
        delete next[alias]
    }
    if (entries.length > 0) {
        next[key] = entries
    }
    return next
}

export const getSnapshotEntriesForVideo = (
    snapshotLogs: Record<string, SnapshotLogEntry[]>,
    video: VideoSnapshotTarget
): SnapshotLogEntry[] => {
    const aliases = getSnapshotLogAliases(video)
    const merged: SnapshotLogEntry[] = []
    for (const alias of aliases) {
        const entries = snapshotLogs[alias]
        if (Array.isArray(entries)) {
            merged.push(...entries)
        }
    }
    return cleanSnapshotEntries(merged)
}

export type PlaybackMode = 'once' | 'sequence' | 'repeat-one'
export type ExportQualityMode = 'source-match' | 'balanced'
export type { UiLanguage } from '../../../common/i18n'

const getVideoAtIndex = (playlist: PlaylistItem[], index: number): PlaylistItem | null => {
    if (index < 0 || index >= playlist.length) return null
    return playlist[index] ?? null
}

const areColorGradesEqual = (a: ColorGradeState, b: ColorGradeState): boolean =>
    Math.abs(a.exposure - b.exposure) < 1e-6 &&
    Math.abs(a.contrast - b.contrast) < 1e-6 &&
    Math.abs(a.saturation - b.saturation) < 1e-6 &&
    Math.abs(a.highlights - b.highlights) < 1e-6 &&
    Math.abs(a.shadows - b.shadows) < 1e-6

const appendColorGradeHistory = (history: ColorGradeState[], entry: ColorGradeState): ColorGradeState[] => {
    const next = [...history, cloneColorGrade(entry)]
    return next.length > MAX_COLOR_GRADE_HISTORY ? next.slice(next.length - MAX_COLOR_GRADE_HISTORY) : next
}

const assignHistoryEntry = (
    records: Record<string, ColorGradeState[]>,
    key: string,
    entries: ColorGradeState[]
): Record<string, ColorGradeState[]> => {
    const next = { ...records }
    if (entries.length > 0) next[key] = entries
    else delete next[key]
    return next
}

interface AppState {
    playlist: PlaylistItem[]
    currentIndex: number
    activeLut: string | null
    lutLibrary: string[]
    lutStars: Record<string, boolean>
    lutIntensity: number
    colorGrade: ColorGradeState
    videoColorGrades: Record<string, ColorGradeState>
    colorGradeClipboard: ColorGradeState | null
    colorGradeUndoStack: Record<string, ColorGradeState[]>
    colorGradeRedoStack: Record<string, ColorGradeState[]>
    isPlaying: boolean
    isLutBypassed: boolean
    autoDetectLog: boolean
    snapshotTrigger: number // Increment to trigger capture
    currentTime: number
    duration: number

    sidebarWidth: number
    isSidebarOpen: boolean
    snapshotDirectory: string | null
    playbackRate: number
    volume: number
    showDebugBars: boolean
    sidebarTabOrder: SidebarTab[]
    playbackMode: PlaybackMode
    uiLanguage: UiLanguage
    exportQualityMode: ExportQualityMode
    autoClearPlaylistAfterExport: boolean
    rememberPlaylist: boolean
    snapshotLogs: Record<string, SnapshotLogEntry[]>
    missingVideoPaths: Record<string, boolean>

    // Actions
    addFiles: (files: PlaylistItem[]) => void
    setCurrentIndex: (index: number) => void
    setLut: (path: string | null) => void
    addLutToLibrary: (path: string) => void
    removeLutFromLibrary: (path: string) => void
    toggleLutStar: (path: string) => void
    setLutLibraryOrder: (paths: string[]) => void
    setLutIntensity: (val: number) => void
    togglePlay: () => void
    setPlaying: (playing: boolean) => void
    setColorGrade: (grade: Partial<ColorGradeState>) => void
    resetColorGrade: () => void
    copyColorGrade: () => void
    pasteColorGrade: () => void
    undoColorGrade: () => void
    redoColorGrade: () => void
    setBypassLut: (bypass: boolean) => void
    captureSnapshot: () => void
    nextVideo: () => void
    prevVideo: () => void
    setSidebarWidth: (width: number) => void
    toggleSidebar: () => void
    setSnapshotDirectory: (path: string | null) => void
    setPlaybackRate: (rate: number) => void
    setVolume: (volume: number) => void
    toggleDebugBars: () => void
    setSidebarTabOrder: (order: SidebarTab[]) => void
    setPlaybackMode: (mode: PlaybackMode) => void
    setUiLanguage: (language: UiLanguage) => void
    setExportQualityMode: (mode: ExportQualityMode) => void
    setProgress: (currentTime: number, duration: number) => void
    seek: (time: number) => void
    setAutoClearPlaylistAfterExport: (enabled: boolean) => void
    setRememberPlaylist: (enabled: boolean) => void
    addSnapshotLog: (video: VideoSnapshotTarget, entry: SnapshotLogEntry) => void
    cleanSnapshotLogsForVideo: (video: VideoSnapshotTarget) => void
    clearSnapshotLogsForVideo: (video: VideoSnapshotTarget) => void
    cleanAllSnapshotLogs: () => void
    setVideoMissing: (videoPath: string, missing: boolean) => void
    seekTrigger: number
    removeFile: (id: string) => void
    clearPlaylist: () => void
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            playlist: [],
            currentIndex: -1,
            activeLut: null,
            lutLibrary: [],
            lutStars: {},
            lutIntensity: 1.0,
            colorGrade: cloneColorGrade(DEFAULT_COLOR_GRADE),
            videoColorGrades: {},
            colorGradeClipboard: null,
            colorGradeUndoStack: {},
            colorGradeRedoStack: {},
            isPlaying: false,
            isLutBypassed: false,
            autoDetectLog: true,
            snapshotTrigger: 0,
            currentTime: 0,
            duration: 0,
            sidebarWidth: 260,
            isSidebarOpen: true,
            snapshotDirectory: null,
            playbackRate: 1.0,
            sidebarTabOrder: DEFAULT_SIDEBAR_TAB_ORDER,
            playbackMode: 'once',
            uiLanguage: DEFAULT_UI_LANGUAGE,
            exportQualityMode: 'source-match',
            autoClearPlaylistAfterExport: false,
            rememberPlaylist: false,
            snapshotLogs: {},
            missingVideoPaths: {},
            seekTrigger: 0,

            addFiles: (files) => set((state) => {
                const existingPaths = new Set(state.playlist.map(item => item.path))
                const newFiles = files
                    .filter((file) => !existingPaths.has(file.path))
                    .map(normalizePlaylistItem)

                let nextSnapshotLogs = state.snapshotLogs
                for (const item of newFiles) {
                    const merged = limitSnapshotEntries(getSnapshotEntriesForVideo(nextSnapshotLogs, item))
                    nextSnapshotLogs = replaceSnapshotEntriesForVideo(nextSnapshotLogs, item, merged)
                }

                const nextPlaylist = [...state.playlist, ...newFiles]
                const nextCurrentIndex = state.currentIndex === -1 && newFiles.length > 0 ? state.playlist.length : state.currentIndex
                const currentVideo = getVideoAtIndex(nextPlaylist, nextCurrentIndex)
                const nextColorGrade = currentVideo
                    ? getColorGradeForVideo(state.videoColorGrades, currentVideo)
                    : cloneColorGrade(DEFAULT_COLOR_GRADE)

                return {
                    playlist: nextPlaylist,
                    currentIndex: nextCurrentIndex,
                    colorGrade: nextColorGrade,
                    snapshotLogs: nextSnapshotLogs
                }
            }),

            setCurrentIndex: (index) => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, index)
                return {
                    currentIndex: index,
                    currentTime: 0,
                    duration: 0,
                    colorGrade: currentVideo
                        ? getColorGradeForVideo(state.videoColorGrades, currentVideo)
                        : cloneColorGrade(DEFAULT_COLOR_GRADE)
                }
            }),

            setLut: (path) => set({
                activeLut: path,
                isLutBypassed: false
            }),

            addLutToLibrary: (path) => set((state) => {
                if (state.lutLibrary.includes(path)) return {}
                const nextLibrary = [...state.lutLibrary, path]
                return {
                    lutLibrary: nextLibrary,
                    activeLut: resolveActiveLut({
                        activeLut: state.activeLut,
                        lutLibrary: nextLibrary,
                        lutStars: state.lutStars
                    })
                }
            }),

            removeLutFromLibrary: (path) => set((state) => {
                const nextLibrary = state.lutLibrary.filter((p) => p !== path)
                const nextStars = { ...state.lutStars }
                delete nextStars[path]
                return {
                    lutLibrary: nextLibrary,
                    activeLut: resolveActiveLut({
                        activeLut: state.activeLut === path ? null : state.activeLut,
                        lutLibrary: nextLibrary,
                        lutStars: nextStars
                    }),
                    lutStars: nextStars
                }
            }),

            toggleLutStar: (path) => set((state) => ({
                lutStars: {
                    ...state.lutStars,
                    [path]: !state.lutStars[path]
                }
            })),

            setLutLibraryOrder: (paths) => set((state) => {
                const existingSet = new Set(state.lutLibrary)
                const orderedExisting = paths.filter((p) => existingSet.has(p))
                const missing = state.lutLibrary.filter((p) => !orderedExisting.includes(p))
                const nextLibrary = [...orderedExisting, ...missing]
                return {
                    lutLibrary: nextLibrary,
                    activeLut: resolveActiveLut({
                        activeLut: state.activeLut,
                        lutLibrary: nextLibrary,
                        lutStars: state.lutStars
                    })
                }
            }),

            setLutIntensity: (val) => set({ lutIntensity: val }),

            togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

            setPlaying: (playing) => set({ isPlaying: playing }),

            setColorGrade: (grade) => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, state.currentIndex)
                const nextColorGrade = { ...state.colorGrade, ...grade }
                if (areColorGradesEqual(nextColorGrade, state.colorGrade)) return {}
                if (!currentVideo) {
                    return { colorGrade: nextColorGrade }
                }
                const key = resolveVideoIdentity(currentVideo)
                const nextUndo = assignHistoryEntry(
                    state.colorGradeUndoStack,
                    key,
                    appendColorGradeHistory(state.colorGradeUndoStack[key] || [], state.colorGrade)
                )
                const nextRedo = assignHistoryEntry(state.colorGradeRedoStack, key, [])
                return {
                    colorGrade: nextColorGrade,
                    videoColorGrades: mergeColorGradeForVideo(state.videoColorGrades, currentVideo, grade),
                    colorGradeUndoStack: nextUndo,
                    colorGradeRedoStack: nextRedo
                }
            }),
            resetColorGrade: () => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, state.currentIndex)
                if (areColorGradesEqual(state.colorGrade, DEFAULT_COLOR_GRADE)) return {}
                if (!currentVideo) {
                    return { colorGrade: cloneColorGrade(DEFAULT_COLOR_GRADE) }
                }
                const key = resolveVideoIdentity(currentVideo)
                const nextUndo = assignHistoryEntry(
                    state.colorGradeUndoStack,
                    key,
                    appendColorGradeHistory(state.colorGradeUndoStack[key] || [], state.colorGrade)
                )
                const nextRedo = assignHistoryEntry(state.colorGradeRedoStack, key, [])
                return {
                    colorGrade: cloneColorGrade(DEFAULT_COLOR_GRADE),
                    videoColorGrades: clearColorGradeForVideo(state.videoColorGrades, currentVideo),
                    colorGradeUndoStack: nextUndo,
                    colorGradeRedoStack: nextRedo
                }
            }),
            copyColorGrade: () => set((state) => ({
                colorGradeClipboard: cloneColorGrade(state.colorGrade)
            })),
            pasteColorGrade: () => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, state.currentIndex)
                if (!currentVideo || !state.colorGradeClipboard) return {}
                const pasted = cloneColorGrade(state.colorGradeClipboard)
                if (areColorGradesEqual(pasted, state.colorGrade)) return {}
                const key = resolveVideoIdentity(currentVideo)
                const nextUndo = assignHistoryEntry(
                    state.colorGradeUndoStack,
                    key,
                    appendColorGradeHistory(state.colorGradeUndoStack[key] || [], state.colorGrade)
                )
                const nextRedo = assignHistoryEntry(state.colorGradeRedoStack, key, [])
                return {
                    colorGrade: pasted,
                    videoColorGrades: mergeColorGradeForVideo(state.videoColorGrades, currentVideo, pasted),
                    colorGradeUndoStack: nextUndo,
                    colorGradeRedoStack: nextRedo
                }
            }),
            undoColorGrade: () => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, state.currentIndex)
                if (!currentVideo) return {}
                const key = resolveVideoIdentity(currentVideo)
                const undoEntries = state.colorGradeUndoStack[key] || []
                if (undoEntries.length === 0) return {}
                const previousGrade = cloneColorGrade(undoEntries[undoEntries.length - 1])
                const nextUndo = assignHistoryEntry(state.colorGradeUndoStack, key, undoEntries.slice(0, -1))
                const nextRedo = assignHistoryEntry(
                    state.colorGradeRedoStack,
                    key,
                    appendColorGradeHistory(state.colorGradeRedoStack[key] || [], state.colorGrade)
                )
                return {
                    colorGrade: previousGrade,
                    videoColorGrades: replaceColorGradeForVideo(state.videoColorGrades, currentVideo, previousGrade),
                    colorGradeUndoStack: nextUndo,
                    colorGradeRedoStack: nextRedo
                }
            }),
            redoColorGrade: () => set((state) => {
                const currentVideo = getVideoAtIndex(state.playlist, state.currentIndex)
                if (!currentVideo) return {}
                const key = resolveVideoIdentity(currentVideo)
                const redoEntries = state.colorGradeRedoStack[key] || []
                if (redoEntries.length === 0) return {}
                const reappliedGrade = cloneColorGrade(redoEntries[redoEntries.length - 1])
                const nextRedo = assignHistoryEntry(state.colorGradeRedoStack, key, redoEntries.slice(0, -1))
                const nextUndo = assignHistoryEntry(
                    state.colorGradeUndoStack,
                    key,
                    appendColorGradeHistory(state.colorGradeUndoStack[key] || [], state.colorGrade)
                )
                return {
                    colorGrade: reappliedGrade,
                    videoColorGrades: replaceColorGradeForVideo(state.videoColorGrades, currentVideo, reappliedGrade),
                    colorGradeUndoStack: nextUndo,
                    colorGradeRedoStack: nextRedo
                }
            }),
            setBypassLut: (bypass) => set({ isLutBypassed: bypass }),

            captureSnapshot: () => set((state) => ({ snapshotTrigger: state.snapshotTrigger + 1 })),

            nextVideo: () => {
                const { currentIndex, playlist, videoColorGrades } = get()
                if (currentIndex < playlist.length - 1) {
                    const nextIndex = currentIndex + 1
                    const nextVideo = getVideoAtIndex(playlist, nextIndex)
                    set({
                        currentIndex: nextIndex,
                        currentTime: 0,
                        duration: 0,
                        isPlaying: true,
                        colorGrade: nextVideo
                            ? getColorGradeForVideo(videoColorGrades, nextVideo)
                            : cloneColorGrade(DEFAULT_COLOR_GRADE)
                    })
                } else {
                    set({ isPlaying: false })
                }
            },

            prevVideo: () => {
                const { currentIndex, playlist, videoColorGrades } = get()
                if (currentIndex > 0) {
                    const nextIndex = currentIndex - 1
                    const nextVideo = getVideoAtIndex(playlist, nextIndex)
                    set({
                        currentIndex: nextIndex,
                        currentTime: 0,
                        duration: 0,
                        isPlaying: true,
                        colorGrade: nextVideo
                            ? getColorGradeForVideo(videoColorGrades, nextVideo)
                            : cloneColorGrade(DEFAULT_COLOR_GRADE)
                    })
                }
            },

            setSidebarWidth: (width) => set({ sidebarWidth: width }),
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setSnapshotDirectory: (path) => set({ snapshotDirectory: path }),
            setPlaybackRate: (rate) => set({ playbackRate: rate }),
            setProgress: (currentTime, duration) => set({ currentTime, duration }),
            seek: (time) => set((state) => ({ currentTime: time, seekTrigger: state.seekTrigger + 1 })),
            setAutoClearPlaylistAfterExport: (enabled) => set({ autoClearPlaylistAfterExport: enabled }),
            setRememberPlaylist: (enabled) => set({ rememberPlaylist: enabled }),
            addSnapshotLog: (video, entry) => set((state) => {
                const merged = getSnapshotEntriesForVideo(state.snapshotLogs, video)
                const nextEntries = limitSnapshotEntries(cleanSnapshotEntries([...merged, entry]))
                return {
                    snapshotLogs: replaceSnapshotEntriesForVideo(state.snapshotLogs, video, nextEntries)
                }
            }),
            cleanSnapshotLogsForVideo: (video) => set((state) => {
                const cleaned = limitSnapshotEntries(getSnapshotEntriesForVideo(state.snapshotLogs, video))
                return {
                    snapshotLogs: replaceSnapshotEntriesForVideo(state.snapshotLogs, video, cleaned)
                }
            }),
            clearSnapshotLogsForVideo: (video) => set((state) => ({
                snapshotLogs: replaceSnapshotEntriesForVideo(state.snapshotLogs, video, [])
            })),
            cleanAllSnapshotLogs: () => set((state) => {
                let nextSnapshotLogs = { ...state.snapshotLogs }

                const uniqueVideos = new Map<string, VideoSnapshotTarget>()
                for (const item of state.playlist) {
                    uniqueVideos.set(resolveVideoIdentity(item), item)
                }

                for (const video of uniqueVideos.values()) {
                    const cleaned = limitSnapshotEntries(getSnapshotEntriesForVideo(nextSnapshotLogs, video))
                    nextSnapshotLogs = replaceSnapshotEntriesForVideo(nextSnapshotLogs, video, cleaned)
                }

                for (const [key, entries] of Object.entries(nextSnapshotLogs)) {
                    const cleaned = limitSnapshotEntries(cleanSnapshotEntries(entries || []))
                    if (cleaned.length > 0) nextSnapshotLogs[key] = cleaned
                    else delete nextSnapshotLogs[key]
                }

                return { snapshotLogs: nextSnapshotLogs }
            }),
            setVideoMissing: (videoPath, missing) => set((state) => {
                const next = { ...state.missingVideoPaths }
                if (missing) next[videoPath] = true
                else delete next[videoPath]
                return { missingVideoPaths: next }
            }),

            volume: 0.75,
            setVolume: (volume) => set({ volume }),

            showDebugBars: false,
            toggleDebugBars: () => set((state) => ({ showDebugBars: !state.showDebugBars })),
            setSidebarTabOrder: (order) => set({ sidebarTabOrder: normalizeSidebarTabOrder(order) }),
            setPlaybackMode: (mode) => set({ playbackMode: mode }),
            setUiLanguage: (language) => set({ uiLanguage: language }),
            setExportQualityMode: (mode) => set({ exportQualityMode: mode }),

            removeFile: (id) => set((state) => {
                const removed = state.playlist.find((item) => item.id === id)
                const newPlaylist = state.playlist.filter(item => item.id !== id)
                // Adjust currentIndex if necessary
                let newIndex = state.currentIndex
                if (newIndex >= newPlaylist.length) newIndex = newPlaylist.length - 1
                let nextLogs = { ...state.snapshotLogs }
                const nextMissing = { ...state.missingVideoPaths }
                let nextUndoStack = { ...state.colorGradeUndoStack }
                let nextRedoStack = { ...state.colorGradeRedoStack }
                if (removed) {
                    const removedIdentity = resolveVideoIdentity(removed)
                    const hasMatchingVideo = newPlaylist.some((item) => resolveVideoIdentity(item) === removedIdentity)
                    if (hasMatchingVideo) {
                        const merged = limitSnapshotEntries(getSnapshotEntriesForVideo(nextLogs, removed))
                        nextLogs = replaceSnapshotEntriesForVideo(nextLogs, removed, merged)
                    } else {
                        for (const alias of getSnapshotLogAliases(removed)) {
                            delete nextLogs[alias]
                        }
                    }
                    delete nextMissing[removed.path]
                    if (!hasMatchingVideo) {
                        delete nextUndoStack[removedIdentity]
                        delete nextRedoStack[removedIdentity]
                    }
                }
                const currentVideo = getVideoAtIndex(newPlaylist, newIndex)
                return {
                    playlist: newPlaylist,
                    currentIndex: newIndex,
                    colorGrade: currentVideo
                        ? getColorGradeForVideo(state.videoColorGrades, currentVideo)
                        : cloneColorGrade(DEFAULT_COLOR_GRADE),
                    snapshotLogs: nextLogs,
                    missingVideoPaths: nextMissing,
                    colorGradeUndoStack: nextUndoStack,
                    colorGradeRedoStack: nextRedoStack
                }
            }),

            clearPlaylist: () => set({
                playlist: [],
                currentIndex: -1,
                isPlaying: false,
                colorGrade: cloneColorGrade(DEFAULT_COLOR_GRADE),
                snapshotLogs: {},
                missingVideoPaths: {},
                colorGradeUndoStack: {},
                colorGradeRedoStack: {}
            })
        }),
        {
            name: 'cinesnap-storage',
            partialize: (state) => ({
                sidebarWidth: state.sidebarWidth,
                isSidebarOpen: state.isSidebarOpen,
                snapshotDirectory: state.snapshotDirectory,
                activeLut: state.activeLut,
                lutLibrary: state.lutLibrary,
                lutStars: state.lutStars,
                lutIntensity: state.lutIntensity,
                videoColorGrades: state.videoColorGrades,
                colorGradeClipboard: state.colorGradeClipboard,
                playbackRate: state.playbackRate,
                sidebarTabOrder: state.sidebarTabOrder,
                playbackMode: state.playbackMode,
                uiLanguage: state.uiLanguage,
                exportQualityMode: state.exportQualityMode,
                volume: state.volume,
                showDebugBars: state.showDebugBars,
                autoClearPlaylistAfterExport: state.autoClearPlaylistAfterExport,
                rememberPlaylist: state.rememberPlaylist,
                snapshotLogs: state.snapshotLogs,
                ...(state.rememberPlaylist ? { playlist: state.playlist, currentIndex: state.currentIndex } : {})
            }),
            onRehydrateStorage: () => (state) => {
                if (!state) return

                if (!state.exportQualityMode) {
                    useStore.setState({ exportQualityMode: 'source-match' })
                }

                const hydratedPlaylist = state.playlist.map(normalizePlaylistItem)
                const playlistChanged = hydratedPlaylist.some((item, index) => item.identity !== state.playlist[index]?.identity)
                let hydratedSnapshotLogs = { ...state.snapshotLogs }
                for (const item of hydratedPlaylist) {
                    const merged = limitSnapshotEntries(getSnapshotEntriesForVideo(hydratedSnapshotLogs, item))
                    hydratedSnapshotLogs = replaceSnapshotEntriesForVideo(hydratedSnapshotLogs, item, merged)
                }

                const originalKeys = Object.keys(state.snapshotLogs).sort()
                const hydratedKeys = Object.keys(hydratedSnapshotLogs).sort()
                const snapshotLogsChanged =
                    originalKeys.length !== hydratedKeys.length ||
                    originalKeys.some((key, index) => key !== hydratedKeys[index]) ||
                    hydratedKeys.some((key) => {
                        const current = state.snapshotLogs[key] || []
                        const next = hydratedSnapshotLogs[key] || []
                        if (current.length !== next.length) return true
                        return current.some((entry, index) => {
                            const nextEntry = next[index]
                            return (
                                !nextEntry ||
                                entry.timestampSec !== nextEntry.timestampSec ||
                                entry.createdAt !== nextEntry.createdAt ||
                                entry.snapshotPath !== nextEntry.snapshotPath
                            )
                        })
                    })

                const rehydratedCurrentVideo = getVideoAtIndex(hydratedPlaylist, state.currentIndex)
                const rehydratedColorGrade = rehydratedCurrentVideo
                    ? getColorGradeForVideo(state.videoColorGrades || {}, rehydratedCurrentVideo)
                    : cloneColorGrade(DEFAULT_COLOR_GRADE)

                const colorGradeChanged =
                    Math.abs((state.colorGrade?.exposure ?? 0) - rehydratedColorGrade.exposure) > 1e-6 ||
                    Math.abs((state.colorGrade?.contrast ?? 1) - rehydratedColorGrade.contrast) > 1e-6 ||
                    Math.abs((state.colorGrade?.saturation ?? 1) - rehydratedColorGrade.saturation) > 1e-6 ||
                    Math.abs((state.colorGrade?.highlights ?? 0) - rehydratedColorGrade.highlights) > 1e-6 ||
                    Math.abs((state.colorGrade?.shadows ?? 0) - rehydratedColorGrade.shadows) > 1e-6

                if (playlistChanged || snapshotLogsChanged || colorGradeChanged) {
                    useStore.setState({
                        playlist: hydratedPlaylist,
                        snapshotLogs: hydratedSnapshotLogs,
                        colorGrade: rehydratedColorGrade
                    })
                }

                const resolved = resolveActiveLut({
                    activeLut: state.activeLut,
                    lutLibrary: state.lutLibrary,
                    lutStars: state.lutStars
                })
                if (resolved !== state.activeLut) {
                    state.setLut(resolved)
                }

                const normalizedTabOrder = normalizeSidebarTabOrder(state.sidebarTabOrder)
                if (normalizedTabOrder.some((tab, index) => tab !== state.sidebarTabOrder[index])) {
                    useStore.setState({ sidebarTabOrder: normalizedTabOrder })
                }
            }
        }
    )
)
