import pytest
from backend.app.ai_engine.question_generator import (
    QuestionGenerator,
    generate_portfolio_calibrated_fallback,
)
from backend.app.schemas.assessment import (
    AssessmentAnswerRequest,
    AssessmentGenerateRequest,
    GeneratedAssessmentSchema,
)
from backend.app.services.assessment_service import AssessmentService
from backend.app.validation.question_validator import (
    sanitize_assessment_for_candidate,
    validate_generated_assessment,
    validate_mcq_task,
    validate_msq_task,
)


class TestMultiFormatAssessmentGeneration:
    def test_python_portfolio_generates_multi_format_questions(self):
        portfolio = {
            "primary_languages": ["Python"],
            "skills": ["Machine Learning", "SQL", "FastAPI"],
            "frameworks": ["TensorFlow", "FastAPI"],
            "dsa_topics_solved": ["Arrays", "Sliding Window"],
            "projects": [
                {
                    "title": "Fraud Detection System",
                    "description": "ML-based fraud detection pipeline",
                    "technologies": ["Python", "TensorFlow", "SQL"],
                }
            ],
            "experience_level": "intermediate",
        }

        assessment: GeneratedAssessmentSchema = generate_portfolio_calibrated_fallback(
            portfolio_data=portfolio,
            target_role="Machine Learning Engineer",
            difficulty_preference="medium",
            mcq_count=3,
            msq_count=2,
            coding_count=1,
            question_count=6,
        )

        assert len(assessment.questions) == 6
        mcqs = [q for q in assessment.questions if q.question_type == "mcq"]
        msqs = [q for q in assessment.questions if q.question_type == "msq"]
        codings = [q for q in assessment.questions if q.question_type == "coding"]

        assert len(mcqs) == 3
        assert len(msqs) == 2
        assert len(codings) == 1

        # Check MCQ rules
        for mcq in mcqs:
            valid, errors = validate_mcq_task(mcq)
            assert valid, f"MCQ validation failed: {errors}"
            assert len(mcq.options) == 4
            assert mcq.correct_answer in [opt.id for opt in mcq.options]
            assert mcq.explanation is not None

        # Check MSQ rules
        for msq in msqs:
            valid, errors = validate_msq_task(msq)
            assert valid, f"MSQ validation failed: {errors}"
            assert len(msq.options) >= 3
            assert len(msq.correct_answers) >= 2
            for ca in msq.correct_answers:
                assert ca in [opt.id for opt in msq.options]
            assert msq.explanation is not None

        # Check Coding rules
        coding = codings[0]
        assert "python" in coding.allowed_languages
        assert "python" in coding.starter_code
        assert coding.reference_solution is not None
        assert len(coding.hidden_test_cases) >= 3

    def test_java_portfolio_generates_java_coding_questions(self):
        portfolio = {
            "primary_languages": ["Java"],
            "skills": ["Spring Boot", "Microservices", "PostgreSQL"],
            "frameworks": ["Spring Boot", "Hibernate"],
            "dsa_topics_solved": ["Arrays", "Two Pointers"],
            "projects": [
                {
                    "title": "Payment Gateway",
                    "description": "High-throughput microservices backend",
                    "technologies": ["Java", "Spring Boot", "PostgreSQL"],
                }
            ],
        }

        assessment = generate_portfolio_calibrated_fallback(
            portfolio_data=portfolio,
            target_role="Backend Java Engineer",
            mcq_count=2,
            msq_count=1,
            coding_count=1,
            question_count=4,
        )

        codings = [q for q in assessment.questions if q.question_type == "coding"]
        assert len(codings) == 1
        coding = codings[0]
        assert "java" in coding.allowed_languages
        assert "java" in coding.starter_code
        assert "public class Solution" in coding.starter_code["java"]

        # Strictly verify zero-trust validation passes for Java assessment
        validate_generated_assessment(assessment)

    def test_cpp_portfolio_generates_and_validates_cpp_coding_questions(self):
        portfolio = {
            "primary_languages": ["C++"],
            "skills": ["Algorithms", "Low-Level Programming"],
            "frameworks": ["Qt"],
            "dsa_topics_solved": ["Arrays", "Two Pointers"],
            "projects": [
                {
                    "title": "High Frequency Engine",
                    "description": "Sub-microsecond matching engine in modern C++",
                    "technologies": ["C++", "CMake"],
                }
            ],
        }

        assessment = generate_portfolio_calibrated_fallback(
            portfolio_data=portfolio,
            target_role="C++ Systems Engineer",
            mcq_count=2,
            msq_count=1,
            coding_count=1,
            question_count=4,
        )

        codings = [q for q in assessment.questions if q.question_type == "coding"]
        assert len(codings) == 1
        coding = codings[0]
        assert "cpp" in coding.allowed_languages
        assert "cpp" in coding.starter_code

        # Strictly verify zero-trust validation passes for C++ assessment
        validate_generated_assessment(assessment)

    def test_confidential_answers_and_hidden_tests_are_stripped(self):
        portfolio = {
            "primary_languages": ["Python"],
            "skills": ["Algorithms"],
            "dsa_topics_solved": ["Arrays"],
        }
        assessment = generate_portfolio_calibrated_fallback(portfolio)
        assert len(assessment.questions) > 0

        # Candidate dict check
        for q in assessment.questions:
            cand_dict = q.to_candidate_dict()
            assert "correct_answer" not in cand_dict
            assert "correct_answers" not in cand_dict
            assert "explanation" not in cand_dict
            assert "hidden_test_cases" not in cand_dict
            assert "reference_solution" not in cand_dict

        # Sanitizer check
        full_dict = assessment.model_dump()
        sanitized = sanitize_assessment_for_candidate(full_dict)
        for q in sanitized["questions"]:
            assert "correct_answer" not in q
            assert "correct_answers" not in q
            assert "hidden_test_cases" not in q
            assert "reference_solution" not in q

    def test_fresh_questions_avoid_previous_fingerprints(self):
        portfolio = {
            "primary_languages": ["Python"],
            "skills": ["Algorithms", "Machine Learning"],
            "dsa_topics_solved": ["Arrays"],
        }

        # Attempt 1
        attempt_1 = generate_portfolio_calibrated_fallback(portfolio, previous_fingerprints=[])
        fp_1 = [q.question_fingerprint for q in attempt_1.questions if q.question_fingerprint]

        # Attempt 2 passing attempt 1 fingerprints
        attempt_2 = generate_portfolio_calibrated_fallback(portfolio, previous_fingerprints=fp_1)
        fp_2 = [q.question_fingerprint for q in attempt_2.questions if q.question_fingerprint]

        # Must generate fresh questions (not completely identical)
        assert fp_1 != fp_2
        assert attempt_1.questions[0].title != attempt_2.questions[0].title or fp_1 != fp_2

    def test_mcq_and_msq_deterministic_grading(self):
        from backend.app.database.supabase import get_supabase_client
        client = get_supabase_client()
        user_id = "test_student_user_grading"

        # Seed portfolio
        from backend.app.services.portfolio_service import PortfolioService
        PortfolioService.save_portfolio(
            client=client,
            user_id=user_id,
            github_url="https://github.com/grading/demo",
            primary_languages=["Python"],
            frameworks=["FastAPI"],
            skills=[{"name": "Python"}, {"name": "SQL"}],
            dsa_topics_solved=["Arrays"],
        )

        # Generate assessment
        req = AssessmentGenerateRequest(mcq_count=2, msq_count=1, coding_count=1, question_count=4)
        assessment = AssessmentService.generate_assessment(client, user_id, req)
        aid = assessment["id"]

        # Retrieve questions from database store to know correct answers for testing
        from backend.app.services.assessment_service import _assessment_questions_store
        full_qs = _assessment_questions_store[aid]

        mcq_q = next(q for q in full_qs if q["question_type"] == "mcq")
        msq_q = next(q for q in full_qs if q["question_type"] == "msq")

        # Save correct answer for MCQ
        AssessmentService.save_candidate_answer(
            client=client,
            assessment_id=aid,
            user_id=user_id,
            question_id=mcq_q["id"],
            selected_option=mcq_q["correct_answer"],
        )

        # Save correct answers for MSQ
        AssessmentService.save_candidate_answer(
            client=client,
            assessment_id=aid,
            user_id=user_id,
            question_id=msq_q["id"],
            selected_options=msq_q["correct_answers"],
        )

        # Complete assessment
        results = AssessmentService.complete_assessment(client, aid, user_id)

        assert results["status"] == "completed"
        assert results["mcq_score"] > 0
        assert results["msq_score"] > 0
        assert results["total_score"] >= results["mcq_score"] + results["msq_score"]

        # Questions detail must now include correct answers and explanations
        eval_mcq = next(q for q in results["questions"] if q["question_id"] == mcq_q["id"])
        assert eval_mcq["is_correct"] is True
        assert eval_mcq["correct_answer"] == mcq_q["correct_answer"]
        assert eval_mcq["explanation"] is not None
