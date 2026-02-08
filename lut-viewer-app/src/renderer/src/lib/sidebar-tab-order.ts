export type SidebarTab = 'files' | 'snaps' | 'luts' | 'grade'

export const DEFAULT_SIDEBAR_TAB_ORDER: SidebarTab[] = ['files', 'snaps', 'luts', 'grade']

const isSidebarTab = (value: string): value is SidebarTab => {
  return DEFAULT_SIDEBAR_TAB_ORDER.includes(value as SidebarTab)
}

export const normalizeSidebarTabOrder = (order: string[] | SidebarTab[] | undefined | null): SidebarTab[] => {
  const next: SidebarTab[] = []
  const seen = new Set<SidebarTab>()
  for (const value of order || []) {
    if (!isSidebarTab(value) || seen.has(value)) continue
    seen.add(value)
    next.push(value)
  }

  for (const value of DEFAULT_SIDEBAR_TAB_ORDER) {
    if (seen.has(value)) continue
    next.push(value)
  }
  return next
}

export const moveSidebarTab = (order: SidebarTab[], fromTab: SidebarTab, toTab: SidebarTab): SidebarTab[] => {
  if (fromTab === toTab) return order

  const normalized = normalizeSidebarTabOrder(order)
  const fromIndex = normalized.indexOf(fromTab)
  const toIndex = normalized.indexOf(toTab)
  if (fromIndex === -1 || toIndex === -1) return normalized

  const next = [...normalized]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return normalized
  next.splice(toIndex, 0, moved)
  return next
}
