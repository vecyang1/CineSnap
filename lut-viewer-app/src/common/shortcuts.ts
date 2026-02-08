export const SHORTCUTS = {
  shuttleReverse: {
    keyCode: 'KeyA',
    accelerator: 'A',
    title: 'Rewind (A)'
  },
  shuttleToggle: {
    keyCode: 'KeyS',
    accelerator: 'S',
    title: 'Play/Pause (S)'
  },
  shuttleForward: {
    keyCode: 'KeyD',
    accelerator: 'D',
    title: 'Forward (D)'
  },
  playbackModeRepeatOne: {
    keyCode: 'KeyR',
    accelerator: 'CommandOrControl+R',
    title: 'Repeat One (Cmd/Ctrl+R)'
  },
  playbackModeSequence: {
    keyCode: 'KeyO',
    accelerator: 'CommandOrControl+O',
    title: 'Play in Order (Cmd/Ctrl+O)'
  },
  playbackModeOnce: {
    keyCode: 'KeyE',
    accelerator: 'CommandOrControl+E',
    title: 'Play Once & Stop (Cmd/Ctrl+E)'
  },
  toggleLutBypass: {
    keyCode: 'KeyF',
    accelerator: 'F',
    title: 'Enable/Disable LUT (F)'
  },
  toggleMute: {
    keyCode: 'KeyM',
    accelerator: 'CommandOrControl+Shift+M',
    title: 'Mute/Unmute (Cmd/Ctrl+Shift+M)'
  },
  captureSnapshot: {
    keyCode: 'KeyP',
    accelerator: 'P',
    title: 'Capture Snapshot (P)'
  },
  captureSnapshotAlternative: {
    keyCode: 'KeyS',
    accelerator: 'CommandOrControl+S',
    title: 'Capture Snapshot (Cmd/Ctrl+S)'
  },
  switchToFilesTab: {
    keyCode: 'Digit1',
    accelerator: 'CommandOrControl+1',
    title: 'Files Tab (Cmd/Ctrl+1)'
  },
  switchToSnapsTab: {
    keyCode: 'Digit2',
    accelerator: 'CommandOrControl+2',
    title: 'Snaps Tab (Cmd/Ctrl+2)'
  },
  switchToLutsTab: {
    keyCode: 'Digit3',
    accelerator: 'CommandOrControl+3',
    title: 'LUT Tab (Cmd/Ctrl+3)'
  },
  switchToGradeTab: {
    keyCode: 'Digit4',
    accelerator: 'CommandOrControl+4',
    title: 'Grade Tab (Cmd/Ctrl+4)'
  },
  toggleSidebar: {
    keyCode: 'KeyB',
    accelerator: 'CommandOrControl+B',
    title: 'Toggle Sidebar (Cmd/Ctrl+B)'
  },
  toggleSidebarAlternative: {
    keyCode: 'KeyI',
    accelerator: 'CommandOrControl+I',
    title: 'Toggle Sidebar (Cmd/Ctrl+I)'
  },
  undoColorGrade: {
    keyCode: 'KeyZ',
    accelerator: 'CommandOrControl+Z',
    title: 'Undo Grade (Cmd/Ctrl+Z)'
  },
  redoColorGrade: {
    keyCode: 'KeyZ',
    accelerator: 'CommandOrControl+Shift+Z',
    title: 'Redo Grade (Cmd/Ctrl+Shift+Z)'
  }
} as const

export type MenuAction =
  | 'captureSnapshot'
  | 'shuttleReverse'
  | 'shuttleToggle'
  | 'shuttleForward'
  | 'setPlaybackModeRepeatOne'
  | 'setPlaybackModeSequence'
  | 'setPlaybackModeOnce'
  | 'toggleLutBypass'
  | 'toggleMute'
  | 'switchToFilesTab'
  | 'switchToSnapsTab'
  | 'switchToLutsTab'
  | 'switchToGradeTab'
  | 'toggleSidebar'
  | 'undoColorGrade'
  | 'redoColorGrade'
