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

test('parseCubeLut accepts mixed whitespace-separated LUT values', () => {
  const { parseCubeLut } = loadTsModule('src/renderer/src/lib/lut-parser.ts')
  const lutText = [
    'TITLE "Whitespace stress"',
    'LUT_3D_SIZE 2',
    '',
    '0.0 0.0 0.0',
    '1.0    0.0 0.0',
    '0.0\t1.0\t0.0',
    '1.0 1.0 0.0',
    '0.0 0.0 1.0',
    '1.0\t0.0\t1.0',
    '0.0 1.0 1.0',
    '1.0    1.0    1.0'
  ].join('\n')

  const parsed = parseCubeLut(lutText)
  assert.ok(parsed, 'expected parser to return LUT data')
  assert.equal(parsed.size, 2)
  assert.equal(parsed.data.length, 2 * 2 * 2 * 3)
  assert.deepEqual(Array.from(parsed.data.slice(0, 6)), [0, 0, 0, 255, 0, 0])
})

test('player shader sources are valid WebGL2 GLSL', () => {
  const { vertexShaderSource, fragmentShaderSource } = loadTsModule('src/renderer/src/components/Player/shaders.ts')

  assert.match(vertexShaderSource, /#version 300 es/)
  assert.match(fragmentShaderSource, /#version 300 es/)
  assert.doesNotMatch(vertexShaderSource, /\battribute\b/)
  assert.doesNotMatch(fragmentShaderSource, /\bvarying\b/)
  assert.doesNotMatch(fragmentShaderSource, /\btexture2D\b/)
  assert.doesNotMatch(fragmentShaderSource, /\btexture3D\b/)
})

test('video player requests WebGL2 with preserveDrawingBuffer for snapshots', () => {
  const source = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(
    source,
    /getContext\(\s*['"]webgl2['"]\s*,\s*\{[\s\S]*?preserveDrawingBuffer:\s*true[\s\S]*?\}\s*\)/,
    'WebGL2 context should keep the latest rendered frame so snapshots are not black'
  )
})

test('snapshot capture flushes GL work before exporting data URL', () => {
  const source = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(
    source,
    /rendererRef\.current\?\.gl\.finish\(\)/,
    'Snapshot capture should finish GPU work before reading pixels to avoid black frames'
  )
})

test('video player re-initializes WebGL loop when active video changes', () => {
  const source = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(
    source,
    /\/\/ WebGL Loop & Event Listeners[\s\S]*?useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[(?=[^\]]*currentVideoIdentity)(?=[^\]]*currentVideo\?\.colorSpace)[^\]]*\]\)/,
    'WebGL render lifecycle must be re-created when switching videos, otherwise LUT can disappear'
  )
})
