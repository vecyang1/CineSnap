export interface SnapshotTimelineEntry {
  timestampSec: number
  createdAt: number
  snapshotPath?: string
}

export type SnapshotJumpDirection = 'previous' | 'next'

const normalizeTime = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export const sortSnapshotEntriesByTime = <T extends SnapshotTimelineEntry>(entries: T[]): T[] => {
  return [...entries].sort((a, b) => {
    const byTime = normalizeTime(a.timestampSec) - normalizeTime(b.timestampSec)
    if (byTime !== 0) return byTime
    return a.createdAt - b.createdAt
  })
}

export const buildSnapshotMarkers = (entries: SnapshotTimelineEntry[], duration: number): number[] => {
  if (!Number.isFinite(duration) || duration <= 0) return []

  const markerSet = new Set<number>()
  for (const entry of entries) {
    const clamped = Math.min(normalizeTime(entry.timestampSec), duration)
    const centisecondKey = Math.round(clamped * 100)
    markerSet.add(centisecondKey)
  }

  return Array.from(markerSet.values())
    .sort((a, b) => a - b)
    .map((key) => key / 100)
}

export const cleanSnapshotEntries = <T extends SnapshotTimelineEntry>(entries: T[]): T[] => {
  const byCentisecond = new Map<number, T>()

  for (const entry of entries) {
    if (!Number.isFinite(entry.createdAt)) continue
    if (typeof entry.snapshotPath !== 'string' || entry.snapshotPath.trim().length === 0) continue

    const normalizedTime = normalizeTime(entry.timestampSec)
    const centisecondKey = Math.floor(normalizedTime * 100)
    const normalizedEntry = { ...entry, timestampSec: normalizedTime } as T
    const existing = byCentisecond.get(centisecondKey)
    if (!existing || normalizedEntry.createdAt < existing.createdAt) {
      byCentisecond.set(centisecondKey, normalizedEntry)
    }
  }

  return sortSnapshotEntriesByTime(Array.from(byCentisecond.values()))
}

export const findSnapshotJumpTarget = (
  markers: number[],
  currentTime: number,
  direction: SnapshotJumpDirection,
  epsilonSec = 0.02
): number | null => {
  if (!Array.isArray(markers) || markers.length === 0) return null

  const normalizedMarkers = markers
    .filter((marker) => Number.isFinite(marker))
    .map((marker) => normalizeTime(marker))
    .sort((a, b) => a - b)

  if (normalizedMarkers.length === 0) return null

  const now = normalizeTime(currentTime)
  const epsilon = Number.isFinite(epsilonSec) && epsilonSec > 0 ? epsilonSec : 0

  if (direction === 'previous') {
    for (let i = normalizedMarkers.length - 1; i >= 0; i -= 1) {
      const marker = normalizedMarkers[i]
      if (marker < now - epsilon) return marker
    }
    return null
  }

  for (const marker of normalizedMarkers) {
    if (marker > now + epsilon) return marker
  }
  return null
}
