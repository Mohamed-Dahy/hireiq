import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Upload from '../Upload'

// Mock the API module so the component's getProfile() on mount resolves and
// uploadCV/useStoredCv don't hit the network.
vi.mock('../../api', () => ({
  getProfile: vi.fn().mockResolvedValue({
    data: { tier: 'free', has_stored_cv: false, free_tier_analysis_limit: 2, analyses_in_window: 0 },
  }),
  uploadCV: vi.fn().mockResolvedValue({ data: { session_id: 1, analysis_mode: 'ats_check' } }),
  useStoredCv: vi.fn().mockResolvedValue({ data: { session_id: 1, analysis_mode: 'job_match' } }),
}))

function makePdf(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'cv.pdf', { type: 'application/pdf' })
}

function uploadFile(container: HTMLElement) {
  const input = container.querySelector('#cv-file') as HTMLInputElement
  fireEvent.change(input, { target: { files: [makePdf()] } })
}

describe('Upload mode chooser (subsections)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders both analysis modes', async () => {
    render(<Upload onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /ATS Check/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Job Match Analysis/i })).toBeTruthy()
  })

  it('ATS mode (default): enables submit with a CV and no job description', async () => {
    const { container } = render(<Upload onDone={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /Run ATS Check/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)            // no CV yet

    uploadFile(container)
    await waitFor(() => expect(btn.disabled).toBe(false))  // CV alone is enough in ATS mode
  })

  it('Job Match mode: requires a job description', async () => {
    const { container } = render(<Upload onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /Job Match Analysis/i }))
    uploadFile(container)

    const btn = screen.getByRole('button', { name: /Analyze CV/i }) as HTMLButtonElement
    await waitFor(() => expect(btn).toBeTruthy())
    expect(btn.disabled).toBe(true)            // CV present but no JD

    const textarea = screen.getByPlaceholderText(/Paste the full job description/i)
    fireEvent.change(textarea, { target: { value: 'Senior Python engineer, FastAPI, Docker' } })
    await waitFor(() => expect(btn.disabled).toBe(false))
  })

  it('retains the uploaded CV when switching modes', async () => {
    const { container } = render(<Upload onDone={vi.fn()} />)
    uploadFile(container)
    await waitFor(() => expect(screen.getByText('cv.pdf')).toBeTruthy())

    fireEvent.click(screen.getByRole('radio', { name: /Job Match Analysis/i }))
    fireEvent.click(screen.getByRole('radio', { name: /ATS Check/i }))

    // CV still selected after switching back and forth
    expect(screen.getByText('cv.pdf')).toBeTruthy()
  })
})
