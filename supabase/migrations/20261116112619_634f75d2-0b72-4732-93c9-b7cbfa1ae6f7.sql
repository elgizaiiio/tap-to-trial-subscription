CREATE OR REPLACE FUNCTION public.open_bot_thread(p_bot uuid)
RETURNS public.conversations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE me uuid := auth.uid(); result public.conversations; g uuid;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM 1 FROM public.bots WHERE id=p_bot AND owner_id=me FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bot unavailable'; END IF;
 SELECT id INTO g FROM public.bot_groups WHERE coordinator_id=p_bot AND owner_id=me ORDER BY created_at,id LIMIT 1;
 SELECT c.* INTO result FROM public.conversations c
 WHERE c.user_id=me AND c.bot_id=p_bot AND c.group_id IS NOT DISTINCT FROM g
 AND NOT EXISTS (SELECT 1 FROM public.channel_identities i WHERE i.conversation_id=c.id)
 ORDER BY c.created_at,c.id LIMIT 1;
 IF result.id IS NULL THEN
  INSERT INTO public.conversations(user_id,bot_id,group_id,title) SELECT me,p_bot,g,name FROM public.bots WHERE id=p_bot AND owner_id=me RETURNING * INTO result;
 ELSIF result.is_hidden THEN
  UPDATE public.conversations SET is_hidden=false WHERE id=result.id AND user_id=me RETURNING * INTO result;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.open_bot_thread(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_bot_thread(uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS conversations_bot_timeline ON public.conversations(user_id,bot_id,group_id,created_at,id);
CREATE INDEX IF NOT EXISTS messages_thread_timeline ON public.messages(conversation_id,created_at,id);