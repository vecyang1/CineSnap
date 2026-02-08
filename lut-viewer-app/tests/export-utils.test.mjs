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

test('buildUniqueGradedOutputPath uses _graded suffix by default', async () => {
  const { buildUniqueGradedOutputPath } = loadTsModule('src/renderer/src/lib/export-utils.ts')
  const result = await buildUniqueGradedOutputPath('/tmp/clip01.mp4', async () => false)
  assert.equal(result, '/tmp/clip01_graded.mp4')
})

test('buildUniqueGradedOutputPath increments suffix when duplicates exist', async () => {
  const { buildUniqueGradedOutputPath } = loadTsModule('src/renderer/src/lib/export-utils.ts')
  const existing = new Set([
    '/tmp/clip01_graded.mp4',
    '/tmp/clip01_graded_2.mp4'
  ])
  const result = await buildUniqueGradedOutputPath('/tmp/clip01.mp4', async (candidate) => existing.has(candidate))
  assert.equal(result, '/tmp/clip01_graded_3.mp4')
})
