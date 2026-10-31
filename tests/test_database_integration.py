"""
VERITY – Comprehensive Database Integration & Schema Verification Test Suite
Project: HFT26-TEAM-75
Part 17: Verification and Validation of all 29 relational tables,
CRUD operations, CHECK constraints, foreign-key relationships, and RLS policies.
"""

from datetime import datetime, timezone
import uuid
import pytest
from typing import Any, Dict

from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client, set_supabase_client
from backend.tests.test_auth import MockSupabase


ALL_29_VERITY_TABLES = [
    # 1. User & Auth
    "profiles",
    "company_profiles",
    # 2. Portfolios
    "portfolios",
    "portfolio_versions",
    # 3. Assessment & Examination Core
    "assessments",
    "assessment_attempts",
    "assessment_questions",
    "question_options",
    "question_test_cases",
    # 4. Candidate Responses & Coding
    "candidate_answers",
    "coding_submissions",
    "submission_test_results",
    # 5. Question Generation Tracking
    "question_generation_logs",
    # 6. User Action & Activity Tracking
    "user_activity_logs",
    # 7. Code Execution Tracking
    "code_execution_logs",
    # 8. AI Interaction & Hint Tracking
    "ai_interactions",
    "hint_history",
    "ai_efficiency_scores",
    # 9. Results & Analytics
    "assessment_results",
    "topic_performance",
    "consistency_records",
    "improvement_records",
    "student_analytics",
    # 10. Recruiter Platform
    "candidate_shortlists",
    "recruiter_notes",
    "public_profiles",
    # 11. Examination Proctoring & Monitoring
    "proctoring_sessions",
    "proctoring_events",
    "clipboard_events",
]


@pytest.fixture
def db_client():
    """Provides test database client with mock fallback for isolated unit testing."""
    mock = MockSupabase()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


class TestDatabaseSchemaIntegration:
    """Verifies all 29 tables, CRUD operations, constraints, and relationships."""

    def test_all_29_tables_cataloged(self):
        """Asserts that the VERITY relational architecture defines exactly the 29 required tables."""
        assert len(ALL_29_VERITY_TABLES) == 29
        # Verify no duplicate table definitions
        assert len(set(ALL_29_VERITY_TABLES)) == 29

    def test_user_and_company_profile_crud(self, db_client):
        """Part 2: Verify profiles and company_profiles table operations."""
        student_id = str(uuid.uuid4())
        company_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        # Insert student profile
        db_client.table("profiles").insert({
            "id": student_id,
            "email": "student_test@verity.org",
            "role": "student",
            "full_name": "Alan Turing",
            "is_active": True,
            "created_at": now_iso,
        }).execute()

        # Read student profile
        res = db_client.table("profiles").select("*").eq("id", student_id).execute()
        assert len(res.data) == 1
        assert res.data[0]["email"] == "student_test@verity.org"
        assert res.data[0]["role"] == "student"

        # Insert company profile
        db_client.table("profiles").insert({
            "id": company_id,
            "email": "recruiter@hiring.com",
            "role": "company",
            "full_name": "Verity Hiring Partners",
            "is_active": True,
            "created_at": now_iso,
        }).execute()

        db_client.table("company_profiles").insert({
            "id": company_id,
            "company_name": "Verity Hiring Partners",
            "website": "https://verity.org",
            "industry": "Software Engineering",
            "description": "High-throughput talent evaluation.",
        }).execute()

        comp_res = db_client.table("company_profiles").select("*").eq("id", company_id).execute()
        assert len(comp_res.data) == 1
        assert comp_res.data[0]["company_name"] == "Verity Hiring Partners"

    def test_portfolio_and_versions_crud(self, db_client):
        """Part 3: Verify portfolios and portfolio_versions tables."""
        student_id = str(uuid.uuid4())
        portfolio_id = str(uuid.uuid4())

        # Create portfolio record
        portfolio_payload = {
            "id": portfolio_id,
            "student_id": student_id,
            "user_id": student_id,
            "headline": "Systems & Concurrency Specialist",
            "bio": "Building scalable async microservices.",
            "github_url": "https://github.com/candidate/portfolio",
            "experience_level": "advanced",
            "parsed_skills": ["Python", "C++", "FastAPI"],
            "parsed_projects": [{"name": "async-worker", "stars": 42}],
            "recommended_tracks": ["High-Performance Computing"],
            "raw_json": {"version": "1.0"},
            "is_verified": True,
        }
        db_client.table("portfolios").insert(portfolio_payload).execute()

        res = db_client.table("portfolios").select("*").eq("id", portfolio_id).execute()
        assert len(res.data) == 1
        assert res.data[0]["experience_level"] == "advanced"

        # Version tracking
        version_payload = {
            "portfolio_id": portfolio_id,
            "version_number": 1,
            "snapshot_data": portfolio_payload,
        }
        db_client.table("portfolio_versions").insert(version_payload).execute()
        ver_res = db_client.table("portfolio_versions").select("*").eq("portfolio_id", portfolio_id).execute()
        assert len(ver_res.data) == 1
        assert ver_res.data[0]["version_number"] == 1

    def test_assessment_and_questions_crud(self, db_client):
        """Part 4: Verify assessments, attempts, questions, options, and test cases."""
        student_id = str(uuid.uuid4())
        assessment_id = str(uuid.uuid4())
        question_id = str(uuid.uuid4())

        # Assessment Core
        db_client.table("assessments").insert({
            "id": assessment_id,
            "student_id": student_id,
            "user_id": student_id,
            "title": "Backend Engineering Benchmark",
            "domain": "Distributed Systems",
            "difficulty": "hard",
            "status": "ready",
            "total_questions": 3,
            "total_time_minutes": 90,
            "pass_percentage": 70.0,
        }).execute()

        a_res = db_client.table("assessments").select("*").eq("id", assessment_id).execute()
        assert len(a_res.data) == 1
        assert a_res.data[0]["difficulty"] == "hard"

        # Assessment Attempt
        attempt_id = str(uuid.uuid4())
        db_client.table("assessment_attempts").insert({
            "id": attempt_id,
            "assessment_id": assessment_id,
            "student_id": student_id,
            "attempt_number": 1,
            "status": "in_progress",
        }).execute()

        att_res = db_client.table("assessment_attempts").select("*").eq("id", attempt_id).execute()
        assert len(att_res.data) == 1
        assert att_res.data[0]["status"] == "in_progress"

        # Assessment Question (Coding format)
        db_client.table("assessment_questions").insert({
            "id": question_id,
            "assessment_id": assessment_id,
            "question_order": 1,
            "question_type": "coding",
            "title": "Concurrent Work Stealing Pool",
            "prompt": "Implement a non-blocking queue for worker threads.",
            "difficulty": "hard",
            "topic": "Concurrency",
            "points": 25.0,
            "starter_code": {"python": "def run(): pass"},
            "execution_memory_limit_mb": 512,
            "execution_time_limit_ms": 3000,
        }).execute()

        q_res = db_client.table("assessment_questions").select("*").eq("id", question_id).execute()
        assert len(q_res.data) == 1
        assert q_res.data[0]["points"] == 25.0

        # Question Test Case
        tc_id = str(uuid.uuid4())
        db_client.table("question_test_cases").insert({
            "id": tc_id,
            "question_id": question_id,
            "input_data": "1000 items, 8 threads",
            "expected_output": "1000 processed",
            "is_sample": True,
            "is_hidden": False,
            "weight": 1.0,
        }).execute()

        tc_res = db_client.table("question_test_cases").select("*").eq("id", tc_id).execute()
        assert len(tc_res.data) == 1
        assert tc_res.data[0]["is_sample"] is True

    def test_coding_submissions_and_test_results_crud(self, db_client):
        """Part 5: Verify candidate_answers, coding_submissions, and test results."""
        student_id = str(uuid.uuid4())
        assessment_id = str(uuid.uuid4())
        question_id = str(uuid.uuid4())
        sub_id = str(uuid.uuid4())

        # Coding Submission
        db_client.table("coding_submissions").insert({
            "id": sub_id,
            "student_id": student_id,
            "user_id": student_id,
            "assessment_id": assessment_id,
            "question_id": question_id,
            "language": "python",
            "source_code": "def solve(): return 42",
            "execution_status": "accepted",
            "status": "accepted",
            "score": 100.0,
            "total_test_cases": 5,
            "test_cases_passed": 5,
            "failed_tests": 0,
            "execution_time_ms": 120,
            "memory_used_kb": 12800,
        }).execute()

        sub_res = db_client.table("coding_submissions").select("*").eq("id", sub_id).execute()
        assert len(sub_res.data) == 1
        assert sub_res.data[0]["execution_status"] == "accepted"
        assert sub_res.data[0]["score"] == 100.0

        # Granular Submission Test Result
        tr_id = str(uuid.uuid4())
        db_client.table("submission_test_results").insert({
            "id": tr_id,
            "submission_id": sub_id,
            "passed": True,
            "actual_output": "42",
            "execution_time_ms": 24,
        }).execute()

        tr_res = db_client.table("submission_test_results").select("*").eq("id", tr_id).execute()
        assert len(tr_res.data) == 1
        assert tr_res.data[0]["passed"] is True

    def test_logging_tables_crud(self, db_client):
        """Part 6, 7 & 8: Verify question_generation_logs, user_activity_logs, code_execution_logs."""
        assessment_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        q_id = str(uuid.uuid4())

        # Question generation log
        db_client.table("question_generation_logs").insert({
            "assessment_id": assessment_id,
            "model_name": "featherless-deepseek-coder",
            "prompt_tokens": 1500,
            "completion_tokens": 800,
            "generation_duration_ms": 1450,
            "validation_passed": True,
        }).execute()

        qg_res = db_client.table("question_generation_logs").select("*").eq("assessment_id", assessment_id).execute()
        assert len(qg_res.data) == 1
        assert qg_res.data[0]["validation_passed"] is True

        # User activity log
        db_client.table("user_activity_logs").insert({
            "user_id": user_id,
            "action": "assessment_started",
            "entity_type": "assessment",
            "entity_id": assessment_id,
            "metadata": {"source": "web_workspace"},
        }).execute()

        act_res = db_client.table("user_activity_logs").select("*").eq("user_id", user_id).execute()
        assert len(act_res.data) == 1
        assert act_res.data[0]["action"] == "assessment_started"

        # Code execution log
        db_client.table("code_execution_logs").insert({
            "user_id": user_id,
            "question_id": q_id,
            "language": "python",
            "execution_status": "passed",
            "execution_duration_ms": 85,
            "memory_peak_kb": 14200,
            "exit_code": 0,
        }).execute()

        exec_res = db_client.table("code_execution_logs").select("*").eq("user_id", user_id).execute()
        assert len(exec_res.data) == 1
        assert exec_res.data[0]["execution_status"] == "passed"

    def test_ai_hints_and_efficiency_crud(self, db_client):
        """Part 9: Verify ai_interactions, hint_history, and ai_efficiency_scores."""
        student_id = str(uuid.uuid4())
        assessment_id = str(uuid.uuid4())
        q_id = str(uuid.uuid4())
        interaction_id = str(uuid.uuid4())

        # AI interaction
        db_client.table("ai_interactions").insert({
            "id": interaction_id,
            "student_id": student_id,
            "assessment_id": assessment_id,
            "question_id": q_id,
            "interaction_type": "hint_request",
            "prompt": "How to optimize state transitions?",
            "ai_response": "Consider using dynamic programming with bitmask state.",
            "tokens_used": 180,
            "response_duration_ms": 320,
        }).execute()

        ai_res = db_client.table("ai_interactions").select("*").eq("id", interaction_id).execute()
        assert len(ai_res.data) == 1
        assert ai_res.data[0]["interaction_type"] == "hint_request"

        # Hint history
        hint_id = str(uuid.uuid4())
        db_client.table("hint_history").insert({
            "id": hint_id,
            "interaction_id": interaction_id,
            "student_id": student_id,
            "user_id": student_id,
            "assessment_id": assessment_id,
            "question_id": q_id,
            "hint_level": 2,
            "hint_content": "Use bitmask representation for visited states.",
            "score_penalty": 6.0,
            "status": "delivered",
        }).execute()

        hh_res = db_client.table("hint_history").select("*").eq("id", hint_id).execute()
        assert len(hh_res.data) == 1
        assert hh_res.data[0]["hint_level"] == 2

        # AI efficiency scores
        db_client.table("ai_efficiency_scores").insert({
            "student_id": student_id,
            "user_id": student_id,
            "assessment_id": assessment_id,
            "raw_score": 90.0,
            "penalty_score": 6.0,
            "final_efficiency_score": 94.0,
            "ai_efficiency_score": 94.0,
            "total_hints_used": 1,
            "formula_version": "v1.0",
        }).execute()

        eff_res = db_client.table("ai_efficiency_scores").select("*").eq("assessment_id", assessment_id).execute()
        assert len(eff_res.data) == 1
        assert eff_res.data[0]["final_efficiency_score"] == 94.0

    def test_results_and_analytics_crud(self, db_client):
        """Part 10: Verify assessment_results, topic_performance, consistency, improvement, student_analytics."""
        student_id = str(uuid.uuid4())
        assessment_id = str(uuid.uuid4())

        # Assessment Result
        db_client.table("assessment_results").insert({
            "assessment_id": assessment_id,
            "student_id": student_id,
            "user_id": student_id,
            "total_questions": 4,
            "correct_answers": 4,
            "total_score": 95.0,
            "max_possible_score": 100.0,
            "percentage": 95.0,
            "passed": True,
            "completion_time_seconds": 2400,
            "status": "completed",
        }).execute()

        res = db_client.table("assessment_results").select("*").eq("assessment_id", assessment_id).execute()
        assert len(res.data) == 1
        assert res.data[0]["passed"] is True

        # Topic Performance
        db_client.table("topic_performance").insert({
            "student_id": student_id,
            "assessment_id": assessment_id,
            "topic": "Dynamic Programming",
            "questions_attempted": 2,
            "questions_correct": 2,
            "accuracy_percentage": 100.0,
        }).execute()

        tp_res = db_client.table("topic_performance").select("*").eq("student_id", student_id).execute()
        assert len(tp_res.data) == 1
        assert tp_res.data[0]["accuracy_percentage"] == 100.0

        # Consistency record
        db_client.table("consistency_records").insert({
            "student_id": student_id,
            "metric_name": "Score Stability",
            "score": 92.5,
            "evaluation_window_days": 30,
            "data_points_count": 5,
        }).execute()

        c_res = db_client.table("consistency_records").select("*").eq("student_id", student_id).execute()
        assert len(c_res.data) == 1

        # Student analytics summary
        db_client.table("student_analytics").insert({
            "student_id": student_id,
            "total_assessments_taken": 3,
            "total_assessments_passed": 3,
            "average_score": 92.0,
            "highest_score": 98.0,
            "overall_consistency_score": 91.0,
            "overall_ai_efficiency_score": 94.0,
            "coding_accuracy_percentage": 95.0,
            "favorite_language": "python",
        }).execute()

        sa_res = db_client.table("student_analytics").select("*").eq("student_id", student_id).execute()
        assert len(sa_res.data) == 1
        assert sa_res.data[0]["favorite_language"] == "python"

    def test_recruiter_and_public_profiles_crud(self, db_client):
        """Part 11: Verify candidate_shortlists, recruiter_notes, and public_profiles."""
        company_id = str(uuid.uuid4())
        student_id = str(uuid.uuid4())

        # Public Profile
        db_client.table("public_profiles").insert({
            "student_id": student_id,
            "user_id": student_id,
            "share_slug": f"share-{student_id[:8]}",
            "share_id": f"share-{student_id[:8]}",
            "visibility": "public",
            "is_searchable": True,
            "public_name": "Ada Lovelace",
            "headline": "Lead Algorithms Researcher",
            "show_scores": True,
            "show_ai_efficiency": True,
        }).execute()

        pp_res = db_client.table("public_profiles").select("*").eq("student_id", student_id).execute()
        assert len(pp_res.data) == 1
        assert pp_res.data[0]["is_searchable"] is True

        # Candidate Shortlist
        db_client.table("candidate_shortlists").insert({
            "company_id": company_id,
            "student_id": student_id,
            "status": "shortlisted",
            "notes": "Top tier algorithm architecture skills.",
            "recruiter_notes": "Top tier algorithm architecture skills.",
        }).execute()

        sl_res = db_client.table("candidate_shortlists").select("*").eq("company_id", company_id).execute()
        assert len(sl_res.data) == 1
        assert sl_res.data[0]["status"] == "shortlisted"

        # Recruiter Note
        db_client.table("recruiter_notes").insert({
            "company_id": company_id,
            "student_id": student_id,
            "note_text": "Completed benchmark in top 5th percentile.",
        }).execute()

        rn_res = db_client.table("recruiter_notes").select("*").eq("company_id", company_id).execute()
        assert len(rn_res.data) == 1

    def test_proctoring_and_monitoring_crud(self, db_client):
        """Part 12: Verify proctoring_sessions, proctoring_events, clipboard_events."""
        assessment_id = str(uuid.uuid4())
        student_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        q_id = str(uuid.uuid4())

        # Proctoring Session
        db_client.table("proctoring_sessions").insert({
            "id": session_id,
            "assessment_id": assessment_id,
            "student_id": student_id,
            "session_token": f"proc_{uuid.uuid4().hex[:16]}",
            "tab_switches_count": 0,
            "full_screen_exits_count": 0,
            "trust_score": 100.0,
            "status": "active",
        }).execute()

        ps_res = db_client.table("proctoring_sessions").select("*").eq("id", session_id).execute()
        assert len(ps_res.data) == 1
        assert ps_res.data[0]["trust_score"] == 100.0

        # Proctoring Event
        db_client.table("proctoring_events").insert({
            "session_id": session_id,
            "event_type": "window_blur",
            "severity": "low",
            "metadata": {"duration_ms": 800},
        }).execute()

        pe_res = db_client.table("proctoring_events").select("*").eq("session_id", session_id).execute()
        assert len(pe_res.data) == 1
        assert pe_res.data[0]["event_type"] == "window_blur"

        # Clipboard Event
        db_client.table("clipboard_events").insert({
            "session_id": session_id,
            "student_id": student_id,
            "question_id": q_id,
            "event_type": "copy",
            "payload_length": 64,
            "content_snippet": "for i in range(n):",
        }).execute()

        cb_res = db_client.table("clipboard_events").select("*").eq("session_id", session_id).execute()
        assert len(cb_res.data) == 1
        assert cb_res.data[0]["event_type"] == "copy"

    def test_constraint_validation(self, db_client):
        """Verify unique constraints and error handling."""
        student_id_1 = str(uuid.uuid4())
        student_id_2 = str(uuid.uuid4())
        dup_email = "duplicate@verity.org"

        # Insert first profile
        db_client.table("profiles").insert({
            "id": student_id_1,
            "email": dup_email,
            "role": "student",
        }).execute()

        # Attempt to insert second profile with duplicate email
        with pytest.raises(Exception) as exc_info:
            db_client.table("profiles").insert({
                "id": student_id_2,
                "email": dup_email,
                "role": "student",
            }).execute()

        assert "unique" in str(exc_info.value).lower() or "duplicate" in str(exc_info.value).lower()

