"""
Unit Test Suite for Assessment Generation, Prompts, and Calibration
Role: QA, Architecture & Full-Stack Lead
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

import pytest
from unittest.mock import patch

from backend.app.ai_engine.prompt_builder import build_assessment_prompts
from backend.app.ai_engine.question_generator import (
    QuestionGenerator,
    generate_portfolio_calibrated_fallback,
)
from backend.app.schemas.assessment import GeneratedAssessmentSchema


class TestPromptBuilder:
    def test_build_assessment_prompts_contains_domain_and_tier(self):
        portfolio = {
            "primary_languages": ["Python", "Rust"],
            "skills": [{"name": "Distributed Systems"}],
            "dsa_topics_solved": ["Arrays", "Sliding Window"],
            "preferred_domain": "Backend Infrastructure",
            "projects": [{"title": "KV Store", "description": "LSM-tree key-value database"}],
        }

        messages = build_assessment_prompts(
            portfolio_data=portfolio,
            target_role="Backend Engineer",
            difficulty_preference="medium",
            question_count=3,
        )

        assert len(messages) == 2
        sys_msg = messages[0]["content"]
        user_msg = messages[1]["content"]

        assert "Backend Infrastructure" in user_msg
        assert "Arrays" in user_msg
        assert "Sliding Window" in user_msg
        assert "STRICT DSA RESTRICTION" in sys_msg or "STRICT DSA RESTRICTION" in user_msg


class TestFallbackSynthesizer:
    def test_fallback_generates_valid_questions_grounded_in_portfolio(self):
        portfolio = {
            "primary_languages": ["Python"],
            "frameworks": ["FastAPI"],
            "dsa_topics_solved": ["Arrays", "Strings"],
            "projects": [{"title": "Telemetry Router", "description": "Routes sensor data"}],
        }

        assessment: GeneratedAssessmentSchema = generate_portfolio_calibrated_fallback(
            portfolio_data=portfolio,
            target_role="Cloud Engineer",
            difficulty_preference="easy",
            question_count=2,
        )

        assert len(assessment.questions) == 2
        assert assessment.difficulty == "easy"
        assert assessment.duration_minutes == 60
        # Question 1 must be grounded in claimed topics
        assert assessment.questions[0].target_skill in ("Arrays", "Strings")
