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
  const requireForModule = createRequire(filePath)
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
    require: requireForModule,
    console,
    process,
    Buffer
  }

  vm.runInNewContext(transpiled, context, { filename: filePath })
  return module.exports
}

test('getColorGradeForVideo returns default grade when missing', () => {
  const { getColorGradeForVideo, DEFAULT_COLOR_GRADE } = loadTsModule('src/renderer/src/lib/color-grade.ts')
  const grade = getColorGradeForVideo({}, { path: '/tmp/a.mp4' })
  assert.deepEqual(grade, DEFAULT_COLOR_GRADE)
})

test('mergeColorGradeForVideo stores independent grades per video', () => {
  const { mergeColorGradeForVideo, getColorGradeForVideo } = loadTsModule('src/renderer/src/lib/color-grade.ts')
  let map = {}
  map = mergeColorGradeForVideo(map, { path: '/tmp/a.mp4' }, { exposure: 0.6 })
  map = mergeColorGradeForVideo(map, { path: '/tmp/b.mp4' }, { saturation: 1.4 })

  assert.equal(getColorGradeForVideo(map, { path: '/tmp/a.mp4' }).exposure, 0.6)
  assert.equal(getColorGradeForVideo(map, { path: '/tmp/b.mp4' }).saturation, 1.4)
  assert.equal(getColorGradeForVideo(map, { path: '/tmp/a.mp4' }).saturation, 1)
})

test('replaceColorGradeForVideo clears aliases and keeps canonical key', () => {
  const { replaceColorGradeForVideo, getColorGradeForVideo, DEFAULT_COLOR_GRADE } = loadTsModule('src/renderer/src/lib/color-grade.ts')
  let map = {
    '/tmp/a.mp4': { ...DEFAULT_COLOR_GRADE, exposure: 0.2 }
  }

  map = replaceColorGradeForVideo(
    map,
    { path: '/tmp/a.mp4', identity: 'vid:abc' },
    { ...DEFAULT_COLOR_GRADE, contrast: 1.2 }
  )

  assert.equal(Object.prototype.hasOwnProperty.call(map, '/tmp/a.mp4'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(map, 'vid:abc'), true)
  assert.equal(getColorGradeForVideo(map, { path: '/tmp/a.mp4', identity: 'vid:abc' }).contrast, 1.2)
})

test('clearColorGradeForVideo removes mapping and returns default', () => {
  const { mergeColorGradeForVideo, clearColorGradeForVideo, getColorGradeForVideo, DEFAULT_COLOR_GRADE } = loadTsModule('src/renderer/src/lib/color-grade.ts')
  let map = mergeColorGradeForVideo({}, { path: '/tmp/a.mp4' }, { highlights: 0.4 })
  map = clearColorGradeForVideo(map, { path: '/tmp/a.mp4' })

  assert.deepEqual(getColorGradeForVideo(map, { path: '/tmp/a.mp4' }), DEFAULT_COLOR_GRADE)
})
