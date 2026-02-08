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

test('reverse shuttle step increases with speed', () => {
  const { calculateReverseStepSeconds } = loadTsModule('src/renderer/src/lib/reverse-shuttle.ts')

  const oneX = calculateReverseStepSeconds(1, 16, 0)
  const twoX = calculateReverseStepSeconds(2, 16, 0)

  assert.ok(twoX > oneX)
})

test('reverse shuttle uses a minimum step to avoid visual sticking', () => {
  const { calculateReverseStepSeconds } = loadTsModule('src/renderer/src/lib/reverse-shuttle.ts')

  const step = calculateReverseStepSeconds(1, 1, 0)

  assert.ok(step >= 0.03)
})

test('reverse shuttle pending seek debt is capped', () => {
  const { accumulateReversePendingSeconds } = loadTsModule('src/renderer/src/lib/reverse-shuttle.ts')

  let pending = 0
  for (let i = 0; i < 20; i += 1) {
    pending = accumulateReversePendingSeconds(pending, 2, 33)
  }

  assert.ok(pending <= 0.45)
})
