import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  openFileDialog: (options?: any) => ipcRenderer.invoke('dialog-open-file', options),
  openLutDialog: () => ipcRenderer.invoke('dialog-open-lut'),
  batchExport: (params: any) => ipcRenderer.invoke('ffmpeg-run-command', params),
  readMetadata: (filePath: string) => ipcRenderer.invoke('read-metadata', filePath),
  readLutFile: (filePath: string) => ipcRenderer.invoke('read-lut-file', filePath),
  saveSnapshot: (params: { base64Data: string, folderPath: string, filename: string }) => ipcRenderer.invoke('save-snapshot', params),
  captureSnapshot: (params: {
    inputPath: string
    folderPath: string
    filename: string
    timeSec: number
    lutPath: string | null
    lutIntensity: number
    isLutBypassed: boolean
  }) => ipcRenderer.invoke('capture-snapshot', params),
  listSnapshots: (folderPath: string) => ipcRenderer.invoke('list-snapshots', folderPath),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  pathExists: (path: string) => ipcRenderer.invoke('path-exists', path),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  setUiLanguage: (language: 'en' | 'zh') => ipcRenderer.invoke('set-ui-language', language),
  getUiLanguage: () => ipcRenderer.invoke('get-ui-language'),
  on: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args))
  },
  off: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, (_event, ...args) => func(...args))
  }
}

// Minimal electron shim if needed
const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: any, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    once: (channel: string, func: (...args: any[]) => void) => ipcRenderer.once(channel, (_event, ...args) => func(...args)),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
  },
  process: process
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
