import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('store persists export quality mode with source-match default', () => {
  const storeSource = readFileSync(path.join(projectRoot, 'src/renderer/src/store/useStore.ts'), 'utf8')

  assert.match(storeSource, /exportQualityMode:/)
  assert.match(storeSource, /exportQualityMode: 'source-match'/)
  assert.match(storeSource, /setExportQualityMode:/)
  assert.match(storeSource, /setExportQualityMode: \(mode\) => set\(\{ exportQualityMode: mode \}\)/)
  assert.match(storeSource, /partialize: \(state\) => \(\{/)
  assert.match(storeSource, /exportQualityMode: state\.exportQualityMode/)
})

test('settings panel exposes source-match and balanced export options', () => {
  const sidebarSource = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Sidebar/Sidebar.tsx'), 'utf8')

  assert.match(sidebarSource, /Export Quality Profile/)
  assert.match(sidebarSource, /setExportQualityMode/)
  assert.match(sidebarSource, /value="source-match"/)
  assert.match(sidebarSource, /value="balanced"/)
})
