import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectRoot = path.resolve(process.cwd())

test('export pipeline keeps per-file quality and color metadata', () => {
  const mainSource = readFileSync(path.join(projectRoot, 'src/main/index.ts'), 'utf8')

  assert.match(mainSource, /buildExportEncodingProfile/)
  assert.match(mainSource, /exportQualityMode/)
  assert.match(mainSource, /exportQualityMode === 'balanced'/)
  assert.match(mainSource, /ffmpeg\.ffprobe\(inputPath/)
  assert.match(mainSource, /-movflags \+faststart/)
  assert.match(mainSource, /-map_metadata 0/)
  assert.match(mainSource, /-maxrate/)
  assert.match(mainSource, /-bufsize/)
  assert.match(mainSource, /-color_primaries/)
  assert.match(mainSource, /-color_trc/)
  assert.match(mainSource, /-colorspace/)
})

test('snapshots are saved as lossless png', () => {
  const filenameSource = readFileSync(path.join(projectRoot, 'src/renderer/src/lib/snapshot-filename.ts'), 'utf8')
  const videoPlayerSource = readFileSync(path.join(projectRoot, 'src/renderer/src/components/Player/VideoPlayer.tsx'), 'utf8')

  assert.match(filenameSource, /\.png/)
  assert.match(videoPlayerSource, /toDataURL\('image\/png'\)/)
  assert.doesNotMatch(videoPlayerSource, /toDataURL\('image\/jpeg', 0\.95\)/)
})
