-- ============================================================
-- VERITY Database Migration: 004_create_response_and_submission_tables.sql
-- Part 5: Candidate Responses and Submissions
-- ============================================================

-- 1. Candidate Answers Table (for MCQ, MSQ, Short Answer, Code Fill)
CREATE TABLE IF NOT EXISTS public.candidate_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
    text_response TEXT,
    is_correct BOOLEAN,
    points_awarded NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (points_awarded >= 0),
    answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attempt_question_answer UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON public.candidate_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.candidate_answers(question_id);

-- 2. Coding Submissions Table
CREATE TABLE IF NOT EXISTS public.coding_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE SET NULL,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK (language IN ('python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'c++', 'go', 'rust')),
    source_code TEXT NOT NULL,
    execution_status TEXT NOT NULL CHECK (execution_status IN (
        'passed', 'failed', 'compilation_error', 'runtime_error',
        'time_limit_exceeded', 'memory_limit_exceeded', 'security_violation',
        'accepted', 'wrong_answer', 'system_error'
    )),
    status TEXT,
    test_cases_passed INT NOT NULL DEFAULT 0,
    passed_tests INT DEFAULT 0,
    total_test_cases INT NOT NULL DEFAULT 0,
    total_tests INT DEFAULT 0,
    failed_tests INT NOT NULL DEFAULT 0,
    execution_time_ms INT NOT NULL DEFAULT 0,
    memory_used_kb INT NOT NULL DEFAULT 0,
    memory_used_mb FLOAT DEFAULT 0.0,
    compiler_output TEXT,
    error_message TEXT,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (score >= 0 AND score <= 100),
    test_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coding_subs_student ON public.coding_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_coding_subs_user ON public.coding_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_subs_assessment ON public.coding_submissions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_coding_subs_question ON public.coding_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_coding_subs_attempt ON public.coding_submissions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_coding_subs_created_at ON public.coding_submissions(created_at DESC);

-- 3. Submission Test Results Table
CREATE TABLE IF NOT EXISTS public.submission_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.coding_submissions(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES public.question_test_cases(id) ON DELETE SET NULL,
    passed BOOLEAN NOT NULL,
    actual_output TEXT,
    execution_time_ms INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sub_test_results_submission ON public.submission_test_results(submission_id);

-- 4. Backward Compatibility View for legacy 'submissions' table
CREATE OR REPLACE VIEW public.submissions AS
SELECT 
    id,
    COALESCE(user_id, student_id) AS user_id,
    student_id,
    assessment_id,
    question_id,
    attempt_id,
    language,
    source_code,
    COALESCE(status, execution_status) AS status,
    execution_status,
    test_results,
    score,
    COALESCE(total_tests, total_test_cases) AS total_tests,
    COALESCE(passed_tests, test_cases_passed) AS passed_tests,
    failed_tests,
    execution_time_ms,
    COALESCE(memory_used_mb, (memory_used_kb::float / 1024.0)) AS memory_used_mb,
    COALESCE(error_message, compiler_output) AS error_message,
    created_at
FROM public.coding_submissions;
