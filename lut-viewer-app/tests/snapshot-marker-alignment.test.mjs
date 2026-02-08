import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('timeline hides nearby snapshot marker so jump target and thumb share the same center', () => {
  const controlsSource = readFileSync(
    path.join(projectRoot, 'src/renderer/src/components/Player/Controls.tsx'),
    'utf8'
  )

  assert.match(controlsSource, /const markerEpsilon = 0\.12/)
  assert.match(controlsSource, /Math\.abs\(time - localTime\) <= markerEpsilon/)
})
