import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AtsResultView from '../AtsResultView'
import type { AtsResult } from '../../api'

function makeResult(overrides: Partial<AtsResult> = {}): AtsResult {
  return {
    session_id: 1,
    overall_score: 72,
    ai_sections_available: true,
    categories: [
      { key: 'parseability', label: 'Parseability', score: 1, weight: 0.2, ai_dependent: false, confidence: 'high' },
      { key: 'contact', label: 'Contact information', score: 0.6, weight: 0.12, ai_dependent: false, confidence: 'high' },
    ],
    issues: [
      { category: 'contact', severity: 'medium', message: 'No phone detected.', recommendation: 'Add a phone number.' },
    ],
    keyword_coverage: null,
    strengths: [{ category: 'parseability', message: 'Text is cleanly machine-readable.' }],
    next_steps: ['Add a phone number.', 'Add quantified achievements.'],
    score_explanation: 'Your CV scored 72/100 — decent, with clear room to improve.',
    ...overrides,
  }
}

describe('AtsResultView enriched sections (US5)', () => {
  it('renders the score explanation, strengths and next steps', () => {
    render(<AtsResultView result={makeResult()} loading={false} />)
    expect(screen.getByText(/scored 72\/100/i)).toBeTruthy()
    expect(screen.getByText('What to do next')).toBeTruthy()
    // "Add a phone number." appears in both next-steps and the issue "Fix:" line
    expect(screen.getAllByText('Add a phone number.').length).toBeGreaterThan(0)
    expect(screen.getByText('Strengths')).toBeTruthy()
    expect(screen.getByText('Text is cleanly machine-readable.')).toBeTruthy()
  })

  it('shows an ATS-ready style result when there are no issues', () => {
    const clean = makeResult({
      overall_score: 98,
      issues: [],
      next_steps: ['Your CV is ATS-ready — no material issues detected. Keep it up to date.'],
      score_explanation: 'Your CV scored 98/100 — strong.',
    })
    render(<AtsResultView result={clean} loading={false} />)
    expect(screen.getAllByText(/ATS-ready/i).length).toBeGreaterThan(0)
    // no issues → the issues list shows the positive empty-state
    expect(screen.getAllByText(/No issues detected/i).length).toBeGreaterThan(0)
  })

  it('shows a loading state', () => {
    render(<AtsResultView result={null} loading={true} />)
    expect(screen.getByText(/Running ATS compatibility checks/i)).toBeTruthy()
  })
})
