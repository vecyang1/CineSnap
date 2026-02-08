const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'password',
  'url',
  'tel',
  'number'
])

export const isShortcutTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true
  if (target.tagName !== 'INPUT') return false

  const input = target as HTMLInputElement
  const type = (input.type || 'text').toLowerCase()
  return TEXT_INPUT_TYPES.has(type)
}
