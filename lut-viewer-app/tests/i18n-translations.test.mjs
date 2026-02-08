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

test('translator defaults to English and supports Chinese entries', () => {
  const { DEFAULT_UI_LANGUAGE, createTranslator, normalizeUiLanguage } = loadTsModule('src/common/i18n.ts')

  assert.equal(DEFAULT_UI_LANGUAGE, 'en')
  assert.equal(normalizeUiLanguage('zh'), 'zh')
  assert.equal(normalizeUiLanguage('unsupported'), 'en')

  const tEn = createTranslator('en')
  const tZh = createTranslator('zh')

  assert.equal(tEn('sidebar.tabGrade'), 'Grade')
  assert.equal(tZh('sidebar.tabGrade'), '调色')
  assert.equal(tEn('sidebar.selectionSummary', { selected: 2, total: 5 }), '2/5 selected')
  assert.equal(tZh('sidebar.selectionSummary', { selected: 2, total: 5 }), '已选 2/5')
})
