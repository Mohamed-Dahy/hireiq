# Feature Specification: ATS-Grade Engine Upgrade

**Feature Branch**: `004-ats-grade-engine`  
**Created**: 2026-07-03  
**Status**: Draft  
**Input**: User description: "create me a full spec of these for the truly ats-grade system"

## Overview

The shipped ATS Check (spec 003) is a reliable, resilient **ATS‑readiness heuristic**: it catches the major real‑world ATS failure modes (image‑only PDFs, missing/renamed sections, tables/multi‑column, missing contact, no metrics) and explains every deduction. It is **not**, however, a true ATS parser: it checks *proxies* for parseability rather than actually extracting the structured record a real applicant tracking system reads; it accepts **PDF only**; its keyword coverage depends entirely on an AI call; its 0–100 score is hand‑tuned rather than validated against real outcomes; and its skill/action‑verb recognition relies on small fixed word lists.

This feature closes those gaps to make the checker genuinely **ATS‑grade**:

1. **Word‑document support** — accept `.docx` CVs, not just PDF (the most common real submission gap).
2. **A real parsing layer** — extract the structured information an ATS actually reads (contact block, work‑experience entries with role/employer/dates, education, skills) and show the user that parsed view plus warnings for anything an ATS could not extract.
3. **Resilient keyword coverage** — matched/missing keyword analysis works even when the AI service is unavailable, via a deterministic fallback.
4. **A validated score** — the ATS score is calibrated against a set of real CVs labeled by outcome, so the number reflects real ATS behavior rather than intuition.
5. **Comprehensive skill & action‑verb recognition** — recognize skills and action verbs from a broad, maintained vocabulary rather than a short hardcoded list.

It preserves everything spec 003 guaranteed: deterministic structural scoring, graceful degradation, owner‑only access, no data leakage, and every deduction traceable to a named fault.

## Clarifications

### Session 2026-07-03

- Q: The ATS result feels vague — what extra detail should each result show? → A: Comprehensive — show the **point impact** of each issue and category ("this cost you −8"), a concrete **before → after fix example** per issue, and **category drill‑down** to the individual sub‑checks behind each category score.
- Q: "Not enough options for the user" — what controls should the ATS Check offer? → A: A **target role/industry selector** that tailors which skills/keywords/checks apply, a **quick vs. detailed depth toggle**, and **re‑analyze after edits** to see the updated score.
- Q: What is the calibration ground truth (US4)? → A: **Expert human rating** (an expert‑rated validation set). Live proprietary‑ATS outcomes and open‑source‑parser labels are explicitly **not** used this iteration (parser‑based labeling is noted as a possible future upgrade). This resolves the previously‑open scope question.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check a Word (.docx) CV, not just PDF (Priority: P1)

A job seeker whose CV is a Word document uploads it to the ATS Check and gets the same full analysis a PDF gets, without having to convert it first.

**Why this priority**: `.docx` is one of the most common CV formats candidates actually submit; rejecting it is the single biggest real‑world coverage gap. It is independently valuable and shippable on its own.

**Independent Test**: Upload a `.docx` CV, run the ATS Check with no job description, and confirm a full result (score, categories, issues, strengths, next steps) is produced — equivalent to the PDF path.

**Acceptance Scenarios**:

1. **Given** a `.docx` CV, **When** the user runs an ATS Check, **Then** the system produces the same categories of result it produces for a PDF.
2. **Given** an unsupported file type (e.g. an image or spreadsheet), **When** the user tries to upload it, **Then** the system rejects it with a clear message listing the accepted formats and does not consume the user's quota.
3. **Given** a password‑protected or corrupt Word file, **When** the user uploads it, **Then** the system reports it cannot read the file rather than failing silently.

---

### User Story 2 - See what an ATS actually extracts from my CV (Priority: P1)

A job seeker wants to know not just "is my CV parseable" but *what an ATS would actually pull out of it* — their name and contact details, each job (title, employer, dates), education, and skills — and to be warned about anything the parser could not confidently extract (e.g. a job with no detectable dates, or a skills section it could not read).

**Why this priority**: This is the defining capability that separates a true ATS‑grade checker from a heuristic one. Showing the parsed record — and its gaps — is what lets a user actually fix the things that make real ATS software misread their CV.

**Independent Test**: Run the check on a normal CV and confirm the result includes a structured "here's what an ATS reads from your CV" view (contact, work‑experience entries, education, skills), and that a CV with a deliberately unparseable experience entry surfaces a specific "could not extract" warning for it.

**Acceptance Scenarios**:

1. **Given** a standard CV, **When** the check runs, **Then** the result shows the extracted contact details, a list of work‑experience entries (role, employer, dates where present), education entries, and detected skills.
2. **Given** a CV where a role is missing dates or an employer, **When** the check runs, **Then** that entry is flagged as partially parsed with guidance on what to add.
3. **Given** a CV whose skills are embedded in a graphic or table an ATS can't read, **When** the check runs, **Then** the skills are reported as not reliably extractable and this lowers the parseability outcome.
4. **Given** the parsed view, **When** the user reviews it, **Then** what is shown reflects the fields a typical ATS reads (a best‑effort structured extraction, not merely the raw text), so discrepancies are actionable.

---

### User Story 3 - Keyword coverage that always works (Priority: P2)

A job seeker supplies a job description and expects matched/missing keyword coverage every time — including when the AI service is slow or unavailable.

**Why this priority**: Spec 003's keyword coverage silently becomes unavailable during an AI outage. Making it resilient turns a best‑effort extra into a dependable feature, and reduces reliance on (and data sent to) the external AI.

**Independent Test**: With the AI service disabled, run an ATS Check with a job description and confirm matched/missing keywords are still returned (via the deterministic path), clearly labeled as to how they were produced.

**Acceptance Scenarios**:

1. **Given** a CV and a job description with the AI available, **When** the check runs, **Then** keyword coverage is produced (AI‑assisted).
2. **Given** the same inputs with the AI unavailable, **When** the check runs, **Then** keyword coverage is still produced by the deterministic fallback, and the result indicates coverage is available.
3. **Given** deterministic coverage, **When** the user reviews matched/missing terms, **Then** obvious synonyms/abbreviations of job‑relevant terms are still recognized as matches to a reasonable degree.

---

### User Story 4 - A score I can trust (Priority: P2)

A job seeker (and the product owner) needs the 0–100 ATS score to be **validated**, not just a developer's intuition — a CV that experienced reviewers judge ATS‑friendly should score high, and one they judge ATS‑problematic should score low, with the ordering demonstrably correct.

**Why this priority**: An unvalidated score can mislead users. Calibrating it against a labeled reference set makes the headline number defensible and the whole feature trustworthy.

> **Honesty note (decided — see Clarifications 2026‑07‑03):** "labeled" means **expert human rating** of CVs as ATS‑friendly / ATS‑problematic — the verifiable, achievable ground truth. A solo team cannot observe true outcomes from proprietary ATS engines (Workday/Taleo/Greenhouse), so the spec deliberately does **not** claim calibration against live ATS results. Open‑source‑parser‑based labeling was considered and deferred to a possible future iteration.

**Independent Test**: Run the checker across a held‑out set of CVs **rated by expert reviewers** as "ATS‑friendly" vs "ATS‑problematic" and confirm the scores separate the two groups by a defined margin and rank them in the expected order.

**Acceptance Scenarios**:

1. **Given** a validation set of CVs labeled by expert human rating, **When** each is scored, **Then** the ATS‑friendly group scores materially higher on average than the ATS‑problematic group.
2. **Given** two CVs where one is clearly better structured than the other, **When** both are scored, **Then** the better CV scores higher (correct ordering).
3. **Given** the calibrated scoring, **When** any score is shown, **Then** each point of deduction still maps to a specific named fault (calibration tunes weights, it does not introduce unexplained adjustments).

---

### User Story 5 - Accurate skills & wording feedback across any role (Priority: P3)

A job seeker in any field (not just software) gets accurate recognition of the skills and action verbs in their CV, so the content‑quality feedback and skill detection are meaningful for their industry.

**Why this priority**: The current short hardcoded lists (~a couple dozen action verbs, a small skills set) bias results toward tech and miss most real CVs. Broad, maintained vocabularies make the feedback correct for everyone, but this refines existing feedback rather than adding a new capability, so it ranks below the structural work.

**Independent Test**: Run the check on CVs from several distinct fields (e.g. nursing, finance, marketing, trades) and confirm their genuine skills and action verbs are recognized, not just technology terms.

**Acceptance Scenarios**:

1. **Given** a non‑technical CV with strong action verbs and role‑specific skills, **When** the check runs, **Then** those verbs and skills are recognized and not flagged as missing.
2. **Given** a CV that genuinely lacks action verbs or skills, **When** the check runs, **Then** the weakness is still correctly flagged (no false "all good").
3. **Given** the recognized skills, **When** shown to the user, **Then** they reflect the CV's actual domain rather than a fixed technology list.

---

### User Story 6 - A clear, detailed result I can tailor and iterate on (Priority: P1)

A job seeker finds the current result too vague — the score and findings don't explain *why* or *how much*, and there are no controls to fit their situation. They want each finding to show its point impact and a concrete example of the fix, to expand any category to see what was actually checked, to tell the checker what role/industry they're targeting so the analysis is relevant, to switch between a quick summary and a full report, and to re‑run after editing and watch the score move.

**Why this priority**: This is direct user feedback on the shipped experience — a vague, fixed result undermines the whole feature's usefulness regardless of how accurate the engine is. Making the result concrete and giving the user control is P1.

**Independent Test**: Open an ATS result and confirm each issue shows a point impact and a before→after example, each category expands to its sub‑checks, a target role/industry can be selected and changes what's considered relevant, depth can be toggled, and re‑running after an edit shows an updated score.

**Acceptance Scenarios**:

1. **Given** any ATS result, **When** the user reviews it, **Then** each issue shows how many points it cost and a concrete before→after example of the fix, and each category can be expanded to the individual sub‑checks behind its score.
2. **Given** the ATS Check, **When** the user selects a target role/industry, **Then** the skills/keywords/checks considered relevant are tailored to that field (e.g. a nursing role surfaces clinical competencies, not software).
3. **Given** a completed result, **When** the user toggles depth, **Then** they can switch between a concise summary and the full detailed report from the same analysis.
4. **Given** the user edits their CV and re‑runs the check, **When** the new result appears, **Then** the score reflects the change (fixing a flagged issue raises the score) and, where feasible, what changed is indicated.

---

### Edge Cases

- **Word file that is really a renamed other format** (wrong content for its extension): detected and rejected with a clear message, not mis‑parsed.
- **Scanned/image‑only content inside a Word file**: treated like an image‑only PDF — parseability flagged, low score, clear explanation.
- **CV with no detectable structure at all** (a wall of text): the parser reports minimal extractable structure and this dominates the result, rather than the system erroring.
- **Very large document / many pages**: handled within the same responsiveness expectations; length still flagged as an issue where relevant.
- **Deterministic keyword coverage on an empty/meaningless job description**: coverage is omitted (same rule as today), not fabricated.
- **A CV that parses perfectly**: the parsed view shows complete records and the result still communicates an explicit "ATS‑ready" state.
- **Calibration set drift**: when the labeled validation set is updated, re‑running calibration must not silently regress previously‑correct orderings (guarded by the validation acceptance test).

## Requirements *(mandatory)*

### Functional Requirements

#### Document intake (US1)

- **FR-001**: The system MUST accept `.docx` (Word) CVs for the ATS Check in addition to PDF, producing an equivalent result for both formats.
- **FR-002**: The system MUST enforce the same file‑size and safety limits on Word uploads as on PDF uploads, and MUST reject unsupported types with a clear message listing accepted formats, without consuming the user's analysis quota.
- **FR-003**: The system MUST detect and clearly report files that cannot be read (corrupt, password‑protected, or content not matching the declared type) rather than failing silently or producing a misleading score.
- **FR-004**: Wherever the current experience lets a user upload or reuse a CV (fresh upload and stored CV), the accepted formats MUST be consistent.

#### Structured parsing (US2)

- **FR-005**: The system MUST extract, from a CV, the structured information an ATS reads: contact details (name, email, phone, links), work‑experience entries (role, employer, dates when present), education entries, and a skills list.
- **FR-006**: The result MUST present this parsed record as a **best‑effort structured extraction** of the CV — the fields a typical ATS reads — distinct from the raw text. (It reflects this system's parser, not a guarantee of how any specific proprietary ATS parses.)
- **FR-007**: The system MUST flag any field or entry it could not confidently extract (e.g. a role with no detectable dates, an unreadable skills block) with specific, actionable guidance.
- **FR-008**: Parse success MUST feed the parseability outcome — a CV whose key records cannot be reliably extracted MUST score lower on parseability, with the reason named.
- **FR-009**: The parsing layer MUST be deterministic and MUST NOT send CV content to an external AI service (privacy parity with the existing structural engine).

#### Resilient keyword coverage (US3)

- **FR-010**: When a job description is supplied, the system MUST produce matched/missing keyword coverage even when the AI service is unavailable, via a deterministic fallback.
- **FR-011**: The result MUST indicate that keyword coverage is available whenever either the AI‑assisted or the deterministic method succeeds; coverage MUST be marked unavailable only when neither can run.
- **FR-012**: The deterministic fallback MUST recognize common synonyms/abbreviations of job‑relevant terms to a reasonable degree, so it is genuinely useful rather than exact‑string only.
- **FR-013**: When no (or an empty/meaningless) job description is supplied, keyword coverage MUST be omitted (unchanged from current behavior).

#### Calibrated score (US4)

- **FR-014**: The overall ATS score MUST be calibrated against a labeled reference set of CVs (labeled by **expert human rating** as ATS‑friendly / ATS‑problematic), such that the ATS‑friendly group scores materially higher than the ATS‑problematic group. *(The spec does not claim calibration against live proprietary‑ATS outcomes — see Assumptions.)*
- **FR-015**: Calibration MUST preserve explainability — it tunes category weights/thresholds only; it MUST NOT introduce score adjustments that do not map to a named, user‑visible fault or strength.
- **FR-016**: The system MUST provide a repeatable way to re‑validate the score against the labeled reference set, reporting the separation between the labeled groups and the ranking correctness, so regressions are caught when the engine changes.
- **FR-017**: Score ordering MUST be correct on clear pairs — a clearly better‑structured CV MUST never score lower than a clearly worse one in the validation set.

#### Comprehensive vocabulary (US5)

- **FR-018**: Skill recognition MUST draw on a broad, maintained vocabulary spanning multiple industries (not a small fixed technology list), so skills in non‑technical CVs are recognized.
- **FR-019**: Action‑verb recognition MUST draw on a broad vocabulary rather than a short hardcoded list, so strong wording is recognized across fields.
- **FR-020**: The vocabularies MUST be maintainable/updatable without code changes to the scoring logic, so coverage can grow over time.
- **FR-021**: Broadening recognition MUST NOT suppress genuine weaknesses — a CV that truly lacks skills or action verbs MUST still be flagged.

#### Result detail & user controls (US6)

- **FR-025**: Each result MUST show the **point impact** of every issue and of every category (how much each cost the overall score), so the number is never unexplained.
- **FR-026**: Each issue MUST include a concrete **before → after example** illustrating the recommended fix. Examples MUST be illustrative/generic and MUST NOT fabricate claims about the user's actual CV content.
- **FR-027**: Each category MUST be expandable to the individual **sub‑checks** that determined its score, so the user can see what was actually evaluated.
- **FR-028**: The user MUST be able to select a **target role/industry** for the ATS Check; this tailors which skills, keywords, and checks are considered relevant and how they are weighted. It MUST be optional (a sensible default applies when unset).
- **FR-029**: The user MUST be able to choose the **result depth** — a concise summary versus the full detailed report — from the same underlying analysis.
- **FR-030**: The user MUST be able to **re‑analyze after editing** their CV and see the updated score; where feasible, the result SHOULD indicate what changed since the previous run.
- **FR-031**: All added detail MUST preserve the explainability and determinism guarantees — every displayed point still maps to a named cause, and the detail itself is produced deterministically (not dependent on the external AI).

#### Compatibility & non‑regression

- **FR-022**: All spec 003 guarantees MUST be preserved: deterministic structural scoring, graceful AI degradation, owner‑only access to results/CVs, no public share links, admin aggregate‑only, deletion removes files, and every deduction traceable to a named fault.
- **FR-023**: Results produced before this upgrade MUST remain viewable; the richer parsed view and calibrated score apply to new checks without breaking historical results.
- **FR-024**: The end‑to‑end ATS Check MUST stay within the current responsiveness expectations for a standard CV.

### Key Entities *(include if feature involves data)*

- **Uploaded CV**: The candidate's document, now either PDF or Word, subject to the same size/safety limits and owner‑only handling.
- **Parsed Résumé Record**: The structured extraction of a CV — contact block, ordered work‑experience entries (role, employer, start/end dates, confidence), education entries, and skills — plus per‑field extraction‑confidence and "could not extract" flags. Derived from the CV; private to the owner; produced without external AI.
- **ATS Result** (extended from spec 003): now additionally carries the Parsed Résumé Record, the source of keyword coverage (AI‑assisted vs deterministic), a calibrated overall score, the **point impact per issue and per category**, a **before→after example per issue**, the **sub‑checks under each category** (for drill‑down), and the **target role/industry** the analysis was run against. Existing fields (categories, issues, strengths, next steps, explanation) are retained.
- **Target Role/Industry**: An optional user‑selected context for the ATS Check that tailors which skills/keywords/checks are relevant and how they are weighted; a sensible default applies when unset.
- **Skill & Action‑Verb Vocabulary**: A maintained, multi‑industry reference list used for recognition, updatable independently of scoring logic.
- **Calibration Validation Set**: A collection of real CVs labeled by **expert human rating** (ATS‑friendly / ATS‑problematic), used to tune weights and to re‑validate the score. Ground truth is reviewer judgment, not live‑ATS results. Used for evaluation only; not exposed to end users; handled under the same privacy rules as any CV data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A `.docx` CV produces a complete ATS result equivalent in structure to the PDF path for at least 95% of valid, text‑based Word CVs.
- **SC-002**: For a standard CV, the result shows a parsed record containing contact details, at least the work‑experience and education entries present in the CV, and a skills list — and a user can identify from it what an ATS would read.
- **SC-003**: For a CV with a deliberately unparseable entry (missing dates / unreadable skills block), that specific gap is flagged and the parseability outcome is reduced with a named reason.
- **SC-004**: With the AI service disabled, an ATS Check with a job description still returns matched/missing keyword coverage 100% of the time on valid input.
- **SC-005**: On a held‑out set of CVs rated by expert reviewers, ATS‑friendly CVs score materially higher than ATS‑problematic CVs (a clear average gap and correct ranking on ≥90% of clear pairs). *(Ground truth is expert rating, not live‑ATS results.)*
- **SC-006**: Skills and action verbs are correctly recognized in CVs from at least four distinct non‑technical fields, with no field returning "no skills/verbs detected" when the CV genuinely contains them.
- **SC-007**: A genuinely weak CV (no metrics, no skills, poor structure) is still scored low and flagged — broadening recognition does not produce false "all good" results.
- **SC-008**: All spec 003 behaviors continue to pass their existing checks (zero regression in reliability, resilience, privacy, and explainability).
- **SC-009**: The calibrated score remains fully explainable: 100% of point deductions on any result map to a named issue or category shown to the user.
- **SC-010**: Re‑running the score validation after an engine change reports the group separation and ranking accuracy, so a regression below target is detectable before release.
- **SC-011**: 100% of issues in a result display a point impact and a before→after fix example, and every category can be expanded to its underlying sub‑checks.
- **SC-012**: Selecting a different target role/industry measurably changes which skills/keywords are treated as relevant (e.g. a nursing target surfaces clinical competencies, not software terms).
- **SC-013**: After a user fixes a flagged issue and re‑runs the check, the overall score increases (the change is reflected).
- **SC-014**: The depth toggle presents both a concise summary and a full detailed report derived from the same analysis, with no separate re‑run required.

## Assumptions

- **Builds on spec 003**: This upgrades the existing ATS Check (modes, result shape, resilience, privacy) rather than replacing it; the mode chooser and Job‑Match mode are unchanged.
- **Formats in scope**: PDF (existing) and modern Word `.docx`. Legacy `.doc`, `.rtf`, `.txt`, and image formats are **out of scope** for this iteration (rejected with a clear message).
- **Parsing depth**: The parser targets the fields a mainstream ATS extracts (contact, work‑experience entries with role/employer/dates, education, skills) and a confidence/gap flag per field — enough to show a faithful "what an ATS reads" view and to drive parseability. It is not a full semantic understanding of every bullet point.
- **Keyword fallback approach**: The deterministic fallback uses term/skill matching with synonym/abbreviation awareness (not exact‑string only). The AI‑assisted path remains the primary when available; the deterministic path guarantees availability.
- **Calibration ground truth** *(decided 2026‑07‑03)*: "Labeled" means **expert human rating** of CVs as ATS‑friendly / ATS‑problematic — the achievable, verifiable ground truth. The spec deliberately does **not** claim calibration against live proprietary‑ATS results, which a solo team cannot observe (claiming so would be circular). The approach is a **modest, expert‑rated validation set** (curated internally and/or from openly available résumé datasets) used to tune weights and re‑validate ordering — calibration‑by‑validation, not a trained ML model. Open‑source‑parser‑based labeling was considered and **deferred** to a possible future iteration (larger scope, still a proxy).
- **Vocabulary source**: Skills and action verbs come from a broad, maintained, multi‑industry vocabulary (curated and/or sourced from an open skills taxonomy), stored as data that can be updated without changing scoring logic.
- **Privacy**: The parsing layer, deterministic keyword fallback, and vocabulary matching all run without sending CV content to an external AI service; the only external‑AI use remains the optional AI‑assisted keyword coverage, and the labeled validation set is handled under the same privacy rules as any CV data.
- **No public sharing**: Results and the parsed record remain owner‑only downloads/views; no public or shareable URLs are introduced.
