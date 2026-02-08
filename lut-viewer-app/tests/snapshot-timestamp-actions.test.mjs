import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('snapshot timestamps card exposes only clear action', () => {
  const sidebarSource = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Sidebar/Sidebar.tsx'), 'utf8')

  assert.match(sidebarSource, /t\('sidebar\.snapshotTimestamps'\)/)
  assert.match(sidebarSource, /clearSnapshotLogsForVideo/)
  assert.match(sidebarSource, /t\('sidebar\.clear'\)/)
  assert.doesNotMatch(sidebarSource, /cleanSnapshotLogsForVideo/)
  assert.doesNotMatch(sidebarSource, /cleanAllSnapshotLogs/)
  assert.doesNotMatch(sidebarSource, />\s*Clean\s*</)
  assert.doesNotMatch(sidebarSource, />\s*Clean All\s*</)
})
