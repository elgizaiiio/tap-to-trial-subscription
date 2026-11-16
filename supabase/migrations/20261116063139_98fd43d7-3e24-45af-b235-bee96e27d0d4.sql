CREATE TABLE IF NOT EXISTS public.agent_trials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days')
);
GRANT SELECT ON public.agent_trials TO authenticated;
GRANT ALL ON public.agent_trials TO service_role;
ALTER TABLE public.agent_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their own trial" ON public.agent_trials;
CREATE POLICY "Users can see their own trial" ON public.agent_trials FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Starts the one-time 3-day trial on first use; never extends or restarts it.
CREATE OR REPLACE FUNCTION public.ensure_agent_trial(p_user_id uuid) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.agent_trials(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT ends_at INTO e FROM public.agent_trials WHERE user_id = p_user_id;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.ensure_agent_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_agent_trial(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_my_agent_trial() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN public.ensure_agent_trial(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_agent_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_agent_trial() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agent_usage_status() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); p text; paid boolean; t timestamptz; active boolean;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT plan INTO p FROM public.subscriptions WHERE user_id=u AND current_period_end>now();
 paid := coalesce(p IN ('plus','pro','ultra'), false);
 t := public.ensure_my_agent_trial();
 active := NOT paid AND t IS NOT NULL AND t > now();
 RETURN jsonb_build_object(
   'plan', CASE WHEN paid THEN p WHEN active THEN 'trial' ELSE 'free' END,
   'isPaid', paid, 'trialActive', active, 'trialEndsAt', t, 'hasAccess', paid OR active,
   'allowanceUsd',0,'spentUsd',0,'remainingUsd',0,'stepUsd',0.01,'resetsDaily',false);
END $$;
REVOKE ALL ON FUNCTION public.agent_usage_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agent_usage_status() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.charge_agent_usage(p_user_id uuid,p_operation_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p text; t timestamptz;
BEGIN
 IF p_operation_key IS NULL OR length(p_operation_key)<1 OR length(p_operation_key)>200 THEN RAISE EXCEPTION 'Invalid operation'; END IF;
 SELECT plan INTO p FROM public.subscriptions WHERE user_id=p_user_id AND current_period_end>now();
 IF p IN ('plus','pro','ultra') THEN RETURN jsonb_build_object('ok',true,'paid',true,'chargedUsd',0); END IF;
 t := public.ensure_agent_trial(p_user_id);
 IF t > now() THEN RETURN jsonb_build_object('ok',true,'trial',true,'trialEndsAt',t,'chargedUsd',0); END IF;
 RETURN jsonb_build_object('ok',false,'code','trial_ended','trialEndsAt',t,'remainingUsd',0);
END $$;
REVOKE ALL ON FUNCTION public.charge_agent_usage(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charge_agent_usage(uuid,text) TO service_role;