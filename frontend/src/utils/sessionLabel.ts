export function getSessionLabel(s: {
  id: number
  jd_snippet?: string | null
  cv_filename?: string | null
  original_cv_filename?: string | null
}): string {
  const role = s.jd_snippet
    ? (() => {
        const line = s.jd_snippet.trim().split('\n')[0].trim()
        return line.length >= 4 ? line : ''
      })()
    : ''

  const cvName = (s.original_cv_filename ?? '')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]/g, ' ')
    .trim()

  if (role && cvName) {
    const combined = `${role} · ${cvName}`
    return combined.length > 64 ? combined.slice(0, 64) + '…' : combined
  }

  if (role) {
    return role.length > 52 ? role.slice(0, 52) + '…' : role
  }

  if (cvName.length >= 2) {
    return cvName.length > 52 ? cvName.slice(0, 52) + '…' : cvName
  }

  return `Session #${s.id}`
}
