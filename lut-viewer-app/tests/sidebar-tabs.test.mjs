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

test('normalizeSidebarTabOrder keeps known tabs once and appends missing tabs', () => {
  const { DEFAULT_SIDEBAR_TAB_ORDER, normalizeSidebarTabOrder } = loadTsModule('src/renderer/src/lib/sidebar-tab-order.ts')

  const normalized = normalizeSidebarTabOrder(['snaps', 'files', 'files', 'x'])

  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), ['snaps', 'files', 'luts', 'grade'])
  assert.deepEqual(JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_TAB_ORDER)), ['files', 'snaps', 'luts', 'grade'])
})

test('moveSidebarTab reorders tabs by source and target IDs', () => {
  const { moveSidebarTab } = loadTsModule('src/renderer/src/lib/sidebar-tab-order.ts')

  const reordered = moveSidebarTab(['files', 'snaps', 'luts', 'grade'], 'grade', 'snaps')

  assert.deepEqual(JSON.parse(JSON.stringify(reordered)), ['files', 'grade', 'snaps', 'luts'])
})

test('store persists sidebarTabOrder and normalizes updates', () => {
  const storeSource = readFileSync(path.join(projectRoot, 'src/renderer/src/store/useStore.ts'), 'utf8')
  assert.match(storeSource, /sidebarTabOrder:\s*DEFAULT_SIDEBAR_TAB_ORDER/)
  assert.match(storeSource, /setSidebarTabOrder:\s*\(order\)\s*=>\s*set\(\{\s*sidebarTabOrder:\s*normalizeSidebarTabOrder\(order\)\s*\}\)/)
  assert.match(storeSource, /sidebarTabOrder:\s*state\.sidebarTabOrder/)
})
