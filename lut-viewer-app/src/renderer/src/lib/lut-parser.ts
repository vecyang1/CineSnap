export const parseCubeLut = (text: string): { data: Uint8Array, size: number } | null => {
    const lines = text.split(/\r?\n/)
    let size = 0
    const data: number[] = []

    // Basic Adobe .cube parser
    // DOMAIN_MIN / MAX ignored for now (assume 0-1)

    for (let line of lines) {
        line = line.trim()
        if (line.startsWith('#') || line === '') continue

        if (line.startsWith('LUT_3D_SIZE')) {
            const [, sizeToken] = line.split(/\s+/)
            size = Number.parseInt(sizeToken ?? '', 10)
            continue
        }

        if (line.startsWith('TITLE') || line.startsWith('DOMAIN')) continue

        // Data lines: R G B
        const parts = line.split(/\s+/).map((part) => Number.parseFloat(part))
        if (parts.length === 3 && parts.every((value) => Number.isFinite(value))) {
            // WebGL textures usually expect 0-255 for gl.RGB/UNSIGNED_BYTE
            // .cube is 0.0-1.0
            data.push(Math.round(Math.min(1, Math.max(0, parts[0])) * 255))
            data.push(Math.round(Math.min(1, Math.max(0, parts[1])) * 255))
            data.push(Math.round(Math.min(1, Math.max(0, parts[2])) * 255))
        }
    }

    if (size === 0) return null
    if (data.length !== size * size * size * 3) {
        console.warn(`Invalid LUT payload length. Expected ${size * size * size * 3}, got ${data.length}`)
        return null
    }

    return { data: new Uint8Array(data), size }
}
