import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('media protocol is registered with privileges required for GPU video processing', () => {
  const source = readFileSync(path.join(projectRoot, 'src/main/index.ts'), 'utf8')

  assert.match(source, /scheme:\s*['"]media['"]/)
  assert.match(source, /standard:\s*true/)
  assert.match(source, /corsEnabled:\s*true/)
  assert.match(source, /stream:\s*true/)
  assert.match(source, /supportFetchAPI:\s*true/)
})
