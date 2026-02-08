import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import * as ts from 'typescript'

const projectRoot = path.resolve(process.cwd())
const requireForTests = createRequire(import.meta.url)

function loadTsModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath)
  const source = readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: filePath
  }).outputText

  const module = { exports: {} }
  const context = {
    module,
    exports: module.exports,
    require: requireForTests,
    console,
    process,
    Buffer
  }

  vm.runInNewContext(transpiled, context, { filename: filePath })
  return module.exports
}

test('snapshot timeline entries sort by video time then created time', () => {
  const { sortSnapshotEntriesByTime } = loadTsModule('src/renderer/src/lib/snapshot-timeline.ts')

  const entries = [
    { timestampSec: 5, createdAt: 1002 },
    { timestampSec: 3, createdAt: 1000 },
    { timestampSec: 5, createdAt: 999 },
    { timestampSec: 0, createdAt: 1001 }
  ]

  const sorted = sortSnapshotEntriesByTime(entries)
  const view = JSON.parse(JSON.stringify(sorted))

  assert.deepEqual(view.map((x) => [x.timestampSec, x.createdAt]), [
    [0, 1001],
    [3, 1000],
    [5, 999],
    [5, 1002]
  ])
})

test('snapshot timeline markers are unique, clamped and sorted', () => {
  const { buildSnapshotMarkers } = loadTsModule('src/renderer/src/lib/snapshot-timeline.ts')

  const markers = buildSnapshotMarkers([
    { timestampSec: -1, createdAt: 1 },
    { timestampSec: 0, createdAt: 2 },
    { timestampSec: 2.004, createdAt: 3 },
    { timestampSec: 2.001, createdAt: 4 },
    { timestampSec: 10, createdAt: 5 }
  ], 5)

  assert.deepEqual(JSON.parse(JSON.stringify(markers)), [0, 2, 5])
})

test('cleanSnapshotEntries removes invalid rows and duplicate timestamps', () => {
  const { cleanSnapshotEntries } = loadTsModule('src/renderer/src/lib/snapshot-timeline.ts')

  const cleaned = cleanSnapshotEntries([
    { timestampSec: 12.234, createdAt: 10, snapshotPath: '/snaps/a.jpg' },
    { timestampSec: 12.235, createdAt: 20, snapshotPath: '/snaps/b.jpg' }, // same centisecond bucket
    { timestampSec: -1, createdAt: 30, snapshotPath: '/snaps/c.jpg' }, // clamped to 0
    { timestampSec: Number.NaN, createdAt: 40, snapshotPath: '/snaps/d.jpg' },
    { timestampSec: 5, createdAt: Number.NaN, snapshotPath: '/snaps/e.jpg' },
    { timestampSec: 2, createdAt: 11, snapshotPath: '' } // no file path
  ])

  assert.deepEqual(JSON.parse(JSON.stringify(cleaned)), [
    { timestampSec: 0, createdAt: 30, snapshotPath: '/snaps/c.jpg' },
    { timestampSec: 12.234, createdAt: 10, snapshotPath: '/snaps/a.jpg' }
  ])
})

test('findSnapshotJumpTarget returns previous and next markers around current time', () => {
  const { findSnapshotJumpTarget } = loadTsModule('src/renderer/src/lib/snapshot-timeline.ts')

  const markers = [1.2, 3.5, 6.1]

  assert.equal(findSnapshotJumpTarget(markers, 3.5, 'previous'), 1.2)
  assert.equal(findSnapshotJumpTarget(markers, 3.5, 'next'), 6.1)
  assert.equal(findSnapshotJumpTarget(markers, 0.2, 'previous'), null)
  assert.equal(findSnapshotJumpTarget(markers, 9.9, 'next'), null)
})

test('findSnapshotJumpTarget ignores tiny offsets inside epsilon window', () => {
  const { findSnapshotJumpTarget } = loadTsModule('src/renderer/src/lib/snapshot-timeline.ts')

  const markers = [10.01, 10.5]
  assert.equal(findSnapshotJumpTarget(markers, 10.0, 'next', 0.02), 10.5)
})
