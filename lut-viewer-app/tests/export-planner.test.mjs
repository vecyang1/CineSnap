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

test('resolveLutPathForExport skips LUT for Rec709 in smart mode', () => {
  const { resolveLutPathForExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  const lutPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 'rec709',
    smartApplyLut: true,
    unknownDecision: 'apply-lut'
  })
  assert.equal(lutPath, null)
})

test('resolveLutPathForExport skips LUT for Rec709 gamma in BT.2020', () => {
  const { resolveLutPathForExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  const lutPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 'rec709-bt2020',
    smartApplyLut: true,
    unknownDecision: 'apply-lut'
  })
  assert.equal(lutPath, null)
})

test('resolveLutPathForExport applies LUT for log clips in smart mode', () => {
  const { resolveLutPathForExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  const lutPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 's-log3',
    smartApplyLut: true,
    unknownDecision: 'skip-lut'
  })
  assert.equal(lutPath, '/tmp/look.cube')
})

test('resolveLutPathForExport applies LUT for HLG clips in smart mode', () => {
  const { resolveLutPathForExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  const lutPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 'hlg',
    smartApplyLut: true,
    unknownDecision: 'skip-lut'
  })
  assert.equal(lutPath, '/tmp/look.cube')
})

test('resolveLutPathForExport honors unknown decision', () => {
  const { resolveLutPathForExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  const applyPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 'unknown',
    smartApplyLut: true,
    unknownDecision: 'apply-lut'
  })
  const skipPath = resolveLutPathForExport({
    activeLut: '/tmp/look.cube',
    colorSpace: 'unknown',
    smartApplyLut: true,
    unknownDecision: 'skip-lut'
  })
  assert.equal(applyPath, '/tmp/look.cube')
  assert.equal(skipPath, null)
})

test('hasColorGradeAdjustments detects non-default grade changes', () => {
  const { DEFAULT_COLOR_GRADE, hasColorGradeAdjustments } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  assert.equal(hasColorGradeAdjustments(DEFAULT_COLOR_GRADE), false)
  assert.equal(hasColorGradeAdjustments({ ...DEFAULT_COLOR_GRADE, saturation: 1.2 }), true)
})

test('shouldSkipVideoExport skips when no LUT and no grade changes', () => {
  const { shouldSkipVideoExport } = loadTsModule('src/renderer/src/lib/export-planner.ts')
  assert.equal(shouldSkipVideoExport({ lutPath: null, hasGradeAdjustments: false }), true)
  assert.equal(shouldSkipVideoExport({ lutPath: '/tmp/look.cube', hasGradeAdjustments: false }), false)
  assert.equal(shouldSkipVideoExport({ lutPath: null, hasGradeAdjustments: true }), false)
})
