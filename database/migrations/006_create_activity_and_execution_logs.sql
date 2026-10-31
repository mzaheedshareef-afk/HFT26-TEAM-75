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

