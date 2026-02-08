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

test('buildSnapshotFilename keeps old format when LUT is not applied', () => {
  const { buildSnapshotFilename } = loadTsModule('src/renderer/src/lib/snapshot-filename.ts')
  const filename = buildSnapshotFilename({
    timestampIso: '2026-02-05T07:31:41.953Z',
    appliedLutPath: null
  })

  assert.equal(filename, 's-260205-073141-953.png')
})

test('buildSnapshotFilename appends LUT name when LUT is applied', () => {
  const { buildSnapshotFilename } = loadTsModule('src/renderer/src/lib/snapshot-filename.ts')
  const filename = buildSnapshotFilename({
    timestampIso: '2026-02-05T07:31:41.953Z',
    appliedLutPath: '/Users/me/LUTs/SLOG3 0504 Yuan .cube'
  })

  assert.equal(filename, 's-260205-073141-953-slog3-0504-yuan.png')
})

test('buildSnapshotFilename truncates overly long LUT labels', () => {
  const { buildSnapshotFilename } = loadTsModule('src/renderer/src/lib/snapshot-filename.ts')
  const filename = buildSnapshotFilename({
    timestampIso: '2026-02-05T07:31:41.953Z',
    appliedLutPath: '/Users/me/LUTs/Super Long Cinematic LUT Name v2 FINAL FINAL.cube'
  })

  assert.equal(filename, 's-260205-073141-953-super-long-cinematic-lut.png')
})
