"""
report_generator.py
-------------------
Builds a modern PDF report for a CV session using fpdf2.
Color palette matches the HireIQ app: primary blue + zinc neutrals.
"""

import re
from fpdf import FPDF
from datetime import datetime, timezone

# ── Color palette (app theme) ─────────────────────────────────────────────────
_P       = (37, 99, 235)     # primary blue-600
_P_LIGHT = (239, 246, 255)   # blue-50
_P_BDR   = (191, 219, 254)   # blue-200
_TEAL    = (13, 148, 136)    # teal-600 (accent, used for interview blocks)
_OK      = (22, 163, 74)     # green-600
_OK_BG   = (240, 253, 244)   # green-50
_WARN    = (217, 119, 6)     # amber-600
_WARN_BG = (255, 251, 235)   # amber-50
_ERR     = (220, 38, 38)     # red-600
_ERR_BG  = (254, 242, 242)   # red-50
_Z900    = (24, 24, 27)      # zinc-900
_Z700    = (63, 63, 70)      # zinc-700
_Z500    = (113, 113, 122)   # zinc-500
_Z400    = (161, 161, 170)   # zinc-400
_Z200    = (228, 228, 231)   # zinc-200
_Z100    = (244, 244, 245)   # zinc-100
_Z50     = (250, 250, 250)   # zinc-50
_WHITE   = (255, 255, 255)


def _s(text) -> str:
    """Safely encode text to latin-1 for Helvetica."""
    if not text:
        return ""
    return (
        str(text)
        .replace("—", "-").replace("–", "-")
        .replace("’", "'").replace("‘", "'")
        .replace("“", '"').replace("”", '"')
        .replace("•", "-").replace("…", "...")
        .encode("latin-1", errors="replace").decode("latin-1")
    )


class _Report(FPDF):

    # ── Page chrome ───────────────────────────────────────────────────────────

    def header(self):
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*_P)
        self.set_x(10)
        self.cell(22, 7, "HireIQ", ln=False)
        self.set_font("Helvetica", size=8)
        self.set_text_color(*_Z400)
        self.cell(0, 7, "CV Analysis Report", ln=True)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.25)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", size=7)
        self.set_text_color(*_Z400)
        self.cell(
            0, 5,
            f"HireIQ  ·  {datetime.now(timezone.utc).replace(tzinfo=None).strftime('%d %b %Y')}  ·  Page {self.page_no()}",
            align="C",
        )

    # ── Section header ────────────────────────────────────────────────────────

    def section(self, title: str, meta: str = ""):
        self.ln(5)
        y = self.get_y()
        # Left accent strip
        self.set_fill_color(*_P)
        self.rect(10, y, 3, 7, style="F")
        self.set_x(15)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*_Z900)
        self.cell(155, 7, _s(title), ln=False)
        if meta:
            self.set_font("Helvetica", size=8)
            self.set_text_color(*_Z400)
            self.cell(0, 7, _s(meta), align="R", ln=True)
        else:
            self.ln(7)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.2)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    # ── Match score block ─────────────────────────────────────────────────────

    def score_block(self, score: float, candidate_level: str | None = None):
        bx, by, bw, bh = 10, self.get_y(), 190, 26

        if score >= 70:
            score_col, bg_col, label = _OK,   _OK_BG,   "Strong Match"
            note = "The CV aligns well with the job requirements."
        elif score >= 40:
            score_col, bg_col, label = _WARN, _WARN_BG, "Moderate Match"
            note = "Some skill gaps exist but the candidate shows clear potential."
        else:
            score_col, bg_col, label = _ERR,  _ERR_BG,  "Needs Improvement"
            note = "Significant gaps exist between the CV and the job requirements."

        # Card shell
        self.set_fill_color(*_Z50)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.25)
        self.rect(bx, by, bw, bh, style="DF")

        # Colored score panel (left 32 mm)
        self.set_fill_color(*bg_col)
        self.rect(bx, by, 32, bh, style="F")
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(*score_col)
        self.set_xy(bx, by + 3)
        self.cell(32, 12, f"{score:.0f}%", align="C")
        self.set_font("Helvetica", size=7)
        self.set_text_color(*score_col)
        self.set_xy(bx, by + 15)
        self.cell(32, 5, "match score", align="C")

        # Right text
        rx = bx + 36
        self.set_xy(rx, by + 4)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*_Z900)
        self.cell(0, 7, _s(label))

        if candidate_level:
            lv = _s(candidate_level)
            lw = self.get_string_width(lv) + 8
            lx = 200 - lw - 2
            self.set_fill_color(*_P_LIGHT)
            self.set_draw_color(*_P_BDR)
            self.set_line_width(0.15)
            self.rect(lx, by + 3, lw, 7, style="DF")
            self.set_font("Helvetica", "B", 7)
            self.set_text_color(*_P)
            self.set_xy(lx, by + 3)
            self.cell(lw, 7, lv, align="C")

        self.set_xy(rx, by + 13)
        self.set_font("Helvetica", size=8)
        self.set_text_color(*_Z500)
        self.cell(0, 5, _s(note))

        self.set_y(by + bh + 5)

    # ── Skill inventory table ─────────────────────────────────────────────────

    def skill_table(self, skills: list[dict]):
        hard = [s for s in skills if s.get("category") != "soft"]
        soft = [s for s in skills if s.get("category") == "soft"]

        LEVEL = {
            "advanced":     (_OK,   _OK_BG,   "Advanced"),
            "intermediate": (_WARN, _WARN_BG, "Mid"),
            "beginner":     (_Z400, _Z100,    "Junior"),
        }
        col_w  = 91
        gap    = 8
        row_h  = 7
        left_x = 10
        right_x = left_x + col_w + gap

        # Column headers
        hy = self.get_y()
        self.set_fill_color(*_Z100)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.2)
        self.rect(left_x,  hy, col_w, 7, style="DF")
        self.rect(right_x, hy, col_w, 7, style="DF")
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*_Z500)
        self.set_xy(left_x + 3, hy)
        self.cell(col_w, 7, f"Technical / Hard Skills  ({len(hard)})")
        self.set_xy(right_x + 3, hy)
        self.cell(col_w, 7, f"Soft Skills  ({len(soft)})")
        self.ln(7)

        rows = max(len(hard), len(soft))
        for i in range(rows):
            ry = self.get_y()
            if ry + row_h > self.h - self.b_margin:
                self.add_page()
                ry = self.get_y()

            alt = _Z50 if i % 2 == 0 else _WHITE
            self.set_fill_color(*alt)
            self.set_draw_color(*_Z200)
            self.rect(left_x,  ry, col_w, row_h, style="DF")
            self.rect(right_x, ry, col_w, row_h, style="DF")

            for col_x, items in [(left_x, hard), (right_x, soft)]:
                if i >= len(items):
                    continue
                item = items[i]
                skill_name = _s(item.get("skill", ""))
                level_key  = (item.get("level") or "beginner").lower()
                txt_col, bg_col, badge = LEVEL.get(level_key, LEVEL["beginner"])

                # Bullet dot
                self.set_fill_color(*txt_col)
                self.rect(col_x + 3, ry + 2.5, 2.5, 2.5, style="F")

                # Skill name
                self.set_font("Helvetica", size=8)
                self.set_text_color(*_Z700)
                self.set_xy(col_x + 8, ry)
                self.cell(col_w - 35, row_h, skill_name[:28])

                # Level badge
                bw = 22
                bx = col_x + col_w - bw - 2
                self.set_fill_color(*bg_col)
                self.set_draw_color(*txt_col)
                self.set_line_width(0.15)
                self.rect(bx, ry + 1.5, bw, row_h - 3, style="DF")
                self.set_font("Helvetica", "B", 6)
                self.set_text_color(*txt_col)
                self.set_xy(bx, ry + 1.5)
                self.cell(bw, row_h - 3, badge.upper(), align="C")

            self.ln(row_h)
        self.ln(3)

    # ── Skill gap card ────────────────────────────────────────────────────────

    def gap_card(self, index: int, skill: str, importance: str, reason: str, resource: str):
        IMP = {
            "high":   (_ERR,  _ERR_BG,  "HIGH PRIORITY"),
            "medium": (_WARN, _WARN_BG, "MEDIUM"),
            "low":    (_Z400, _Z100,    "LOW"),
        }
        txt_col, bg_col, badge = IMP.get(importance.lower(), IMP["medium"])

        reason_lines = (len(reason) // 88 + 1) if reason else 0
        res_lines    = (len(resource) // 88 + 1) if resource else 0
        card_h = 9 + (reason_lines * 5 if reason else 0) + (res_lines * 5 + 5 if resource else 0) + 4

        y = self.get_y()
        if y + card_h > self.h - self.b_margin:
            self.add_page()
            y = self.get_y()

        # Card
        self.set_fill_color(*_Z50)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.25)
        self.rect(10, y, 190, card_h, style="DF")

        # Importance-colored left bar
        self.set_fill_color(*txt_col)
        self.rect(10, y, 3, card_h, style="F")

        # Index number
        self.set_xy(14, y + 2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*_Z400)
        self.cell(7, 5, str(index))

        # Skill name
        self.set_xy(22, y + 2)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*_Z900)
        self.cell(130, 5, _s(skill))

        # Badge (top-right)
        bw = self.get_string_width(badge) + 8
        bx = 200 - bw - 2
        self.set_fill_color(*bg_col)
        self.set_draw_color(*txt_col)
        self.set_line_width(0.15)
        self.rect(bx, y + 2, bw, 6, style="DF")
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*txt_col)
        self.set_xy(bx, y + 2)
        self.cell(bw, 6, badge, align="C")

        cur = y + 9
        if reason:
            self.set_xy(22, cur)
            self.set_font("Helvetica", size=9)
            self.set_text_color(*_Z700)
            self.multi_cell(172, 5, _s(reason))
            cur = self.get_y()

        if resource:
            self.set_xy(22, cur + 2)
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(*_P)
            self.cell(16, 5, "Learn:")
            self.set_font("Helvetica", size=8)
            self.set_text_color(*_Z500)
            self.multi_cell(155, 5, _s(resource))

        self.set_y(y + card_h + 3)

    # ── Interview question row ────────────────────────────────────────────────

    def question_row(self, index: int, text: str):
        row_h = max(1, len(text) // 82 + 1) * 5 + 5
        y = self.get_y()
        if y + row_h > self.h - self.b_margin:
            self.add_page()
            y = self.get_y()
        self.set_fill_color(*(_Z50 if index % 2 == 0 else _WHITE))
        self.set_draw_color(*_Z200)
        self.set_line_width(0.15)
        self.rect(10, y, 190, row_h, style="DF")
        # Number chip
        cw = 9
        self.set_fill_color(*_P_LIGHT)
        self.set_draw_color(*_P_BDR)
        self.rect(12, y + 1.5, cw, row_h - 3, style="DF")
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*_P)
        self.set_xy(12, y + 1.5)
        self.cell(cw, row_h - 3, str(index), align="C")
        # Text
        self.set_xy(24, y + 2)
        self.set_font("Helvetica", size=9)
        self.set_text_color(*_Z700)
        self.multi_cell(173, 5, _s(text))
        self.set_y(y + row_h + 1)

    # ── Mock interview result ─────────────────────────────────────────────────

    def interview_block(self, index: int, question: str, transcript: str | None,
                        clarity: float | None, relevance: float | None,
                        depth: float | None, eye_contact: float | None):
        q_lines = len(question) // 82 + 1
        t_lines = (len(transcript) // 82 + 1) if transcript else 0
        scores  = [v for v in [clarity, relevance, depth] if v is not None]
        card_h  = q_lines * 5 + (t_lines * 5 + 8 if transcript else 0) + len(scores) * 7 + (6 if eye_contact is not None else 0) + 10

        y = self.get_y()
        if y + card_h > self.h - self.b_margin:
            self.add_page()
            y = self.get_y()

        # Card
        self.set_fill_color(*_Z50)
        self.set_draw_color(*_Z200)
        self.set_line_width(0.25)
        self.rect(10, y, 190, card_h, style="DF")

        # Teal accent (interview colour)
        self.set_fill_color(*_TEAL)
        self.rect(10, y, 3, card_h, style="F")

        # Q label
        self.set_xy(14, y + 2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*_TEAL)
        self.cell(0, 5, f"Q{index}")

        # Question
        self.set_xy(22, y + 2)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*_Z900)
        self.multi_cell(174, 5, _s(question))
        cur = self.get_y() + 3

        # Transcript box
        if transcript:
            t_text = _s(f'"{transcript}"')
            t_h    = t_lines * 5 + 6
            self.set_fill_color(*_WHITE)
            self.set_draw_color(*_Z200)
            self.rect(14, cur, 182, t_h, style="DF")
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(*_Z500)
            self.set_xy(17, cur + 3)
            self.multi_cell(176, 5, t_text)
            cur = self.get_y() + 4

        # Score bars
        bar_w = 95
        for lbl, val in [("Clarity", clarity), ("Relevance", relevance), ("Depth", depth)]:
            if val is None:
                continue
            self.set_xy(14, cur)
            self.set_font("Helvetica", size=8)
            self.set_text_color(*_Z500)
            self.cell(30, 6, lbl)
            bx = 14 + 30
            by = cur + 1.5
            filled = int((val / 10) * bar_w)
            self.set_fill_color(*_Z200)
            self.rect(bx, by, bar_w, 3, style="F")
            sc = _OK if val >= 7 else _WARN if val >= 4 else _ERR
            self.set_fill_color(*sc)
            if filled > 0:
                self.rect(bx, by, filled, 3, style="F")
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(*sc)
            self.set_xy(bx + bar_w + 3, cur)
            self.cell(20, 6, f"{val:.1f}/10")
            cur += 7

        if eye_contact is not None:
            ec_pct = int(eye_contact * 100)
            ec_col = _OK if ec_pct >= 60 else _WARN if ec_pct >= 30 else _ERR
            self.set_xy(14, cur)
            self.set_font("Helvetica", size=8)
            self.set_text_color(*_Z500)
            self.cell(30, 6, "Eye contact")
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(*ec_col)
            self.cell(0, 6, f"{ec_pct}%", ln=True)

        self.set_y(y + card_h + 4)


# ── ATS report (spec 003 US5) ──────────────────────────────────────────────────

def _render_ats(pdf: "_Report", ats: dict) -> None:
    score = float(ats.get("overall_score", 0) or 0)
    sc = _OK if score >= 70 else _WARN if score >= 40 else _ERR

    pdf.section("ATS Compatibility", f"Score {score:.0f} / 100")

    exp = ats.get("score_explanation")
    if exp:
        pdf.set_x(10)
        pdf.set_font("Helvetica", size=9)
        pdf.set_text_color(*_Z700)
        pdf.multi_cell(190, 5, _s(exp))
        pdf.ln(2)

    cats = ats.get("categories", [])
    if cats:
        pdf.set_x(10); pdf.set_font("Helvetica", "B", 9); pdf.set_text_color(*_Z900)
        pdf.cell(0, 6, "Category breakdown", ln=True)
        for c in cats:
            cscore = round(float(c.get("score", 0) or 0) * 100)
            pdf.set_x(12); pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_Z700)
            pdf.cell(120, 5, _s(c.get("label") or c.get("key", "")))
            pdf.set_text_color(*(_OK if cscore >= 80 else _WARN if cscore >= 50 else _ERR))
            pdf.cell(0, 5, f"{cscore}%", ln=True)
        pdf.ln(2)

    strengths = ats.get("strengths", [])
    if strengths:
        pdf.set_x(10); pdf.set_font("Helvetica", "B", 9); pdf.set_text_color(*_OK)
        pdf.cell(0, 6, "Strengths", ln=True)
        pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_Z700)
        for s in strengths:
            pdf.set_x(12); pdf.multi_cell(186, 5, _s("- " + (s.get("message") or "")))
        pdf.ln(2)

    steps = ats.get("next_steps", [])
    if steps:
        pdf.set_x(10); pdf.set_font("Helvetica", "B", 9); pdf.set_text_color(*_P)
        pdf.cell(0, 6, "What to do next", ln=True)
        pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_Z700)
        for i, st in enumerate(steps, 1):
            pdf.set_x(12); pdf.multi_cell(186, 5, _s(f"{i}. {st}"))
        pdf.ln(2)

    issues = ats.get("issues", [])
    if issues:
        pdf.section("Issues & Recommendations", f"{len(issues)} found")
        for it in issues:
            sev = (it.get("severity") or "").lower()
            col = _ERR if sev == "high" else _WARN if sev == "medium" else _Z400
            pdf.set_x(12); pdf.set_font("Helvetica", "B", 8); pdf.set_text_color(*col)
            pdf.multi_cell(186, 5, _s(f"[{sev.upper()}] {it.get('message', '')}"))
            pdf.set_x(14); pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_Z500)
            pdf.multi_cell(184, 5, _s("Fix: " + (it.get("recommendation") or "")))
            pdf.ln(1)

    kc = ats.get("keyword_coverage")
    if kc and kc.get("available"):
        pdf.section("Keyword Coverage")
        pdf.set_x(10); pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_OK)
        pdf.multi_cell(190, 5, _s("Matched: " + ", ".join(kc.get("matched", []) or ["-"])))
        pdf.set_x(10); pdf.set_text_color(*_ERR)
        pdf.multi_cell(190, 5, _s("Missing: " + ", ".join(kc.get("missing", []) or ["-"])))


def generate_ats_report(
    cv_filename: str,
    original_cv_filename: str | None,
    ats_result: dict,
) -> bytes:
    """Owner-only ATS compatibility PDF (no public/shareable URL — FR-022)."""
    pdf = _Report()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    cv_name = original_cv_filename or ""
    if not cv_name or re.match(r'^[0-9a-f\-]{36}\.pdf$', cv_name, re.IGNORECASE):
        cv_name = "Uploaded CV"

    pdf.set_fill_color(*_P)
    pdf.rect(10, pdf.get_y(), 190, 1.5, style="F")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 14); pdf.set_text_color(*_Z900); pdf.set_x(10)
    pdf.cell(0, 9, "ATS Compatibility Report", ln=True)
    pdf.set_font("Helvetica", size=8); pdf.set_text_color(*_Z400); pdf.set_x(10)
    pdf.cell(0, 5, _s(f"CV: {cv_name[:50]}   ·   Generated: {datetime.now(timezone.utc).replace(tzinfo=None).strftime('%d %b %Y')}"), ln=True)
    pdf.ln(3)

    _render_ats(pdf, ats_result or {})
    return bytes(pdf.output())


# ── Public API ────────────────────────────────────────────────────────────────

def generate_report(
    cv_filename: str,
    original_cv_filename: str | None,
    jd_snippet: str | None,
    match_score: float,
    candidate_level: str | None,
    skill_inventory: list[dict],
    gap_report: list[dict],
    ai_interview_questions: list[str],
    interview_results: list[dict],
) -> bytes:
    pdf = _Report()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Session header ─────────────────────────────────────────────────────────
    role = (jd_snippet or "").strip()
    cv_name = original_cv_filename or ""
    if not cv_name or re.match(r'^[0-9a-f\-]{36}\.pdf$', cv_name, re.IGNORECASE):
        cv_name = "Uploaded CV"

    # Thin blue top rule
    pdf.set_fill_color(*_P)
    pdf.rect(10, pdf.get_y(), 190, 1.5, style="F")
    pdf.ln(4)

    if role:
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*_Z900)
        pdf.set_x(10)
        pdf.cell(0, 9, _s(role[:72]), ln=True)

    pdf.set_font("Helvetica", size=8)
    pdf.set_text_color(*_Z400)
    pdf.set_x(10)
    meta = f"CV: {_s(cv_name[:50])}   ·   Generated: {datetime.now(timezone.utc).replace(tzinfo=None).strftime('%d %b %Y')}"
    pdf.cell(0, 5, meta, ln=True)
    pdf.ln(5)

    # ── Match score ───────────────────────────────────────────────────────────
    pdf.score_block(match_score, candidate_level)

    # ── Skill inventory ───────────────────────────────────────────────────────
    if skill_inventory:
        hard = [s for s in skill_inventory if s.get("category") != "soft"]
        soft = [s for s in skill_inventory if s.get("category") == "soft"]
        pdf.section("Skill Inventory", f"{len(hard)} technical  ·  {len(soft)} soft")
        pdf.skill_table(skill_inventory)

    # ── Skill gap analysis ────────────────────────────────────────────────────
    if gap_report:
        pdf.section("Skill Gap Analysis", f"{len(gap_report)} gaps identified")
        for i, gap in enumerate(gap_report, 1):
            pdf.gap_card(
                index=i,
                skill=gap.get("skill", ""),
                importance=gap.get("importance", "medium"),
                reason=gap.get("reason", ""),
                resource=gap.get("resource", ""),
            )

    # ── AI interview questions ────────────────────────────────────────────────
    if ai_interview_questions:
        pdf.section("Interview Questions", f"{len(ai_interview_questions)} recommended")
        for i, q in enumerate(ai_interview_questions, 1):
            pdf.question_row(i, q)
        pdf.ln(2)

    # ── Mock interview results ────────────────────────────────────────────────
    if interview_results:
        pdf.section("Mock Interview Results", f"{len(interview_results)} recorded")
        for i, r in enumerate(interview_results, 1):
            pdf.interview_block(
                index=i,
                question=r.get("question", ""),
                transcript=r.get("transcript"),
                clarity=r.get("clarity_score"),
                relevance=r.get("relevance_score"),
                depth=r.get("depth_score"),
                eye_contact=r.get("eye_contact_ratio"),
            )

    # Empty-state notice
    if not skill_inventory and not gap_report and not ai_interview_questions and not interview_results:
        pdf.ln(10)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*_Z400)
        pdf.cell(0, 6, "Run a CV analysis to populate skill gaps, questions, and more.", align="C", ln=True)

    return bytes(pdf.output())


def generate_recruiter_report(recruiter_list, candidates: list) -> bytes:
    """Ranked candidate table for recruiters — same blue/zinc theme."""
    pdf = _Report()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Session info
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*_Z900)
    pdf.set_x(10)
    pdf.cell(0, 8, _s(recruiter_list.name[:70]), ln=True)
    pdf.set_font("Helvetica", size=8)
    pdf.set_text_color(*_Z400)
    pdf.set_x(10)
    meta_parts = []
    if recruiter_list.job_title:
        meta_parts.append(f"Position: {recruiter_list.job_title}")
    meta_parts.append(f"Generated: {datetime.now(timezone.utc).replace(tzinfo=None).strftime('%d %b %Y')}")
    pdf.cell(0, 5, _s("   ·   ".join(meta_parts)), ln=True)
    pdf.ln(4)

    if not candidates:
        pdf.section("Candidates")
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*_Z400)
        pdf.cell(0, 8, "No candidates in this pipeline yet.", ln=True)
        return bytes(pdf.output())

    pdf.section("Candidate Rankings", f"{len(candidates)} total")

    # Table header
    CW = [14, 65, 24, 28, 59]  # Rank, Name, Score, Level/Status, Skills

    pdf.set_fill_color(*_P_LIGHT)
    pdf.set_draw_color(*_P_BDR)
    pdf.set_line_width(0.2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*_P)
    for i, (label, w) in enumerate(zip(["#", "Candidate", "Score", "Status", "Top Skills"], CW)):
        ln = True if i == len(CW) - 1 else False
        pdf.cell(w, 7, label, border=1, fill=True, align="C" if i in (0, 2) else "L", ln=ln)

    for idx, c in enumerate(candidates, 1):
        rank_label = str(c.rank) if c.rank is not None else str(idx)

        # Name
        if c.candidate_name:
            name = _s(c.candidate_name[:30])
        elif c.session and (c.session.original_cv_filename or c.session.cv_filename):
            raw = c.session.original_cv_filename or c.session.cv_filename
            name = _s(re.sub(r'\.pdf$', '', raw, flags=re.IGNORECASE)[:30])
        else:
            name = "-"

        # Score
        score = c.session.match_score if c.session else None
        score_str = f"{score:.0f}%" if score is not None else "-"
        sv = score or 0
        sc = _OK if sv >= 70 else _WARN if sv >= 40 else _ERR

        # Status
        status = _s((c.status or "-").replace("_", " ").title()[:20])

        # Top skills
        skills_str = "-"
        inv = c.session.skill_inventory if c.session else None
        if inv:
            try:
                import json as _json
                items = _json.loads(inv) if isinstance(inv, str) else inv
                hard = [it.get("skill", "") for it in items if it.get("category") != "soft"]
                skills_str = _s(", ".join(hard[:3])) if hard else "-"
            except Exception:
                pass

        bg = _Z50 if idx % 2 == 0 else _WHITE
        pdf.set_fill_color(*bg)
        pdf.set_draw_color(*_Z200)
        pdf.set_line_width(0.15)

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*_P)
        pdf.cell(CW[0], 6, rank_label, border=1, fill=True, align="C")

        pdf.set_text_color(*_Z700)
        pdf.set_font("Helvetica", size=8)
        pdf.cell(CW[1], 6, name, border=1, fill=True)

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*sc)
        pdf.cell(CW[2], 6, score_str, border=1, fill=True, align="C")

        pdf.set_font("Helvetica", size=8)
        pdf.set_text_color(*_Z500)
        pdf.cell(CW[3], 6, status, border=1, fill=True)
        pdf.cell(CW[4], 6, skills_str, border=1, fill=True, ln=True)

    # Summary row
    avg = sum(
        (c.session.match_score or 0) for c in candidates if c.session and c.session.match_score
    ) / max(len([c for c in candidates if c.session and c.session.match_score]), 1)

    pdf.ln(3)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*_Z400)
    pdf.set_x(10)
    pdf.cell(0, 5, f"Average match score: {avg:.1f}%   ·   {len(candidates)} candidates evaluated", ln=True)

    return bytes(pdf.output())
