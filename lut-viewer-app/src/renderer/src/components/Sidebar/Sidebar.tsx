import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { getSnapshotEntriesForVideo, useStore, type UiLanguage } from '../../store/useStore'
import { FolderOpen, Settings, Layers, Download, PanelLeftClose, PanelLeftOpen, Trash2, Camera, SlidersHorizontal, Check, Star, GripVertical, Sun, RotateCcw, Copy, ClipboardPaste } from 'lucide-react'
import clsx from 'clsx'
import { createTranslator } from '../../../../common/i18n'
import { getColorGradeForVideo } from '../../lib/color-grade'
import { isLutFilePath, processFiles } from '../../lib/file-utils'
import { electronApi } from '../../lib/electron-api'
import { buildUniqueGradedOutputPath } from '../../lib/export-utils'
import { hasColorGradeAdjustments, resolveLutPathForExport, shouldSkipVideoExport, type UnknownLutDecision } from '../../lib/export-planner'
import { sortSnapshotEntriesByTime } from '../../lib/snapshot-timeline'
import { isShortcutTypingTarget } from '../../lib/keyboard-target'
import { SHORTCUTS, type MenuAction } from '../../../../common/shortcuts'
import { useAnalysisStore } from '../../store/useAnalysisStore'

type SidebarTab = 'files' | 'snaps' | 'luts' | 'grade'

export const Sidebar: React.FC = () => {
    const {
        playlist, currentIndex, setCurrentIndex, addFiles, activeLut, setLut, lutLibrary, lutStars, addLutToLibrary, removeLutFromLibrary, toggleLutStar, setLutLibraryOrder, lutIntensity, setLutIntensity,
        sidebarWidth, isSidebarOpen, setSidebarWidth, toggleSidebar,
        snapshotDirectory, setSnapshotDirectory,
        colorGrade, videoColorGrades, colorGradeClipboard, setColorGrade, resetColorGrade, copyColorGrade, pasteColorGrade,
        undoColorGrade, redoColorGrade,
        autoClearPlaylistAfterExport, setAutoClearPlaylistAfterExport,
        rememberPlaylist, setRememberPlaylist,
        snapshotLogs, missingVideoPaths, setVideoMissing, clearSnapshotLogsForVideo,
        playbackMode, setPlaybackMode,
        uiLanguage, setUiLanguage,
        exportQualityMode, setExportQualityMode
    } = useStore()
    const [tab, setTab] = useState<SidebarTab>('files')
    const [isExporting, setIsExporting] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isLutDragOver, setIsLutDragOver] = useState(false)
    const [dragLutPath, setDragLutPath] = useState<string | null>(null)
    const [snapshots, setSnapshots] = useState<string[]>([])
    const [snapshotsLoading, setSnapshotsLoading] = useState(false)
    const [smartApplyLutOnExport, setSmartApplyLutOnExport] = useState(true)
    const [selectedExportIds, setSelectedExportIds] = useState<Record<string, boolean>>({})
    const exposureDistribution = useAnalysisStore((s) => s.exposureDistribution)

    const [exportProgress, setExportProgress] = useState<{ current: number, total: number } | null>(null)
    const { removeFile, clearPlaylist } = useStore()
    const selectedExportCount = React.useMemo(
        () => playlist.reduce((count, item) => count + (selectedExportIds[item.id] ? 1 : 0), 0),
        [playlist, selectedExportIds]
    )
    const histogramMaxBin = React.useMemo(
        () => Math.max(1, ...exposureDistribution.histogram),
        [exposureDistribution.histogram]
    )
    const t = React.useMemo(() => createTranslator(uiLanguage), [uiLanguage])

    useEffect(() => {
        void electronApi.setUiLanguage(uiLanguage)
    }, [uiLanguage])

    // Resize Logic
    const startResizing = useCallback(() => {
        setIsResizing(true)
    }, [])

    const stopResizing = useCallback(() => {
        setIsResizing(false)
    }, [])

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth)
            }
        }
    }, [isResizing, setSidebarWidth])

    useEffect(() => {
        window.addEventListener('mousemove', resize)
        window.addEventListener('mouseup', stopResizing)
        return () => {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [resize, stopResizing])


    const handleOpenFiles = async () => {
        const files = await electronApi.openFileDialog()
        if (files && files.length > 0) {
            const playlistItems = await processFiles(files)
            addFiles(playlistItems)
        }
    }

    const handleSetSnapshotFolder = async () => {
        const folder = await electronApi.openFileDialog({ properties: ['openDirectory', 'createDirectory'] })
        if (folder && folder.length > 0) {
            setSnapshotDirectory(folder[0])
        }
    }

    const handleLoadLut = async () => {
        const path = await electronApi.openLutDialog()
        if (path) {
            addLutToLibrary(path)
            setLut(path)
        }
    }

    const getOrderedLuts = useCallback((library: string[], stars: Record<string, boolean>) => {
        const starred = library.filter((path) => stars[path])
        const regular = library.filter((path) => !stars[path])
        return [...starred, ...regular]
    }, [])
    const orderedLutLibrary = React.useMemo(
        () => getOrderedLuts(lutLibrary, lutStars),
        [getOrderedLuts, lutLibrary, lutStars]
    )
    const currentVideo = playlist[currentIndex]
    const currentVideoSnapshotEntries = React.useMemo(() => {
        if (!currentVideo) return []
        return sortSnapshotEntriesByTime(getSnapshotEntriesForVideo(snapshotLogs, currentVideo))
    }, [currentVideo, snapshotLogs])
    const addLutPaths = (paths: string[]) => {
        const validPaths = paths.filter(isLutFilePath)
        if (validPaths.length === 0) {
            alert(t('sidebar.noLutFilesFoundAlert'))
            return
        }

        validPaths.forEach((path) => addLutToLibrary(path))
        setLut(validPaths[validPaths.length - 1])
    }

    const handleLutDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsLutDragOver(false)

        const droppedPaths = Array.from(e.dataTransfer.files)
            .map((file) => (file as any).path as string)
            .filter(Boolean)

        if (droppedPaths.length > 0) {
            addLutPaths(droppedPaths)
            return
        }

        if (!dragLutPath) return
        const starred = lutLibrary.filter((path) => lutStars[path])
        const regular = lutLibrary.filter((path) => !lutStars[path])
        if (lutStars[dragLutPath]) {
            const nextStarred = [...starred.filter((path) => path !== dragLutPath), dragLutPath]
            setLutLibraryOrder([...nextStarred, ...regular])
        } else {
            const nextRegular = [...regular.filter((path) => path !== dragLutPath), dragLutPath]
            setLutLibraryOrder([...starred, ...nextRegular])
        }
        setDragLutPath(null)
    }

    const handleLutDropOnItem = (targetPath: string) => {
        if (!dragLutPath || dragLutPath === targetPath) return

        const starred = lutLibrary.filter((path) => lutStars[path])
        const regular = lutLibrary.filter((path) => !lutStars[path])
        const draggedIsStarred = Boolean(lutStars[dragLutPath])

        if (draggedIsStarred) {
            const nextStarred = starred.filter((path) => path !== dragLutPath)
            const targetIndex = nextStarred.includes(targetPath) ? nextStarred.indexOf(targetPath) : nextStarred.length
            nextStarred.splice(targetIndex, 0, dragLutPath)
            setLutLibraryOrder([...nextStarred, ...regular])
        } else {
            const nextRegular = regular.filter((path) => path !== dragLutPath)
            const targetIndex = nextRegular.includes(targetPath) ? nextRegular.indexOf(targetPath) : 0
            nextRegular.splice(targetIndex, 0, dragLutPath)
            setLutLibraryOrder([...starred, ...nextRegular])
        }

        setDragLutPath(null)
    }

    const loadSnapshots = useCallback(async () => {
        if (!snapshotDirectory) {
            setSnapshots([])
            return
        }

        setSnapshotsLoading(true)
        const result = await electronApi.listSnapshots(snapshotDirectory)
        if (Array.isArray(result)) {
            setSnapshots(result)
        } else {
            setSnapshots([])
            if (result.error) console.error('Failed to list snapshots:', result.error)
        }
        setSnapshotsLoading(false)
    }, [snapshotDirectory])

    useEffect(() => {
        if (tab === 'snaps') void loadSnapshots()
    }, [tab, loadSnapshots])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isShortcutTypingTarget(e.target)) return
            if (!(e.metaKey || e.ctrlKey)) return
            const key = String(e.key ?? '').toLowerCase()

            if (e.code === SHORTCUTS.switchToFilesTab.keyCode) {
                e.preventDefault()
                setTab('files')
                return
            }
            if (e.code === SHORTCUTS.switchToSnapsTab.keyCode) {
                e.preventDefault()
                setTab('snaps')
                return
            }
            if (e.code === SHORTCUTS.switchToLutsTab.keyCode) {
                e.preventDefault()
                setTab('luts')
                return
            }
            if (e.code === SHORTCUTS.switchToGradeTab.keyCode) {
                e.preventDefault()
                setTab('grade')
                return
            }
            const isToggleSidebarShortcut =
                e.code === SHORTCUTS.toggleSidebar.keyCode ||
                e.code === SHORTCUTS.toggleSidebarAlternative.keyCode ||
                key === 'b' ||
                key === 'i'

            if (isToggleSidebarShortcut) {
                e.preventDefault()
                if (!window.electron?.ipcRenderer) {
                    toggleSidebar()
                }
                return
            }
            if (e.code === SHORTCUTS.undoColorGrade.keyCode && !e.shiftKey) {
                e.preventDefault()
                undoColorGrade()
                return
            }
            if (e.code === SHORTCUTS.redoColorGrade.keyCode && e.shiftKey) {
                e.preventDefault()
                redoColorGrade()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [redoColorGrade, toggleSidebar, undoColorGrade])

    useEffect(() => {
        const ipc = window.electron?.ipcRenderer
        if (!ipc?.on) return

        const unsubscribe = ipc.on('menu-action', (action: MenuAction) => {
            if (action === 'switchToFilesTab') {
                setTab('files')
                return
            }
            if (action === 'switchToSnapsTab') {
                setTab('snaps')
                return
            }
            if (action === 'switchToLutsTab') {
                setTab('luts')
                return
            }
            if (action === 'switchToGradeTab') {
                setTab('grade')
                return
            }
            if (action === 'toggleSidebar') {
                toggleSidebar()
                return
            }
            if (action === 'undoColorGrade') {
                undoColorGrade()
                return
            }
            if (action === 'redoColorGrade') {
                redoColorGrade()
            }
        })

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe()
        }
    }, [redoColorGrade, toggleSidebar, undoColorGrade])

    useEffect(() => {
        const onSnapshotSaved = () => {
            if (tab === 'snaps') void loadSnapshots()
        }
        window.addEventListener('snapshot-saved', onSnapshotSaved)
        return () => window.removeEventListener('snapshot-saved', onSnapshotSaved)
    }, [tab, loadSnapshots])

    useEffect(() => {
        setSelectedExportIds((prev) => {
            const next: Record<string, boolean> = {}
            for (const item of playlist) {
                next[item.id] = prev[item.id] ?? true
            }
            return next
        })
    }, [playlist])

    useEffect(() => {
        let cancelled = false
        const validateFiles = async () => {
            for (const item of playlist) {
                const exists = await electronApi.pathExists(item.path)
                if (!cancelled) setVideoMissing(item.path, !exists)
            }
        }
        void validateFiles()
        return () => {
            cancelled = true
        }
    }, [playlist, setVideoMissing])

    const formatTime = (seconds: number) => {
        const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
        const m = Math.floor(safe / 60)
        const s = Math.floor(safe % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
    }
    const formatColorSpaceLabel = (colorSpace: string): string => {
        if (colorSpace === 'rec709') return 'REC.709'
        if (colorSpace === 'rec709-bt2020') return 'REC.709 / BT.2020'
        if (colorSpace === 's-log3') return 'S-LOG3'
        if (colorSpace === 'hlg') return 'HLG'
        if (colorSpace === 'apple-log') return 'APPLE LOG'
        return colorSpace.toUpperCase()
    }
    const handleExport = async () => {
        const exportTargets = playlist.filter((item) => selectedExportIds[item.id])
        if (exportTargets.length === 0) return
        setIsExporting(true)
        setExportProgress({ current: 0, total: exportTargets.length })
        console.log("Starting video export...")

        let exportedCount = 0
        let skippedMissingCount = 0
        let skippedNoProcessingCount = 0
        let failedCount = 0
        const exportedIds: string[] = []

        for (let i = 0; i < exportTargets.length; i++) {
            const item = exportTargets[i]

            const inputExists = await electronApi.pathExists(item.path)
            if (!inputExists) {
                skippedMissingCount += 1
                setVideoMissing(item.path, true)
                setExportProgress({ current: i + 1, total: exportTargets.length })
                continue
            }

            let unknownDecision: UnknownLutDecision = 'skip-lut'
            if (smartApplyLutOnExport && activeLut && item.colorSpace === 'unknown') {
                const shouldApply = window.confirm(
                    t('sidebar.exportUnknownColorSpaceConfirm', { name: item.name })
                )
                unknownDecision = shouldApply ? 'apply-lut' : 'skip-lut'
            }

            const lutPath = resolveLutPathForExport({
                activeLut,
                colorSpace: item.colorSpace,
                smartApplyLut: smartApplyLutOnExport,
                unknownDecision
            })
            const itemColorGrade = getColorGradeForVideo(videoColorGrades, item)
            const itemHasGradeAdjustments = hasColorGradeAdjustments(itemColorGrade)

            if (shouldSkipVideoExport({ lutPath, hasGradeAdjustments: itemHasGradeAdjustments })) {
                skippedNoProcessingCount += 1
                setExportProgress({ current: i + 1, total: exportTargets.length })
                continue
            }

            const outputPath = await buildUniqueGradedOutputPath(item.path, electronApi.pathExists)

            try {
                const result = await electronApi.batchExport({
                    inputPath: item.path,
                    outputPath,
                    lutPath,
                    lutIntensity,
                    colorGrade: itemColorGrade,
                    exportQualityMode
                })
                if (result.status === 'success') {
                    exportedCount += 1
                    exportedIds.push(item.id)
                    console.log(`Exported: ${outputPath}`)
                } else {
                    failedCount += 1
                    console.error(`Failed to export ${item.name}`, result.error)
                }
            } catch (error) {
                failedCount += 1
                console.error(`Failed to export ${item.name}`, error)
            }
            setExportProgress({ current: i + 1, total: exportTargets.length })
        }

        setIsExporting(false)
        setExportProgress(null)

        if (autoClearPlaylistAfterExport && exportedIds.length > 0) {
            if (exportedIds.length === playlist.length) {
                clearPlaylist()
            } else {
                for (const id of exportedIds) removeFile(id)
            }
        }

        const details = [
            t('sidebar.exportDetailExported', { count: exportedCount }),
            skippedMissingCount > 0 ? t('sidebar.exportDetailSkippedMissing', { count: skippedMissingCount }) : null,
            skippedNoProcessingCount > 0 ? t('sidebar.exportDetailSkippedUnchanged', { count: skippedNoProcessingCount }) : null,
            failedCount > 0 ? t('sidebar.exportDetailFailed', { count: failedCount }) : null,
            autoClearPlaylistAfterExport && exportedIds.length > 0 ? t('sidebar.exportDetailRemoved') : null
        ].filter(Boolean).join('\n')
        alert(t('sidebar.exportFinished', { details }))
    }

    if (!isSidebarOpen) {
        return (
            <div className="absolute top-0 left-0 h-full w-12 bg-transparent z-40 flex flex-col pt-10 items-center group">
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-r-lg bg-surface/50 hover:bg-surface text-white/50 hover:text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                    title={t('sidebar.expandSidebar')}
                >
                    <PanelLeftOpen size={20} />
                </button>
            </div>
        )
    }

    return (
        <div
            className="h-full bg-surface/90 backdrop-blur-xl border-r border-white/5 flex flex-col relative group"
            style={{ width: sidebarWidth }}
        >
            {/* Resizer Handle */}
            <div
                className={clsx(
                    "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
                    isResizing && "bg-primary"
                )}
                onMouseDown={startResizing}
            />

            {/* Header / Traffic Lights Spacer */}
            <div className="h-10 w-full drag-region flex items-center justify-between px-3 pt-2">
                <div className="flex-1" /> {/* Spacer for drag */}
                <button
                    onClick={toggleSidebar}
                    className="no-drag p-1 text-white/20 hover:text-white transition-colors"
                    title={t('sidebar.collapseSidebar')}
                >
                    <PanelLeftClose size={16} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 gap-2 box-border mb-4 shrink-0 justify-between items-center min-w-0">
                <div className="flex gap-2 overflow-x-auto mask-linear-fade [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <button
                        onClick={() => setTab('files')}
                        className={clsx("flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap", tab === 'files' ? "text-white border-b-2 border-primary" : "text-gray-400 hover:text-white")}
                        title={t('shortcut.filesTab')}
                    >
                        <Layers size={16} /> {t('sidebar.tabFiles')}
                    </button>
                    <button
                        onClick={() => setTab('snaps')}
                        className={clsx("flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap", tab === 'snaps' ? "text-white border-b-2 border-primary" : "text-gray-400 hover:text-white")}
                        title={t('shortcut.snapsTab')}
                    >
                        <Camera size={16} /> {t('sidebar.tabSnaps')}
                    </button>
                    <button
                        onClick={() => setTab('luts')}
                        className={clsx("flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap", tab === 'luts' ? "text-white border-b-2 border-primary" : "text-gray-400 hover:text-white")}
                        title={t('shortcut.lutsTab')}
                    >
                        <SlidersHorizontal size={16} /> {t('sidebar.tabLut')}
                    </button>
                    <button
                        onClick={() => setTab('grade')}
                        className={clsx("flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap", tab === 'grade' ? "text-white border-b-2 border-primary" : "text-gray-400 hover:text-white")}
                        title={t('shortcut.gradeTab')}
                    >
                        <Sun size={16} /> {t('sidebar.tabGrade')}
                    </button>
                </div>

                {tab === 'files' && playlist.length > 0 && (
                    <button
                        onClick={() => { if (confirm(t('sidebar.clearPlaylistConfirm'))) clearPlaylist() }}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title={t('sidebar.clearPlaylistTitle')}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2 min-h-0">
                {tab === 'files' && (
                    <div className="space-y-1">
                        {playlist.length === 0 && (
                            <div className="text-center text-white/20 text-xs py-10">{t('sidebar.noFilesLoaded')}</div>
                        )}
                        {playlist.length > 0 && (
                            <div className="px-1 py-1 flex items-center justify-between text-[11px] text-white/50">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedExportIds(Object.fromEntries(playlist.map((item) => [item.id, true])))}
                                        className="hover:text-white"
                                    >
                                        {t('sidebar.selectionAll')}
                                    </button>
                                    <button
                                        onClick={() => setSelectedExportIds(Object.fromEntries(playlist.map((item) => [item.id, false])))}
                                        className="hover:text-white"
                                    >
                                        {t('sidebar.selectionNone')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const currentId = playlist[currentIndex]?.id
                                            const next = Object.fromEntries(playlist.map((item) => [item.id, item.id === currentId]))
                                            setSelectedExportIds(next)
                                        }}
                                        className="hover:text-white"
                                    >
                                        {t('sidebar.selectionCurrent')}
                                    </button>
                                </div>
                                <span>{t('sidebar.selectionSummary', { selected: selectedExportCount, total: playlist.length })}</span>
                            </div>
                        )}
                        {playlist.map((item, idx) => (
                            <div
                                key={item.id}
                                onClick={() => setCurrentIndex(idx)}
                                className={clsx(
                                    "p-2 rounded-lg cursor-pointer flex items-center justify-between transition-all group shrink-0 relative pr-8",
                                    currentIndex === idx ? "bg-white/10" : "hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(selectedExportIds[item.id])}
                                        onChange={(e) => {
                                            e.stopPropagation()
                                            setSelectedExportIds((prev) => ({ ...prev, [item.id]: e.target.checked }))
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-0.5 accent-primary"
                                        title={t('sidebar.includeClipInExport')}
                                    />
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="text-sm text-white font-medium truncate select-none">{item.name}</span>
                                    <span className="text-xs text-gray-500 uppercase select-none">
                                        {missingVideoPaths[item.path] ? t('sidebar.missingFile') : formatColorSpaceLabel(item.colorSpace)}
                                    </span>
                                    {(getSnapshotEntriesForVideo(snapshotLogs, item).length || 0) > 0 && (
                                        <span className="text-[10px] text-cyan-300/80 select-none">
                                            {t('sidebar.snapshotsCount', { count: getSnapshotEntriesForVideo(snapshotLogs, item).length })}
                                        </span>
                                    )}
                                </div>
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile(item.id) }}
                                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white transition-all bg-black/50 rounded"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}

                        {currentIndex >= 0 && playlist[currentIndex] && (
                            <div className="mt-3 p-2 rounded-lg bg-black/20 border border-white/10">
                                <div className="flex items-center justify-between mb-2 gap-2">
                                    <div className="text-xs text-gray-400">{t('sidebar.snapshotTimestamps')}</div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                if (!currentVideo) return
                                                if (confirm(t('sidebar.clearSavedTimestampsConfirm'))) {
                                                    clearSnapshotLogsForVideo(currentVideo)
                                                }
                                            }}
                                            className="text-[10px] px-2 h-6 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200"
                                            title={t('sidebar.deleteAllTimestampsTitle')}
                                        >
                                            {t('sidebar.clear')}
                                        </button>
                                    </div>
                                </div>
                                {currentVideoSnapshotEntries.length === 0 && (
                                    <div className="text-[11px] text-white/35">{t('sidebar.noSnapshotsForVideo')}</div>
                                )}
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {currentVideoSnapshotEntries.map((entry) => (
                                        <button
                                            key={`${entry.createdAt}-${entry.timestampSec}`}
                                            onClick={() => {
                                                setCurrentIndex(currentIndex)
                                                useStore.getState().seek(entry.timestampSec)
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault()
                                                if (entry.snapshotPath) void electronApi.showItemInFolder(entry.snapshotPath)
                                            }}
                                            className="w-full text-left rounded px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 truncate"
                                            title={entry.snapshotPath || t('sidebar.timestampEntryTitle')}
                                        >
                                            {formatTime(entry.timestampSec)} · {new Date(entry.createdAt).toLocaleTimeString()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'snaps' && (
                    <div className="space-y-1 p-2">
                        <div className="text-xs text-gray-400 mb-2">
                            {t('sidebar.snapFolderLabel', { folder: snapshotDirectory ? '...' + snapshotDirectory.slice(-20) : t('sidebar.folderNotSet') })}
                        </div>
                        {!snapshotDirectory && (
                            <button
                                onClick={handleSetSnapshotFolder}
                                className="text-xs bg-primary/30 hover:bg-primary/40 text-primary rounded px-2 h-7"
                            >
                                {t('sidebar.setSnapshotFolder')}
                            </button>
                        )}
                        {snapshotDirectory && (
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={() => void loadSnapshots()}
                                    className="text-xs bg-white/10 hover:bg-white/20 rounded px-2 h-7"
                                >
                                    {t('sidebar.refresh')}
                                </button>
                                <button
                                    onClick={() => void electronApi.openPath(snapshotDirectory)}
                                    className="text-xs bg-white/10 hover:bg-white/20 rounded px-2 h-7"
                                >
                                    {t('sidebar.openFolder')}
                                </button>
                            </div>
                        )}
                        {snapshotsLoading && <div className="text-xs text-white/40 py-2">{t('sidebar.loadingSnapshots')}</div>}
                        {!snapshotsLoading && snapshotDirectory && snapshots.length === 0 && (
                            <div className="text-center text-white/20 text-xs py-4">
                                {t('sidebar.noSnapshotsInFolder')}
                            </div>
                        )}
                        {!snapshotsLoading && snapshots.length > 0 && (
                            <div className="space-y-1">
                                {snapshots.map((snapPath) => {
                                    const name = snapPath.split('/').pop() || snapPath
                                    return (
                                        <button
                                            key={snapPath}
                                            onClick={() => void electronApi.openPath(snapPath)}
                                            onContextMenu={(e) => {
                                                e.preventDefault()
                                                void electronApi.showItemInFolder(snapPath)
                                            }}
                                            className="w-full text-left p-2 rounded-lg bg-black/20 hover:bg-white/10 text-xs text-white/90 truncate"
                                            title={snapPath}
                                        >
                                            {name}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
                {tab === 'luts' && (
                    <div
                        className={clsx(
                            "space-y-2 p-2 rounded-lg border border-transparent",
                            isLutDragOver && "border-primary bg-primary/10"
                        )}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsLutDragOver(true)
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsLutDragOver(true)
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsLutDragOver(false)
                        }}
                        onDrop={handleLutDrop}
                    >
                        <div className="flex gap-2">
                            <button
                                onClick={handleLoadLut}
                                className="text-xs bg-white/10 hover:bg-white/20 rounded px-2 h-7 flex items-center gap-1"
                            >
                                <FolderOpen size={12} /> {t('sidebar.addLut')}
                            </button>
                            <button
                                onClick={() => setLut(null)}
                                className={clsx(
                                    "text-xs rounded px-2 h-7 flex items-center gap-1",
                                    activeLut ? "bg-white/10 hover:bg-white/20 text-white" : "bg-primary/30 text-primary"
                                )}
                                >
                                {!activeLut && <Check size={12} />} {t('common.none')}
                            </button>
                        </div>

                        <div className="text-xs text-gray-400">{t('sidebar.libraryHint')}</div>
                        {lutLibrary.length === 0 && (
                            <div className="text-xs text-white/30 py-2">{t('sidebar.noLutAddedYet')}</div>
                        )}
                        <div className="space-y-1">
                            {orderedLutLibrary.map((path) => {
                                const fileName = path.split('/').pop() || path
                                const isActive = activeLut === path
                                const isStarred = Boolean(lutStars[path])
                                return (
                                    <div
                                        key={path}
                                        draggable
                                        onDragStart={() => setDragLutPath(path)}
                                        onDragEnd={() => setDragLutPath(null)}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleLutDropOnItem(path)
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault()
                                            void electronApi.showItemInFolder(path)
                                        }}
                                        className={clsx(
                                            "p-2 rounded-lg border text-xs flex items-center gap-2 cursor-move",
                                            isActive ? "border-primary bg-primary/10" : "border-white/10 bg-black/20"
                                        )}
                                        title={t('sidebar.revealInFinder')}
                                    >
                                        <GripVertical size={12} className="text-white/30 shrink-0" />
                                        <button
                                            onClick={() => setLut(path)}
                                            className="flex-1 text-left truncate"
                                            title={path}
                                        >
                                            {fileName}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleLutStar(path)
                                            }}
                                            className={clsx(
                                                "p-1 rounded transition-colors",
                                                isStarred ? "text-yellow-400 hover:text-yellow-300" : "text-white/50 hover:text-white"
                                            )}
                                            title={isStarred ? t('sidebar.unstarLut') : t('sidebar.starLut')}
                                        >
                                            <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeLutFromLibrary(path)
                                            }}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title={t('sidebar.removeLut')}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
                {tab === 'grade' && (
                    <div className="space-y-4 p-2 overflow-x-auto">
                        <div className="flex justify-between items-center mb-2 min-w-[200px]">
                            <span className="text-xs font-bold text-gray-400 uppercase">{t('sidebar.gradeAdjustment')}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={copyColorGrade}
                                    className="text-xs text-white/60 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded"
                                    title={t('sidebar.copy')}
                                >
                                    <Copy size={10} /> {t('sidebar.copy')}
                                </button>
                                <button
                                    onClick={pasteColorGrade}
                                    disabled={!colorGradeClipboard}
                                    className="text-xs text-white/60 hover:text-white disabled:opacity-40 disabled:hover:text-white/60 flex items-center gap-1 bg-white/5 px-2 py-1 rounded"
                                    title={t('sidebar.paste')}
                                >
                                    <ClipboardPaste size={10} /> {t('sidebar.paste')}
                                </button>
                                <button
                                    onClick={resetColorGrade}
                                    className="text-xs text-white/50 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded"
                                >
                                    <RotateCcw size={10} /> {t('sidebar.reset')}
                                </button>
                            </div>
                        </div>

                        <div className="min-w-[200px] rounded-lg border border-white/10 bg-black/20 p-2 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cyan-200 font-semibold">{t('sidebar.exposureDistribution')}</span>
                                <span className="text-[10px] text-white/40">{exposureDistribution.totalSamples} px</span>
                            </div>
                            <div className="h-24 rounded-md border border-white/10 bg-black/40 p-2">
                                <svg
                                    viewBox={`0 0 ${Math.max(1, exposureDistribution.histogram.length)} 100`}
                                    className="w-full h-full"
                                    preserveAspectRatio="none"
                                >
                                    <defs>
                                        <linearGradient id="exposureGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="rgb(59 130 246)" />
                                            <stop offset="50%" stopColor="rgb(34 197 94)" />
                                            <stop offset="100%" stopColor="rgb(251 191 36)" />
                                        </linearGradient>
                                    </defs>
                                    {exposureDistribution.histogram.map((count, index) => {
                                        const height = (count / histogramMaxBin) * 100
                                        const barHeight = count > 0 ? Math.max(1, height) : 0
                                        return (
                                            <rect
                                                key={`hist-bin-${index}`}
                                                x={index + 0.08}
                                                y={100 - height}
                                                width={0.84}
                                                height={barHeight}
                                                fill="url(#exposureGradient)"
                                                opacity={0.95}
                                            />
                                        )
                                    })}
                                </svg>
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-3 min-w-[200px]">
                            {/* ... existing sliders ... */}
                            <div>
                                <div className="flex justify-between text-xs text-white mb-1">
                                    <span>{t('sidebar.exposure')}</span>
                                    <span className="text-white/50">{colorGrade.exposure.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={-2.0} max={2.0} step={0.05}
                                    value={colorGrade.exposure}
                                    onChange={(e) => setColorGrade({ exposure: parseFloat(e.target.value) })}
                                    className="w-full accent-primary h-1 bg-white/20 rounded appearance-none"
                                />
                            </div>

                            {/* ... (keep other sliders) ... */}
                            <div>
                                <div className="flex justify-between text-xs text-white mb-1">
                                    <span>{t('sidebar.contrast')}</span>
                                    <span className="text-white/50">{colorGrade.contrast.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5} max={1.5} step={0.05}
                                    value={colorGrade.contrast}
                                    onChange={(e) => setColorGrade({ contrast: parseFloat(e.target.value) })}
                                    className="w-full accent-primary h-1 bg-white/20 rounded appearance-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-white mb-1">
                                    <span>{t('sidebar.highlights')}</span>
                                    <span className="text-white/50">{colorGrade.highlights.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={-1.0} max={1.0} step={0.05}
                                    value={colorGrade.highlights}
                                    onChange={(e) => setColorGrade({ highlights: parseFloat(e.target.value) })}
                                    className="w-full accent-primary h-1 bg-white/20 rounded appearance-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-white mb-1">
                                    <span>{t('sidebar.shadows')}</span>
                                    <span className="text-white/50">{colorGrade.shadows.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={-1.0} max={1.0} step={0.05}
                                    value={colorGrade.shadows}
                                    onChange={(e) => setColorGrade({ shadows: parseFloat(e.target.value) })}
                                    className="w-full accent-primary h-1 bg-white/20 rounded appearance-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-white mb-1">
                                    <span>{t('sidebar.saturation')}</span>
                                    <span className="text-white/50">{colorGrade.saturation.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.0} max={2.0} step={0.05}
                                    value={colorGrade.saturation}
                                    onChange={(e) => setColorGrade({ saturation: parseFloat(e.target.value) })}
                                    className="w-full accent-primary h-1 bg-white/20 rounded appearance-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {playlist.length > 0 && (
                <div className="px-4 pt-2 text-[10px] text-white/40 text-center">
                    {t('sidebar.exportTarget', {
                        target: selectedExportCount > 0
                            ? t('sidebar.selectedVideosCount', { count: selectedExportCount, plural: selectedExportCount > 1 ? 's' : '' })
                            : t('sidebar.noneSelected')
                    })}
                </div>
            )}
            <div className="p-4 border-t border-white/5 grid grid-cols-3 gap-2 shrink-0">
                {/* ... existing footer ... */}
                <button onClick={handleOpenFiles} className="btn-primary flex items-center justify-center gap-2" title={t('sidebar.importFiles')}>
                    <FolderOpen size={16} />
                </button>
                <button
                    onClick={handleExport}
                    disabled={isExporting || selectedExportCount === 0}
                    className="btn-secondary bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50 relative overflow-hidden"
                    title={t('sidebar.exportSelectedVideos')}
                >
                    {isExporting ? (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                            {exportProgress && Math.round((exportProgress.current / exportProgress.total) * 100)}%
                        </div>
                    ) : (
                        <>
                            <Download size={16} />
                            <span className="text-[11px]">{t('sidebar.export')}</span>
                        </>
                    )}

                    {/* Progress Fill */}
                    {isExporting && exportProgress && (
                        <div
                            className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300"
                            style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                        />
                    )}
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={clsx("btn-icon flex items-center justify-center", showSettings ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10")}
                    title={t('sidebar.settings')}
                >
                    <Settings size={16} />
                </button>
            </div>

            {/* Settings Modal Overlay */}
            {showSettings && (
                <div className="absolute bottom-16 left-2 right-2 bg-[#202020] border border-white/10 rounded-xl p-3 shadow-2xl z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('sidebar.settings')}</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-white block mb-1">{t('sidebar.settingsSnapshotFolder')}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={snapshotDirectory || ''}
                                    readOnly
                                    className="bg-black/20 border border-white/10 rounded h-7 px-2 text-xs w-full text-white/50"
                                    placeholder={t('sidebar.settingsSnapshotFolderPlaceholder')}
                                />
                                <button onClick={handleSetSnapshotFolder} className="bg-white/10 hover:bg-white/20 rounded w-7 h-7 flex items-center justify-center shrink-0">
                                    <FolderOpen size={12} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs text-white">{t('sidebar.settingsShowDebugBars')}</label>
                            <input
                                type="checkbox"
                                checked={useStore.getState().showDebugBars}
                                onChange={useStore.getState().toggleDebugBars}
                                className="accent-primary"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-white block mb-1">{t('sidebar.settingsPlaybackMode')}</label>
                            <select
                                value={playbackMode}
                                onChange={(e) => setPlaybackMode(e.target.value as typeof playbackMode)}
                                className="w-full bg-black/20 border border-white/10 rounded h-7 px-2 text-xs text-white"
                            >
                                <option value="once">{t('sidebar.settingsPlaybackOnce')}</option>
                                <option value="sequence">{t('sidebar.settingsPlaybackSequence')}</option>
                                <option value="repeat-one">{t('sidebar.settingsPlaybackRepeatOne')}</option>
                            </select>
                            <div className="text-[10px] text-white/40 mt-1">
                                {t('sidebar.settingsPlaybackShortcutHint')}
                            </div>
                            <div className="text-[10px] text-white/40">
                                {t('sidebar.settingsTimelineShortcutHint')}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-white block mb-1">{t('sidebar.settingsLanguage')}</label>
                            <select
                                value={uiLanguage}
                                onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
                                className="w-full bg-black/20 border border-white/10 rounded h-7 px-2 text-xs text-white"
                                aria-label={t('sidebar.settingsLanguage')}
                            >
                                <option value="en">English</option>
                                <option value="zh">中文</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs text-white">{t('sidebar.settingsRememberPlaylist')}</label>
                            <input
                                type="checkbox"
                                checked={rememberPlaylist}
                                onChange={(e) => setRememberPlaylist(e.target.checked)}
                                className="accent-primary"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs text-white">{t('sidebar.settingsAutoClear')}</label>
                            <input
                                type="checkbox"
                                checked={autoClearPlaylistAfterExport}
                                onChange={(e) => setAutoClearPlaylistAfterExport(e.target.checked)}
                                className="accent-primary"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs text-white">{t('sidebar.settingsSmartLut')}</label>
                            <input
                                type="checkbox"
                                checked={smartApplyLutOnExport}
                                onChange={(e) => setSmartApplyLutOnExport(e.target.checked)}
                                className="accent-primary"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-white block mb-1">{t('sidebar.settingsExportQuality') || 'Export Quality Profile'}</label>
                            <select
                                value={exportQualityMode}
                                onChange={(e) => setExportQualityMode(e.target.value as typeof exportQualityMode)}
                                className="w-full bg-black/20 border border-white/10 rounded h-7 px-2 text-xs text-white"
                            >
                                <option value="source-match">{t('sidebar.settingsExportQualitySourceMatch')}</option>
                                <option value="balanced">{t('sidebar.settingsExportQualityBalanced')}</option>
                            </select>
                        </div>

                        <div>
                            <button onClick={() => setSnapshotDirectory(null)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                <Trash2 size={12} /> {t('sidebar.settingsResetFolder')}
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-white block mb-1">{t('sidebar.settingsLutIntensity', { percent: Math.round(lutIntensity * 100) })}</label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={Math.round(lutIntensity * 100)}
                                onChange={(e) => setLutIntensity(Number(e.target.value) / 100)}
                                className="w-full accent-primary"
                            />
                        </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-white/5 text-center">
                        <a
                            href="https://github.com/vecyang1/"
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                                e.preventDefault()
                                void electronApi.openExternal('https://github.com/vecyang1/')
                            }}
                            className="text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
                        >
                            {t('sidebar.designedBy')}
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
