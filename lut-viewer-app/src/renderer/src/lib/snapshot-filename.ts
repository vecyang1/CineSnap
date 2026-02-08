const pad = (value: number, size: number): string => String(value).padStart(size, '0')

const compactTimestamp = (timestampIso: string): string => {
  const parsed = new Date(timestampIso || new Date().toISOString())
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const yy = pad(date.getUTCFullYear() % 100, 2)
  const mm = pad(date.getUTCMonth() + 1, 2)
  const dd = pad(date.getUTCDate(), 2)
  const hh = pad(date.getUTCHours(), 2)
  const min = pad(date.getUTCMinutes(), 2)
  const ss = pad(date.getUTCSeconds(), 2)
  const ms = pad(date.getUTCMilliseconds(), 3)
  return `${yy}${mm}${dd}-${hh}${min}${ss}-${ms}`
}

const getLutBaseName = (lutPath: string): string => {
  const fileName = lutPath.split(/[/\\]/).pop() || lutPath
  return fileName.replace(/\.[^.]+$/u, '')
}

const sanitizeLutLabel = (label: string): string => {
  return label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .toLowerCase()
}

const truncateLutLabel = (label: string, maxLength = 24): string => {
  if (label.length <= maxLength) return label
  return label.slice(0, maxLength).replace(/[-_]+$/g, '')
}

type BuildSnapshotFilenameInput = {
  timestampIso: string
  appliedLutPath: string | null
}

export const buildSnapshotFilename = ({ timestampIso, appliedLutPath }: BuildSnapshotFilenameInput): string => {
  const stamp = compactTimestamp(timestampIso)
  if (!appliedLutPath) return `s-${stamp}.png`

  const lutLabel = truncateLutLabel(sanitizeLutLabel(getLutBaseName(appliedLutPath)))
  if (!lutLabel) return `s-${stamp}.png`
  return `s-${stamp}-${lutLabel}.png`
}
