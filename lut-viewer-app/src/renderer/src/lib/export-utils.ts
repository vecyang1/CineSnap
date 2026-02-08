const splitPathAndExt = (filePath: string): { stem: string, ext: string } => {
    const slashIdx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dotIdx = filePath.lastIndexOf('.')
    if (dotIdx <= slashIdx) {
        return { stem: filePath, ext: '' }
    }
    return {
        stem: filePath.slice(0, dotIdx),
        ext: filePath.slice(dotIdx)
    }
}

export const buildUniqueGradedOutputPath = async (
    inputPath: string,
    exists: (candidatePath: string) => Promise<boolean>
): Promise<string> => {
    const { stem, ext } = splitPathAndExt(inputPath)
    let attempt = 1
    while (true) {
        const suffix = attempt === 1 ? '_graded' : `_graded_${attempt}`
        const candidate = `${stem}${suffix}${ext || '.mp4'}`
        if (!(await exists(candidate))) return candidate
        attempt += 1
    }
}
