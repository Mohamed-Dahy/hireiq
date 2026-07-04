# Quickstart: ATS-Grade Engine Upgrade

**Feature**: `004-ats-grade-engine` | **Date**: 2026-07-03

How to run and verify the ATS-grade upgrade. Builds on the existing Docker-first setup; **no DB migration** (new data lives in `ats_result` JSON + data files).

---

## 1. Bring up the stack

```bash
# python-docx is a NEW dependency — rebuild the backend image
docker-compose up --build
```

No migration to run (head stays `019`). Confirm health: `GET /health` → 200.

---

## 2. Try it in the UI

1. Sign in → **Analyze CV** → **ATS Check**.
2. Upload a **`.docx`** CV (previously PDF-only) → confirm a full result appears.
3. (Optional) pick a **target role/industry** → confirm the relevant skills/keywords shift to that field.
4. In the result: expand a **category** to see its sub-checks; each issue shows a **point impact** and a **before → after** example; open the **"What an ATS reads"** panel (parsed record) and note any "could not extract" warnings.
5. Toggle **quick ↔ detailed** depth.
6. Fix a flagged issue in your CV, re-upload → confirm the score moves and **"what changed"** is shown.

---

## 3. API smoke test

```bash
TOKEN=...
# .docx, ATS check, with a target role
curl -s -X POST http://localhost:8000/cv/upload -H "Authorization: Bearer $TOKEN" \
  -F "cv_file=@sample_cv.docx" -F "analysis_mode=ats_check" -F "target_role=Registered Nurse"
# → { session_id, analysis_mode:"ats_check", ats_score }

curl -s http://localhost:8000/cv/<session_id>/ats -H "Authorization: Bearer $TOKEN"
# → includes parsed_record, categories[].point_impact/sub_checks, issues[].example, target_role
```

---

## 4. Run the score-validation harness (US4)

```bash
docker-compose exec backend python scripts/validate_ats_scoring.py
# prints group separation + pairwise ranking accuracy; exits non-zero if below SC-005 targets
```

---

## 5. Acceptance verification checklist

| Spec ref | Check |
|----------|-------|
| US1 / SC-001 | A valid `.docx` CV produces a complete result equivalent to the PDF path; unsupported/corrupt files rejected with a clear message, no quota spent |
| US2 / SC-002/003 | Result shows a parsed record (contact, experience, education, skills); a deliberately unparseable entry is flagged and lowers parseability with a named reason |
| US3 / SC-004 | With the AI disabled, ATS+JD still returns matched/missing keywords (`source:"deterministic"`) |
| US4 / SC-005 | Harness: expert-rated friendly CVs score materially higher than problematic ones; ranking correct on ≥90% of clear pairs |
| US5 / SC-006/007 | Non-technical CVs (nursing/finance/marketing/trades) get real skills/verbs recognized; a genuinely weak CV is still flagged low |
| US6 / SC-011 | Every issue shows point impact + before→after example; every category expands to sub-checks |
| US6 / SC-012 | Changing target role/industry changes which skills/keywords are considered relevant |
| US6 / SC-013/014 | Re-running after a fix raises the score; depth toggle shows summary vs full from one analysis |
| FR-022/SC-008 | All spec-003 behaviors still pass (determinism, resilience, owner-only, no leakage, explainability) |
| FR-031/SC-009 | Every displayed point of deduction maps to a named issue/category (impacts reconcile with the score) |

---

## 6. Tests

```bash
docker-compose exec backend pytest tests/unit/test_resume_parser.py tests/unit/test_ats_vocab.py \
  tests/unit/test_document_loader.py tests/unit/test_ats_checker.py tests/unit/test_ats_keywords.py
docker-compose exec backend pytest tests/integration/test_ats_check.py   # docx upload, target_role, richer payload, deterministic keyword path
cd frontend && npx tsc --noEmit && npm run test
```
