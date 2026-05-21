export function getSessionLabel(s: {
  id: number
  jd_snippet?: string | null
  cv_filename?: string | null
}): string {
  if (s.jd_snippet) {
    const snippet = s.jd_snippet.trim()
    // Already extracted a clean title on the backend — just truncate
    const label = snippet.split('\n')[0].trim()
    if (label.length >= 4) {
      return label.length > 52 ? label.slice(0, 52) + '…' : label
    }
  }
  if (s.cv_filename) {
    // Strip UUID prefix (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_) or just remove .pdf
    const name = s.cv_filename
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/[_-]/g, ' ')
      .trim()
    if (name.length >= 2) {
      return name.length > 52 ? name.slice(0, 52) + '…' : name
    }
  }
  return `Session #${s.id}`
}
