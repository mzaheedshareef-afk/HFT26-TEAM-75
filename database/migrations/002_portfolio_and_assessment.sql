-- ============================================================
-- Supabase Schema Migration: Portfolio & Personalized Assessment
-- File: database/migrations/002_portfolio_and_assessment.sql
-- ============================================================

-- 1. Create portfolios table
CREATE TABLE IF NOT EXISTS public.portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    headline TEXT,
    bio TEXT,
    github_username TEXT,
    linkedin_url TEXT,
    experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    raw_json JSONB NOT NULL,
    parsed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for portfolio lookups
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_experience ON public.portfolios(experience_level);

-- 2. Create assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'Software Engineer',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'in_progress', 'completed', 'expired')) DEFAULT 'ready',
    total_time_limit_minutes INT NOT NULL DEFAULT 60,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);

-- 3. Create assessment_questions table
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    category TEXT NOT NULL,
    target_skill TEXT NOT NULL,
    starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    reference_solution TEXT,
    time_limit_seconds FLOAT NOT NULL DEFAULT 2.0,
    memory_limit_mb INT NOT NULL DEFAULT 256,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'validated', 'rejected')) DEFAULT 'validated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON public.assessment_questions(assessment_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for portfolios
DROP POLICY IF EXISTS "Students can view own portfolio" ON public.portfolios;
CREATE POLICY "Students can view own portfolio"
    ON public.portfolios FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own portfolio" ON public.portfolios;
CREATE POLICY "Students can insert own portfolio"
    ON public.portfolios FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can update own portfolio" ON public.portfolios;
CREATE POLICY "Students can update own portfolio"
    ON public.portfolios FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policies for assessments
DROP POLICY IF EXISTS "Students can view own assessments" ON public.assessments;
CREATE POLICY "Students can view own assessments"
    ON public.assessments FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own assessments" ON public.assessments;
CREATE POLICY "Students can insert own assessments"
    ON public.assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 7. RLS Policies for assessment_questions
-- Candidates can view questions for assessments they own
DROP POLICY IF EXISTS "Users can view questions for own assessment" ON public.assessment_questions;
CREATE POLICY "Users can view questions for own assessment"
    ON public.assessment_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_questions.assessment_id AND a.user_id = auth.uid()
        )
    );
