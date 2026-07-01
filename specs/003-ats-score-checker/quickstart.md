# Quickstart: ATS Score Checker

**Feature**: `003-ats-score-checker` | **Date**: 2026-07-01

How to run, exercise, and verify the ATS Score Checker locally. Assumes the existing Docker-first setup (Constitution III).

---

## 1. Bring up the stack

```bash
cp .env.example .env            # if not already present; fill GROQ_API_KEY, JWT_SECRET
docker-compose up --build
```

Apply the new migration (runs inside the backend container):

```bash
docker-compose exec backend alembic upgrade head   # applies 019_ats_check
```

Verify health: `GET http://localhost:8000/health` → `200`.

---

## 2. Try the new flow in the UI

1. Sign in, click **Analyze CV** in the nav.
2. In the mode chooser (new subsections), pick **ATS Check**.
3. Upload a PDF CV (or "Use this CV" if you have a stored one); **leave the job description empty**.
4. Run it → you should see an **overall ATS score (0–100)**, a category breakdown, and a prioritized list of issues each with a fix.
5. Repeat with a job description pasted in → an additional **keyword coverage** section (matched / missing terms) appears.
6. Switch to **Job Match Analysis** → the existing match-score + skill-gap stream works exactly as before.

---

## 3. API smoke test (no UI)

```bash
TOKEN=...   # a valid access JWT

# ATS check, no JD
curl -s -X POST http://localhost:8000/cv/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "cv_file=@sample_cv.pdf" \
  -F "analysis_mode=ats_check"
# → { session_id, analysis_mode:"ats_check", ats_score: <0-100>, match_score:null, ... }

# Fetch the stored ATS result
curl -s http://localhost:8000/cv/<session_id>/ats -H "Authorization: Bearer $TOKEN"

# ATS check WITH a JD (adds keyword coverage)
curl -s -X POST http://localhost:8000/cv/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "cv_file=@sample_cv.pdf" -F "analysis_mode=ats_check" \
  -F "jd_text=Senior Python engineer, FastAPI, PostgreSQL, Docker..."
```

---

## 4. Acceptance verification checklist

| Spec ref | Check |
|----------|-------|
| US1 / FR-007/008 | ATS check with **no JD** returns a 0–100 score + issues + recommendations |
| US2 / FR-001–004 | Mode chooser shown; switching modes updates required inputs; CV not lost on switch |
| US3 / FR-017–019 | With a JD: keyword coverage (matched/missing) appears; with no JD it is absent |
| US4 / FR-023/024 | Job Match Analysis unchanged; pre-existing sessions still viewable |
| FR-010a / FR-012a | CV with "My Journey" heading + decorative glyphs ⇒ both flagged (SC-012) |
| FR-009 | Image-only/scanned PDF ⇒ low score, parseability flagged (SC-003) |
| FR-027/028 | With Groq key removed/blocked: ATS structural score still returns; keyword/suggestions marked unavailable; not charged |
| FR-025/026 (R5) | Free user, limit=2: 2 checks succeed, 3rd → 429; invalid/degraded attempt does not consume a slot |
| FR-029 | Requesting another user's `/cv/{id}/ats` ⇒ 403 |
| FR-031 / leakage | `DELETE /cv/{id}` removes the PDF from `uploads/`; deleting stored CV removes derived sessions |
| FR-022 | Report is an authenticated attachment download; no public/shareable URL exists |
| FR-030 | Admin endpoints expose only aggregates — no CV content / individual ATS results |
| US5 / SC-013 | A strong CV and a weak CV (missing sections, no metrics, decorative) score ≥ 25 points apart; strong CV is not auto-100 |
| US5 / SC-015 | Every ATS result shows a **Strengths** list, a **"What to do next"** summary, and a plain-language **score explanation** — even at a high score (ATS-ready state) |
| US5 / SC-016 | A CV with only calendar years (no metrics) and no phone is flagged for both (quantified + contact), not silently passed |
| US5 / FR-035 | A multi-column / table-based CV is actually flagged by the formatting category |
| US5 real-CV | Run the **recalibrated** engine on the user's actual uploads (e.g. `Backend/uploads/Mohamed Dahy CV.pdf`) and read the result: either it surfaces real faults (proves recalibration works) or it stays high — in which case the **strengths + next-steps + explanation** must make that high score informative (enrichment is the fix). Every deduction must map to a named fault (SC-014). |

---

## 5. Tests

```bash
docker-compose exec backend pytest tests/unit/test_ats_checker.py            # deterministic engine
docker-compose exec backend pytest tests/integration/test_ats_check.py       # endpoints, quota, ownership, deletion
cd frontend && npm run test                                                  # mode chooser + ATS result view
cd frontend && npx tsc --noEmit                                              # strict type check (Constitution I)
```

Key unit cases (no I/O): scoring math, section/heading detection, contact regex, action-verb & quantified-achievement detection, no-JD path omits keyword_coverage. Key integration cases: quota boundary (R5), owner-only `/ats` (403), delete removes file, stored-CV cascade, AI-degraded run not charged.
