-- Subscription lifecycle: expires_at on grant + revoke on expiration

CREATE OR REPLACE FUNCTION public.grant_pro_entitlement(
  p_user_id uuid,
  p_product_id text DEFAULT 'catchmap_pro_monthly',
  p_revenuecat_customer_id text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pro_entitlements (
    user_id,
    is_active,
    product_id,
    revenuecat_customer_id,
    expires_at,
    updated_at
  )
  VALUES (
    p_user_id,
    true,
    p_product_id,
    p_revenuecat_customer_id,
    p_expires_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    product_id = EXCLUDED.product_id,
    revenuecat_customer_id = COALESCE(EXCLUDED.revenuecat_customer_id, pro_entitlements.revenuecat_customer_id),
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_pro_entitlement(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pro_entitlements
  SET
    is_active = false,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pro_entitlement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_pro_entitlement TO service_role;

REVOKE ALL ON FUNCTION public.revoke_pro_entitlement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_pro_entitlement TO service_role;
