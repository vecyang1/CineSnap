import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('grade tab keeps histogram and removes detailed exposure stats and threshold controls', () => {
  const sidebarSource = readFileSync(
    path.join(projectRoot, 'src/renderer/src/components/Sidebar/Sidebar.tsx'),
    'utf8'
  )

  assert.match(sidebarSource, /t\('sidebar\.exposureDistribution'\)/)
  assert.match(sidebarSource, /exposureDistribution\.histogram\.map/)

  assert.doesNotMatch(sidebarSource, /t\('sidebar\.averageLuma'\)/)
  assert.doesNotMatch(sidebarSource, /t\('sidebar\.blackClip'\)/)
  assert.doesNotMatch(sidebarSource, /t\('sidebar\.whiteClip'\)/)
  assert.doesNotMatch(sidebarSource, /t\('sidebar\.zoneRatios'\)/)
  assert.doesNotMatch(sidebarSource, /P10 - P90/)
  assert.doesNotMatch(sidebarSource, /t\('sidebar\.clipWarningThresholds'\)/)
})
