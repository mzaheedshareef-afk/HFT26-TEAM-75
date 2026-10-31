import json
from typing import Any, Dict, List, Optional

from backend.app.validation.dsa_whitelist import extract_claimed_dsa_topics


def build_assessment_prompts(
    portfolio_data: Dict[str, Any],
    target_role: str = "Software Engineer",
    difficulty_preference: str = "medium",
    question_count: int = 6,
    mcq_count: int = 3,
    msq_count: int = 2,
    coding_count: int = 1,
    previous_fingerprints: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """
    Constructs high-fidelity system and user prompts grounded in candidate's real portfolio.
    Generates a multi-format assessment containing:
    1. MCQ: Multiple Choice Questions (exactly 1 correct answer)
    2. MSQ: Multiple Select Questions (at least 2 correct answers)
    3. Coding: Executable programming problems with starter code, public & hidden tests.
    """
    primary_languages = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    frameworks = portfolio_data.get("frameworks") or []
    skills = portfolio_data.get("skills") or []
    experience_level = portfolio_data.get("experience_level") or "intermediate"
    summary_note = portfolio_data.get("summary_note") or portfolio_data.get("summaryNote") or portfolio_data.get("notes") or ""
    projects = portfolio_data.get("projects") or []
    preferred_domain = portfolio_data.get("preferred_domain") or portfolio_data.get("domain") or "Backend Development"
    claimed_dsa_topics = extract_claimed_dsa_topics(portfolio_data) or ["Arrays", "Strings"]

    # Skill formatting
    skills_list = []
    for s in skills:
        if isinstance(s, dict):
            skills_list.append(s.get("name", ""))
        elif isinstance(s, str):
            skills_list.append(s)
    all_skills = sorted(list(set([s for s in skills_list + primary_languages + frameworks if s])))

    # Project descriptions
    project_descriptions = []
    for p in projects:
        if isinstance(p, dict):
            title = p.get("title") or p.get("name", "Project")
            desc = p.get("description", "")
            stack = ", ".join(p.get("tech_stack", []) or p.get("technologies", []))
            project_descriptions.append(f"- {title} (Stack: {stack}): {desc}")
        elif isinstance(p, str):
            project_descriptions.append(f"- {p}")

    project_context = "\n".join(project_descriptions) if project_descriptions else "General Software Engineering projects."

    # Avoid repeating questions
    avoid_directive = ""
    if previous_fingerprints:
        avoid_directive = (
            f"\nCRITICAL DIVERSITY RULE: Candidate previously attempted questions with fingerprints: "
            f"{', '.join(previous_fingerprints[:10])}. Do NOT reuse identical questions or prompts."
        )

    system_prompt = (
        "You are an Elite Technical Assessment Architect and Lead Engineer at a top-tier tech company. "
        "Your task is to generate a personalized, high-caliber, multi-format 60-minute technical examination "
        "tailored strictly to a candidate's actual verified portfolio.\n\n"
        "Examination Requirements:\n"
        f"1. Generate exactly {mcq_count} MCQ questions, {msq_count} MSQ questions, and {coding_count} Coding problems.\n"
        f"2. Total question count: {mcq_count + msq_count + coding_count}.\n"
        "3. DOMAIN PERSONALIZATION: Tailor challenges to candidate's domain: '{preferred_domain}'.\n"
        "4. STRICT DSA RESTRICTION: The candidate has claimed ONLY the following DSA topics: "
        f"{', '.join(claimed_dsa_topics)}. You MUST ONLY generate algorithmic problems on these exact claimed topics. "
        "Any question violating this whitelist will be automatically rejected by the automated validation pipeline.\n"
        "5. MCQ Specifications:\n"
        "   - 'question_type': 'mcq'\n"
        "   - Exactly 4 distinct options with ids 'A', 'B', 'C', 'D'\n"
        "   - Exactly 1 correct answer (e.g., 'correct_answer': 'B')\n"
        "   - Non-empty explanation justifying the answer\n"
        "   - 'marks': 2.0\n"
        "5. MSQ Specifications:\n"
        "   - 'question_type': 'msq'\n"
        "   - At least 4 distinct options with ids 'A', 'B', 'C', 'D'\n"
        "   - At least 2 correct answers (e.g., 'correct_answers': ['A', 'C'])\n"
        "   - Non-empty explanation justifying the correct set\n"
        "   - 'marks': 3.0\n"
        "6. Coding Specifications:\n"
        "   - 'question_type': 'coding'\n"
        f"   - Must target candidate's primary language ({primary_languages[0]})\n"
        f"   - Algorithmic topic strictly selected from candidate's claimed DSA whitelist: {', '.join(claimed_dsa_topics)}\n"
        "   - 'starter_code': boilerplate function in the candidate's language\n"
        "   - 'examples': at least 2 public test cases with input and expected_output\n"
        "   - 'hidden_test_cases': at least 3 edge cases\n"
        "   - 'reference_solution': fully working solution passing 100% of test cases\n"
        "   - 'marks': 10.0\n"
        "7. Output must be strictly valid JSON matching the specified top-level schema without markdown wrapping."
        f"{avoid_directive}"
    )

    user_prompt = f"""
Candidate Portfolio Context:
- Domain: {preferred_domain}
- Primary Languages: {', '.join(primary_languages)}
- Frameworks & Libraries: {', '.join(frameworks) if frameworks else 'None declared'}
- Key Skills: {', '.join(all_skills)}
- Claimed Solved DSA Topics: {', '.join(claimed_dsa_topics)}
- Assessed Experience Level: {experience_level}
- Target Role: {target_role}
- Candidate Projects:
{project_context}

Return a single JSON object with this exact schema:
{{
  "title": "{target_role} Multi-Format Technical Assessment",
  "duration_minutes": 60,
  "difficulty": "{difficulty_preference}",
  "target_role": "{target_role}",
  "mcq_count": {mcq_count},
  "msq_count": {msq_count},
  "coding_count": {coding_count},
  "questions": [
    {{
      "question_id": "q1",
      "question_type": "mcq",
      "title": "<MCQ Title>",
      "description": "<Question Text>",
      "difficulty": "{difficulty_preference}",
      "topic": "<Portfolio Skill Topic>",
      "portfolio_skill_reference": "<Skill>",
      "marks": 2.0,
      "options": [
        {{"id": "A", "text": "<Option 1>"}},
        {{"id": "B", "text": "<Option 2>"}},
        {{"id": "C", "text": "<Option 3>"}},
        {{"id": "D", "text": "<Option 4>"}}
      ],
      "correct_answer": "B",
      "explanation": "<Explanation>"
    }},
    {{
      "question_id": "q4",
      "question_type": "msq",
      "title": "<MSQ Title>",
      "description": "<Question Text>",
      "difficulty": "{difficulty_preference}",
      "topic": "<Portfolio Skill Topic>",
      "portfolio_skill_reference": "<Skill>",
      "marks": 3.0,
      "options": [
        {{"id": "A", "text": "<Option 1>"}},
        {{"id": "B", "text": "<Option 2>"}},
        {{"id": "C", "text": "<Option 3>"}},
        {{"id": "D", "text": "<Option 4>"}}
      ],
      "correct_answers": ["A", "C"],
      "explanation": "<Explanation>"
    }},
    {{
      "question_id": "q6",
      "question_type": "coding",
      "title": "<Coding Title>",
      "description": "<Problem Statement>",
      "difficulty": "{difficulty_preference}",
      "topic": "<Claimed DSA Topic>",
      "portfolio_skill_reference": "{primary_languages[0]}",
      "marks": 10.0,
      "constraints": ["Time limit: 2000ms", "Memory limit: 256MB"],
      "examples": [
        {{"test_case_id": "tc_pub_1", "input": "<input>", "expected_output": "<output>", "explanation": "<reason>"}}
      ],
      "allowed_languages": ["{primary_languages[0].lower()}"],
      "starter_code": {{
        "{primary_languages[0].lower()}": "<starter_code>"
      }},
      "hidden_test_cases": [
        {{"test_case_id": "tc_hid_1", "input": "<hidden_input>", "expected_output": "<hidden_output>", "weight": 1.0}}
      ],
      "reference_solution": "<reference_solution>"
    }}
  ]
}}
"""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
