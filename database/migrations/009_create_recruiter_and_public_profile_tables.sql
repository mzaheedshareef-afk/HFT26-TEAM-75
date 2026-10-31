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
