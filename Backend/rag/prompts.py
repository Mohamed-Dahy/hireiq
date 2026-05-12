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

STRUCTURED_ANALYSIS_TEMPLATE = """You are an expert technical recruiter and career coach.
Analyze the CV and job description below and return ONLY a JSON object — no explanation, no markdown fences.

Required JSON schema:
{{
  "skill_inventory": [
    {{"skill": "string", "category": "hard|soft", "level": "beginner|intermediate|advanced"}}
  ],
  "gap_report": [
    {{"skill": "string", "importance": "high|medium|low", "reason": "string", "resource": "string"}}
  ],
  "study_roadmap": [
    {{"topic": "string", "priority": "high|medium|low", "estimated_hours": integer, "resources": ["string"]}}
  ],
  "questions": [
    {{"question": "string", "model_answer": "string"}}
  ]
}}

Rules:
- skill_inventory: ALL skills found in CV (hard + soft), max 15 items
- gap_report: TOP 5 skills required by JD but missing/weak in CV, ranked high → low
- study_roadmap: 5 learning topics to close the gaps, ordered by priority
- questions: 5 interview questions the interviewer will ask, with concise model answers

CV:
{cv_text}

Job Description:
{jd_text}

Return ONLY the JSON object:"""

structured_analysis_prompt = PromptTemplate(
    input_variables=["cv_text", "jd_text"],
    template=STRUCTURED_ANALYSIS_TEMPLATE,
)

SKILL_GAP_TEMPLATE = """
You are an expert technical recruiter and career coach.

You are given a candidate's CV and a job description.

CV:
{cv_text}

Job Description:
{jd_text}

Your task:
1. List the TOP 5 skills or qualifications required by the job that are MISSING or WEAK in the CV.
   - Rank them from most important to least important.
   - For each missing skill, suggest one specific and practical way the candidate can learn it.

2. Generate 5 tailored interview questions the interviewer is likely to ask this specific candidate,
   based on the gaps you identified and the role requirements.

Format your response EXACTLY like this:

## Skill Gaps

1. **[Skill Name]** — [Why it matters for this role]
   - How to learn: [Specific suggestion]

2. **[Skill Name]** — [Why it matters for this role]
   - How to learn: [Specific suggestion]

(continue for all 5)

## Interview Questions

1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
"""

skill_gap_prompt = PromptTemplate(
    input_variables=["cv_text", "jd_text"],
    template=SKILL_GAP_TEMPLATE,
)
