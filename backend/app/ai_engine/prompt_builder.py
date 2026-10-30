import json
from typing import Any, Dict, List, Optional


def build_assessment_prompts(
    portfolio_data: Dict[str, Any],
    target_role: str = "Software Engineer",
    difficulty_preference: str = "medium",
    question_count: int = 3,
) -> List[Dict[str, str]]:
    """
    Constructs high-fidelity system and user prompts grounded in candidate's real portfolio.
    Guarantees that questions are tailored to candidate's skills, languages, and projects.
    """
    # Extract portfolio details
    primary_languages = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    frameworks = portfolio_data.get("frameworks") or []
    experience_level = portfolio_data.get("experience_level") or "intermediate"
    summary_note = portfolio_data.get("summary_note") or portfolio_data.get("summaryNote") or ""
    projects = portfolio_data.get("projects") or []
    recommended_tracks = portfolio_data.get("recommended_tracks") or []

    # Format project context
    project_descriptions = []
    for p in projects:
        if isinstance(p, dict):
            title = p.get("title", "Project")
            desc = p.get("description", "")
            stack = ", ".join(p.get("tech_stack", []))
            project_descriptions.append(f"- {title} (Stack: {stack}): {desc}")
        elif isinstance(p, str):
            project_descriptions.append(f"- {p}")

    project_context = "\n".join(project_descriptions) if project_descriptions else "General Full-Stack / Backend Engineering projects."

    system_prompt = (
        "You are an Elite Technical Assessment Architect and Lead Engineer at a top-tier tech company. "
        "Your task is to generate a personalized, high-caliber 60-minute coding assessment tailored strictly "
        "to a candidate's actual verified portfolio data.\n\n"
        "Assessment Generation Directives:\n"
        f"1. Generate exactly {question_count} distinct coding questions calibrated to difficulty '{difficulty_preference}'.\n"
        f"2. Calibrate language requirements to candidate's primary languages: {', '.join(primary_languages)}.\n"
        "3. Question Breakdown:\n"
        "   - Question 1 (Core DSA & Algorithms): Relevant data structure problem (e.g. hash maps, sliding window, graphs, dynamic programming) in candidate's primary language.\n"
        f"   - Question 2 (Framework & System Engineering): Real-world backend/system problem reflecting frameworks: {', '.join(frameworks) if frameworks else 'Standard Backend Architecture'}.\n"
        "   - Question 3 (Domain / Portfolio Project Challenge): Problem directly inspired by the candidate's actual projects and experience.\n"
        "4. Output must be strictly valid JSON without markdown fences, matching the specified Pydantic schema.\n"
        "5. For each question, provide:\n"
        "   - 'question_id': Unique identifier (e.g., 'q1', 'q2', 'q3')\n"
        "   - 'title': Clear, professional problem title\n"
        "   - 'description': Detailed specification with input/output format and expectations\n"
        "   - 'difficulty': 'easy', 'medium', or 'hard'\n"
        "   - 'topic': Technical category (e.g., 'Data Structures', 'Async Systems', 'Database Optimization')\n"
        "   - 'constraints': List of string constraints (e.g., ['Time limit: 2000ms', 'Memory limit: 256MB', '1 <= N <= 10^5'])\n"
        "   - 'examples': Array of at least 2 public test cases with 'input', 'expected_output', and 'explanation'\n"
        f"   - 'allowed_languages': Array of languages allowed, prioritized by candidate stack ({', '.join(primary_languages)})\n"
        "   - 'starter_code': Dictionary mapping language names (e.g. 'python') to boilerplate starter functions\n"
        "   - 'hidden_test_cases': Array of at least 3 edge-case test cases with 'input', 'expected_output', and 'weight'\n"
        "   - 'reference_solution': Working Python implementation solving the problem"
    )

    user_prompt = f"""
Candidate Portfolio Analysis:
- Primary Languages: {', '.join(primary_languages)}
- Declared Frameworks & Tools: {', '.join(frameworks) if frameworks else 'None declared'}
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
      "topic": "<Category>",
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
          "input": "<Input>",
          "expected_output": "<Output>",
          "weight": 1.0
        }}
      ],
      "reference_solution": "def solution(...):\\n    return ...\\n"
    }}
  ]
}}
"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt.strip()},
    ]
