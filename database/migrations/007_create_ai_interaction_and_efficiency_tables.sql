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

