type CaptureSnapshotParams = {
  inputPath: string
  folderPath: string
  filename: string
  timeSec: number
  lutPath: string | null
  lutIntensity: number
  isLutBypassed: boolean
}

const invokeFallback = (channel: string, ...args: any[]) => {
  const ipcInvoke = window.electron?.ipcRenderer?.invoke
  if (typeof ipcInvoke !== 'function') {
    throw new Error('Electron IPC bridge unavailable. Please restart the app.')
  }
  return ipcInvoke(channel, ...args)
}

export const electronApi = {
  openFileDialog: (options?: any): Promise<string[]> =>
    window.api?.openFileDialog ? window.api.openFileDialog(options) : invokeFallback('dialog-open-file', options),

  openLutDialog: (): Promise<string | null> =>
    window.api?.openLutDialog ? window.api.openLutDialog() : invokeFallback('dialog-open-lut'),

  readMetadata: (filePath: string): Promise<any> =>
    window.api?.readMetadata ? window.api.readMetadata(filePath) : invokeFallback('read-metadata', filePath),

  readLutFile: (filePath: string): Promise<string> =>
    window.api?.readLutFile ? window.api.readLutFile(filePath) : invokeFallback('read-lut-file', filePath),

  saveSnapshot: (params: { base64Data: string; folderPath: string; filename: string }): Promise<{ success: boolean; path?: string; error?: string }> =>
    window.api?.saveSnapshot ? window.api.saveSnapshot(params) : invokeFallback('save-snapshot', params),

  batchExport: (params: {
    inputPath: string
    outputPath: string
    lutPath: string | null
    lutIntensity: number
    exportQualityMode?: 'source-match' | 'balanced'
    colorGrade?: {
      exposure: number
      contrast: number
      saturation: number
      highlights: number
      shadows: number
    }
  }): Promise<{ status: string; error?: string }> =>
    window.api?.batchExport ? window.api.batchExport(params) : invokeFallback('ffmpeg-run-command', params),

  captureSnapshot: (params: CaptureSnapshotParams): Promise<{ success: boolean; path?: string; error?: string }> =>
    window.api?.captureSnapshot ? window.api.captureSnapshot(params) : invokeFallback('capture-snapshot', params),

  listSnapshots: (folderPath: string): Promise<string[] | { error: string }> =>
    window.api?.listSnapshots ? window.api.listSnapshots(folderPath) : invokeFallback('list-snapshots', folderPath),

  showItemInFolder: (path: string): Promise<{ success: boolean; error?: string }> =>
    window.api?.showItemInFolder ? window.api.showItemInFolder(path) : invokeFallback('show-item-in-folder', path),

  openPath: (path: string): Promise<{ success: boolean; error?: string }> =>
    window.api?.openPath ? window.api.openPath(path) : invokeFallback('open-path', path),

  pathExists: (path: string): Promise<boolean> =>
    window.api?.pathExists ? window.api.pathExists(path) : invokeFallback('path-exists', path),

  openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
    window.api?.openExternal ? window.api.openExternal(url) : invokeFallback('open-external', url),

  setUiLanguage: (language: 'en' | 'zh'): Promise<{ success: boolean; language: 'en' | 'zh' }> =>
    window.api?.setUiLanguage ? window.api.setUiLanguage(language) : invokeFallback('set-ui-language', language),

  getUiLanguage: (): Promise<'en' | 'zh'> =>
    window.api?.getUiLanguage ? window.api.getUiLanguage() : invokeFallback('get-ui-language')
}
