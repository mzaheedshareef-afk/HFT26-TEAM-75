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

