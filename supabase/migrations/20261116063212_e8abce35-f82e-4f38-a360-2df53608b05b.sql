CREATE OR REPLACE FUNCTION public.agent_trials_fix_window() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  NEW.started_at := now();
  NEW.ends_at := now() + interval '3 days';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_trials_fix_window ON public.agent_trials;
CREATE TRIGGER agent_trials_fix_window BEFORE INSERT ON public.agent_trials FOR EACH ROW EXECUTE FUNCTION public.agent_trials_fix_window();
REVOKE ALL ON FUNCTION public.agent_trials_fix_window() FROM PUBLIC, anon, authenticated;

GRANT INSERT ON public.agent_trials TO authenticated;
DROP POLICY IF EXISTS "Users can start their own trial" ON public.agent_trials;
CREATE POLICY "Users can start their own trial" ON public.agent_trials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_my_agent_trial() RETURNS timestamptz
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE u uuid := auth.uid(); e timestamptz;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.agent_trials(user_id) VALUES (u) ON CONFLICT (user_id) DO NOTHING;
  SELECT ends_at INTO e FROM public.agent_trials WHERE user_id = u;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_agent_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_agent_trial() TO authenticated, service_role;