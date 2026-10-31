-- ============================================================
-- VERITY Database Migration: 012_create_rls_policies.sql
-- Part 13: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all 29 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_efficiency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consistency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. Profiles & Company Profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile except role" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "Prevent user profile deletion" ON public.profiles;
CREATE POLICY "Prevent user profile deletion" ON public.profiles
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Companies can view own company profile" ON public.company_profiles;
CREATE POLICY "Companies can view own company profile" ON public.company_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can insert own company profile" ON public.company_profiles;
CREATE POLICY "Companies can insert own company profile" ON public.company_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Companies can update own company profile" ON public.company_profiles;
CREATE POLICY "Companies can update own company profile" ON public.company_profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. Portfolios & Versions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own portfolio" ON public.portfolios;
CREATE POLICY "Students manage own portfolio" ON public.portfolios
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies can view candidate portfolios" ON public.portfolios;
CREATE POLICY "Companies can view candidate portfolios" ON public.portfolios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.company_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own portfolio versions" ON public.portfolio_versions;
CREATE POLICY "Students view own portfolio versions" ON public.portfolio_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.portfolios p
            WHERE p.id = portfolio_id AND (p.student_id = auth.uid() OR p.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 3. Assessments, Attempts & Questions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own assessments" ON public.assessments;
CREATE POLICY "Students manage own assessments" ON public.assessments
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate assessments" ON public.assessments;
CREATE POLICY "Companies view candidate assessments" ON public.assessments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students manage own attempts" ON public.assessment_attempts;
CREATE POLICY "Students manage own attempts" ON public.assessment_attempts
    FOR ALL USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view questions for their assessments" ON public.assessment_questions;
CREATE POLICY "Students view questions for their assessments" ON public.assessment_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Students view options for their questions" ON public.question_options;
CREATE POLICY "Students view options for their questions" ON public.question_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessments a ON a.id = q.assessment_id
            WHERE q.id = question_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Students view sample test cases" ON public.question_test_cases;
CREATE POLICY "Students view sample test cases" ON public.question_test_cases
    FOR SELECT USING (
        is_sample = true AND EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessments a ON a.id = q.assessment_id
            WHERE q.id = question_id AND (a.student_id = auth.uid() OR a.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 4. Responses & Submissions (Immutable)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own answers" ON public.candidate_answers;
CREATE POLICY "Students view own answers" ON public.candidate_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            WHERE att.id = attempt_id AND att.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students insert own answers" ON public.candidate_answers;
CREATE POLICY "Students insert own answers" ON public.candidate_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts att
            WHERE att.id = attempt_id AND att.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own coding submissions" ON public.coding_submissions;
CREATE POLICY "Students view own coding submissions" ON public.coding_submissions
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate submissions" ON public.coding_submissions;
CREATE POLICY "Companies view candidate submissions" ON public.coding_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students insert own coding submissions" ON public.coding_submissions;
CREATE POLICY "Students insert own coding submissions" ON public.coding_submissions
    FOR INSERT WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Submissions are immutable - no update" ON public.coding_submissions;
CREATE POLICY "Submissions are immutable - no update" ON public.coding_submissions
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Submissions are immutable - no delete" ON public.coding_submissions;
CREATE POLICY "Submissions are immutable - no delete" ON public.coding_submissions
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Students view submission test results" ON public.submission_test_results;
CREATE POLICY "Students view submission test results" ON public.submission_test_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coding_submissions s
            WHERE s.id = submission_id AND (s.student_id = auth.uid() OR s.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------
-- 5. Logs (Activity & Code Execution)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users view own activity logs" ON public.user_activity_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users insert own activity logs" ON public.user_activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own code execution logs" ON public.code_execution_logs;
CREATE POLICY "Users view own code execution logs" ON public.code_execution_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own code execution logs" ON public.code_execution_logs;
CREATE POLICY "Users insert own code execution logs" ON public.code_execution_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. AI Interactions & Hints (Immutable)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own ai interactions" ON public.ai_interactions;
CREATE POLICY "Students view own ai interactions" ON public.ai_interactions
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own ai interactions" ON public.ai_interactions;
CREATE POLICY "Students insert own ai interactions" ON public.ai_interactions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own hint history" ON public.hint_history;
CREATE POLICY "Students view own hint history" ON public.hint_history
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own hint history" ON public.hint_history;
CREATE POLICY "Students insert own hint history" ON public.hint_history
    FOR INSERT WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Hint history is immutable - no update" ON public.hint_history;
CREATE POLICY "Hint history is immutable - no update" ON public.hint_history
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Hint history is immutable - no delete" ON public.hint_history;
CREATE POLICY "Hint history is immutable - no delete" ON public.hint_history
    FOR DELETE USING (false);

DROP POLICY IF EXISTS "Students view own ai efficiency" ON public.ai_efficiency_scores;
CREATE POLICY "Students view own ai efficiency" ON public.ai_efficiency_scores
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view candidate ai efficiency" ON public.ai_efficiency_scores;
CREATE POLICY "Companies view candidate ai efficiency" ON public.ai_efficiency_scores
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

-- ------------------------------------------------------------
-- 7. Results & Analytics
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own assessment results" ON public.assessment_results;
CREATE POLICY "Students view own assessment results" ON public.assessment_results
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies view assessment results" ON public.assessment_results;
CREATE POLICY "Companies view assessment results" ON public.assessment_results
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Students view own topic performance" ON public.topic_performance;
CREATE POLICY "Students view own topic performance" ON public.topic_performance
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own consistency records" ON public.consistency_records;
CREATE POLICY "Students view own consistency records" ON public.consistency_records
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own improvement records" ON public.improvement_records;
CREATE POLICY "Students view own improvement records" ON public.improvement_records
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own student analytics" ON public.student_analytics;
CREATE POLICY "Students view own student analytics" ON public.student_analytics
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Companies view student analytics" ON public.student_analytics;
CREATE POLICY "Companies view student analytics" ON public.student_analytics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.company_profiles WHERE id = auth.uid())
    );

-- ------------------------------------------------------------
-- 8. Recruiter Platform (Strict company isolation)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Companies manage own candidate shortlists" ON public.candidate_shortlists;
CREATE POLICY "Companies manage own candidate shortlists" ON public.candidate_shortlists
    FOR ALL USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies manage own recruiter notes" ON public.recruiter_notes;
CREATE POLICY "Companies manage own recruiter notes" ON public.recruiter_notes
    FOR ALL USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);

-- ------------------------------------------------------------
-- 9. Public Profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own public profile" ON public.public_profiles;
CREATE POLICY "Students manage own public profile" ON public.public_profiles
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = student_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view searchable profiles" ON public.public_profiles;
CREATE POLICY "Public can view searchable profiles" ON public.public_profiles
    FOR SELECT USING (is_searchable = true AND visibility = 'public');

-- ------------------------------------------------------------
-- 10. Proctoring & Integrity Monitoring
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Students view own proctoring sessions" ON public.proctoring_sessions
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Students insert own proctoring sessions" ON public.proctoring_sessions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students insert proctoring events" ON public.proctoring_events;
CREATE POLICY "Students insert proctoring events" ON public.proctoring_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.proctoring_sessions s
            WHERE s.id = session_id AND s.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students view own proctoring events" ON public.proctoring_events;
CREATE POLICY "Students view own proctoring events" ON public.proctoring_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.proctoring_sessions s
            WHERE s.id = session_id AND s.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students insert clipboard events" ON public.clipboard_events;
CREATE POLICY "Students insert clipboard events" ON public.clipboard_events
    FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students view own clipboard events" ON public.clipboard_events;
CREATE POLICY "Students view own clipboard events" ON public.clipboard_events
    FOR SELECT USING (auth.uid() = student_id);
