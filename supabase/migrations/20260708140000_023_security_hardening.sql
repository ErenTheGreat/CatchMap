/*
# Security hardening — Wave 1

1. Legacy tables: read-only for clients (no anon write)
2. import_waterbodies_batch: service_role only
3. app_feedback: RPC with rate limiting instead of open insert
4. species_id_usage: per-user rate limit tracking for edge functions
*/

-- ---------------------------------------------------------------------------
-- Legacy fishing_spots: read-only for anon/authenticated
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_spots" ON fishing_spots;
DROP POLICY IF EXISTS "anon_update_spots" ON fishing_spots;
DROP POLICY IF EXISTS "anon_delete_spots" ON fishing_spots;

-- Keep SELECT policy (anon_select_spots) for fallback spot discovery.

-- ---------------------------------------------------------------------------
-- Legacy catches: read-only for anon/authenticated
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_catches" ON catches;
DROP POLICY IF EXISTS "anon_update_catches" ON catches;
DROP POLICY IF EXISTS "anon_delete_catches" ON catches;

-- ---------------------------------------------------------------------------
-- import_waterbodies_batch: restrict to service_role
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.import_waterbodies_batch(jsonb) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_waterbodies_batch(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- app_feedback: rate-limited RPC
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_app_feedback" ON app_feedback;

CREATE OR REPLACE FUNCTION public.submit_app_feedback(
  p_category text,
  p_message text,
  p_contact_email text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_recent_count integer;
  v_id uuid;
BEGIN
  IF p_category NOT IN ('bug', 'feature', 'general') THEN
    RAISE EXCEPTION 'Invalid feedback category';
  END IF;

  IF char_length(trim(p_message)) < 10 THEN
    RAISE EXCEPTION 'Message must be at least 10 characters';
  END IF;

  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT count(*)::integer INTO v_recent_count
    FROM app_feedback
    WHERE created_at > now() - interval '1 hour'
      AND contact_email IS NOT DISTINCT FROM nullif(trim(p_contact_email), '');

    IF v_recent_count >= 5 THEN
      RAISE EXCEPTION 'Too many feedback submissions. Please try again later.';
    END IF;
  ELSE
    SELECT count(*)::integer INTO v_recent_count
    FROM app_feedback
    WHERE created_at > now() - interval '1 hour';

    IF v_recent_count >= 30 THEN
      RAISE EXCEPTION 'Too many feedback submissions. Please try again later.';
    END IF;
  END IF;

  INSERT INTO app_feedback (category, message, contact_email, app_version, platform)
  VALUES (
    p_category,
    trim(p_message),
    nullif(trim(p_contact_email), ''),
    p_app_version,
    p_platform
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_app_feedback(text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- species_id_usage: rate limit tracking for identify-species edge function
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS species_id_usage (
  user_id uuid NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, called_at)
);

CREATE INDEX IF NOT EXISTS idx_species_id_usage_user_time
  ON species_id_usage (user_id, called_at DESC);

ALTER TABLE species_id_usage ENABLE ROW LEVEL SECURITY;

-- No client policies — edge function uses service_role.

COMMENT ON TABLE species_id_usage IS
  'Tracks identify-species edge function calls for per-user rate limiting.';
