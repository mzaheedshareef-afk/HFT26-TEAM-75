-- ============================================================
-- Supabase Schema Migration: Recruiter Backend, Shortlisting & Candidate Discovery
-- File: database/migrations/005_recruiter_and_shortlists.sql
-- ============================================================

-- 1. Create company_profiles table for company metadata and settings
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    location TEXT,
    description TEXT,
    company_size TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_id ON public.company_profiles(id);

-- 2. Create company_shortlists table
CREATE TABLE IF NOT EXISTS public.company_shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recruiter_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_company_student_shortlist UNIQUE (company_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlists_company_id ON public.company_shortlists(company_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_student_id ON public.company_shortlists(student_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_created_at ON public.company_shortlists(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_shortlists ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for company_profiles
DROP POLICY IF EXISTS "Companies can view own company profile" ON public.company_profiles;
CREATE POLICY "Companies can view own company profile"
    ON public.company_profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can insert own company profile" ON public.company_profiles;
CREATE POLICY "Companies can insert own company profile"
    ON public.company_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can update own company profile" ON public.company_profiles;
CREATE POLICY "Companies can update own company profile"
    ON public.company_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 5. RLS Policies for company_shortlists
-- Strictly isolated: only the owning company can read, add, update, or remove shortlist items.
DROP POLICY IF EXISTS "Companies can view own shortlist only" ON public.company_shortlists;
CREATE POLICY "Companies can view own shortlist only"
    ON public.company_shortlists FOR SELECT
    USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can insert to own shortlist only" ON public.company_shortlists;
CREATE POLICY "Companies can insert to own shortlist only"
    ON public.company_shortlists FOR INSERT
    WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can update notes on own shortlist only" ON public.company_shortlists;
CREATE POLICY "Companies can update notes on own shortlist only"
    ON public.company_shortlists FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can delete from own shortlist only" ON public.company_shortlists;
CREATE POLICY "Companies can delete from own shortlist only"
    ON public.company_shortlists FOR DELETE
    USING (auth.uid() = company_id);

-- 6. Updated_at trigger for company_profiles and company_shortlists
DROP TRIGGER IF EXISTS set_company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER set_company_profiles_updated_at
    BEFORE UPDATE ON public.company_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_company_shortlists_updated_at ON public.company_shortlists;
CREATE TRIGGER set_company_shortlists_updated_at
    BEFORE UPDATE ON public.company_shortlists
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
