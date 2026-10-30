-- ============================================================
-- Supabase Schema Migration: AI Hints, Analytics & Public Profiles
-- File: database/migrations/004_ai_hints_analytics_profiles.sql
-- ============================================================

-- 1. Create ai_hint_interactions table
CREATE TABLE IF NOT EXISTS public.ai_hint_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    hint_level INT NOT NULL CHECK (hint_level IN (1, 2, 3)),
    hint_text TEXT NOT NULL,
    sanitized_redacted BOOLEAN NOT NULL DEFAULT FALSE,
    request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('delivered', 'rejected', 'failed')) DEFAULT 'delivered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_hint_user_id ON public.ai_hint_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_hint_assessment_id ON public.ai_hint_interactions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_hint_question_id ON public.ai_hint_interactions(question_id);
CREATE INDEX IF NOT EXISTS idx_ai_hint_created_at ON public.ai_hint_interactions(created_at DESC);

-- 2. Create assessment_ai_metrics table
CREATE TABLE IF NOT EXISTS public.assessment_ai_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_hints_requested INT NOT NULL DEFAULT 0,
    hints_by_level JSONB NOT NULL DEFAULT '{"1": 0, "2": 0, "3": 0}'::jsonb,
    questions_with_hints INT NOT NULL DEFAULT 0,
    hint_frequency_per_question FLOAT DEFAULT 0.0,
    coding_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (coding_score >= 0 AND coding_score <= 100),
    ai_efficiency_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0 CHECK (ai_efficiency_score >= 0 AND ai_efficiency_score <= 100),
    final_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (final_score >= 0 AND final_score <= 100),
    formula_version TEXT NOT NULL DEFAULT 'v1.0',
    scoring_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON public.assessment_ai_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_assessment_id ON public.assessment_ai_metrics(assessment_id);

-- 3. Create student_public_profiles table
CREATE TABLE IF NOT EXISTS public.student_public_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    share_id TEXT NOT NULL UNIQUE,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'private',
    public_name TEXT NOT NULL,
    headline TEXT,
    bio TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    technologies JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    portfolio_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    verified_achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
    performance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_public_profiles_user_id ON public.student_public_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_share_id ON public.student_public_profiles(share_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_visibility ON public.student_public_profiles(visibility);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ai_hint_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_ai_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_public_profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for ai_hint_interactions
DROP POLICY IF EXISTS "Students can view own hint interactions" ON public.ai_hint_interactions;
CREATE POLICY "Students can view own hint interactions"
    ON public.ai_hint_interactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own hint interactions" ON public.ai_hint_interactions;
CREATE POLICY "Students can insert own hint interactions"
    ON public.ai_hint_interactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Prevent hint interaction update" ON public.ai_hint_interactions;
CREATE POLICY "Prevent hint interaction update"
    ON public.ai_hint_interactions FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "Prevent hint interaction deletion" ON public.ai_hint_interactions;
CREATE POLICY "Prevent hint interaction deletion"
    ON public.ai_hint_interactions FOR DELETE
    USING (false);

-- 6. RLS Policies for assessment_ai_metrics
DROP POLICY IF EXISTS "Students can view own ai metrics" ON public.assessment_ai_metrics;
CREATE POLICY "Students can view own ai metrics"
    ON public.assessment_ai_metrics FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can insert own ai metrics" ON public.assessment_ai_metrics;
CREATE POLICY "Students can insert own ai metrics"
    ON public.assessment_ai_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can update own ai metrics" ON public.assessment_ai_metrics;
CREATE POLICY "Students can update own ai metrics"
    ON public.assessment_ai_metrics FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. RLS Policies for student_public_profiles
DROP POLICY IF EXISTS "Students can view own public profile" ON public.student_public_profiles;
CREATE POLICY "Students can view own public profile"
    ON public.student_public_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public profile when visibility is public" ON public.student_public_profiles;
CREATE POLICY "Anyone can view public profile when visibility is public"
    ON public.student_public_profiles FOR SELECT
    USING (visibility = 'public');

DROP POLICY IF EXISTS "Students can insert own public profile" ON public.student_public_profiles;
CREATE POLICY "Students can insert own public profile"
    ON public.student_public_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can update own public profile" ON public.student_public_profiles;
CREATE POLICY "Students can update own public profile"
    ON public.student_public_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

