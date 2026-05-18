export const SITE_NAME = 'HireIQ'
export const SITE_TAGLINE = 'AI-Powered Interview Coaching'
export const SITE_URL = 'https://hireiq.app'

export const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    color: 'gray',
    features: [
      '2 CV analyses / 10 days',
      'AI skill gap report',
      '5 mock interview questions',
      'Basic score gauge',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Professional',
    price: '$12',
    period: 'per month',
    color: 'purple',
    badge: 'Most popular',
    features: [
      'Unlimited CV analyses',
      'Deep AI gap analysis + roadmap',
      'Unlimited mock interviews',
      'ATS Job Tracker',
      'PDF export reports',
      'Priority AI processing',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    key: 'recruiter',
    name: 'Recruiter',
    price: '$39',
    period: 'per month',
    color: 'violet',
    features: [
      'Everything in Professional',
      'Candidate comparison lists',
      'Ranked shortlisting (up to 20)',
      'Recruiter PDF exports',
      'Team collaboration (soon)',
      'API access (soon)',
    ],
    cta: 'Contact sales',
    highlight: false,
  },
] as const

export const TESTIMONIALS = [
  {
    text: "HireIQ identified that I was missing Kubernetes knowledge for my target role. I spent 2 weeks on it and got the offer.",
    name: 'Amira K.',
    role: 'Senior Backend Engineer',
  },
  {
    text: "The mock interview scoring is brutal in the best way. I went from 58% clarity to 89% in a week of practice.",
    name: 'David O.',
    role: 'Product Manager @ Fintech',
  },
  {
    text: "As a recruiter, the candidate comparison export saves me 3 hours per hiring cycle.",
    name: 'Sarah M.',
    role: 'Technical Recruiter',
  },
] as const
