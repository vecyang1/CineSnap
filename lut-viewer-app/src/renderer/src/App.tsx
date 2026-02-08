import { Sidebar } from './components/Sidebar/Sidebar'
import { VideoPlayer } from './components/Player/VideoPlayer'
import { Controls } from './components/Player/Controls'
import { useStore } from './store/useStore'
import { processFiles, resolveDroppedPlaybackIndex, splitDroppedPaths } from './lib/file-utils'
import { DragEvent } from 'react'

function App(): React.ReactElement {
  const addFiles = useStore((s) => s.addFiles)
  const addLutToLibrary = useStore((s) => s.addLutToLibrary)
  const setLut = useStore((s) => s.setLut)
  const setCurrentIndex = useStore((s) => s.setCurrentIndex)
  const setPlaying = useStore((s) => s.setPlaying)

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files).map(f => (f as any).path).filter(Boolean) // Electron File object has 'path'
    if (files.length > 0) {
      const { videoPaths, lutPaths } = splitDroppedPaths(files)

      if (lutPaths.length > 0) {
        lutPaths.forEach((path) => addLutToLibrary(path))
        setLut(lutPaths[lutPaths.length - 1])
      }

      if (videoPaths.length > 0) {
        const playlistItems = await processFiles(videoPaths)
        if (playlistItems.length > 0) {
          addFiles(playlistItems)
          const nextPlaylist = useStore.getState().playlist
          const targetIndex = resolveDroppedPlaybackIndex(nextPlaylist, playlistItems.map((item) => item.path))
          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex)
            setPlaying(true)
          }
        }
      }
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className="flex w-screen h-screen bg-background text-white font-sans selection:bg-primary/30"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Sidebar />
      <div
        className="flex-1 h-full relative flex flex-col transition-all duration-300 ease-out"
      // Style will be handled by flex-1, but we might want smoother expansion if needed.
      // For now, flex-1 automatically fills remaining space after Sidebar's fixed (but changing) width.
      >
        <div className="h-8 w-full drag-region absolute top-0 left-0 z-50"></div>
        <VideoPlayer />
        <Controls />
      </div>
    </div>
  )
}


export default App
