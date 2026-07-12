/*
# Beta feedback inbox

Collects in-app tester feedback. Insert-only for clients; read via Supabase dashboard.
*/

CREATE TABLE IF NOT EXISTS app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  message text NOT NULL CHECK (char_length(trim(message)) >= 10),
  contact_email text,
  app_version text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_app_feedback" ON app_feedback;
CREATE POLICY "anon_insert_app_feedback" ON app_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at ON app_feedback (created_at DESC);
