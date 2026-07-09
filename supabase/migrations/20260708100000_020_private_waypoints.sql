/*
# Private waypoints — user-owned map pins with optional cloud sync

Each waypoint is private to the signed-in user (RLS). client_id enables
idempotent upserts from the offline-first mobile app.
*/

CREATE TABLE IF NOT EXISTS public.waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text UNIQUE,
  name text NOT NULL,
  notes text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_user_id ON public.waypoints (user_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_client_id ON public.waypoints (client_id) WHERE client_id IS NOT NULL;

ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY waypoints_select_own ON public.waypoints
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY waypoints_insert_own ON public.waypoints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY waypoints_update_own ON public.waypoints
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY waypoints_delete_own ON public.waypoints
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.waypoints IS
  'Private user waypoints — never shared publicly. Synced per-user via RLS.';
