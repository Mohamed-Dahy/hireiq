"""
prompts.py
----------
All LangChain prompt templates live here — never inline them in service files.
"""

from langchain_core.prompts import PromptTemplate

# ---------------------------------------------------------------------------
# Structured analysis — returns a strict JSON object (used by analyze_structured)
# Double-braces {{ }} escape literal braces inside PromptTemplate.
# ---------------------------------------------------------------------------

STRUCTURED_ANALYSIS_TEMPLATE = """You are a senior technical recruiter with 15+ years placing engineers at FAANG and top-tier startups.

Analyze the CV and job description below.

STEP 1 — CALIBRATE SENIORITY (do this mentally before generating output):
Assess the candidate's actual seniority from: years of experience, complexity of past projects,
scope of responsibilities, leadership indicators, and depth of technical skills.
Assign one of: Junior (0-2 yrs / student), Mid-Level (2-5 yrs), Senior (5-10 yrs), Staff/Principal (10+ yrs / broad impact).

STEP 2 — Generate the JSON below. Every decision must respect the seniority level you assessed.
- skill_inventory: accurately reflect each skill's TRUE level — do not downgrade advanced skills to "intermediate"
- gap_report: only flag skills genuinely missing or below the JD bar; if a candidate is already strong in a skill, do NOT list it as a gap
- gap_report resources: must be level-appropriate — never suggest beginner tutorials to a Senior/Staff candidate; suggest advanced books, conference talks, open-source contribution guides, or architecture papers
- questions: match the seniority level. For Junior → fundamentals + situational. For Mid → design decisions + debugging scenarios. For Senior/Staff → system design, tradeoffs, cross-team impact, technical leadership.

Return ONLY a JSON object — no explanation, no markdown fences.

Required JSON schema:
{{
  "candidate_level": "Junior|Mid-Level|Senior|Staff/Principal",
  "skill_inventory": [
    {{"skill": "string", "category": "hard|soft", "level": "beginner|intermediate|advanced"}}
  ],
  "gap_report": [
    {{"skill": "string", "importance": "high|medium|low", "reason": "string", "resource": "string"}}
  ],
  "questions": [
    {{"question": "string", "model_answer": "string"}}
  ]
}}

Rules:
- skill_inventory: ALL skills found in CV (hard + soft), max 15 items; be generous with "advanced" for experienced candidates
- gap_report: TOP 5 skills required by JD but GENUINELY missing/below-bar in CV, ranked high → low; if fewer than 5 real gaps exist, return fewer — never pad with skills the candidate already has
- questions: 5 interview questions calibrated to the candidate_level you assessed, with concise model answers that reflect that level's expectations
- For Senior/Staff candidates: questions MUST include at least 2 system design or architectural tradeoff questions

CV:
{cv_text}

Job Description:
{jd_text}

Return ONLY the JSON object:"""

structured_analysis_prompt = PromptTemplate(
    input_variables=["cv_text", "jd_text"],
    template=STRUCTURED_ANALYSIS_TEMPLATE,
)

# ---------------------------------------------------------------------------
# Narrative skill gap analysis — streamed SSE text (used by analyze_cv_stream)
# ---------------------------------------------------------------------------

SKILL_GAP_TEMPLATE = """
You are a senior technical recruiter and career coach with 15+ years placing engineers at top companies.

CV:
{cv_text}

Job Description:
{jd_text}

STEP 1 — ASSESS THE CANDIDATE'S SENIORITY LEVEL before writing anything:
Look at years of experience, project complexity, team size, technologies depth, leadership indicators.
Silently assign: Junior (0-2 yrs), Mid-Level (2-5 yrs), Senior (5-10 yrs), or Staff/Principal (10+ yrs).
Every suggestion you make MUST respect this level.

ANTI-PATTERNS — you MUST NEVER do these:
- Do NOT suggest "Create a GitHub profile" — experienced developers already have one
- Do NOT suggest "learn the basics of X" to someone who listed X in their CV
- Do NOT recommend beginner courses (e.g. "Introduction to Python") to Mid/Senior/Staff candidates
- Do NOT suggest tutorial-level resources when advanced skills are already demonstrated
- Do NOT treat every gap as a zero-knowledge gap — if the candidate is close, say so and suggest what bridges the gap at their level

Your task:
1. List the TOP gaps between this specific candidate and this specific role.
   - Only list skills GENUINELY missing or below the required bar — not skills they already have
   - Rank by business impact to this role (most critical first)
   - For each gap: explain WHY it matters for this role at their seniority level
   - For each gap: suggest a LEVEL-APPROPRIATE learning path:
     * Junior → structured course or tutorial is fine
     * Mid-Level → project-based learning, intermediate books, open-source contribution
     * Senior → architecture case studies, advanced books (e.g. Designing Data-Intensive Applications), conference talks, writing/presenting on the topic
     * Staff/Principal → leading an implementation, publishing, contributing to the standard

2. Generate 5 tailored interview questions that an interviewer at this level WILL ask,
   based on actual gaps and role requirements — not generic questions any candidate would face.

Format EXACTLY like this:

## Skill Gap Analysis

**Candidate Level Assessed:** [Junior/Mid-Level/Senior/Staff/Principal]

### Gaps

1. **[Skill Name]** — [Why it matters at this level for this role]
   - Bridge: [Level-appropriate, specific learning path]

2. **[Skill Name]** — [Why it matters]
   - Bridge: [Specific suggestion]

(continue for all real gaps, maximum 5)

### Interview Questions

1. [Level-calibrated question]
2. [Level-calibrated question]
3. [Level-calibrated question]
4. [Level-calibrated question]
5. [Level-calibrated question]
"""

skill_gap_prompt = PromptTemplate(
    input_variables=["cv_text", "jd_text"],
    template=SKILL_GAP_TEMPLATE,
)


# ---------------------------------------------------------------------------
# Career Roadmap — structured JSON (used by roadmap_service)
# ---------------------------------------------------------------------------

CAREER_ROADMAP_TEMPLATE = """You are a senior career coach and curriculum designer who has coached engineers from mid-level to FAANG Staff.

A candidate wants to become: {target_role}

Their current skills (with proficiency levels):
{current_skills}

Their job description context (the role/environment they are currently in):
{jd_text}

Identified skill gaps (from CV analysis):
{gap_summary}

STEP 1 — ASSESS THE CANDIDATE'S CURRENT LEVEL:
Read the skills list carefully. If a candidate has "Python (hard, advanced)" and "FastAPI (hard, advanced)",
they are NOT a beginner — do not treat them as one. Build the roadmap from their ACTUAL current position.

CRITICAL ANTI-PATTERNS — you MUST NEVER include these in the output:
- Do NOT suggest "Create a GitHub profile" — assume they already have one
- Do NOT suggest "contribute to open source for the first time" as a basic step for experienced devs
- Do NOT suggest "write a blog post" as a quick win unless the role specifically requires it
- Do NOT suggest "join a coding challenge on HackerRank/LeetCode" as a phase action for experienced devs
- Do NOT start a phase with beginner foundations (e.g. "Learn what an API is") for intermediate/advanced candidates
- Do NOT recommend beginner-level courses to Mid/Senior candidates
- Do NOT pad phases with skills the candidate already has at the required level
- quick_wins MUST address the actual gap_summary above — not generic career advice

PHASE RULES:
- Start phases from the candidate's ACTUAL current skill level — skip everything they already know
- For Senior/Staff candidates: phases focus on architectural depth, advanced specialization, leadership topics
- Each phase must directly build toward {target_role} requirements currently missing from the candidate's profile
- Project suggestions must be non-trivial for the candidate's level (no "build a To-Do app" for a Senior dev)

RESOURCE RULES — CRITICAL — read carefully:
- You MUST use ONLY resources from the AVAILABLE RESOURCES list below
- Copy the name, url, type, is_free, and estimated_hours EXACTLY as listed — do not modify them
- Do NOT invent, guess, or create any resource not in the list below
- Do NOT use official documentation pages as resources (they are references, not courses)
- Each phase MUST have 3-5 resources chosen from the AVAILABLE RESOURCES list
- If the list does not have enough resources for a skill, choose the closest related ones from the list

AVAILABLE RESOURCES (use ONLY these, copy URLs exactly):
{available_resources}

Required JSON schema:
{{
  "phases": [
    {{
      "name": "string — specific phase name reflecting actual content, e.g. 'Advanced MLOps: CI/CD Pipelines & Model Versioning'",
      "estimated_weeks": integer,
      "skills_covered": ["skill1", "skill2"],
      "resources": [
        {{
          "name": "string — exact name from AVAILABLE RESOURCES",
          "url": "string — exact URL from AVAILABLE RESOURCES",
          "type": "course|book|video|project|tool",
          "is_free": boolean,
          "estimated_hours": integer
        }}
      ],
      "project_to_build": "string — non-trivial, level-appropriate project with concrete specs",
      "milestone": "string — what the candidate can demonstrate/prove after this phase"
    }}
  ],
  "career_insight": {{
    "salary_range_local": "string in EGP e.g. '45,000-80,000 EGP/month'",
    "salary_range_remote": "string in USD e.g. '$5,000-$10,000/month USD (remote)'",
    "top_companies": ["Company A", "Company B", "Company C", "Company D", "Company E"],
    "hot_skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "market_demand": "high|medium|low"
  }},
  "quick_wins": [
    {{
      "action": "string — specific action directly addressing one of the identified gaps above",
      "why": "string — direct connection to the {target_role} requirements",
      "time_required": "string e.g. '3-4 hours' or '1 weekend'"
    }}
  ]
}}

Rules:
- Generate 3-5 phases covering ONLY what is missing from the candidate's profile
- Total estimated_weeks: 8-20 weeks for Senior+ candidates, 16-30 weeks for Junior/Mid
- Each phase: 3-5 resources from the available list, 1 non-trivial project, 1 measurable milestone
- quick_wins: exactly 3 actions, each tied to a specific gap from gap_summary, completable in 1-2 weeks
- career_insight: exactly 5 top_companies and 5 hot_skills for this role in 2025-2026 market
- Salary ranges: realistic for Egyptian market + international remote work

Target role: {target_role}

Return ONLY the JSON object:"""

career_roadmap_prompt = PromptTemplate(
    input_variables=["target_role", "current_skills", "jd_text", "gap_summary", "available_resources"],
    template=CAREER_ROADMAP_TEMPLATE,
)
