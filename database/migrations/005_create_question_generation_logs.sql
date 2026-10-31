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

