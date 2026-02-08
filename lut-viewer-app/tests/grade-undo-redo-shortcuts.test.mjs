import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('grade undo/redo shortcuts are defined and wired', () => {
  const shortcutsSource = readFileSync(path.join(projectRoot, 'src/common/shortcuts.ts'), 'utf8')
  const storeSource = readFileSync(path.join(projectRoot, 'src/renderer/src/store/useStore.ts'), 'utf8')
  const sidebarSource = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Sidebar/Sidebar.tsx'), 'utf8')
  const mainSource = readFileSync(path.join(projectRoot, 'src/main/index.ts'), 'utf8')

  assert.match(shortcutsSource, /undoColorGrade:\s*\{/)
  assert.match(shortcutsSource, /undoColorGrade[\s\S]*keyCode:\s*['"]KeyZ['"]/)
  assert.match(shortcutsSource, /undoColorGrade[\s\S]*accelerator:\s*['"]CommandOrControl\+Z['"]/)
  assert.match(shortcutsSource, /redoColorGrade:\s*\{/)
  assert.match(shortcutsSource, /redoColorGrade[\s\S]*keyCode:\s*['"]KeyZ['"]/)
  assert.match(shortcutsSource, /redoColorGrade[\s\S]*accelerator:\s*['"]CommandOrControl\+Shift\+Z['"]/)

  assert.match(storeSource, /undoColorGrade:\s*\(\)\s*=>\s*void/)
  assert.match(storeSource, /redoColorGrade:\s*\(\)\s*=>\s*void/)
  assert.match(storeSource, /colorGradeUndoStack:/)
  assert.match(storeSource, /colorGradeRedoStack:/)

  assert.match(sidebarSource, /SHORTCUTS\.undoColorGrade\.keyCode/)
  assert.match(sidebarSource, /SHORTCUTS\.redoColorGrade\.keyCode/)
  assert.match(sidebarSource, /action === 'undoColorGrade'/)
  assert.match(sidebarSource, /action === 'redoColorGrade'/)

  assert.match(mainSource, /send\('menu-action', 'undoColorGrade'\)/)
  assert.match(mainSource, /send\('menu-action', 'redoColorGrade'\)/)
})
