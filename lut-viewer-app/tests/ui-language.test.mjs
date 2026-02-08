import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('store defaults UI language to English and persists it', () => {
  const storeSource = readFileSync(path.join(projectRoot, 'src/renderer/src/store/useStore.ts'), 'utf8')

  assert.match(storeSource, /import \{\s*DEFAULT_UI_LANGUAGE,\s*type UiLanguage\s*\} from '\.\.\/\.\.\/\.\.\/common\/i18n'/)
  assert.match(storeSource, /uiLanguage:\s*DEFAULT_UI_LANGUAGE/)
  assert.match(storeSource, /setUiLanguage:\s*\(language:\s*UiLanguage\)\s*=>\s*void/)
  assert.match(storeSource, /setUiLanguage:\s*\(language\)\s*=>\s*set\(\{\s*uiLanguage:\s*language\s*\}\)/)
  assert.match(storeSource, /uiLanguage:\s*state\.uiLanguage/)
})

test('sidebar uses shared translator and exposes language switch in settings', () => {
  const sidebarSource = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Sidebar/Sidebar.tsx'), 'utf8')

  assert.match(sidebarSource, /import \{\s*createTranslator\s*\} from '\.\.\/\.\.\/\.\.\/\.\.\/common\/i18n'/)
  assert.match(sidebarSource, /const t = React\.useMemo\(\(\) => createTranslator\(uiLanguage\), \[uiLanguage\]\)/)
  assert.doesNotMatch(sidebarSource, /const gradeI18n = \{/)
  assert.match(sidebarSource, /setUiLanguage/)
  assert.match(sidebarSource, /sidebar\.settingsLanguage/)
  assert.match(sidebarSource, /<option value="en">English<\/option>/)
  assert.match(sidebarSource, /<option value="zh">中文<\/option>/)
})

test('main process updates application menu when language changes', () => {
  const mainSource = readFileSync(path.join(projectRoot, 'src/main/index.ts'), 'utf8')

  assert.match(mainSource, /import \{\s*DEFAULT_UI_LANGUAGE,\s*createTranslator,\s*normalizeUiLanguage,\s*type UiLanguage\s*\} from '\.\.\/common\/i18n'/)
  assert.match(mainSource, /ipcMain\.handle\('set-ui-language'/)
  assert.match(mainSource, /createApplicationMenu\(currentUiLanguage\)/)
})
