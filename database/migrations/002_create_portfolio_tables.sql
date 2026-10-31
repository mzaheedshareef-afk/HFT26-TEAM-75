-- ============================================================
-- VERITY Database Migration: 002_create_portfolio_tables.sql
-- Part 3: Portfolio Management
-- ============================================================

-- 1. Portfolios Table
CREATE TABLE IF NOT EXISTS public.portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    headline TEXT,
    bio TEXT,
    resume_url TEXT,
    github_url TEXT,
    github_username TEXT,
    linkedin_url TEXT,
    website_url TEXT,
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    parsed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    parsed_education JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_extracted_text TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for portfolios
CREATE INDEX IF NOT EXISTS idx_portfolios_student_id ON public.portfolios(student_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_experience_level ON public.portfolios(experience_level);
CREATE INDEX IF NOT EXISTS idx_portfolios_is_verified ON public.portfolios(is_verified);

-- 2. Portfolio Versions Table
CREATE TABLE IF NOT EXISTS public.portfolio_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_portfolio_version UNIQUE (portfolio_id, version_number)
);

-- Indexes for portfolio_versions
CREATE INDEX IF NOT EXISTS idx_portfolio_versions_portfolio_id ON public.portfolio_versions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_versions_version ON public.portfolio_versions(portfolio_id, version_number DESC);

