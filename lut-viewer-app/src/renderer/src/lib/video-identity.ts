const PATH_IDENTITY_PREFIX = 'path:'

const stableHash = (value: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const normalizePart = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value).trim().toLowerCase()
}

export const toPathIdentity = (filePath: string): string => `${PATH_IDENTITY_PREFIX}${filePath}`

export const resolveVideoIdentity = (video: { path: string; identity?: string | null }): string => {
  if (typeof video.identity === 'string' && video.identity.trim().length > 0) {
    return video.identity
  }
  return toPathIdentity(video.path)
}

export const buildVideoIdentity = (filePath: string, metadata: any): string => {
  const format = metadata?.format ?? {}
  const streams = Array.isArray(metadata?.streams) ? metadata.streams : []
  const primaryVideo = streams.find((stream) => stream?.codec_type === 'video') ?? streams[0] ?? {}

  const fingerprintParts = [
    normalizePart(format.duration),
    normalizePart(format.size),
    normalizePart(format.bit_rate),
    normalizePart(format.tags?.creation_time ?? format.tags?.com_apple_quicktime_creationdate),
    normalizePart(primaryVideo.codec_name),
    normalizePart(primaryVideo.codec_tag_string),
    normalizePart(primaryVideo.width),
    normalizePart(primaryVideo.height),
    normalizePart(primaryVideo.pix_fmt),
    normalizePart(primaryVideo.r_frame_rate),
    normalizePart(primaryVideo.avg_frame_rate),
    normalizePart(primaryVideo.nb_frames),
    normalizePart(primaryVideo.color_space),
    normalizePart(primaryVideo.color_transfer),
    normalizePart(primaryVideo.color_primaries),
    normalizePart(primaryVideo.tags?.creation_time),
    normalizePart(primaryVideo.tags?.timecode)
  ].filter((part) => part.length > 0)

  if (fingerprintParts.length < 4) {
    return toPathIdentity(filePath)
  }

  return `vid:${stableHash(fingerprintParts.join('|'))}`
}
