import json
from typing import Any, Dict, List, Optional

from backend.app.validation.dsa_whitelist import extract_claimed_dsa_topics


def build_assessment_prompts(
    portfolio_data: Dict[str, Any],
    target_role: str = "Software Engineer",
    difficulty_preference: str = "medium",
    question_count: int = 3,
) -> List[Dict[str, str]]:
    """
    Constructs high-fidelity system and user prompts grounded in candidate's real portfolio.
    Guarantees that questions are tailored to candidate's skills, languages, projects,
    domain (Web, ML, Security, Backend), and strictly restricted to claimed DSA topics.
    """
    # Extract portfolio details
    primary_languages = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    frameworks = portfolio_data.get("frameworks") or []
    experience_level = portfolio_data.get("experience_level") or "intermediate"
    summary_note = portfolio_data.get("summary_note") or portfolio_data.get("summaryNote") or ""
    projects = portfolio_data.get("projects") or []
    recommended_tracks = portfolio_data.get("recommended_tracks") or []
    preferred_domain = portfolio_data.get("preferred_domain") or portfolio_data.get("domain") or "Backend Development"
    claimed_dsa_topics = extract_claimed_dsa_topics(portfolio_data) or ["Arrays", "Strings"]

    # Tier-specific instruction
    tier_lower = difficulty_preference.lower()
    if tier_lower in ("easy", "novice"):
        tier_label = "Novice / Easy"
        tier_directive = (
            "TIER: Novice / Easy. Questions must be localized bug fixes or small features, "
            "plus Easy DSA strictly selected from claimed topics. Do NOT generate complex multi-file architectures."
        )
    elif tier_lower in ("hard", "master"):
        tier_label = "Master / Hard"
        tier_directive = (
            "TIER: Master / Hard. Questions must involve multi-file debugging or complex extension, "
            "performance constraints (e.g. 200,000 items in 2000ms), and Medium/Hard DSA strictly selected from claimed topics."
        )
    else:
        tier_label = "Adept / Medium"
        tier_directive = (
            "TIER: Adept / Medium. Questions must involve multi-step features (2-3 functions/files), "
            "and Medium DSA strictly selected from claimed topics."
        )

    # Format project context
    project_descriptions = []
    for p in projects:
        if isinstance(p, dict):
            title = p.get("title", "Project")
            desc = p.get("description", "")
            stack = ", ".join(p.get("tech_stack", []) or p.get("technologies", []))
            project_descriptions.append(f"- {title} (Stack: {stack}): {desc}")
        elif isinstance(p, str):
            project_descriptions.append(f"- {p}")

    project_context = "\n".join(project_descriptions) if project_descriptions else "General Full-Stack / Backend Engineering projects."

    system_prompt = (
        "You are an Elite Technical Assessment Architect and Lead Engineer at a top-tier tech company. "
        "Your task is to generate a personalized, high-caliber 60-minute coding assessment tailored strictly "
        "to a candidate's actual verified portfolio data.\n\n"
        "Assessment Generation Directives:\n"
        f"1. Generate exactly {question_count} distinct coding questions calibrated to tier '{tier_label}'.\n"
        f"2. {tier_directive}\n"
        f"3. DOMAIN PERSONALIZATION: Tailor challenges to candidate's domain: '{preferred_domain}'.\n"
        f"4. STRICT DSA RESTRICTION: The candidate has claimed ONLY the following DSA topics: {', '.join(claimed_dsa_topics)}. "
        "You MUST ONLY generate algorithmic problems on these exact claimed topics. "
        "Do NOT generate questions on un-claimed topics (such as Graphs, Trees, Dynamic Programming, or Tries if not listed). "
        "Any question violating this whitelist will be automatically rejected by the automated validation pipeline.\n"
        f"5. Calibrate language requirements to candidate's primary languages: {', '.join(primary_languages)}.\n"
        "6. Question Breakdown:\n"
        f"   - Question 1 (Core DSA from Claimed Topics): Must be restricted to: {', '.join(claimed_dsa_topics)}.\n"
        f"   - Question 2 (Domain & Framework Challenge): Focus on domain '{preferred_domain}' and tools: {', '.join(frameworks) if frameworks else 'Standard Architecture'}.\n"
        "   - Question 3 (Portfolio Project Challenge): Problem directly inspired by candidate's actual projects.\n"
        "7. Output must be strictly valid JSON without markdown fences, matching the specified Pydantic schema.\n"
        "8. For each question, provide:\n"
        "   - 'question_id': Unique identifier (e.g., 'q1', 'q2', 'q3')\n"
        "   - 'title': Clear, professional problem title\n"
        "   - 'description': Detailed specification with input/output format and expectations\n"
        "   - 'difficulty': 'easy', 'medium', or 'hard'\n"
        "   - 'topic': Technical category strictly respecting claimed DSA topics\n"
        "   - 'constraints': List of string constraints (e.g., ['Time limit: 2000ms', 'Memory limit: 256MB'])\n"
        "   - 'examples': Array of at least 2 public test cases with 'input', 'expected_output', and 'explanation'\n"
        f"   - 'allowed_languages': Array of languages allowed, prioritized by candidate stack ({', '.join(primary_languages)})\n"
        "   - 'starter_code': Dictionary mapping language names (e.g. 'python') to runnable boilerplate starter functions that fail acceptance tests\n"
        "   - 'hidden_test_cases': Array of at least 3 edge-case test cases with 'input', 'expected_output', and 'weight'\n"
        "   - 'reference_solution': Fully working Python implementation solving the problem and passing 100% of test cases"
    )

    user_prompt = f"""
Candidate Portfolio Analysis:
- Preferred Domain: {preferred_domain}
- Primary Languages: {', '.join(primary_languages)}
- Declared Frameworks & Tools: {', '.join(frameworks) if frameworks else 'None declared'}
- Claimed Solved DSA Topics: {', '.join(claimed_dsa_topics)}
- Assessed Experience Level: {experience_level}
- Target Role: {target_role}
- Candidate Projects:
{project_context}
- Candidate Notes / Bio: {summary_note if summary_note else 'None provided'}
- Recommended Tracks: {', '.join(recommended_tracks) if recommended_tracks else 'Standard Engineering Track'}

Return a single JSON object with this exact top-level schema:
{{
  "title": "{target_role} Personalized Technical Assessment",
  "duration_minutes": 60,
  "difficulty": "{difficulty_preference}",
  "target_role": "{target_role}",
  "questions": [
    {{
      "question_id": "q1",
      "title": "<Title>",
      "description": "<Description>",
      "difficulty": "{difficulty_preference}",
      "topic": "<Claimed DSA Topic>",
      "constraints": ["Time limit: 2000ms", "Memory: 256MB"],
      "examples": [
        {{
          "test_case_id": "tc_pub_1",
          "input": "<Input>",
          "expected_output": "<Expected Output>",
          "explanation": "<Explanation>"
        }}
      ],
      "allowed_languages": {json.dumps(primary_languages)},
      "starter_code": {{
        "python": "def solution(...):\\n    pass\\n"
      }},
      "hidden_test_cases": [
        {{
          "test_case_id": "tc_hid_1",
          "input": "<Hidden Input>",
          "expected_output": "<Hidden Output>",
          "weight": 1.0
        }}
      ],
      "reference_solution": "def solution(...):\\n    ...\\n"
    }}
  ]
}}
"""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
