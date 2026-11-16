CREATE TABLE public.telegram_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id uuid NOT NULL REFERENCES public.agent_documents(id) ON DELETE CASCADE,
  update_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('private','group','channel','business','business_connection')),
  chat_id bigint,
  chat_title text CHECK (length(chat_title) <= 300),
  from_name text CHECK (length(from_name) <= 300),
  outgoing boolean NOT NULL DEFAULT false,
  text text CHECK (length(text) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, update_id)
);
GRANT SELECT, DELETE ON public.telegram_inbox TO authenticated;
GRANT ALL ON public.telegram_inbox TO service_role;
ALTER TABLE public.telegram_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_inbox_read_own ON public.telegram_inbox FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY telegram_inbox_delete_own ON public.telegram_inbox FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX telegram_inbox_owner_time ON public.telegram_inbox (user_id, doc_id, created_at DESC);