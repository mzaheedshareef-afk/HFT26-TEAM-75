-- ============================================================
-- Supabase Schema Migration: Submissions & Automated Grading
-- File: database/migrations/003_submissions_and_grading.sql
-- ============================================================

-- 1. Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK (language IN ('python', 'java', 'cpp', 'c++')),
    source_code TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'accepted', 'wrong_answer', 'time_limit_exceeded',
        'memory_limit_exceeded', 'compilation_error', 'runtime_error',
        'security_violation', 'system_error'
    )),
    test_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (score >= 0 AND score <= 100),
    total_tests INT NOT NULL DEFAULT 0,
    passed_tests INT NOT NULL DEFAULT 0,
    failed_tests INT NOT NULL DEFAULT 0,
    execution_time_ms FLOAT DEFAULT 0.0,
    memory_used_mb FLOAT DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for submission queries
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assessment_id ON public.submissions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question_id ON public.submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);

-- 2. Create assessment_results table for final rolled-up scores
CREATE TABLE IF NOT EXISTS public.assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (total_score >= 0 AND total_score <= 100),
    questions_count INT NOT NULL DEFAULT 0,
    questions_passed INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'evaluated')) DEFAULT 'in_progress',
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_user_id ON public.assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment_id ON public.assessment_results(assessment_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for submissions
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
CREATE POLICY "Students can view own submissions"
    ON public.submissions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own submissions" ON public.submissions;
CREATE POLICY "Students can insert own submissions"
    ON public.submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Submissions are immutable
DROP POLICY IF EXISTS "Prevent submission update" ON public.submissions;
CREATE POLICY "Prevent submission update"
    ON public.submissions FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "Prevent submission deletion" ON public.submissions;
CREATE POLICY "Prevent submission deletion"
    ON public.submissions FOR DELETE
    USING (false);

-- 5. RLS Policies for assessment_results
DROP POLICY IF EXISTS "Students can view own assessment results" ON public.assessment_results;
CREATE POLICY "Students can view own assessment results"
    ON public.assessment_results FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own assessment results" ON public.assessment_results;
CREATE POLICY "Students can insert own assessment results"
    ON public.assessment_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can update own assessment results" ON public.assessment_results;
CREATE POLICY "Students can update own assessment results"
    ON public.assessment_results FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
