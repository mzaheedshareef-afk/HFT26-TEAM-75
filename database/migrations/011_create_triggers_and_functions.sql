-- ============================================================
-- VERITY Database Migration: 011_create_triggers_and_functions.sql
-- Part 14: Database Triggers, Functions and Constraints
-- ============================================================

-- 1. Generic updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger across all stateful tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER set_company_profiles_updated_at
    BEFORE UPDATE ON public.company_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER set_portfolios_updated_at
    BEFORE UPDATE ON public.portfolios
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_assessments_updated_at ON public.assessments;
CREATE TRIGGER set_assessments_updated_at
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_ai_efficiency_scores_updated_at ON public.ai_efficiency_scores;
CREATE TRIGGER set_ai_efficiency_scores_updated_at
    BEFORE UPDATE ON public.ai_efficiency_scores
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_assessment_results_updated_at ON public.assessment_results;
CREATE TRIGGER set_assessment_results_updated_at
    BEFORE UPDATE ON public.assessment_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_candidate_shortlists_updated_at ON public.candidate_shortlists;
CREATE TRIGGER set_candidate_shortlists_updated_at
    BEFORE UPDATE ON public.candidate_shortlists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_public_profiles_updated_at ON public.public_profiles;
CREATE TRIGGER set_public_profiles_updated_at
    BEFORE UPDATE ON public.public_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_student_analytics_updated_at ON public.student_analytics;
CREATE TRIGGER set_student_analytics_updated_at
    BEFORE UPDATE ON public.student_analytics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Auth user sync trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Compatibility sync trigger for student_id / user_id
CREATE OR REPLACE FUNCTION public.sync_student_and_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.student_id IS NULL AND NEW.user_id IS NOT NULL THEN
        NEW.student_id := NEW.user_id;
    ELSIF NEW.user_id IS NULL AND NEW.student_id IS NOT NULL THEN
        NEW.user_id := NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_portfolios_ids ON public.portfolios;
CREATE TRIGGER sync_portfolios_ids
    BEFORE INSERT OR UPDATE ON public.portfolios
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_assessments_ids ON public.assessments;
CREATE TRIGGER sync_assessments_ids
    BEFORE INSERT OR UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_coding_submissions_ids ON public.coding_submissions;
CREATE TRIGGER sync_coding_submissions_ids
    BEFORE INSERT OR UPDATE ON public.coding_submissions
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_hint_history_ids ON public.hint_history;
CREATE TRIGGER sync_hint_history_ids
    BEFORE INSERT OR UPDATE ON public.hint_history
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_ai_eff_ids ON public.ai_efficiency_scores;
CREATE TRIGGER sync_ai_eff_ids
    BEFORE INSERT OR UPDATE ON public.ai_efficiency_scores
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_assessment_results_ids ON public.assessment_results;
CREATE TRIGGER sync_assessment_results_ids
    BEFORE INSERT OR UPDATE ON public.assessment_results
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

DROP TRIGGER IF EXISTS sync_public_profiles_ids ON public.public_profiles;
CREATE TRIGGER sync_public_profiles_ids
    BEFORE INSERT OR UPDATE ON public.public_profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_student_and_user_id();

-- 4. Proctoring Event Metrics Aggregator Trigger
CREATE OR REPLACE FUNCTION public.aggregate_proctoring_event()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.proctoring_sessions
    SET 
        total_suspicious_events = total_suspicious_events + 1,
        tab_switches_count = tab_switches_count + CASE WHEN NEW.event_type = 'tab_switch' THEN 1 ELSE 0 END,
        full_screen_exits_count = full_screen_exits_count + CASE WHEN NEW.event_type = 'fullscreen_exit' THEN 1 ELSE 0 END,
        multiple_faces_detected_count = multiple_faces_detected_count + CASE WHEN NEW.event_type = 'multiple_faces' THEN 1 ELSE 0 END,
        no_face_detected_count = no_face_detected_count + CASE WHEN NEW.event_type = 'no_face' THEN 1 ELSE 0 END,
        audio_events_count = audio_events_count + CASE WHEN NEW.event_type = 'voice_detected' THEN 1 ELSE 0 END,
        trust_score = GREATEST(0.0, trust_score - CASE 
            WHEN NEW.severity = 'critical' THEN 25.0
            WHEN NEW.severity = 'high' THEN 15.0
            WHEN NEW.severity = 'medium' THEN 8.0
            ELSE 3.0
        END),
        status = CASE 
            WHEN trust_score <= 40.0 THEN 'flagged'
            ELSE status
        END
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_proctoring_event_inserted ON public.proctoring_events;
CREATE TRIGGER on_proctoring_event_inserted
    AFTER INSERT ON public.proctoring_events
    FOR EACH ROW EXECUTE FUNCTION public.aggregate_proctoring_event();

-- 5. Student Analytics Sync Triggers
CREATE OR REPLACE FUNCTION public.update_student_analytics_on_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.student_analytics (student_id, total_coding_submissions, favorite_language, updated_at)
    VALUES (NEW.student_id, 1, NEW.language, timezone('utc'::text, now()))
    ON CONFLICT (student_id) DO UPDATE SET
        total_coding_submissions = public.student_analytics.total_coding_submissions + 1,
        favorite_language = COALESCE(EXCLUDED.favorite_language, public.student_analytics.favorite_language),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_coding_submission_analytics ON public.coding_submissions;
CREATE TRIGGER on_coding_submission_analytics
    AFTER INSERT ON public.coding_submissions
    FOR EACH ROW EXECUTE FUNCTION public.update_student_analytics_on_submission();

CREATE OR REPLACE FUNCTION public.update_student_analytics_on_hint()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.student_analytics (student_id, total_hints_consumed, updated_at)
    VALUES (NEW.student_id, 1, timezone('utc'::text, now()))
    ON CONFLICT (student_id) DO UPDATE SET
        total_hints_consumed = public.student_analytics.total_hints_consumed + 1,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_hint_analytics ON public.hint_history;
CREATE TRIGGER on_hint_analytics
    AFTER INSERT ON public.hint_history
    FOR EACH ROW EXECUTE FUNCTION public.update_student_analytics_on_hint();
