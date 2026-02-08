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

test('shuttle controls provide FCP-like A/S/D speed stepping', () => {
  const { createStoppedShuttleState, nextShuttleState } = loadTsModule('src/renderer/src/lib/shuttle-controls.ts')

  const stopped = createStoppedShuttleState()
  const reverse1 = nextShuttleState(stopped, 'a')
  const reverse2 = nextShuttleState(reverse1, 'a')
  const stopFromReverse = nextShuttleState(reverse2, 's')
  const forward1 = nextShuttleState(stopFromReverse, 'd')
  const forward2 = nextShuttleState(forward1, 'd')
  const stopFromForward = nextShuttleState(forward2, 's')

  assert.deepEqual(JSON.parse(JSON.stringify(reverse1)), { direction: 'reverse', speed: 1, isPlaying: true })
  assert.deepEqual(JSON.parse(JSON.stringify(reverse2)), { direction: 'reverse', speed: 2, isPlaying: true })
  assert.deepEqual(JSON.parse(JSON.stringify(stopFromReverse)), { direction: 'stopped', speed: 0, isPlaying: false })
  assert.deepEqual(JSON.parse(JSON.stringify(forward1)), { direction: 'forward', speed: 1, isPlaying: true })
  assert.deepEqual(JSON.parse(JSON.stringify(forward2)), { direction: 'forward', speed: 2, isPlaying: true })
  assert.deepEqual(JSON.parse(JSON.stringify(stopFromForward)), { direction: 'stopped', speed: 0, isPlaying: false })
})

test('video player keybindings use A/S/D for shuttle actions', () => {
  const source = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(source, /SHORTCUTS\.shuttleReverse\.keyCode/)
  assert.match(source, /SHORTCUTS\.shuttleToggle\.keyCode/)
  assert.match(source, /SHORTCUTS\.shuttleForward\.keyCode/)
  assert.match(source, /SHORTCUTS\.captureSnapshot\.keyCode/)
  assert.match(source, /SHORTCUTS\.toggleLutBypass\.keyCode/)
  assert.match(source, /nextShuttleState\(shuttleStateRef\.current,\s*'a'\)/)
  assert.match(source, /nextShuttleState\(shuttleStateRef\.current,\s*'s'\)/)
  assert.match(source, /nextShuttleState\(shuttleStateRef\.current,\s*'d'\)/)
  assert.match(source, /action === 'shuttleReverse' \|\| action === 'shuttleToggle' \|\| action === 'shuttleForward'/)
  assert.match(source, /calculateReverseStepSeconds/)
  assert.match(source, /accumulateReversePendingSeconds/)
  assert.match(source, /e\.repeat && \(\s*e\.code === SHORTCUTS\.shuttleReverse\.keyCode[\s\S]*e\.code === 'ArrowLeft'[\s\S]*e\.code === 'ArrowRight'/)
  assert.match(source, /useStore\.getState\(\)\.captureSnapshot\(\)/)
})

test('paused hold shuttle uses keyup release to return to paused state', () => {
  const source = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(source, /const pausedShuttlePressRef = useRef<\{ key: ShuttleKey \| null; startedAt: number \}>/)
  assert.match(source, /const momentaryShuttleKeyRef = useRef<ShuttleKey \| null>\(null\)/)
  assert.match(source, /const HOLD_TO_MOMENTARY_SHUTTLE_MS = \d+/)
  assert.doesNotMatch(source, /momentaryShuttleTimeoutRef/)
  assert.match(source, /const wasPaused = !store\.isPlaying/)
  assert.match(source, /if \(wasPaused && shuttleDirectionKey\)/)
  assert.match(source, /pausedShuttlePressRef\.current = \{ key: shuttleDirectionKey, startedAt: performance\.now\(\) \}/)
  assert.match(source, /const heldMs = performance\.now\(\) - pausedShuttlePressRef\.current\.startedAt/)
  assert.match(source, /if \(heldMs < HOLD_TO_MOMENTARY_SHUTTLE_MS\)/)
  assert.match(source, /const handleKeyUp = \(e: KeyboardEvent\) =>/)
  assert.match(source, /if \(pausedShuttlePressRef\.current\.key !== shuttleDirectionKey\) return/)
  assert.match(source, /window\.addEventListener\('keyup', handleKeyUp\)/)
  assert.match(source, /window\.removeEventListener\('keyup', handleKeyUp\)/)
  assert.match(source, /applyShuttleState\('stopped', 0, false\)/)
})
