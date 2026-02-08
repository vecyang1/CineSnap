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

test('once mode always stops on ended event', () => {
  const { getOnEndedAction } = loadTsModule('src/renderer/src/lib/playback-mode.ts')
  assert.equal(getOnEndedAction('once', 0, 3), 'stop')
  assert.equal(getOnEndedAction('once', 2, 3), 'stop')
})

test('sequence mode advances until last video then stops', () => {
  const { getOnEndedAction } = loadTsModule('src/renderer/src/lib/playback-mode.ts')
  assert.equal(getOnEndedAction('sequence', 0, 3), 'next')
  assert.equal(getOnEndedAction('sequence', 1, 3), 'next')
  assert.equal(getOnEndedAction('sequence', 2, 3), 'stop')
})

test('repeat-one mode repeats current video', () => {
  const { getOnEndedAction } = loadTsModule('src/renderer/src/lib/playback-mode.ts')
  assert.equal(getOnEndedAction('repeat-one', 1, 3), 'repeat')
})
