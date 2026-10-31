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
