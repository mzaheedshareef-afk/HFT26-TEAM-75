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

