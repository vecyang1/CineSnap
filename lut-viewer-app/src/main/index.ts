import { app, shell, BrowserWindow, ipcMain, dialog, protocol, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import * as fs from 'fs'
import { DEFAULT_UI_LANGUAGE, createTranslator, normalizeUiLanguage, type UiLanguage } from '../common/i18n'
import { SHORTCUTS, type MenuAction } from '../common/shortcuts'
// @ts-ignore
import ffprobeStatic from 'ffprobe-static'

// Set FFMPEG path
if (ffmpegStatic) {
  // Fix for Electron asar path
  ffmpeg.setFfmpegPath(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'))
}

// Set FFPROBE path
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked'))
}

// Register privileged schemes
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const roundFilterNumber = (value: number): string => value.toFixed(4).replace(/\.?0+$/, '')

const LANGUAGE_SETTINGS_FILE = 'ui-language.json'
let currentUiLanguage: UiLanguage = DEFAULT_UI_LANGUAGE
let lastToggleSidebarShortcutAt = 0

const getLanguageSettingsPath = (): string => join(app.getPath('userData'), LANGUAGE_SETTINGS_FILE)

const loadUiLanguage = (): UiLanguage => {
  try {
    const raw = fs.readFileSync(getLanguageSettingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as { uiLanguage?: unknown }
    return normalizeUiLanguage(parsed?.uiLanguage)
  } catch {
    return DEFAULT_UI_LANGUAGE
  }
}

const persistUiLanguage = (language: UiLanguage): void => {
  try {
    fs.writeFileSync(getLanguageSettingsPath(), JSON.stringify({ uiLanguage: language }, null, 2), 'utf8')
  } catch (error) {
    console.warn('Failed to persist UI language:', error)
  }
}

const buildGradeFilter = (colorGrade?: {
  exposure?: number
  contrast?: number
  saturation?: number
  highlights?: number
  shadows?: number
}): string | null => {
  if (!colorGrade) return null

  const exposure = Number(colorGrade.exposure ?? 0)
  const contrast = Number(colorGrade.contrast ?? 1)
  const saturation = Number(colorGrade.saturation ?? 1)
  const highlights = Number(colorGrade.highlights ?? 0)
  const shadows = Number(colorGrade.shadows ?? 0)

  const brightness = clamp(exposure * 0.18 + shadows * 0.08 + highlights * 0.04, -1, 1)
  const contrastEq = clamp(contrast + highlights * 0.15 - shadows * 0.12, 0.5, 2.0)
  const saturationEq = clamp(saturation, 0, 3)
  const gamma = clamp(1 + highlights * 0.25 - shadows * 0.25, 0.6, 1.8)

  const unchanged =
    Math.abs(brightness) < 0.0001 &&
    Math.abs(contrastEq - 1) < 0.0001 &&
    Math.abs(saturationEq - 1) < 0.0001 &&
    Math.abs(gamma - 1) < 0.0001

  if (unchanged) return null

  return `eq=brightness=${roundFilterNumber(brightness)}:contrast=${roundFilterNumber(contrastEq)}:saturation=${roundFilterNumber(saturationEq)}:gamma=${roundFilterNumber(gamma)}`
}

type FfprobeVideoStream = {
  codec_type?: string
  codec_name?: string
  bit_rate?: string | number
  pix_fmt?: string
  color_primaries?: string
  color_transfer?: string
  color_space?: string
}

type FfprobeAudioStream = {
  codec_type?: string
  bit_rate?: string | number
}

type ExportEncodingProfile = {
  preset: 'medium' | 'slow'
  videoCodec: 'libx264' | 'libx265'
  videoBitrateKbps: number | null
  videoCrf: number
  audioBitrateKbps: number
  pixelFormat: string
  colorPrimaries: string | null
  colorTransfer: string | null
  colorSpace: string | null
}

type ExportQualityMode = 'source-match' | 'balanced'

const parseBitrateKbps = (value: unknown): number | null => {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed / 1000)
}

const normalizeColorMetadata = (value: unknown): string | null => {
  const token = String(value ?? '').trim().toLowerCase()
  if (!token || token === 'unknown' || token === 'unspecified' || token === 'reserved') return null
  return token
}

const inferVideoCodec = (stream: FfprobeVideoStream): 'libx264' | 'libx265' => {
  const codecName = String(stream.codec_name ?? '').toLowerCase()
  const pixFmt = String(stream.pix_fmt ?? '').toLowerCase()
  const wants10Bit = pixFmt.includes('10')
  if (codecName.includes('hevc') || codecName.includes('h265') || wants10Bit) return 'libx265'
  return 'libx264'
}

const pickPreferredOutputPixelFormat = (stream: FfprobeVideoStream, videoCodec: 'libx264' | 'libx265'): string => {
  const pixFmt = String(stream.pix_fmt ?? '').toLowerCase()
  if (videoCodec === 'libx265' && pixFmt.includes('10')) return 'yuv420p10le'
  return 'yuv420p'
}

const readMetadataForExport = (inputPath: string): Promise<any | null> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.warn('Export ffprobe failed, using fallback quality profile:', err.message)
        resolve(null)
        return
      }
      resolve(metadata)
    })
  })
}

const buildExportEncodingProfile = ({
  metadata,
  lutApplied,
  exportQualityMode
}: {
  metadata: any | null
  lutApplied: boolean
  exportQualityMode: ExportQualityMode
}): ExportEncodingProfile => {
  const streams = Array.isArray(metadata?.streams) ? metadata.streams : []
  const videoStream = (streams.find((stream: FfprobeVideoStream) => stream?.codec_type === 'video') ?? {}) as FfprobeVideoStream
  const audioStream = (streams.find((stream: FfprobeAudioStream) => stream?.codec_type === 'audio') ?? {}) as FfprobeAudioStream

  const videoCodec = inferVideoCodec(videoStream)
  const sourceVideoBitrateKbps = parseBitrateKbps(videoStream.bit_rate ?? metadata?.format?.bit_rate)
  const sourceAudioBitrateKbps = parseBitrateKbps(audioStream.bit_rate)

  const videoBitrateScale = exportQualityMode === 'balanced' ? 0.72 : 0.95
  const videoBitrateKbps = sourceVideoBitrateKbps
    ? Math.round(clamp(sourceVideoBitrateKbps * videoBitrateScale, 1200, 150000))
    : null

  const defaultAudioBitrate = exportQualityMode === 'balanced' ? 160 : 192
  const audioBitrateKbps = sourceAudioBitrateKbps
    ? Math.round(clamp(sourceAudioBitrateKbps, 96, 512))
    : defaultAudioBitrate

  const colorPrimaries = lutApplied ? 'bt709' : normalizeColorMetadata(videoStream.color_primaries)
  const colorTransfer = lutApplied ? 'bt709' : normalizeColorMetadata(videoStream.color_transfer)
  const colorSpace = lutApplied ? 'bt709' : normalizeColorMetadata(videoStream.color_space)

  return {
    preset: exportQualityMode === 'balanced' ? 'slow' : 'medium',
    videoCodec,
    videoBitrateKbps,
    videoCrf: exportQualityMode === 'balanced' ? (videoCodec === 'libx265' ? 24 : 20) : (videoCodec === 'libx265' ? 20 : 17),
    audioBitrateKbps,
    pixelFormat: pickPreferredOutputPixelFormat(videoStream, videoCodec),
    colorPrimaries,
    colorTransfer,
    colorSpace
  }
}

// Handler for Batch Export
ipcMain.handle('ffmpeg-run-command', async (_, { inputPath, outputPath, lutPath, lutIntensity, colorGrade, exportQualityMode }) => {
  const qualityMode: ExportQualityMode = exportQualityMode === 'balanced' ? 'balanced' : 'source-match'
  const metadata = await readMetadataForExport(inputPath)
  const encodingProfile = buildExportEncodingProfile({
    metadata,
    lutApplied: Boolean(lutPath),
    exportQualityMode: qualityMode
  })

  return new Promise((resolve, reject) => {
    // Basic command: ffmpeg -i input -vf "lut3d=file.cube:interp=tetrahedral" output
    let vf = ''
    const gradeFilter = buildGradeFilter(colorGrade)
    if (lutPath) {
      const safeLutPath = lutPath.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, "\\:")

      if (lutIntensity !== undefined && lutIntensity !== 1.0) {
        // Complex filter mixed
        vf = `[0:v]split=2[orig][to_lut];[to_lut]lut3d='${safeLutPath}':interp=tetrahedral[lutted];[orig][lutted]blend=all_mode=normal:all_opacity=${lutIntensity}`
        if (gradeFilter) vf += `,${gradeFilter}`
      } else {
        vf = `lut3d='${safeLutPath}':interp=tetrahedral`
        if (gradeFilter) vf += `,${gradeFilter}`
      }
    } else if (gradeFilter) {
      vf = gradeFilter
    }

    const cmd = ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec(encodingProfile.videoCodec)
      .audioCodec('aac')
      .audioBitrate(`${encodingProfile.audioBitrateKbps}k`)
      .outputOptions(`-pix_fmt ${encodingProfile.pixelFormat}`)
      .outputOptions(`-preset ${encodingProfile.preset}`)
      .outputOptions('-movflags +faststart')
      .outputOptions('-map_metadata 0')

    if (encodingProfile.videoBitrateKbps) {
      const maxRateKbps = Math.round(encodingProfile.videoBitrateKbps * 1.1)
      const bufferKbps = Math.round(encodingProfile.videoBitrateKbps * 2)
      cmd.videoBitrate(`${encodingProfile.videoBitrateKbps}k`)
      cmd.outputOptions(`-maxrate ${maxRateKbps}k`)
      cmd.outputOptions(`-bufsize ${bufferKbps}k`)
    } else {
      cmd.outputOptions(`-crf ${encodingProfile.videoCrf}`)
    }

    if (encodingProfile.colorPrimaries) cmd.outputOptions(`-color_primaries ${encodingProfile.colorPrimaries}`)
    if (encodingProfile.colorTransfer) cmd.outputOptions(`-color_trc ${encodingProfile.colorTransfer}`)
    if (encodingProfile.colorSpace) cmd.outputOptions(`-colorspace ${encodingProfile.colorSpace}`)

    if (vf) {
      if (lutIntensity !== undefined && lutIntensity !== 1.0) {
        cmd.complexFilter(vf)
      } else {
        cmd.videoFilters(vf)
      }
    }

    cmd.on('start', (commandLine) => {
      console.log('Export FFmpeg command:', commandLine)
    })
    cmd.on('end', () => resolve({ status: 'success' }))
      .on('error', (err) => reject({ status: 'error', error: err.message }))
      .run()
  })
})

ipcMain.handle('read-metadata', async (_, filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err)
      else resolve(metadata)
    })
  })
})

ipcMain.handle('read-lut-file', async (_, filePath: string) => {
  return fs.promises.readFile(filePath, 'utf8')
})

// Handle file dialog
ipcMain.handle('dialog-open-file', async (_, options) => {
  const t = createTranslator(currentUiLanguage)
  const fallbackOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: t('dialog.videos'), extensions: ['mp4', 'mov', 'mkv', 'avi'] }]
  }

  const openDialogOptions = { ...(options || fallbackOptions) }
  if (!openDialogOptions.defaultPath) {
    openDialogOptions.defaultPath = app.getPath('downloads')
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(openDialogOptions)
  if (canceled) return []
  return filePaths
})

ipcMain.handle('dialog-open-lut', async () => {
  const t = createTranslator(currentUiLanguage)
  const { canceled, filePaths } = await dialog.showOpenDialog({
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [{ name: t('dialog.luts'), extensions: ['cube', '3dl'] }]
  })
  if (canceled) return null
  return filePaths[0]
})

ipcMain.handle('save-snapshot', async (_, { base64Data, folderPath, filename }) => {
  try {
    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), 'base64')
    const fullPath = join(folderPath, filename)
    fs.writeFileSync(fullPath, buffer)
    return { success: true, path: fullPath }
  } catch (e: any) {
    console.error('Snapshot save failed:', e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('capture-snapshot', async (_, { inputPath, folderPath, filename, timeSec, lutPath, lutIntensity, isLutBypassed }) => {
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true })
      const fullPath = join(folderPath, filename)
      const shouldApplyLut = Boolean(lutPath) && !isLutBypassed

      const cmd = ffmpeg(inputPath)

      // Use output seeking for accuracy (slower but reliable)
      if (timeSec > 0) {
        cmd.outputOptions('-ss', String(timeSec))
      }

      cmd.output(fullPath)
        .outputOptions('-vframes 1')

      if (/\.(png)$/i.test(fullPath)) {
        cmd.outputOptions('-compression_level 0')
      } else {
        cmd.outputOptions('-q:v 2') // Quality 2 (High)
      }

      if (shouldApplyLut) {
        const safeLutPath = String(lutPath).replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, "\\:")
        console.log("Applying LUT to snapshot:", safeLutPath)
        if (lutIntensity !== undefined && lutIntensity !== 1.0) {
          const vf = `[0:v]split=2[orig][to_lut];[to_lut]lut3d='${safeLutPath}':interp=tetrahedral[lutted];[orig][lutted]blend=all_mode=normal:all_opacity=${lutIntensity}`
          cmd.complexFilter(vf)
        } else {
          cmd.videoFilters(`lut3d='${safeLutPath}':interp=tetrahedral`)
        }
      }

      cmd.on('start', (commandLine) => {
        console.log('Snapshot FFmpeg command:', commandLine)
      })
        .on('end', () => resolve({ success: true, path: fullPath }))
        .on('error', (err) => {
          console.error('Snapshot error:', err)
          resolve({ success: false, error: err.message })
        })
        .run()
    } catch (e: any) {
      resolve({ success: false, error: e.message })
    }
  })
})

ipcMain.handle('list-snapshots', async (_, folderPath: string) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return []
    const files = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(jpe?g|png)$/i.test(name))
      .map((name) => {
        const fullPath = join(folderPath, name)
        const stat = fs.statSync(fullPath)
        return { path: fullPath, mtimeMs: stat.mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map((item) => item.path)

    return files
  } catch (e: any) {
    return { error: e.message }
  }
})

ipcMain.handle('show-item-in-folder', async (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('open-path', async (_, targetPath: string) => {
  try {
    const error = await shell.openPath(targetPath)
    if (error) return { success: false, error }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('path-exists', async (_, targetPath: string) => {
  try {
    return Boolean(targetPath) && fs.existsSync(targetPath)
  } catch {
    return false
  }
})

ipcMain.handle('open-external', async (_, url: string) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('set-ui-language', async (_, language: unknown) => {
  currentUiLanguage = normalizeUiLanguage(language)
  persistUiLanguage(currentUiLanguage)
  createApplicationMenu(currentUiLanguage)
  return currentUiLanguage
})

ipcMain.handle('get-ui-language', async () => currentUiLanguage)

const sendMenuAction = (action: MenuAction) => {
  const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  focusedWindow?.webContents.send('menu-action', action)
}

const shouldHandleToggleSidebarShortcut = (): boolean => {
  const now = Date.now()
  if (now - lastToggleSidebarShortcutAt < 120) return false
  lastToggleSidebarShortcutAt = now
  return true
}

const createApplicationMenu = (language: UiLanguage = currentUiLanguage) => {
  const t = createTranslator(language)
  const playbackMenu: MenuItemConstructorOptions = {
    label: t('menu.playback'),
    submenu: [
      {
        label: t('menu.shuttleReverse'),
        accelerator: SHORTCUTS.shuttleReverse.accelerator,
        click: () => sendMenuAction('shuttleReverse')
      },
      {
        label: t('menu.shuttleToggle'),
        accelerator: SHORTCUTS.shuttleToggle.accelerator,
        click: () => sendMenuAction('shuttleToggle')
      },
      {
        label: t('menu.shuttleForward'),
        accelerator: SHORTCUTS.shuttleForward.accelerator,
        click: () => sendMenuAction('shuttleForward')
      },
      { type: 'separator' },
      {
        label: t('menu.playbackModeRepeatOne'),
        accelerator: SHORTCUTS.playbackModeRepeatOne.accelerator,
        click: () => sendMenuAction('setPlaybackModeRepeatOne')
      },
      {
        label: t('menu.playbackModeSequence'),
        accelerator: SHORTCUTS.playbackModeSequence.accelerator,
        click: () => sendMenuAction('setPlaybackModeSequence')
      },
      {
        label: t('menu.playbackModeOnce'),
        accelerator: SHORTCUTS.playbackModeOnce.accelerator,
        click: () => sendMenuAction('setPlaybackModeOnce')
      },
      { type: 'separator' },
      {
        label: t('menu.toggleLutBypass'),
        accelerator: SHORTCUTS.toggleLutBypass.accelerator,
        click: () => sendMenuAction('toggleLutBypass')
      },
      {
        label: t('menu.toggleMute'),
        accelerator: SHORTCUTS.toggleMute.accelerator,
        click: () => sendMenuAction('toggleMute')
      }
    ]
  }

  const captureMenu: MenuItemConstructorOptions = {
    label: t('menu.capture'),
    submenu: [
      {
        label: t('menu.captureSnapshot'),
        accelerator: SHORTCUTS.captureSnapshot.accelerator,
        click: () => sendMenuAction('captureSnapshot')
      },
      {
        label: t('menu.captureSnapshot'),
        accelerator: SHORTCUTS.captureSnapshotAlternative.accelerator,
        click: () => sendMenuAction('captureSnapshot')
      }
    ]
  }

  const tabsMenu: MenuItemConstructorOptions = {
    label: t('menu.tabs'),
    submenu: [
      {
        label: t('menu.switchToFilesTab'),
        accelerator: SHORTCUTS.switchToFilesTab.accelerator,
        click: () => sendMenuAction('switchToFilesTab')
      },
      {
        label: t('menu.switchToSnapsTab'),
        accelerator: SHORTCUTS.switchToSnapsTab.accelerator,
        click: () => sendMenuAction('switchToSnapsTab')
      },
      {
        label: t('menu.switchToLutsTab'),
        accelerator: SHORTCUTS.switchToLutsTab.accelerator,
        click: () => sendMenuAction('switchToLutsTab')
      },
      {
        label: t('menu.switchToGradeTab'),
        accelerator: SHORTCUTS.switchToGradeTab.accelerator,
        click: () => sendMenuAction('switchToGradeTab')
      },
      { type: 'separator' },
      {
        label: t('menu.toggleSidebar'),
        accelerator: SHORTCUTS.toggleSidebar.accelerator,
        click: () => {
          if (!shouldHandleToggleSidebarShortcut()) return
          sendMenuAction('toggleSidebar')
        }
      },
      {
        label: t('menu.toggleSidebar'),
        accelerator: SHORTCUTS.toggleSidebarAlternative.accelerator,
        click: () => {
          if (!shouldHandleToggleSidebarShortcut()) return
          sendMenuAction('toggleSidebar')
        }
      }
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: t('menu.view'),
    submenu: [
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { role: 'toggleDevTools' }
    ]
  }

  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
      { role: 'appMenu' },
      captureMenu,
      playbackMenu,
      tabsMenu,
      { role: 'editMenu' },
      viewMenu,
      { role: 'windowMenu' }
    ]
    : [
      captureMenu,
      playbackMenu,
      tabsMenu,
      { role: 'editMenu' },
      viewMenu
    ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'CineSnap',
    titleBarStyle: 'hiddenInset', // Mac style
    vibrancy: 'under-window', // Glass effect
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Transparent for vibrancy to work
    autoHideMenuBar: true,
    icon: icon, // Use imported icon
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isModifierPressed = input.meta || input.control
    const isKeyDownEvent = input.type === 'keyDown'
    const inputKey = String(input.key ?? '').toLowerCase()
    const isToggleSidebarShortcut = isModifierPressed && isKeyDownEvent && (
      input.code === SHORTCUTS.toggleSidebar.keyCode ||
      input.code === SHORTCUTS.toggleSidebarAlternative.keyCode ||
      inputKey === 'b' ||
      inputKey === 'i'
    )
    const isUndoGradeShortcut = isModifierPressed && isKeyDownEvent && input.code === SHORTCUTS.undoColorGrade.keyCode && !input.shift
    const isRedoGradeShortcut = isModifierPressed && isKeyDownEvent && input.code === SHORTCUTS.redoColorGrade.keyCode && input.shift

    if (isToggleSidebarShortcut) {
      if (!shouldHandleToggleSidebarShortcut()) return
      event.preventDefault()
      mainWindow.webContents.send('menu-action', 'toggleSidebar')
      return
    }

    if (isUndoGradeShortcut) {
      event.preventDefault()
      mainWindow.webContents.send('menu-action', 'undoColorGrade')
      return
    }

    if (isRedoGradeShortcut) {
      event.preventDefault()
      mainWindow.webContents.send('menu-action', 'redoColorGrade')
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // electronApp.setAppUserModelId('com.electron')
  app.setAppUserModelId('com.vec.cinesnap') // Native replacement
  currentUiLanguage = loadUiLanguage()
  createApplicationMenu(currentUiLanguage)

  // Register Custom Protocol for Local Media
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '')
    try {
      return callback(decodeURIComponent(url))
    } catch (error) {
      console.error(error)
      // Be careful about returning 404
      return callback({ path: '' })
    }
  })

  app.on('browser-window-created', (_, __) => {
    // optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Force dock icon in dev channel
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock.setIcon(join(__dirname, '../../resources/icon.png'))
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
