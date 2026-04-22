/**
 * Extract only the interview questions from the LLM analysis text.
 * The prompt formats output as:
 *   ## Skill Gaps        ← numbered 1-5, should be IGNORED
 *   ## Interview Questions  ← numbered 1-5, THESE are the questions
 */
export function parseQuestions(analysis: string): string[] {
  const lower = analysis.toLowerCase()

  // Find the interview questions section header
  const marker = lower.indexOf('interview question')
  if (marker === -1) return []   // section not found yet (still streaming)

  // Take only the text after that header
  const afterHeader = analysis.slice(marker)

  return afterHeader
    .split('\n')
    .filter((l) => /^\d+[\.\)]/.test(l.trim()))
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((l) => l.length > 10)   // skip accidental short matches
}
