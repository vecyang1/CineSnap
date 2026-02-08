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

test('auto strategy prefers direct video path when no LUT and neutral grading', () => {
  const { shouldUseProcessingPipeline } = loadTsModule('src/renderer/src/lib/playback-strategy.ts')

  const useGpu = shouldUseProcessingPipeline({
    activeLut: null,
    isLutBypassed: false,
    showDebugBars: false,
    colorGrade: {
      exposure: 0,
      contrast: 1,
      saturation: 1,
      highlights: 0,
      shadows: 0
    }
  })

  assert.equal(useGpu, false)
})

test('auto strategy enables GPU pipeline when LUT/grade/debugbars are active', () => {
  const { shouldUseProcessingPipeline } = loadTsModule('src/renderer/src/lib/playback-strategy.ts')

  assert.equal(
    shouldUseProcessingPipeline({
      activeLut: '/tmp/look.cube',
      isLutBypassed: false,
      showDebugBars: false,
      colorGrade: { exposure: 0, contrast: 1, saturation: 1, highlights: 0, shadows: 0 }
    }),
    true
  )

  assert.equal(
    shouldUseProcessingPipeline({
      activeLut: null,
      isLutBypassed: false,
      showDebugBars: true,
      colorGrade: { exposure: 0, contrast: 1, saturation: 1, highlights: 0, shadows: 0 }
    }),
    true
  )

  assert.equal(
    shouldUseProcessingPipeline({
      activeLut: null,
      isLutBypassed: false,
      showDebugBars: false,
      colorGrade: { exposure: 0.1, contrast: 1, saturation: 1, highlights: 0, shadows: 0 }
    }),
    true
  )
})
