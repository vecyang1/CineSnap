export { }

declare global {
  interface Window {
    electron: any
    api: {
      openFileDialog: (options?: any) => Promise<string[]>
      openLutDialog: () => Promise<string | null>
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
      }) => Promise<{ status: string, error?: string }>
      readMetadata: (filePath: string) => Promise<any>
      readLutFile: (filePath: string) => Promise<string>
      saveSnapshot: (params: { base64Data: string, folderPath: string, filename: string }) => Promise<{ success: boolean, path?: string, error?: string }>
      captureSnapshot: (params: {
        inputPath: string
        folderPath: string
        filename: string
        timeSec: number
        lutPath: string | null
        lutIntensity: number
        isLutBypassed: boolean
      }) => Promise<{ success: boolean, path?: string, error?: string }>
      listSnapshots: (folderPath: string) => Promise<string[] | { error: string }>
      showItemInFolder: (path: string) => Promise<{ success: boolean, error?: string }>
      openPath: (path: string) => Promise<{ success: boolean, error?: string }>
      pathExists: (path: string) => Promise<boolean>
      openExternal: (url: string) => Promise<{ success: boolean, error?: string }>
      setUiLanguage: (language: 'en' | 'zh') => Promise<{ success: boolean, language: 'en' | 'zh' }>
      getUiLanguage: () => Promise<'en' | 'zh'>
      on: (channel: string, func: (...args: any[]) => void) => void
      off: (channel: string, func: (...args: any[]) => void) => void
    }
  }
}
