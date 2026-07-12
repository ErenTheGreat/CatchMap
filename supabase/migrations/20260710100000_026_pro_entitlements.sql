-- Pro entitlements (synced from RevenueCat webhooks or manual grants)
CREATE TABLE IF NOT EXISTS public.pro_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  product_id text NOT NULL DEFAULT 'catchmap_pro_lifetime',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revenuecat_customer_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pro entitlement"
  ON public.pro_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Server-only writes (service role / edge functions)
CREATE POLICY "Service role manages pro entitlements"
  ON public.pro_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Daily hosted AI usage tracking
CREATE TABLE IF NOT EXISTS public.pro_ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_identifier text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  usage_date date NOT NULL DEFAULT (CURRENT_DATE),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_identifier, usage_date)
);

ALTER TABLE public.pro_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ai usage"
  ON public.pro_ai_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS pro_ai_usage_date_idx ON public.pro_ai_usage (usage_date);

-- RevenueCat webhook: grant lifetime Pro on purchase
CREATE OR REPLACE FUNCTION public.grant_pro_entitlement(
  p_user_id uuid,
  p_product_id text DEFAULT 'catchmap_pro_lifetime',
  p_revenuecat_customer_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pro_entitlements (user_id, is_active, product_id, revenuecat_customer_id, updated_at)
  VALUES (p_user_id, true, p_product_id, p_revenuecat_customer_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    product_id = EXCLUDED.product_id,
    revenuecat_customer_id = COALESCE(EXCLUDED.revenuecat_customer_id, pro_entitlements.revenuecat_customer_id),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pro_entitlement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_pro_entitlement TO service_role;
