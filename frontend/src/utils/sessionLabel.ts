export function getSessionLabel(s: { id: number; jd_snippet?: string | null }): string {
  if (s.jd_snippet) {
    const first = s.jd_snippet.trim().split('\n')[0].trim()
    return first.length > 48 ? first.slice(0, 48) + '…' : first
  }
  return `Session #${s.id}`
}
