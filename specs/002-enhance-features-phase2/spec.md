# Feature Specification: HireIQ System Enhancement — Phase 2

**Feature Branch**: `002-enhance-features-phase2`  
**Created**: 2026-05-14  
**Status**: Draft  

---

## Overview

This specification covers a broad set of enhancements and new features for the HireIQ platform. The work is organized into 9 areas:

1. OTP-based email verification (replace link-click with 5-digit code)
2. Dashboard visual redesign (no new logic)
3. Login / Signup visual redesign (no new logic)
4. Full color-theme overhaul (purple → blue/teal across light and dark modes)
5. Full user profile page (activity, settings, stored CV, links)
6. Mobile responsive view
7. **New Feature: Salary Benchmark Explorer** (AI-assisted web search for data accuracy)
8. **New Feature: Interview Question Bank** (curated + Kaggle-sourced Q&A, searchable)
9. Enhanced Career Roadmap (gap-only, CV-driven)
10. AI Token Management Strategy (global usage governance)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — OTP Email Verification (Priority: P1)

A new user registers with their email. Instead of clicking a link in their inbox, they receive a 5-digit numeric code valid for 10 minutes. They enter this code on a verification screen within the app to activate their account. The same OTP flow is used for password changes and password resets.

**Why this priority**: Core security flow — blocks all registrations until resolved. Must ship before profile or social links work.

**Independent Test**: Can be fully tested by registering a new account, receiving the OTP email, entering it correctly, and confirming the user is now active. Also test entering wrong code and expired code.

**Acceptance Scenarios**:

1. **Given** a user submits the registration form, **When** the server processes the request, **Then** a 5-digit OTP is emailed to them and the account is in a `pending_verification` state.
2. **Given** a pending user enters the correct OTP within 10 minutes, **When** they submit the code, **Then** their account becomes active and they are redirected to the dashboard.
3. **Given** a pending user enters a wrong OTP, **When** they submit it, **Then** they see an error and can retry (max 5 attempts before lockout).
4. **Given** a pending user lets the OTP expire (>10 min), **When** they try to verify, **Then** they are told the code expired and can request a new one.
5. **Given** an active user wants to change their password, **When** they initiate the change, **Then** a new OTP is sent to their email and they are redirected to `/verify-otp` to confirm before the password is updated.
6. **Given** a user uses "Forgot Password", **When** they submit their email, **Then** a 5-digit OTP is sent and they are redirected to `/verify-otp` to unlock the reset form — no magic link.

---

### User Story 2 — Dashboard Visual Redesign (Priority: P2)

An authenticated user lands on the dashboard and immediately sees a well-organized, SaaS-quality overview: their recent analyses, match score trends, profile completion percentage, quick-action cards, and key stats — all without any new backend logic.

**Why this priority**: First impression after login. Directly affects perceived product quality.

**Independent Test**: Can be tested visually with existing mock/real user data — no new API calls needed.

**Acceptance Scenarios**:

1. **Given** a logged-in user visits the dashboard, **When** the page loads, **Then** they see a stats summary row (CVs analyzed, avg match score, analyses this month), recent activity list, and quick-action cards (Analyze CV, Career Roadmap, Interview Prep).
2. **Given** a new user with no data, **When** they view the dashboard, **Then** they see an empty-state with a prominent CTA to start their first analysis.

---

### User Story 3 — Login / Signup Visual Redesign (Priority: P3)

The login and signup pages are visually polished to match the new blue/teal design language: clean split-layout or centered card, clear form hierarchy, on-brand colors, smooth transitions — no logic changes.

**Why this priority**: Acquisition and retention entry point. Visual polish here signals quality.

**Independent Test**: Navigate to `/login` and `/signup`, verify visual layout renders correctly in both light and dark mode at desktop and mobile widths.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user visits `/login`, **When** the page loads, **Then** they see the redesigned layout with the new color scheme, logo, and clear form.
2. **Given** a user toggles dark mode, **When** viewing the auth pages, **Then** the new dark-mode palette (non-purple) is applied consistently.

---

### User Story 4 — Color Theme Overhaul (Priority: P2)

Every page and component in the frontend transitions from the current white/purple and dark/purple palette to white/blue (light) and dark/teal-or-slate (dark). The result should not look AI-generated — it should feel like a professional product with considered visual hierarchy.

**Why this priority**: Permeates every screen — sets the visual foundation for all other UI work in this spec.

**Independent Test**: Open each major page (Dashboard, Analyze, Results, Roadmap, Profile, Auth) in both light and dark mode and verify no purple accent remains; all interactive elements use the new palette.

**Acceptance Scenarios**:

1. **Given** any page in light mode, **When** rendered, **Then** primary actions use blue, accent colors use teal or indigo-blue, backgrounds are white/gray-50, no purple remains.
2. **Given** any page in dark mode, **When** rendered, **Then** backgrounds use slate-900/gray-900, accents use teal-400 or sky-400, text contrast meets WCAG AA, no purple remains.

---

### User Story 5 — Full User Profile Page (Priority: P2)

An authenticated user navigates to their profile and sees a professional, comprehensive page: activity summary (analyses run, gaps tracked, roadmap phases), stored personal CV (uploadable once, reusable forever), social links (LinkedIn, GitHub, Portfolio), and account settings (change username, change password via OTP, delete account).

**Why this priority**: Central hub for returning users — increases stickiness and reduces re-upload friction.

**Independent Test**: Fully testable end-to-end: upload a CV, save links, change username, initiate password change (OTP flow), verify all data persists on page reload.

**Acceptance Scenarios**:

1. **Given** a user visits their profile, **When** the page loads, **Then** they see: avatar/name section, activity stats, stored CV status, social links, settings, achievements/badges panel, and referral summary — all in a single comprehensive page built from scratch with the new blue/teal theme.
2. **Given** a user uploads their personal CV, **When** they later go to the Analyze page, **Then** they can choose "Use my stored CV" instead of re-uploading.
3. **Given** a user saves their LinkedIn, GitHub, and Portfolio URLs, **When** they view their profile, **Then** the links are displayed as clickable icons in a professional layout.
4. **Given** a user initiates a username change, **When** they submit the new name, **Then** it is validated for uniqueness and saved immediately.
5. **Given** a user initiates a password change, **When** they enter their new password, **Then** an OTP is sent to their email and they must enter it to confirm — matching the signup OTP flow.

---

### User Story 6 — Mobile Responsive View (Priority: P3)

All pages render correctly and are usable on mobile screen widths (320px–768px): navigation collapses to a hamburger/bottom-nav, cards stack vertically, text is readable, buttons are tap-friendly (min 44px tap targets).

**Why this priority**: A large share of job seekers browse on mobile. Non-functional mobile = lost users.

**Independent Test**: Open each major page at 375px width (iPhone SE). Verify no horizontal scroll, no overlapping elements, all interactions reachable.

**Acceptance Scenarios**:

1. **Given** a user opens HireIQ on a mobile device, **When** they navigate to any page, **Then** the layout adapts: nav collapses, content stacks, text remains legible.
2. **Given** a mobile user runs a CV analysis, **When** the results load, **Then** all result sections (score, skill gaps, questions, roadmap) are accessible by vertical scroll without side-scroll.

---

### User Story 7 — Salary Benchmark Explorer (Priority: P2)

A user selects a job title, experience level (Junior / Mid / Senior / Staff), and country from a form. The system returns a salary range — both local currency (Egyptian market) and USD (remote). Data is sourced from a curated dataset maintained in the backend; an AI-assisted web search step validates and updates the data periodically to ensure it reflects the current market.

**Why this priority**: One of 2 chosen new features. Directly answers the #1 question job seekers have: "Am I being paid fairly?"

**Independent Test**: Submit a query for "Backend Engineer, Mid-Level, Egypt". Verify a salary range is returned with both EGP and USD figures, data source label, and last-updated date.

**Acceptance Scenarios**:

1. **Given** a user submits a salary query, **When** the system processes it, **Then** they see a salary range (min/median/max) in local currency, a remote USD range, and how many data points the estimate is based on.
2. **Given** a user queries a role in a country with limited data, **When** results are returned, **Then** a "low confidence" label is shown and the data is extrapolated from the nearest comparable market.
3. **Given** the admin/system runs the data refresh job, **When** the AI-assisted web search runs, **Then** new salary data is fetched, validated, and merged into the dataset without removing existing curated entries.
4. **Given** a user views results, **When** they share or bookmark the page, **Then** the query parameters are preserved in the URL for sharing.

---

### User Story 8 — Interview Question Bank (Priority: P2)

A user selects a role/major (e.g., "Backend Engineer", "Data Scientist", "Product Manager") and a level, and gets a categorized, searchable list of real interview questions with model answers. Questions are sourced from Kaggle datasets + AI-curated additions. Users can mark questions as "practiced" and track their readiness per category.

**Why this priority**: One of 2 chosen new features. Directly prepares users for interviews — complements the existing CV gap analysis perfectly.

**Independent Test**: Open the Interview Bank, select "Backend Engineer / Mid-Level", verify questions appear in categories (Technical, Behavioral, System Design), verify a question can be marked as practiced and the mark persists on page reload.

**Acceptance Scenarios**:

1. **Given** a user opens the Interview Bank and selects a role + level, **When** the results load, **Then** they see questions grouped by category with model answers expandable on click.
2. **Given** a user marks a question as "practiced", **When** they revisit the bank, **Then** their progress is persisted and a readiness percentage is shown per category.
3. **Given** a user searches for "API design", **When** they type in the search box, **Then** matching questions from all categories are filtered in real time.
4. **Given** an admin/content update task runs, **When** new Kaggle-sourced or AI-curated questions are imported, **Then** they are deduplicated, tagged by role/level/category, and available to users.

---

### User Story 9 — Enhanced Career Roadmap (Priority: P1)

The career roadmap now generates a plan based **only** on the gaps identified from the user's actual CV analysis — it skips everything the user already knows. A Senior developer who uploads their CV gets a roadmap of advanced, missing skills only — not a "learn Python basics" plan.

**Why this priority**: Current roadmap is the #1 user complaint. Fixing it directly improves the platform's core value proposition.

**Independent Test**: Run an analysis for a senior developer CV, navigate to Roadmap, verify no beginner foundations appear and the phases address only the identified gaps.

**Acceptance Scenarios**:

1. **Given** a user has a stored analysis with a gap report, **When** they generate a roadmap, **Then** every phase addresses only skills flagged as gaps — no skills the user already has at an adequate level.
2. **Given** a user has no prior analysis, **When** they try to generate a roadmap, **Then** they are prompted to run a CV analysis first.
3. **Given** a Senior-level user, **When** their roadmap is generated, **Then** resources are advanced (books, architecture talks, open-source contributions) — never beginner tutorials.

---

### User Story 10 — AI Token Management (Priority: P3)

Platform administrators can view real-time token consumption across all LLM operations, set per-user daily limits, switch the active LLM provider/model from a config, and see projected monthly costs. Users approaching their limit receive a graceful degradation message rather than a crash.

**Why this priority**: Operational sustainability — prevents a single power user from exhausting the shared Groq quota and breaking the service for everyone.

**Independent Test**: Set a per-user limit to a low value, run analyses until the limit is hit, verify the user sees a clear "quota reached" message and the service does not error-crash.

**Acceptance Scenarios**:

1. **Given** a user exhausts their daily AI token quota, **When** they try to run another analysis, **Then** they see a clear, friendly message ("Daily AI limit reached — resets at midnight") instead of a 429 error.
2. **Given** an admin views the token dashboard, **When** the page loads, **Then** they see total tokens used today, per-user breakdown, estimated monthly cost, and provider status.
3. **Given** a global provider switch is configured (e.g., Groq → OpenAI), **When** the config is updated, **Then** all new LLM calls route to the new provider without code changes.

---

### Edge Cases

- What happens when an OTP is requested multiple times rapidly? (rate limit: max 3 OTP sends per 30 minutes per email)
- What if the stored CV is deleted by the user mid-analysis?
- What if a salary benchmark query uses a role with no data at all? (show "No data available for this role yet")
- What if a Kaggle import contains malformed question data? (reject row, log, continue)
- What if the user's profile photo upload exceeds size limit? (max 2MB, show clear error)
- What if a mobile user's browser does not support SSE streaming? (fall back to polling or show a loading spinner)

---

## Requirements *(mandatory)*

### Functional Requirements

**OTP Verification**
- **FR-001**: System MUST send a 5-digit numeric OTP to the user's email address upon registration, replacing the current email-link verification.
- **FR-002**: OTPs MUST expire after 10 minutes from generation.
- **FR-003**: System MUST lock OTP entry after 5 consecutive incorrect attempts and require a new OTP to be requested.
- **FR-004**: System MUST enforce a rate limit of maximum 3 OTP send requests per email per 30-minute window.
- **FR-005**: The same OTP flow MUST be used for password change and password reset — no magic links anywhere.
- **FR-006**: System MUST remove the existing email-link verification endpoints and templates.

**Dashboard**
- **FR-007**: Dashboard MUST display a stats summary row: total CVs analyzed, average match score, and analyses run in the current calendar month.
- **FR-008**: Dashboard MUST display the user's 5 most recent analysis sessions with role title, match score, and date.
- **FR-009**: Dashboard MUST show an empty-state with a CTA when the user has no analysis history.

**Color Theme**
- **FR-010**: All primary action buttons, links, and focus rings MUST use a blue palette (not purple) in light mode.
- **FR-011**: All dark-mode accent colors MUST use teal or sky tones — no purple variants.
- **FR-012**: Text contrast MUST meet WCAG AA (4.5:1 for body text, 3:1 for large text) in both modes.

**User Profile Page**
- **FR-013**: Users MUST be able to upload and store one personal CV in their profile (replaces the upload on each analysis).
- **FR-014**: The Analyze page MUST offer a "Use my stored CV" option when a stored CV exists, so users do not need to re-upload.
- **FR-015**: Users MUST be able to save and update LinkedIn URL, GitHub URL, and Portfolio URL from their profile.
- **FR-016**: Profile MUST display an activity summary: total analyses, skills tracked, roadmaps generated.
- **FR-016a**: Profile MUST retain and display the existing achievements/badges panel (First Step, On a Roll, Power User, Solid Match, Top Tier, Public Speaker) carried over from the current Profile.tsx.
- **FR-016b**: Profile MUST retain and display the referral summary card linking to the full Referral Hub.
- **FR-016c**: The existing Profile.tsx MUST be replaced entirely — the new implementation is a clean rewrite that absorbs all previous functionality plus all new sections defined in this spec.
- **FR-017**: Username changes MUST be validated for uniqueness before saving.
- **FR-018**: Password changes MUST require OTP confirmation (FR-005 applies).

**Mobile View**
- **FR-019**: All pages MUST be usable at viewport widths from 320px to 767px without horizontal scrolling.
- **FR-020**: Navigation MUST collapse to a mobile-friendly pattern (hamburger menu or bottom navigation bar) on mobile widths.
- **FR-021**: All interactive tap targets MUST be at least 44×44px on mobile.

**Salary Benchmark Explorer**
- **FR-022**: System MUST provide salary range data (minimum, median, maximum) for at least 20 common tech roles across at least 5 countries/regions. Role and country selection MUST use predefined dropdowns — only roles/countries present in the dataset are listed.
- **FR-023**: Each salary entry MUST include both local currency amount and USD remote equivalent.
- **FR-024**: Each salary entry MUST include a "last updated" date and a data confidence level (high/medium/low).
- **FR-025**: An AI-assisted web search job MUST be implementable (triggered manually or on a schedule) to refresh and validate salary data.
- **FR-026**: Salary query parameters MUST be reflected in the URL for shareability.

**Interview Question Bank**
- **FR-027**: System MUST store at least 200 interview questions covering a minimum of 8 common tech/business roles. Role and level selection MUST use predefined dropdowns matching the roles present in the question dataset. The dataset MUST be as broad as possible — task includes sourcing questions for every available role from Kaggle datasets and AI-curated additions.
- **FR-028**: Questions MUST be categorized by: role, experience level, and question type (Technical, Behavioral, System Design, Culture Fit).
- **FR-029**: Each question MUST have at least one model answer.
- **FR-030**: Users MUST be able to mark individual questions as "practiced" with persistence across sessions.
- **FR-031**: A readiness percentage per category MUST be calculated and displayed (practiced / total questions in that category).
- **FR-032**: Full-text search MUST filter questions in real time across all categories.
- **FR-033**: An import pipeline MUST exist for loading question data from Kaggle CSV/JSON datasets and AI-curated additions, with deduplication.

**Enhanced Career Roadmap**
- **FR-034**: The roadmap generator MUST use the user's stored gap report as the sole input for phase content — phases MUST NOT include skills the user already has at the required level.
- **FR-035**: If no gap report exists for the selected session, the system MUST prompt the user to run a CV analysis first.
- **FR-036**: Resources suggested in roadmap phases MUST be level-appropriate (no beginner content for Senior/Staff candidates).

**AI Token Management**
- **FR-037**: System MUST track CV analysis usage per user in persistent storage, counting each full analysis run as one operation.
- **FR-037a**: Free-tier users MUST be limited to 2 CV analyses per 10-day rolling window. Attempting a 3rd analysis within the window MUST be blocked with a user-friendly message showing when the window resets.
- **FR-037b**: Paid-tier users MUST be limited to 10,000 LLM tokens per day (default; configurable per user by admin).
- **FR-038**: When a user's quota is reached (either tier), LLM endpoints MUST return a user-friendly quota message (e.g., "You've used your 2 free analyses — your next window opens on [date]") instead of propagating a 429 error.
- **FR-039**: The LLM provider and model MUST be configurable via environment variables without code changes.
- **FR-040**: An admin-accessible view MUST show total daily token usage, per-user breakdown, tier breakdown, and estimated monthly cost.

### Key Entities

- **OtpCode**: email, code (hashed), purpose (registration | password_change | password_reset), expires_at, attempt_count, created_at
- **UserProfile**: user_id (FK), stored_cv_path, linkedin_url, github_url, portfolio_url, avatar_url, bio
- **SalaryBenchmark**: role, level, country, currency, min_salary, median_salary, max_salary, usd_min, usd_max, confidence, source, last_updated_at
- **InterviewQuestion**: id, role, level, category, question_text, model_answer, source (kaggle | ai_curated | manual), created_at
- **UserQuestionProgress**: user_id (FK), question_id (FK), practiced_at
- **TokenUsageLog**: user_id (FK), date, tokens_used, operation_type, tier (free | paid)
- **AnalysisUsageWindow**: user_id (FK), window_start (timestamp of first analysis in the current 10-day window), analyses_used (integer, resets when window_start + 10 days has passed)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New user registration completes end-to-end (including OTP verification) in under 3 minutes.
- **SC-002**: Zero users see a raw 429 error from the LLM provider — all quota exhaustion results in a friendly in-app message.
- **SC-003**: All pages render without layout breakage or horizontal scroll on a 375px-wide viewport.
- **SC-004**: The Interview Question Bank launches with at least 200 questions across at least 8 roles, with full-text search returning results under 500ms.
- **SC-005**: The Salary Benchmark Explorer covers at least 20 roles × 5 regions at launch, with data confidence labels on all entries.
- **SC-006**: Career roadmap for a Senior-level candidate contains zero beginner-level resources (verified by review of generated output).
- **SC-007**: Profile page loads all user data (activity, stored CV status, links) in a single page-load with no additional user action.
- **SC-008**: The new color theme passes WCAG AA contrast ratio checks in both light and dark modes across all major pages.
- **SC-009**: A stored CV can be selected and used for a new analysis without any file re-upload step.
- **SC-010**: Free-tier quota enforcement works correctly: a user's 3rd CV analysis within a 10-day window is blocked with a clear message showing the window reset date; paid-tier users are unaffected until their 10,000 token/day limit is reached.

---

## Clarifications

### Session 2026-05-14

- Q: Where does the app take the user to enter the OTP code after registration/password flows? → A: Dedicated `/verify-otp` route, reused across signup verification, password change, and password reset.
- Q: What is the default per-user AI usage limit for each tier? → A: Free tier = 2 CV analyses per 10-day rolling window (operation-count based). Paid tier = 10,000 tokens/day (to be revised in a later iteration).
- Q: Should the new Profile page replace or extend the existing Profile.tsx? → A: Replace completely. The new page absorbs all existing sections (achievements/badges, stats, referral card, account info) plus all new sections (stored CV, social links, username/password edit with OTP). No existing profile feature is removed.
- Q: How should role selection work in the Salary Benchmark and Interview Question Bank? → A: Predefined dropdown of roles matching the seeded dataset exactly — no free text. Dataset should cover as many roles as possible at launch (target: maximize breadth of roles from Kaggle + manual seed).

---

## Assumptions

- The existing email service (SMTP/SendGrid configured in `.env`) can send OTP emails — no new email provider is needed.
- The frontend uses React + TypeScript + Vite + TailwindCSS v3 — the color overhaul is done via Tailwind config token changes.
- The Salary Benchmark data seed will be authored manually (as a JSON/CSV seed file) for the initial launch; the AI-assisted refresh job is an enhancement that runs after launch.
- Kaggle question datasets will be downloaded manually by the developer and placed in a known import directory; the import script processes them from there.
- "AI-assisted web search" for salary data means using an LLM with search-tool capability (or the `WebSearch` tool in Claude Code) to verify and update benchmark values — not a live user-facing search.
- Profile avatars are optional at v1; a default generated avatar (initials-based) is acceptable.
- The admin token dashboard is accessible only to users with an `is_admin` flag — no separate admin auth system is needed.
- Existing `CVSession` model and analysis pipeline remain unchanged; the profile stored-CV feature adds a new optional CV source without replacing the session-based upload.
- Mobile view applies to all existing and new pages; no feature is desktop-only at this spec level.
- The Interview Question Bank is read-only for end users — only admins/import scripts can add questions.
