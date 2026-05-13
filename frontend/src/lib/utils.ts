type ClassValue = string | undefined | null | false | ClassValue[]

function toStr(v: ClassValue): string {
  if (!v) return ''
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join(' ')
  return String(v)
}

export function cn(...inputs: ClassValue[]): string {
  return inputs.map(toStr).filter(Boolean).join(' ')
}
