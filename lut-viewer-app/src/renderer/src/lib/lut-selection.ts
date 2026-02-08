type ResolveActiveLutInput = {
  activeLut: string | null
  lutLibrary: string[]
  lutStars: Record<string, boolean>
}

export const resolveActiveLut = ({ activeLut, lutLibrary, lutStars }: ResolveActiveLutInput): string | null => {
  if (activeLut && lutLibrary.includes(activeLut)) return activeLut

  const starred = lutLibrary.find((path) => Boolean(lutStars[path]))
  if (starred) return starred

  return lutLibrary[0] ?? null
}
