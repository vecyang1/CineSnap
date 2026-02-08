
import { electronApi } from './electron-api'

export const isLutFilePath = (filePath: string): boolean => /\.(cube|3dl)$/i.test(filePath)

export const isVideoFilePath = (filePath: string): boolean =>
    /\.(mp4|mov|mkv|avi|m4v|webm|mpg|mpeg|mxf)$/i.test(filePath)

export const splitDroppedPaths = (filePaths: string[]): { videoPaths: string[], lutPaths: string[] } => {
    const videoPaths: string[] = []
    const lutPaths: string[] = []

    for (const path of filePaths) {
        if (isLutFilePath(path)) {
            lutPaths.push(path)
            continue
        }
        if (isVideoFilePath(path)) {
            videoPaths.push(path)
        }
    }

    return { videoPaths, lutPaths }
}

export const resolveDroppedPlaybackIndex = (
    playlist: Array<{ path: string }>,
    droppedVideoPaths: string[]
): number => {
    for (const droppedPath of droppedVideoPaths) {
        const index = playlist.findIndex((item) => item.path === droppedPath)
        if (index >= 0) return index
    }
    return -1
}

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

const buildVideoIdentity = (filePath: string, metadata: any): string => {
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

    if (fingerprintParts.length < 4) return `path:${filePath}`
    return `vid:${stableHash(fingerprintParts.join('|'))}`
}

export const processFiles = async (filePaths: string[]): Promise<any[]> => {
    const videoPaths = filePaths.filter(isVideoFilePath)
    const playlistItems: any[] = []

    const detectColorSpaceFromName = (name: string): 's-log3' | 'apple-log' | 'hlg' | 'rec709' | 'unknown' => {
        if (/s-?log3/i.test(name)) return 's-log3'
        if (/apple.*log/i.test(name)) return 'apple-log'
        if (/\bhlg\b/i.test(name)) return 'hlg'
        if (/\b(rec[ ._-]?709|bt[ ._-]?709)\b/i.test(name)) return 'rec709'
        return 'unknown'
    }

    const detectColorSpaceFromMetadata = (meta: any): 's-log3' | 'apple-log' | 'hlg' | 'rec709' | 'rec709-bt2020' | 'unknown' => {
        const tags = meta?.format?.tags || {}
        const stream = meta?.streams?.find((s: any) => s.codec_type === 'video') || {}
        const combined = JSON.stringify({ ...tags, ...stream }).toLowerCase()

        const transfer = String(stream?.color_transfer || tags?.color_transfer || '').toLowerCase()
        const primaries = String(stream?.color_primaries || tags?.color_primaries || '').toLowerCase()
        const matrix = String(stream?.color_space || tags?.color_space || '').toLowerCase()

        if (combined.includes('s-log3') || combined.includes('slog3')) return 's-log3'
        if (combined.includes('apple log')) return 'apple-log'

        const isHlg = transfer.includes('arib-std-b67') || transfer === 'hlg' || /\bhlg\b/.test(combined)
        if (isHlg) return 'hlg'

        const isRec709Gamma =
            transfer.includes('bt709') ||
            transfer.includes('iec61966-2-1') ||
            combined.includes('rec709') ||
            combined.includes('bt709')

        if (isRec709Gamma) {
            const isBt2020Gamut = primaries.includes('bt2020') || matrix.includes('bt2020') || combined.includes('bt2020')
            return isBt2020Gamut ? 'rec709-bt2020' : 'rec709'
        }

        return 'unknown'
    }

    for (const path of videoPaths) {
        const name = path.split('/').pop() || 'Video'
        let colorSpace: 's-log3' | 'apple-log' | 'hlg' | 'rec709' | 'rec709-bt2020' | 'unknown' = 'unknown'
        let identity = buildVideoIdentity(path, null)

        // 1. Filename heuristic
        colorSpace = detectColorSpaceFromName(name)

        // 2. Metadata check via bridge with fallback IPC path.
        try {
            const meta = await electronApi.readMetadata(path)
            identity = buildVideoIdentity(path, meta)
            const metadataColorSpace = detectColorSpaceFromMetadata(meta)
            if (metadataColorSpace !== 'unknown') colorSpace = metadataColorSpace
        } catch (e) {
            console.warn("Metadata read failed", e)
        }

        playlistItems.push({
            id: crypto.randomUUID(),
            path,
            name,
            identity,
            size: 0,
            colorSpace
        })
    }
    return playlistItems
}
