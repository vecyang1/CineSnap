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

test('resolveActiveLut keeps previously selected LUT when still present', () => {
  const { resolveActiveLut } = loadTsModule('src/renderer/src/lib/lut-selection.ts')
  const result = resolveActiveLut({
    activeLut: '/luts/user.cube',
    lutLibrary: ['/luts/default.cube', '/luts/user.cube'],
    lutStars: {}
  })
  assert.equal(result, '/luts/user.cube')
})

test('resolveActiveLut falls back to starred LUT, then first LUT', () => {
  const { resolveActiveLut } = loadTsModule('src/renderer/src/lib/lut-selection.ts')

  const starredResult = resolveActiveLut({
    activeLut: null,
    lutLibrary: ['/luts/a.cube', '/luts/b.cube'],
    lutStars: { '/luts/b.cube': true }
  })
  assert.equal(starredResult, '/luts/b.cube')

  const firstResult = resolveActiveLut({
    activeLut: null,
    lutLibrary: ['/luts/a.cube', '/luts/b.cube'],
    lutStars: {}
  })
  assert.equal(firstResult, '/luts/a.cube')
})

test('store persists activeLut and uses default LUT resolver', () => {
  const storeSource = readFileSync(path.join(projectRoot, 'src/renderer/src/store/useStore.ts'), 'utf8')
  assert.match(storeSource, /activeLut:\s*state\.activeLut/)
  assert.match(storeSource, /resolveActiveLut\(/)
})
