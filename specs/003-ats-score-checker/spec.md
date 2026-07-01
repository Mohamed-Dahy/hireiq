# Feature Specification: ATS Score Checker

**Feature Branch**: `003-ats-score-checker`  
**Created**: 2026-07-01  
**Status**: Draft  
**Input**: User description: "i want to implement a new feature of this app that is make ats score checker in the system - currently the system has analyze cv that takes cv and job desc - i want to change it to complete production ats system to take cv and optionally job desc and anything related to fully detailed ATS checker - dont make it in new section, modify the analyze cv section by make it there is subsections and user choose from them"

## Overview

Today the "Analyze CV" area accepts a CV **and a required job description** and returns a job‑match analysis (match score, skill gaps, interview prep, roadmap). This feature reshapes that area into a chooser of analysis modes ("subsections") and adds a full, production‑grade **ATS (Applicant Tracking System) compatibility check** that works on a CV **alone**, with the job description becoming **optional**. When a job description is provided, the ATS check additionally reports keyword coverage against that role. The existing job‑match analysis is preserved as a second mode.

## Clarifications

### Session 2026-07-01

- Q: How should "export/share" of an ATS result work, to avoid leaking a PII‑heavy document? → A: Private download only — the owner downloads a report file while authenticated; no shareable or publicly reachable URL is ever created.
- Q: Must the core ATS checks still produce a score when the external AI analysis service is unavailable? → A: Yes — structural checks (parseability, sections, contact, formatting, dates, length) are AI‑independent and always available; only keyword coverage and written qualitative suggestions require the AI and degrade gracefully when it is down.
- Q: How long are uploaded CVs and ATS results retained, and can users delete them? → A: User‑controlled deletion with no automatic expiry; deleting a CV also removes its derived ATS result(s).
- Q: Should the ATS check go deeper than section *presence*? → A: Yes — also flag non‑standard section heading labels (suggesting canonical names) and ATS‑unfriendly elements (special characters/glyphs, uncommon fonts, and links/icons rendered as non‑text).
- Q: Besides the owner, who can see a user's CV content and ATS results? → A: Owner‑only; the admin dashboard sees aggregate metrics only (never CV content or individual results); recruiter mode is unaffected by this feature.

### Session 2026-07-01 (post-MVP calibration review)

- Observation: after Phases 1–4 shipped, the ATS score saturates near 98–100 for almost any text CV, most categories read 100%, and the result offers little actionable detail (no strengths, no consolidated next steps, thin guidance). Root causes found in the shipped engine: some checks are effectively inert or over‑permissive (e.g. a table/column check that never triggers, "quantified achievement" detection that counts bare calendar years, contact detection that treats date ranges as phone numbers, and section detection that passes on a loose keyword appearing anywhere), so nearly every category returns a perfect sub‑score.
- Q: Is the saturated, low‑detail result acceptable / handled by remaining phases? → A: No — it is a real gap not covered by the remaining planned work. Decision: **recalibrate** the scoring so it meaningfully discriminates CV quality, **and enrich** the result with strengths, prioritized gaps, a clear "what to do next" summary, and a plain‑language explanation of the score. Captured as an extension of this spec (see User Story 5 and FR‑033…FR‑040).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check a CV's ATS readiness without a job description (Priority: P1)

A job seeker wants to know whether their CV will survive automated resume screeners and how to improve it, before they have any specific job in mind. From the Analyze CV area they choose the **ATS Check** mode, upload (or reuse) their CV, leave the job description empty, and run the check. They receive an overall ATS score (0–100), a breakdown by category, a list of specific problems found, and prioritized, actionable recommendations to fix them.

**Why this priority**: This is the genuinely new capability the request centers on. The current system structurally cannot run without a job description, so producing real value from a CV alone is the core MVP. It is independently shippable and valuable on its own.

**Independent Test**: Upload a CV with no job description, run the ATS Check, and confirm a numeric ATS score, per‑category breakdown, detected issues, and recommendations are returned and saved to history — all without supplying a job description.

**Acceptance Scenarios**:

1. **Given** a logged‑in user on the Analyze CV area, **When** they select the ATS Check mode, **Then** the job description field is clearly marked optional and the run control is enabled with only a CV provided.
2. **Given** a CV that is missing a skills section and uses a non‑standard layout, **When** the user runs the ATS Check without a job description, **Then** the result shows an overall ATS score, flags the missing section and the layout problem as issues, and lists recommendations to fix each.
3. **Given** a clean, well‑structured CV, **When** the user runs the ATS Check, **Then** the overall score is high and category breakdowns show which areas passed.
4. **Given** a completed ATS Check, **When** the user revisits their history, **Then** the ATS result (mode, score, issues) is retrievable and distinguishable from job‑match results.

---

### User Story 2 - Choose an analysis mode within Analyze CV (Priority: P1)

A user opens the Analyze CV area and is presented with selectable subsections/modes — at minimum **ATS Check** (CV required, job description optional) and **Job Match Analysis** (CV + job description) — with a short description of what each produces, and picks the one that fits their goal.

**Why this priority**: The request explicitly requires reorganizing the existing single flow into chooser‑based subsections rather than a new top‑level section. Without the chooser, neither mode is discoverable, so this gates the rest of the feature.

**Independent Test**: Open the Analyze CV area and confirm the mode chooser is shown, each mode is described, selecting a mode reveals only that mode's inputs and requirements, and the user can switch modes before running.

**Acceptance Scenarios**:

1. **Given** the Analyze CV area, **When** it loads, **Then** the available analysis modes are presented as selectable subsections with a one‑line description of each.
2. **Given** the chooser, **When** the user selects Job Match Analysis, **Then** both a CV and a job description are required before the run control is enabled.
3. **Given** the chooser, **When** the user selects ATS Check, **Then** a CV is required and the job description is optional.
4. **Given** a mode has been selected, **When** the user switches to a different mode, **Then** the inputs and requirements update to match the newly selected mode without losing an already‑uploaded CV.

---

### User Story 3 - ATS check with a target job description (Priority: P2)

A user who is applying to a specific role provides both a CV and that role's job description in ATS Check mode. In addition to the standard ATS readiness results, they see how well the CV's keywords and skills cover the job description — which important terms are present and which are missing — so they can tailor the CV before applying.

**Why this priority**: It builds directly on US1 and increases value for the common "applying to a specific job" case, but the feature is already useful without it, so it is secondary to the CV‑only MVP.

**Independent Test**: Run the ATS Check with a CV and a job description and confirm the result includes a keyword‑coverage section listing matched and missing job‑relevant terms in addition to the standard ATS score and issues.

**Acceptance Scenarios**:

1. **Given** ATS Check mode with a CV and a job description, **When** the check runs, **Then** the result includes the standard ATS readiness output plus a keyword‑coverage section of matched and missing terms.
2. **Given** a CV missing several skills named in the job description, **When** the check runs, **Then** those skills appear in the missing‑keywords list with guidance to add them where truthful.
3. **Given** a job description was supplied, **When** the user views the score, **Then** the keyword‑coverage contribution is shown distinctly from the CV‑only ATS structural/quality categories.

---

### User Story 4 - Preserve the existing job‑match analysis (Priority: P2)

An existing user continues to run the full job‑match analysis (match score, skill inventory, gap report, interview questions, roadmap) by selecting the **Job Match Analysis** mode, with no loss of current capability.

**Why this priority**: Protects existing value and avoids regression while the area is reorganized. It is not new functionality, so it ranks below the new ATS capability, but it must not be broken.

**Independent Test**: Select Job Match Analysis, provide a CV and job description, and confirm the same match score, skill gaps, interview questions, and roadmap as today are produced and saved to history.

**Acceptance Scenarios**:

1. **Given** Job Match Analysis mode with a CV and job description, **When** the analysis runs, **Then** the user receives the match score, skill gaps, interview questions, and roadmap as before.
2. **Given** existing saved analyses created before this feature, **When** the user opens their history, **Then** those prior results remain viewable.

---

### User Story 5 - A meaningful score with strengths and clear next steps (Priority: P1)

A job seeker runs the ATS Check and expects the number to actually reflect their CV's quality — a strong CV and a weak CV should get visibly different scores — and expects to understand *why*: what the CV does well (strengths), what is holding the score down (prioritized gaps), what to do next, and what the score means in plain language. A near‑perfect score should be earned, not the default.

**Why this priority**: Delivered as P1 because the MVP's headline output (the score and its guidance) is currently misleading and unhelpful — it saturates near 100 for almost any CV and gives little actionable feedback. Without this, the core value proposition of the ATS Check is not met even though the plumbing works.

**Independent Test**: Run the ATS Check on a deliberately strong CV and a deliberately weak CV (missing sections, no metrics, decorative formatting) and confirm (a) the two scores differ substantially, (b) the strong CV is not automatically 100, (c) both results show a strengths list, a prioritized set of top next steps, and a plain‑language explanation of the score.

**Acceptance Scenarios**:

1. **Given** a strong, well‑structured CV and a weak CV, **When** each is checked, **Then** their overall ATS scores differ by a clear margin and the weak CV scores materially lower.
2. **Given** any completed ATS Check, **When** the user views the result, **Then** it shows a **Strengths** list (aspects the CV handles well) in addition to issues.
3. **Given** any completed ATS Check, **When** the user views the result, **Then** it shows a prioritized **"What to do next"** summary of the highest‑impact actions, distinct from the full issue list.
4. **Given** any completed ATS Check, **When** the user views the result, **Then** a short plain‑language explanation states what the score means and the main factors driving it.
5. **Given** a CV with no quantified achievements (only calendar years present) and no phone number, **When** it is checked, **Then** those weaknesses are actually flagged (not silently passed) and reflected in the score.

---

### Edge Cases

- **No CV provided**: The run control stays disabled and the user is told a CV is required for every mode.
- **Unreadable / image‑only / scanned CV**: When little or no machine‑readable text can be extracted, the result itself flags low parseability as the dominant ATS issue (a low score with a clear explanation), rather than failing silently or erroring out.
- **Non‑PDF or oversized file**: The user receives a clear message about accepted format and size limits and is not charged against any usage quota.
- **Empty or junk job description in ATS Check**: Treated as "no job description" — the keyword‑coverage section is omitted rather than producing meaningless matches.
- **Extremely long CV (many pages)**: Length is flagged as an issue with a recommendation; the check still completes.
- **Quota reached**: A user who has exhausted their allowed analyses is told the limit is reached and when it resets, consistent with the existing analysis quota behavior.
- **AI analysis service temporarily unavailable**: The ATS Check still returns its structural and quality score and issues; AI‑dependent parts (keyword coverage, written suggestions) are clearly marked unavailable with a retry option, and the run is not charged. (For Job Match Analysis, which is AI‑dependent end‑to‑end, the user sees a clear, retryable message and is not charged.)
- **Reusing a stored CV**: A user with a previously stored CV can run any mode against it without re‑uploading.

## Requirements *(mandatory)*

### Functional Requirements

#### Mode chooser (subsections)

- **FR-001**: The Analyze CV area MUST present the available analysis modes as selectable subsections within the existing area (not as a new top‑level navigation section), each with a short description of what it produces.
- **FR-002**: The system MUST offer at least two modes: **ATS Check** (CV required, job description optional) and **Job Match Analysis** (CV and job description both required).
- **FR-003**: When a mode is selected, the system MUST show only that mode's required and optional inputs and enable the run control only when that mode's required inputs are present.
- **FR-004**: Users MUST be able to switch between modes before running without losing an already‑provided CV.

#### CV intake

- **FR-005**: Every mode MUST require a CV, supplied either by upload or by reusing the user's stored CV.
- **FR-006**: The system MUST accept the same CV file types and size limits the current upload flow accepts, and MUST reject others with a clear message without consuming usage quota.

#### ATS Check — core analysis (CV‑only capable)

- **FR-007**: The ATS Check MUST produce results from a CV alone, with no job description required.
- **FR-008**: The ATS Check MUST return an overall ATS score on a 0–100 scale together with a breakdown of the contributing categories.
- **FR-009**: The ATS Check MUST evaluate **parseability** — whether a screener can reliably extract the CV's text — and flag image‑only/scanned or low‑text documents as a major issue.
- **FR-010**: The ATS Check MUST detect the presence or absence of **standard CV sections** (at minimum contact details, work experience, education, and skills) and flag missing ones.
- **FR-010a**: The ATS Check MUST detect **non‑standard section heading labels** (e.g., "My Journey" used in place of "Experience") that automated parsers may not recognize, and recommend the canonical heading name.
- **FR-011**: The ATS Check MUST validate **contact information** (presence of a reachable email and/or phone) and flag when it is missing or malformed.
- **FR-012**: The ATS Check MUST detect **parse‑hostile formatting** — such as multi‑column layouts, tables, text embedded in images/graphics, and content placed in headers/footers — and flag elements likely to confuse automated parsers.
- **FR-012a**: The ATS Check MUST detect **ATS‑unfriendly content elements** — including special characters/decorative glyphs, uncommon or non‑embedded fonts, and links/icons rendered as non‑text — and flag them with guidance to replace them with plain‑text equivalents.
- **FR-013**: The ATS Check MUST evaluate **content quality signals** including use of action verbs, presence of quantified achievements, overall length, and readability, and flag weaknesses.
- **FR-014**: The ATS Check MUST check **date and chronology consistency** in the experience/education history and flag gaps or inconsistent date formatting.
- **FR-015**: For every detected issue, the system MUST provide a specific, actionable recommendation describing how to fix it.
- **FR-016**: The system MUST present issues and recommendations in a prioritized order so the user can address the highest‑impact problems first.

#### ATS Check — keyword coverage (when a job description is provided)

- **FR-017**: When a job description is provided in ATS Check mode, the system MUST additionally report keyword/skill coverage against that job description, listing terms found in the CV and important terms that are missing.
- **FR-018**: The system MUST present the keyword‑coverage contribution distinctly from the CV‑only structural and quality categories so the user understands which part of the score depends on the job description.
- **FR-019**: When no job description (or an empty/meaningless one) is provided, the system MUST omit the keyword‑coverage section rather than report misleading matches.

#### Results, persistence, and history

- **FR-020**: The system MUST persist each ATS Check result (its mode, score, detected issues, recommendations, and keyword coverage when applicable) and make it retrievable from the user's history.
- **FR-021**: Saved results MUST record which mode produced them so ATS results and job‑match results are distinguishable in history.
- **FR-022**: The system MUST allow the owning user to export an ATS Check result as a downloadable report file while authenticated. The system MUST NOT create any publicly reachable or guessable‑URL share link for an ATS result or CV (private download only).

#### Preserve existing capability

- **FR-023**: The Job Match Analysis mode MUST continue to produce the current outputs (match score, skill inventory, gap report, interview questions, roadmap) with no loss of capability.
- **FR-024**: Analyses created before this feature MUST remain viewable in history.

#### Quota and limits

- **FR-025**: Running any analysis mode MUST be governed by the existing usage‑quota rules (free‑tier limit with a reset window; paid‑tier rules), and the user MUST be informed when a limit is reached and when it resets. *(See Assumptions: the ATS Check counts against the same quota as the existing analysis.)*
- **FR-026**: Failed or rejected runs (invalid file, service unavailable) MUST NOT be counted against the user's quota.

#### Security, privacy & reliability

- **FR-027**: ATS Check structural and quality categories (parseability, standard‑section detection, non‑standard heading detection, contact validation, parse‑hostile formatting, ATS‑unfriendly element detection, content quality, length/readability, and date consistency) MUST be computable without the external AI analysis service, so an ATS score and its core issues remain available during an AI outage or rate‑limit.
- **FR-028**: Features that require the external AI service (keyword coverage analysis and any written qualitative suggestions) MUST degrade gracefully when it is unavailable — the result is still returned with the AI‑dependent portions clearly marked as unavailable, and the run MUST NOT be counted against the user's quota.
- **FR-029**: A user's CV content and ATS results MUST be private to the owning user. No other end‑user may access them, and the system MUST reject access to a result or CV that does not belong to the requesting user.
- **FR-030**: The admin dashboard MUST expose only aggregate metrics (e.g., counts, score distributions) and MUST NOT expose any individual user's CV content or individual ATS results.
- **FR-031**: Users MUST be able to delete their uploaded CV and their ATS results; deleting a stored CV MUST also remove its derived ATS result(s) and the underlying CV file. No automatic time‑based expiry is applied.
- **FR-032**: The system MUST minimize exposure of personal data to external processing — only the CV/job‑description content necessary to perform AI‑dependent steps is sent to the external AI service, and only when an AI‑dependent step is actually requested.

#### Score calibration & richer guidance (US5)

- **FR-033**: The overall ATS score MUST meaningfully discriminate CV quality — CVs with real weaknesses MUST score materially lower than clean CVs, and the full 0–100 range MUST be usable (a near‑perfect score is reserved for CVs with no detected weaknesses across categories, not the default outcome for any text CV).
- **FR-034**: Every scored check MUST be genuinely evaluated and accurate — no check may be inert (always passing) or based on a signal that is never computed, and detection MUST avoid the known false‑passes: quantified‑achievement detection MUST NOT count bare calendar years or arbitrary numbers as achievements; contact detection MUST NOT accept date ranges as phone numbers; section detection MUST be anchored to actual section headings rather than any occurrence of a keyword.
- **FR-035**: Parse‑hostile structure detection (multi‑column and table‑like layouts) MUST be actually implemented and able to trigger on real CVs that exhibit them.
- **FR-036**: The result MUST include a **Strengths** list summarizing the aspects the CV handles well (the categories/checks it passes strongly), so users get positive, specific feedback even at high scores.
- **FR-037**: The result MUST include a prioritized **"What to do next"** summary — a short, ranked set of the highest‑impact actions — presented distinctly from the full issue list.
- **FR-038**: The result MUST include a concise, plain‑language explanation of what the score means and the main factors driving it up or down.
- **FR-039**: When the ATS Check finds no material weaknesses, the result MUST still communicate this clearly (an explicit "ATS‑ready" state with the strengths that justify it) rather than showing an empty or uninformative result.
- **FR-040**: Category sub‑scores MUST be presented with enough granularity that a user can see which specific categories cost them points (not a wall of 100%s), consistent with the recalibrated scoring in FR‑033/FR‑034.

### Key Entities *(include if feature involves data)*

- **Analysis Session**: A single run within the Analyze CV area. Attributes: owning user, mode (ATS Check / Job Match Analysis), the CV used, optional job description, creation time, and the produced results. Extends the concept of the existing CV analysis session so history is unified.
- **ATS Result**: The outcome of an ATS Check. Attributes: overall ATS score (0–100), per‑category breakdown (parseability, standard sections, heading conventions, contact, formatting, ATS‑unfriendly elements, content quality, dates, and — when applicable — keyword coverage), a flag for which categories are AI‑independent vs AI‑dependent, an ordered list of detected issues each with a severity and an actionable recommendation, a **strengths** list, a prioritized **"what to do next"** summary, a plain‑language **score explanation**, and the matched/missing keyword lists when a job description was supplied. Private to the owning user.
- **Job Match Result**: The existing job‑match outcome (match score, skill inventory, gap report, interview questions, roadmap), preserved.
- **Stored CV**: The user's reusable CV, usable as input to any mode without re‑upload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can obtain a complete ATS Check result from a CV alone (no job description) in a single flow, and at least 95% of valid, text‑based CV uploads return a score and recommendations without error.
- **SC-002**: Every ATS Check result presents an overall 0–100 score, a category breakdown, and at least one specific recommendation for each detected issue.
- **SC-003**: For a CV with deliberately introduced problems (missing skills section, image‑only content, no contact email), the ATS Check flags each of those problems.
- **SC-004**: When a job description is supplied, the result lists matched and missing job‑relevant keywords, and users can identify what to add.
- **SC-005**: Users can select between at least two analysis modes from within the Analyze CV area, and 90% of first‑time users can start the mode they intend without assistance (measured via task‑completion testing).
- **SC-006**: The existing job‑match analysis continues to produce its current outputs with zero regressions, verified against prior saved results.
- **SC-007**: A typical ATS Check completes within the same responsiveness users experience for the current analysis (results begin appearing within a few seconds for a standard CV).
- **SC-008**: Invalid uploads and failed runs never consume the user's analysis quota.
- **SC-009**: With the external AI service made unavailable, an ATS Check on a valid CV still returns a structural/quality score and its issues 100% of the time, with AI‑dependent sections marked unavailable.
- **SC-010**: No ATS result or CV is reachable by anyone other than its owner: attempts to access another user's result/CV are rejected, and no public/guessable share URL exists; verified by access‑control testing.
- **SC-011**: Deleting a stored CV removes the CV file and all its derived ATS results, verified to be irretrievable afterward.
- **SC-012**: For a CV using non‑standard section headings and decorative glyphs, the ATS Check flags both the unrecognized headings and the ATS‑unfriendly elements with canonical/plain‑text recommendations.
- **SC-013**: A deliberately strong CV and a deliberately weak CV produce ATS scores that differ by a clear margin (e.g., ≥ 25 points), demonstrating the score discriminates quality rather than saturating near 100.
- **SC-014**: Every point deducted from an ATS score traces to a specific, named fault in a category (accuracy, not an artificial spread). A CV with no detected faults in any category may legitimately score near‑100; conversely, CVs that do contain faults show those faults as deductions. (The goal is that the number is *earned and explainable*, not that scores are forced to spread.)
- **SC-015**: Every ATS Check result presents a strengths list, a prioritized "what to do next" summary, and a plain‑language explanation of the score — including when the score is high (an explicit "ATS‑ready" state), so the result is never empty or uninformative.
- **SC-016**: A CV that lists only calendar years (no quantified achievements) and has no phone number is correctly flagged for both weaknesses, confirming the previously over‑permissive checks now discriminate.

## Assumptions

- **Subsection interpretation**: "Subsections the user chooses from" is interpreted as a mode chooser inside the existing Analyze CV area, where **ATS Check** (CV required, job description optional) and **Job Match Analysis** (CV + job description, the existing flow) are the initial modes. The existing job‑match capability becomes one of these modes rather than being replaced.
- **CV‑only is the new path**: The current flow requires a job description; the defining new behavior is producing meaningful results with no job description. ATS score (CV‑only readiness) and the existing match score (CV vs job description) are distinct metrics.
- **Scope boundary of "fully detailed ATS checker"**: The ATS Check covers parseability, standard‑section detection, contact‑info validation, parse‑hostile formatting detection, content‑quality signals (action verbs, quantified achievements, length, readability), date/chronology consistency, and (job‑description‑dependent) keyword coverage. It does **not** include automatic CV rewriting/generation, applying to jobs, or integrating with external/third‑party ATS platforms in this iteration.
- **Quota behavior**: The ATS Check counts against the same usage quota as the existing analysis (free‑tier limit with reset window; paid‑tier rules), to keep cost and abuse controls consistent. If the product owner wants the ATS Check to be free or metered separately, that is a small follow‑up adjustment.
- **Input types and stored CV**: The feature reuses the existing CV upload constraints (accepted file types/size) and the existing stored‑CV reuse capability; no new intake mechanism is introduced.
- **Authentication and history**: The feature reuses the existing authenticated user model and history/persistence; ATS results are stored alongside existing analysis sessions and shown in the same history.
- **Export**: ATS results are exportable as an authenticated, owner‑only download (no public or shareable link), reusing the existing report‑export capability.
- **Data privacy & retention**: CV content and ATS results are private to the owning user; the admin dashboard reports aggregates only. Uploaded CVs and results persist until the user deletes them (no automatic expiry), and the existing stored‑CV deletion capability is extended to also remove derived ATS results.
- **Resilience**: The external AI analysis service is treated as a non‑critical dependency for the ATS Check — structural/quality scoring continues without it; only keyword coverage and written suggestions require it.
