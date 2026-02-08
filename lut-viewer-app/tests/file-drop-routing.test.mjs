import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import * as ts from 'typescript'

const projectRoot = path.resolve(process.cwd())
const requireForTests = createRequire(import.meta.url)

function loadTsModule(relativePath, stubs = {}) {
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
  const dirname = path.dirname(filePath)
  const localRequire = (specifier) => {
    if (specifier in stubs) return stubs[specifier]
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(dirname, specifier)
      if (resolved in stubs) return stubs[resolved]
    }
    return requireForTests(specifier)
  }

  const context = {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    process,
    Buffer,
    crypto: globalThis.crypto
  }

  vm.runInNewContext(transpiled, context, { filename: filePath })
  return module.exports
}

const videoIdentityModule = loadTsModule('src/renderer/src/lib/video-identity.ts')

test('processFiles only returns media playlist items (ignores LUT and unknown files)', async () => {
  const { processFiles } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': {
      electronApi: {
        readMetadata: async () => ({ format: { tags: {} }, streams: [] })
      }
    }
  })

  const items = await processFiles([
    '/tmp/looks/slog3_to_709.cube',
    '/tmp/footage/clip01.mp4',
    '/tmp/looks/grade.3dl',
    '/tmp/docs/readme.txt'
  ])

  assert.equal(items.length, 1)
  assert.equal(items[0].name, 'clip01.mp4')
})

test('processFiles supports common video extensions', async () => {
  const { processFiles } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': {
      electronApi: {
        readMetadata: async () => ({ format: { tags: {} }, streams: [] })
      }
    }
  })

  const items = await processFiles([
    '/tmp/a.mov',
    '/tmp/b.MKV',
    '/tmp/c.webm',
    '/tmp/d.wav'
  ])

  const names = [...items.map((item) => item.name)]
  assert.deepEqual(names, ['a.mov', 'b.MKV', 'c.webm'])
})

test('processFiles derives a stable identity for copied videos across different paths', async () => {
  const { processFiles } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': {
      electronApi: {
        readMetadata: async () => ({
          format: {
            duration: '37.422000',
            bit_rate: '1020304',
            size: '90234567',
            tags: {
              creation_time: '2026-01-26T14:54:03.000000Z'
            }
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 3840,
              height: 2160,
              pix_fmt: 'yuv420p',
              r_frame_rate: '30000/1001',
              nb_frames: '1122'
            }
          ]
        })
      }
    }
  })

  const items = await processFiles([
    '/Volumes/DiskA/20260121_S36816.MP4',
    '/Volumes/DiskB/backup/20260121_S36816.MP4'
  ])

  assert.equal(items.length, 2)
  assert.ok(typeof items[0].identity === 'string' && items[0].identity.length > 0)
  assert.equal(items[0].identity, items[1].identity)
})

test('processFiles detects HLG from metadata transfer characteristics', async () => {
  const { processFiles } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': {
      electronApi: {
        readMetadata: async () => ({
          format: { tags: {} },
          streams: [
            {
              codec_type: 'video',
              color_transfer: 'arib-std-b67',
              color_primaries: 'bt2020',
              color_space: 'bt2020nc'
            }
          ]
        })
      }
    }
  })

  const items = await processFiles(['/tmp/hlg_take01.mov'])
  assert.equal(items.length, 1)
  assert.equal(items[0].colorSpace, 'hlg')
})

test('processFiles detects Rec709 gamma in BT.2020 primaries', async () => {
  const { processFiles } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': {
      electronApi: {
        readMetadata: async () => ({
          format: { tags: {} },
          streams: [
            {
              codec_type: 'video',
              color_transfer: 'bt709',
              color_primaries: 'bt2020',
              color_space: 'bt2020nc'
            }
          ]
        })
      }
    }
  })

  const items = await processFiles(['/tmp/rec709_bt2020_take01.mp4'])
  assert.equal(items.length, 1)
  assert.equal(items[0].colorSpace, 'rec709-bt2020')
})

test('resolveDroppedPlaybackIndex prefers the first dropped video found in playlist', () => {
  const { resolveDroppedPlaybackIndex } = loadTsModule('src/renderer/src/lib/file-utils.ts', {
    './video-identity': videoIdentityModule,
    './electron-api': { electronApi: { readMetadata: async () => ({ format: { tags: {} }, streams: [] }) } }
  })

  const index = resolveDroppedPlaybackIndex(
    [
      { path: '/videos/old.mp4' },
      { path: '/videos/new.mp4' },
      { path: '/videos/another.mp4' }
    ],
    ['/videos/missing.mp4', '/videos/new.mp4']
  )

  assert.equal(index, 1)
})

test('app drop handler routes dropped videos to playback selection', () => {
  const appSource = readFileSync(path.join(projectRoot, 'src/renderer/src/App.tsx'), 'utf8')
  assert.match(appSource, /resolveDroppedPlaybackIndex/)
  assert.match(appSource, /setPlaying\(true\)/)
})
