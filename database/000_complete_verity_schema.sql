-- ============================================================
-- VERITY COMPLETE DATABASE SCHEMA & MIGRATIONS
-- Platform: Portfolio-Driven Adaptive Coding & Assessment
-- Team: HFT26-TEAM-75
-- Generated: 2026-10-31
-- Includes all 29 relational tables, compatibility views,
-- indexes, triggers, and Row Level Security (RLS) policies.
-- ============================================================

-- >>> START: 001_create_user_and_profile_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 001_create_user_and_profile_tables.sql
-- Part 2: User and Profile Management
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (Core user table linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'company', 'admin')),
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- In case profiles table already existed from earlier schema without avatar_url or admin role:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Indexes on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- 2. Company Profiles Table
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    company_size TEXT,
    description TEXT,
    logo_url TEXT,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes on company_profiles
CREATE INDEX IF NOT EXISTS idx_company_profiles_id ON public.company_profiles(id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_name ON public.company_profiles(company_name);


-- >>> END: 001_create_user_and_profile_tables.sql <<<


-- >>> START: 002_create_portfolio_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 002_create_portfolio_tables.sql
-- Part 3: Portfolio Management
-- ============================================================

-- 1. Portfolios Table
CREATE TABLE IF NOT EXISTS public.portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    headline TEXT,
    bio TEXT,
    resume_url TEXT,
    github_url TEXT,
    github_username TEXT,
    linkedin_url TEXT,
    website_url TEXT,
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    parsed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_education JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_extracted_text TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for portfolios
CREATE INDEX IF NOT EXISTS idx_portfolios_student_id ON public.portfolios(student_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_experience_level ON public.portfolios(experience_level);
CREATE INDEX IF NOT EXISTS idx_portfolios_is_verified ON public.portfolios(is_verified);

-- 2. Portfolio Versions Table
CREATE TABLE IF NOT EXISTS public.portfolio_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_portfolio_version UNIQUE (portfolio_id, version_number)
);

-- Indexes for portfolio_versions
CREATE INDEX IF NOT EXISTS idx_portfolio_versions_portfolio_id ON public.portfolio_versions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_versions_version ON public.portfolio_versions(portfolio_id, version_number DESC);


-- >>> END: 002_create_portfolio_tables.sql <<<


-- >>> START: 003_create_assessment_and_question_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 003_create_assessment_and_question_tables.sql
-- Part 4: Assessment and Examination Core
-- ============================================================

-- 1. Assessments Table
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'Software Engineering',
    target_role TEXT DEFAULT 'Software Engineer',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'expired', 'ready', 'generating')) DEFAULT 'ready',
    total_questions INT NOT NULL DEFAULT 0,
    total_time_minutes INT NOT NULL DEFAULT 60,
    total_time_limit_minutes INT DEFAULT 60,
    pass_percentage NUMERIC(5, 2) NOT NULL DEFAULT 60.0 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessments_student_id ON public.assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_difficulty ON public.assessments(difficulty);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON public.assessments(created_at DESC);

-- 2. Assessment Attempts Table
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    time_spent_seconds INT NOT NULL DEFAULT 0,
    final_score NUMERIC(5, 2) CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned', 'timed_out')) DEFAULT 'in_progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_assessment_attempt UNIQUE (assessment_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_attempts_assessment_id ON public.assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_id ON public.assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.assessment_attempts(status);

-- 3. Assessment Questions Table (supports MCQ, MSQ, coding, short_answer, code_fill)
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_order INT NOT NULL DEFAULT 1,
    order_index INT DEFAULT 1,
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'msq', 'coding', 'short_answer', 'code_fill')) DEFAULT 'coding',
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    topic TEXT NOT NULL DEFAULT 'General',
    category TEXT,
    target_skill TEXT,
    points NUMERIC(5, 2) NOT NULL DEFAULT 10.0 CHECK (points >= 0),
    starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
    solution_code TEXT,
    reference_solution TEXT,
    sample_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_memory_limit_mb INT NOT NULL DEFAULT 256,
    memory_limit_mb INT DEFAULT 256,
    execution_time_limit_ms INT NOT NULL DEFAULT 2000,
    time_limit_seconds FLOAT DEFAULT 2.0,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'validated', 'rejected')) DEFAULT 'validated',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON public.assessment_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.assessment_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.assessment_questions(topic);

-- 4. Question Options Table (for MCQ and MSQ questions)
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    option_key TEXT NOT NULL, -- e.g. 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_question_option_key UNIQUE (question_id, option_key)
);

CREATE INDEX IF NOT EXISTS idx_options_question_id ON public.question_options(question_id);

-- 5. Question Test Cases Table (for coding questions)
CREATE TABLE IF NOT EXISTS public.question_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_sample BOOLEAN NOT NULL DEFAULT false,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    weight NUMERIC(5, 2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_test_cases_question_id ON public.question_test_cases(question_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_is_sample ON public.question_test_cases(question_id, is_sample);


-- >>> END: 003_create_assessment_and_question_tables.sql <<<


-- >>> START: 004_create_response_and_submission_tables.sql <<<

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


-- >>> END: 004_create_response_and_submission_tables.sql <<<


-- >>> START: 005_create_question_generation_logs.sql <<<

-- ============================================================
-- VERITY Database Migration: 005_create_question_generation_logs.sql
-- Part 6: Question Generation Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    generation_duration_ms INT NOT NULL DEFAULT 0,
    validation_passed BOOLEAN NOT NULL DEFAULT true,
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_qgen_logs_assessment_id ON public.question_generation_logs(assessment_id);
CREATE INDEX IF NOT EXISTS idx_qgen_logs_model ON public.question_generation_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_qgen_logs_created_at ON public.question_generation_logs(created_at DESC);


-- >>> END: 005_create_question_generation_logs.sql <<<


-- >>> START: 006_create_activity_and_execution_logs.sql <<<

-- ============================================================
-- VERITY Database Migration: 006_create_activity_and_execution_logs.sql
-- Part 7: User Action and Activity Tracking
-- Part 8: Code Execution Tracking
-- ============================================================

-- 1. User Activity Logs Table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.user_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.user_activity_logs(user_id, created_at DESC);

-- 2. Code Execution Logs Table
CREATE TABLE IF NOT EXISTS public.code_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
    language TEXT NOT NULL,
    code_hash TEXT,
    execution_status TEXT NOT NULL,
    execution_duration_ms INT NOT NULL DEFAULT 0,
    memory_peak_kb INT NOT NULL DEFAULT 0,
    sandbox_id TEXT,
    exit_code INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_code_exec_user_id ON public.code_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_code_exec_question_id ON public.code_execution_logs(question_id);
CREATE INDEX IF NOT EXISTS idx_code_exec_status ON public.code_execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_code_exec_user_question ON public.code_execution_logs(user_id, question_id, created_at DESC);


-- >>> END: 006_create_activity_and_execution_logs.sql <<<


-- >>> START: 007_create_ai_interaction_and_efficiency_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 007_create_ai_interaction_and_efficiency_tables.sql
-- Part 9: AI Interaction and Hint Tracking
-- ============================================================

-- 1. AI Interactions Table (Tracks all student interactions with AI)
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('hint_request', 'explanation_request', 'code_review', 'general_query')),
    prompt TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    response_duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_student ON public.ai_interactions(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_assessment ON public.ai_interactions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_question ON public.ai_interactions(question_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON public.ai_interactions(created_at DESC);

-- 2. Hint History Table (Granular record of progressive hints requested)
CREATE TABLE IF NOT EXISTS public.hint_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID REFERENCES public.ai_interactions(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    hint_level INT NOT NULL CHECK (hint_level IN (1, 2, 3)),
    hint_content TEXT NOT NULL,
    hint_text TEXT,
    score_penalty NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (score_penalty >= 0),
    sanitized_redacted BOOLEAN NOT NULL DEFAULT false,
    request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('delivered', 'rejected', 'failed')) DEFAULT 'delivered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_hint_history_student ON public.hint_history(student_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_user ON public.hint_history(user_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_assessment ON public.hint_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_question ON public.hint_history(question_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_created_at ON public.hint_history(created_at DESC);

-- Backward compatibility view for legacy 'ai_hint_interactions'
CREATE OR REPLACE VIEW public.ai_hint_interactions AS
SELECT
    id,
    COALESCE(user_id, student_id) AS user_id,
    student_id,
    assessment_id,
    question_id,
    hint_level,
    COALESCE(hint_text, hint_content) AS hint_text,
    hint_content,
    sanitized_redacted,
    request_metadata,
    status,
    created_at
FROM public.hint_history;

-- 3. AI Efficiency Scores Table (Evaluates candidate AI dependency)
CREATE TABLE IF NOT EXISTS public.ai_efficiency_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    raw_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (raw_score >= 0 AND raw_score <= 100),
    penalty_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (penalty_score >= 0),
    final_efficiency_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0 CHECK (final_efficiency_score >= 0 AND final_efficiency_score <= 100),
    ai_efficiency_score NUMERIC(5, 2) DEFAULT 100.0,
    total_hints_used INT NOT NULL DEFAULT 0,
    total_hints_requested INT DEFAULT 0,
    hints_by_level JSONB NOT NULL DEFAULT '{"1": 0, "2": 0, "3": 0}'::jsonb,
    questions_with_hints INT NOT NULL DEFAULT 0,
    hint_frequency_per_question FLOAT DEFAULT 0.0,
    coding_score NUMERIC(5, 2) DEFAULT 0.0,
    final_score NUMERIC(5, 2) DEFAULT 0.0,
    avg_time_between_hints_sec INT NOT NULL DEFAULT 0,
    formula_version TEXT NOT NULL DEFAULT 'v1.0',
    scoring_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_ai_efficiency_assessment UNIQUE (assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_eff_student ON public.ai_efficiency_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_eff_user ON public.ai_efficiency_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_eff_assessment ON public.ai_efficiency_scores(assessment_id);

-- Backward compatibility view for legacy 'assessment_ai_metrics'
CREATE OR REPLACE VIEW public.assessment_ai_metrics AS
SELECT
    id,
    assessment_id,
    COALESCE(user_id, student_id) AS user_id,
    student_id,
    COALESCE(total_hints_requested, total_hints_used) AS total_hints_requested,
    total_hints_used,
    hints_by_level,
    questions_with_hints,
    hint_frequency_per_question,
    COALESCE(coding_score, raw_score) AS coding_score,
    COALESCE(ai_efficiency_score, final_efficiency_score) AS ai_efficiency_score,
    COALESCE(final_score, raw_score) AS final_score,
    formula_version,
    scoring_components,
    created_at,
    updated_at
FROM public.ai_efficiency_scores;


-- >>> END: 007_create_ai_interaction_and_efficiency_tables.sql <<<


-- >>> START: 008_create_results_and_analytics_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 008_create_results_and_analytics_tables.sql
-- Part 10: Results and Analytics
-- ============================================================

-- 1. Assessment Results Table (Rolled-up performance metrics per assessment)
CREATE TABLE IF NOT EXISTS public.assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE SET NULL,
    total_questions INT NOT NULL DEFAULT 0,
    questions_count INT DEFAULT 0,
    correct_answers INT NOT NULL DEFAULT 0,
    questions_passed INT DEFAULT 0,
    total_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (total_score >= 0 AND total_score <= 100),
    max_possible_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (percentage >= 0 AND percentage <= 100),
    passed BOOLEAN NOT NULL DEFAULT false,
    completion_time_seconds INT NOT NULL DEFAULT 0,
    rank_in_assessment INT,
    percentile NUMERIC(5, 2) CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 100)),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'evaluated')) DEFAULT 'completed',
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_assessment_results_assessment UNIQUE (assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_student ON public.assessment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON public.assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment ON public.assessment_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_score ON public.assessment_results(total_score DESC);

-- 2. Topic Performance Table (Skill-wise breakdown per assessment)
CREATE TABLE IF NOT EXISTS public.topic_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    questions_attempted INT NOT NULL DEFAULT 0,
    questions_correct INT NOT NULL DEFAULT 0,
    accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (accuracy_percentage >= 0 AND accuracy_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_topic_perf_student_topic ON public.topic_performance(student_id, topic);
CREATE INDEX IF NOT EXISTS idx_topic_perf_assessment ON public.topic_performance(assessment_id);

-- 3. Consistency Records Table (Tracks performance stability across time)
CREATE TABLE IF NOT EXISTS public.consistency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
    evaluation_window_days INT NOT NULL DEFAULT 30,
    data_points_count INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_consistency_student ON public.consistency_records(student_id);
CREATE INDEX IF NOT EXISTS idx_consistency_recorded ON public.consistency_records(student_id, recorded_at DESC);

-- 4. Improvement Records Table (Tracks skill growth deltas)
CREATE TABLE IF NOT EXISTS public.improvement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    initial_score NUMERIC(5, 2) NOT NULL CHECK (initial_score >= 0 AND initial_score <= 100),
    current_score NUMERIC(5, 2) NOT NULL CHECK (current_score >= 0 AND current_score <= 100),
    delta_percentage NUMERIC(5, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_improvement_student ON public.improvement_records(student_id);
CREATE INDEX IF NOT EXISTS idx_improvement_topic ON public.improvement_records(student_id, topic);

-- 5. Student Analytics Table (Aggregated candidate intelligence across all assessments)
CREATE TABLE IF NOT EXISTS public.student_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_assessments_taken INT NOT NULL DEFAULT 0,
    total_assessments_passed INT NOT NULL DEFAULT 0,
    average_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (average_score >= 0 AND average_score <= 100),
    highest_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (highest_score >= 0 AND highest_score <= 100),
    overall_consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (overall_consistency_score >= 0 AND overall_consistency_score <= 100),
    overall_ai_efficiency_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (overall_ai_efficiency_score >= 0 AND overall_ai_efficiency_score <= 100),
    coding_accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (coding_accuracy_percentage >= 0 AND coding_accuracy_percentage <= 100),
    mcq_accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (mcq_accuracy_percentage >= 0 AND mcq_accuracy_percentage <= 100),
    total_coding_submissions INT NOT NULL DEFAULT 0,
    total_hints_consumed INT NOT NULL DEFAULT 0,
    favorite_language TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_student_analytics_student ON public.student_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_avg_score ON public.student_analytics(average_score DESC);


-- >>> END: 008_create_results_and_analytics_tables.sql <<<


-- >>> START: 009_create_recruiter_and_public_profile_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 009_create_recruiter_and_public_profile_tables.sql
-- Part 11: Recruiter Platform
-- ============================================================

-- 1. Candidate Shortlists Table (Recruiter bookmarking and tracking)
CREATE TABLE IF NOT EXISTS public.candidate_shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('reviewing', 'interviewing', 'offered', 'rejected', 'archived', 'shortlisted')) DEFAULT 'shortlisted',
    notes TEXT DEFAULT '',
    recruiter_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_candidate UNIQUE (company_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlists_company_id ON public.candidate_shortlists(company_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_student_id ON public.candidate_shortlists(student_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_status ON public.candidate_shortlists(company_id, status);
CREATE INDEX IF NOT EXISTS idx_shortlists_created_at ON public.candidate_shortlists(created_at DESC);

-- Backward compatibility view for legacy 'company_shortlists'
CREATE OR REPLACE VIEW public.company_shortlists AS
SELECT
    id,
    company_id,
    student_id,
    COALESCE(recruiter_notes, notes) AS recruiter_notes,
    status,
    created_at,
    updated_at
FROM public.candidate_shortlists;

-- 2. Recruiter Notes Table (Free-form recruiter comments per candidate)
CREATE TABLE IF NOT EXISTS public.recruiter_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recruiter_notes_company ON public.recruiter_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_notes_student ON public.recruiter_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_notes_created_at ON public.recruiter_notes(company_id, student_id, created_at DESC);

-- 3. Public Profiles Table (Candidate discoverable portfolio/verification profile)
CREATE TABLE IF NOT EXISTS public.public_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    share_slug TEXT NOT NULL UNIQUE,
    share_id TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'public',
    is_searchable BOOLEAN NOT NULL DEFAULT true,
    public_name TEXT NOT NULL DEFAULT '',
    headline TEXT,
    bio TEXT,
    show_scores BOOLEAN NOT NULL DEFAULT true,
    show_ai_efficiency BOOLEAN NOT NULL DEFAULT true,
    show_projects BOOLEAN NOT NULL DEFAULT true,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    technologies JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    portfolio_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    verified_achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
    performance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    view_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_public_profiles_student ON public.public_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_user ON public.public_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_slug ON public.public_profiles(share_slug);
CREATE INDEX IF NOT EXISTS idx_public_profiles_search ON public.public_profiles(is_searchable, visibility);

-- Backward compatibility view for legacy 'student_public_profiles'
CREATE OR REPLACE VIEW public.student_public_profiles AS
SELECT
    id,
    COALESCE(user_id, student_id) AS user_id,
    student_id,
    COALESCE(share_id, share_slug) AS share_id,
    share_slug,
    visibility,
    public_name,
    headline,
    bio,
    skills,
    technologies,
    projects,
    portfolio_highlights,
    verified_achievements,
    performance_summary,
    created_at,
    updated_at
FROM public.public_profiles;


-- >>> END: 009_create_recruiter_and_public_profile_tables.sql <<<


-- >>> START: 010_create_proctoring_tables.sql <<<

-- ============================================================
-- VERITY Database Migration: 010_create_proctoring_tables.sql
-- Part 12: Examination Proctoring and Monitoring
-- ============================================================

-- 1. Proctoring Sessions Table (Live tracking of exam integrity)
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    tab_switches_count INT NOT NULL DEFAULT 0,
    full_screen_exits_count INT NOT NULL DEFAULT 0,
    multiple_faces_detected_count INT NOT NULL DEFAULT 0,
    no_face_detected_count INT NOT NULL DEFAULT 0,
    audio_events_count INT NOT NULL DEFAULT 0,
    total_suspicious_events INT NOT NULL DEFAULT 0,
    trust_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0 CHECK (trust_score >= 0 AND trust_score <= 100),
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'terminated_fraud', 'flagged')) DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proctoring_token ON public.proctoring_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_proctoring_assessment ON public.proctoring_sessions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_student ON public.proctoring_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_status ON public.proctoring_sessions(status);

-- 2. Proctoring Events Table (Audit log of discrete suspicious actions)
CREATE TABLE IF NOT EXISTS public.proctoring_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'tab_switch', 'window_blur', 'fullscreen_exit', 'paste_action',
        'multiple_faces', 'no_face', 'voice_detected', 'device_disconnected'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_url TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_proctoring_events_session ON public.proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_severity ON public.proctoring_events(severity);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_recorded ON public.proctoring_events(session_id, recorded_at DESC);

-- 3. Clipboard Events Table (Tracks suspicious copy/paste behavior)
CREATE TABLE IF NOT EXISTS public.clipboard_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('copy', 'paste', 'cut')),
    payload_length INT NOT NULL DEFAULT 0,
    content_snippet TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_clipboard_student ON public.clipboard_events(student_id);
CREATE INDEX IF NOT EXISTS idx_clipboard_session ON public.clipboard_events(session_id);
CREATE INDEX IF NOT EXISTS idx_clipboard_question ON public.clipboard_events(question_id);
CREATE INDEX IF NOT EXISTS idx_clipboard_recorded ON public.clipboard_events(student_id, recorded_at DESC);


-- >>> END: 010_create_proctoring_tables.sql <<<


-- >>> START: 011_create_triggers_and_functions.sql <<<

-- ============================================================
-- VERITY Database Migration: 011_create_triggers_and_functions.sql
-- Part 14: Database Triggers, Functions and Constraints
-- ============================================================

-- 1. Generic updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger across all stateful tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER set_company_profiles_updated_at
    BEFORE UPDATE ON public.company_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER set_portfolios_updated_at
    BEFORE UPDATE ON public.portfolios
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_assessments_updated_at ON public.assessments;
CREATE TRIGGER set_assessments_updated_at
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_ai_efficiency_scores_updated_at ON public.ai_efficiency_scores;
CREATE TRIGGER set_ai_efficiency_scores_updated_at
    BEFORE UPDATE ON public.ai_efficiency_scores
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_assessment_results_updated_at ON public.assessment_results;
CREATE TRIGGER set_assessment_results_updated_at
    BEFORE UPDATE ON public.assessment_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_candidate_shortlists_updated_at ON public.candidate_shortlists;
CREATE TRIGGER set_candidate_shortlists_updated_at
    BEFORE UPDATE ON public.candidate_shortlists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_public_profiles_updated_at ON public.public_profiles;
CREATE TRIGGER set_public_profiles_updated_at
    BEFORE UPDATE ON public.public_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_student_analytics_updated_at ON public.student_analytics;
CREATE TRIGGER set_student_analytics_updated_at
    BEFORE UPDATE ON public.student_analytics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Auth user sync trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Compatibility sync trigger for student_id / user_id
CREATE OR REPLACE FUNCTION public.sync_student_and_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.student_id IS NULL AND NEW.user_id IS NOT NULL THEN
        NEW.student_id := NEW.user_id;
    ELSIF NEW.user_id IS NULL AND NEW.student_id IS NOT NULL THEN
        NEW.user_id := NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_portfolios_ids ON public.portfolios;
CREATE TRIGGER sync_portfolios_ids
    BEFORE INSERT OR UPDATE ON public.portfolios
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_assessments_ids ON public.assessments;
CREATE TRIGGER sync_assessments_ids
    BEFORE INSERT OR UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_coding_submissions_ids ON public.coding_submissions;
CREATE TRIGGER sync_coding_submissions_ids
    BEFORE INSERT OR UPDATE ON public.coding_submissions
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_hint_history_ids ON public.hint_history;
CREATE TRIGGER sync_hint_history_ids
    BEFORE INSERT OR UPDATE ON public.hint_history
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_ai_eff_ids ON public.ai_efficiency_scores;
CREATE TRIGGER sync_ai_eff_ids
    BEFORE INSERT OR UPDATE ON public.ai_efficiency_scores
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_assessment_results_ids ON public.assessment_results;
CREATE TRIGGER sync_assessment_results_ids
    BEFORE INSERT OR UPDATE ON public.assessment_results
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_public_profiles_ids ON public.public_profiles;
CREATE TRIGGER sync_public_profiles_ids
    BEFORE INSERT OR UPDATE ON public.public_profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

-- 4. Proctoring Event Metrics Aggregator Trigger
CREATE OR REPLACE FUNCTION public.aggregate_proctoring_event()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.proctoring_sessions
    SET 
        total_suspicious_events = total_suspicious_events + 1,
        tab_switches_count = tab_switches_count + CASE WHEN NEW.event_type = 'tab_switch' THEN 1 ELSE 0 END,
        full_screen_exits_count = full_screen_exits_count + CASE WHEN NEW.event_type = 'fullscreen_exit' THEN 1 ELSE 0 END,
        multiple_faces_detected_count = multiple_faces_detected_count + CASE WHEN NEW.event_type = 'multiple_faces' THEN 1 ELSE 0 END,
        no_face_detected_count = no_face_detected_count + CASE WHEN NEW.event_type = 'no_face' THEN 1 ELSE 0 END,
        audio_events_count = audio_events_count + CASE WHEN NEW.event_type = 'voice_detected' THEN 1 ELSE 0 END,
        trust_score = GREATEST(0.0, trust_score - CASE 
            WHEN NEW.severity = 'critical' THEN 25.0
            WHEN NEW.severity = 'high' THEN 15.0
            WHEN NEW.severity = 'medium' THEN 8.0
            ELSE 3.0
        END),
        status = CASE 
            WHEN trust_score <= 40.0 THEN 'flagged'
            ELSE status
        END
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_proctoring_event_inserted ON public.proctoring_events;
CREATE TRIGGER on_proctoring_event_inserted
    AFTER INSERT ON public.proctoring_events
    FOR EACH ROW EXECUTE FUNCTION public.aggregate_proctoring_event();

-- 5. Student Analytics Sync Triggers
CREATE OR REPLACE FUNCTION public.update_student_analytics_on_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.student_analytics (student_id, total_coding_submissions, favorite_language, updated_at)
    VALUES (NEW.student_id, 1, NEW.language, timezone('utc'::text, now()))
    ON CONFLICT (student_id) DO UPDATE SET
        total_coding_submissions = public.student_analytics.total_coding_submissions + 1,
        favorite_language = COALESCE(EXCLUDED.favorite_language, public.student_analytics.favorite_language),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_coding_submission_analytics ON public.coding_submissions;
CREATE TRIGGER on_coding_submission_analytics
    AFTER INSERT ON public.coding_submissions
    FOR EACH ROW EXECUTE FUNCTION public.update_student_analytics_on_submission();

CREATE OR REPLACE FUNCTION public.update_student_analytics_on_hint()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.student_analytics (student_id, total_hints_consumed, updated_at)
    VALUES (NEW.student_id, 1, timezone('utc'::text, now()))
    ON CONFLICT (student_id) DO UPDATE SET
        total_hints_consumed = public.student_analytics.total_hints_consumed + 1,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_hint_analytics ON public.hint_history;
CREATE TRIGGER on_hint_analytics
    AFTER INSERT ON public.hint_history
    FOR EACH ROW EXECUTE FUNCTION public.update_student_analytics_on_hint();


-- >>> END: 011_create_triggers_and_functions.sql <<<


-- >>> START: 012_create_rls_policies.sql <<<

-- ============================================================
-- VERITY Database Migration: 012_create_rls_policies.sql
-- Part 13: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all 29 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_efficiency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consistency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. Profiles & Company Profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile except role" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "Prevent user profile deletion" ON public.profiles;
CREATE POLICY "Prevent user profile deletion" ON public.profiles
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Companies can view own company profile" ON public.company_profiles;
CREATE POLICY "Companies can view own company profile" ON public.company_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can insert own company profile" ON public.company_profiles;
CREATE POLICY "Companies can insert own company profile" ON public.company_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can update own company profile" ON public.company_profiles;
CREATE POLICY "Companies can update own company profile" ON public.company_profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. Portfolios & Versions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own portfolio" ON public.portfolios;
CREATE POLICY "Students manage own portfolio" ON public.portfolios
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies can view candidate portfolios" ON public.portfolios;
CREATE POLICY "Companies can view candidate portfolios" ON public.portfolios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.company_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own portfolio versions" ON public.portfolio_versions;
CREATE POLICY "Students view own portfolio versions" ON public.portfolio_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.portfolios p
            WHERE p.id = portfolio_id AND (p.student_id = auth.uid() OR p.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 3. Assessments, Attempts & Questions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own assessments" ON public.assessments;
CREATE POLICY "Students manage own assessments" ON public.assessments
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate assessments" ON public.assessments;
CREATE POLICY "Companies view candidate assessments" ON public.assessments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students manage own attempts" ON public.assessment_attempts;
CREATE POLICY "Students manage own attempts" ON public.assessment_attempts
    FOR ALL USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view questions for their assessments" ON public.assessment_questions;
CREATE POLICY "Students view questions for their assessments" ON public.assessment_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Students view options for their questions" ON public.question_options;
CREATE POLICY "Students view options for their questions" ON public.question_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessments a ON a.id = q.assessment_id
            WHERE q.id = question_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Students view sample test cases" ON public.question_test_cases;
CREATE POLICY "Students view sample test cases" ON public.question_test_cases
    FOR SELECT USING (
        is_sample = true AND EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessments a ON a.id = q.assessment_id
            WHERE q.id = question_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 4. Responses & Submissions (Immutable)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own answers" ON public.candidate_answers;
CREATE POLICY "Students view own answers" ON public.candidate_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            WHERE att.id = attempt_id AND att.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students insert own answers" ON public.candidate_answers;
CREATE POLICY "Students insert own answers" ON public.candidate_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            WHERE att.id = attempt_id AND att.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own coding submissions" ON public.coding_submissions;
CREATE POLICY "Students view own coding submissions" ON public.coding_submissions
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate submissions" ON public.coding_submissions;
CREATE POLICY "Companies view candidate submissions" ON public.coding_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students insert own coding submissions" ON public.coding_submissions;
CREATE POLICY "Students insert own coding submissions" ON public.coding_submissions
    FOR INSERT WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Submissions are immutable - no update" ON public.coding_submissions;
CREATE POLICY "Submissions are immutable - no update" ON public.coding_submissions
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Submissions are immutable - no delete" ON public.coding_submissions;
CREATE POLICY "Submissions are immutable - no delete" ON public.coding_submissions
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Students view submission test results" ON public.submission_test_results;
CREATE POLICY "Students view submission test results" ON public.submission_test_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coding_submissions s
            WHERE s.id = submission_id AND (s.student_id = auth.uid() OR s.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 5. Logs (Activity & Code Execution)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users view own activity logs" ON public.user_activity_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users insert own activity logs" ON public.user_activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own code execution logs" ON public.code_execution_logs;
CREATE POLICY "Users view own code execution logs" ON public.code_execution_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own code execution logs" ON public.code_execution_logs;
CREATE POLICY "Users insert own code execution logs" ON public.code_execution_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. AI Interactions & Hints (Immutable)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own ai interactions" ON public.ai_interactions;
CREATE POLICY "Students view own ai interactions" ON public.ai_interactions
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own ai interactions" ON public.ai_interactions;
CREATE POLICY "Students insert own ai interactions" ON public.ai_interactions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own hint history" ON public.hint_history;
CREATE POLICY "Students view own hint history" ON public.hint_history
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own hint history" ON public.hint_history;
CREATE POLICY "Students insert own hint history" ON public.hint_history
    FOR INSERT WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Hint history is immutable - no update" ON public.hint_history;
CREATE POLICY "Hint history is immutable - no update" ON public.hint_history
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Hint history is immutable - no delete" ON public.hint_history;
CREATE POLICY "Hint history is immutable - no delete" ON public.hint_history
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Students view own ai efficiency" ON public.ai_efficiency_scores;
CREATE POLICY "Students view own ai efficiency" ON public.ai_efficiency_scores
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate ai efficiency" ON public.ai_efficiency_scores;
CREATE POLICY "Companies view candidate ai efficiency" ON public.ai_efficiency_scores
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

-- ------------------------------------------------------------
-- 7. Results & Analytics
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own assessment results" ON public.assessment_results;
CREATE POLICY "Students view own assessment results" ON public.assessment_results
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view assessment results" ON public.assessment_results;
CREATE POLICY "Companies view assessment results" ON public.assessment_results
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students view own topic performance" ON public.topic_performance;
CREATE POLICY "Students view own topic performance" ON public.topic_performance
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own consistency records" ON public.consistency_records;
CREATE POLICY "Students view own consistency records" ON public.consistency_records
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own improvement records" ON public.improvement_records;
CREATE POLICY "Students view own improvement records" ON public.improvement_records
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own student analytics" ON public.student_analytics;
CREATE POLICY "Students view own student analytics" ON public.student_analytics
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Companies view student analytics" ON public.student_analytics;
CREATE POLICY "Companies view student analytics" ON public.student_analytics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

-- ------------------------------------------------------------
-- 8. Recruiter Platform (Strict company isolation)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Companies manage own candidate shortlists" ON public.candidate_shortlists;
CREATE POLICY "Companies manage own candidate shortlists" ON public.candidate_shortlists
    FOR ALL USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies manage own recruiter notes" ON public.recruiter_notes;
CREATE POLICY "Companies manage own recruiter notes" ON public.recruiter_notes
    FOR ALL USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);

-- ------------------------------------------------------------
-- 9. Public Profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own public profile" ON public.public_profiles;
CREATE POLICY "Students manage own public profile" ON public.public_profiles
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view searchable profiles" ON public.public_profiles;
CREATE POLICY "Public can view searchable profiles" ON public.public_profiles
    FOR SELECT USING (is_searchable = true AND visibility = 'public');

-- ------------------------------------------------------------
-- 10. Proctoring & Integrity Monitoring
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Students view own proctoring sessions" ON public.proctoring_sessions
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Students insert own proctoring sessions" ON public.proctoring_sessions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert proctoring events" ON public.proctoring_events;
CREATE POLICY "Students insert proctoring events" ON public.proctoring_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.proctoring_sessions s
            WHERE s.id = session_id AND s.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own proctoring events" ON public.proctoring_events;
CREATE POLICY "Students view own proctoring events" ON public.proctoring_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.proctoring_sessions s
            WHERE s.id = session_id AND s.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students insert clipboard events" ON public.clipboard_events;
CREATE POLICY "Students insert clipboard events" ON public.clipboard_events
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own clipboard events" ON public.clipboard_events;
CREATE POLICY "Students view own clipboard events" ON public.clipboard_events
    FOR SELECT USING (auth.uid() = student_id);


-- >>> END: 012_create_rls_policies.sql <<<

