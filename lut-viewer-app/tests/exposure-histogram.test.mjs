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

test('analyzeExposureDistribution computes clipping and zones from pixel data', () => {
  const { analyzeExposureDistribution } = loadTsModule('src/renderer/src/lib/exposure-histogram.ts')

  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255,
    255, 255, 255, 255,
    128, 128, 128, 255
  ])

  const result = analyzeExposureDistribution(pixels, {
    binCount: 8,
    blackClipThreshold: 0.05,
    whiteClipThreshold: 0.95,
    sampleStride: 1
  })

  assert.equal(result.totalSamples, 3)
  assert.equal(result.histogram.length, 8)
  assert.equal(result.zoneRatios.shadows, 1 / 3)
  assert.equal(result.zoneRatios.midtones, 1 / 3)
  assert.equal(result.zoneRatios.highlights, 1 / 3)
  assert.equal(result.clippedBlackRatio, 1 / 3)
  assert.equal(result.clippedWhiteRatio, 1 / 3)
  assert.ok(result.averageLuma > 0.49 && result.averageLuma < 0.51)
})

test('analyzeExposureDistribution respects sample stride and keeps histogram normalized by sample count', () => {
  const { analyzeExposureDistribution } = loadTsModule('src/renderer/src/lib/exposure-histogram.ts')

  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255,
    10, 10, 10, 255,
    245, 245, 245, 255,
    255, 255, 255, 255
  ])

  const result = analyzeExposureDistribution(pixels, {
    binCount: 4,
    sampleStride: 2
  })

  assert.equal(result.totalSamples, 2)
  const histogramTotal = result.histogram.reduce((sum, val) => sum + val, 0)
  assert.equal(histogramTotal, 2)
})

test('analyzeExposureDistribution returns safe defaults for empty input', () => {
  const { analyzeExposureDistribution } = loadTsModule('src/renderer/src/lib/exposure-histogram.ts')

  const result = analyzeExposureDistribution(new Uint8ClampedArray([]))

  assert.equal(result.totalSamples, 0)
  assert.equal(result.averageLuma, 0)
  assert.equal(result.clippedBlackRatio, 0)
  assert.equal(result.clippedWhiteRatio, 0)
  assert.equal(result.zoneRatios.shadows, 0)
  assert.equal(result.zoneRatios.midtones, 0)
  assert.equal(result.zoneRatios.highlights, 0)
  assert.ok(result.histogram.length > 0)
})
