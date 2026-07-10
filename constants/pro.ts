/** CatchMap Pro — subscription IAP and fair-use limits. */

/** Primary offer: monthly auto-renewing subscription. */
export const PRO_SUBSCRIPTION_PRODUCT_ID = 'catchmap_pro_monthly';

/** Legacy lifetime product — kept for restore / grandfathered buyers. */
export const PRO_PRODUCT_ID = 'catchmap_pro_lifetime';

/** RevenueCat entitlement identifier (configure in RevenueCat dashboard). */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Fallback display price when the store price is unavailable (USD). */
export const PRO_MONTHLY_PRICE_USD = 3.99;

export function getProDisplayPrice(): string {
  return `$${PRO_MONTHLY_PRICE_USD.toFixed(2)}/mo`;
}

/** Append /mo when the store price string omits a billing period. */
export function formatProPriceLabel(priceString: string | null | undefined): string {
  const base = priceString?.trim() || getProDisplayPrice();
  if (/\/\s*(mo|month|yr|year)/i.test(base)) {
    return base;
  }
  return `${base}/mo`;
}

export const PRO_SUBSCRIPTION_DISCLOSURE =
  'Auto-renews monthly · Cancel anytime in App Store or Google Play settings';

export const PRO_AI_DAILY_LIMIT = 30;
export const PRO_CLOUD_PHOTO_LIMIT_MB = 500;
export const PRO_CLOUD_PHOTO_WARN_MB = 400;
export const PRO_OFFLINE_REGION_LIMIT = 3;

export const FREE_SAVED_SPOTS_LIMIT = 10;
export const PRO_SAVED_SPOTS_LIMIT = 100;
export const FREE_WAYPOINTS_LIMIT = 15;
export const PRO_WAYPOINTS_LIMIT = 200;

export function getMaxSavedSpots(isPro: boolean): number {
  return isPro ? PRO_SAVED_SPOTS_LIMIT : FREE_SAVED_SPOTS_LIMIT;
}

export function getMaxWaypoints(isPro: boolean): number {
  return isPro ? PRO_WAYPOINTS_LIMIT : FREE_WAYPOINTS_LIMIT;
}

/** Compact bullets for onboarding Pro slide. */
export const PRO_ONBOARDING_BULLETS = [
  'Hosted Catch AI — chat, photo species ID, coach tips',
  'Cloud backup for catches, photos, and waypoints',
  'Offline map packs and trip planner with reminders',
  'Personal insights, pattern alerts, and premium map layers',
] as const;

export const PRO_FEATURE_BULLETS = [
  'Hosted Catch AI — chat, photo species ID, coach enhance (30 requests/day)',
  'Cloud backup & sync for catches, photos, and waypoints',
  'Offline map packs for remote fishing (up to 3 regions)',
  'Trip planner with calendar, reminders, and pattern scoring',
  'Pattern-match push alerts on saved spots',
  'Personal insights & bite fingerprint — instant unlock',
  'Catch Coach rig and technique advice',
  'Premium map layers: radar, heatmap, community activity',
  'AI Trip Brief & “What should I fish today?”',
  'Higher limits: 100 saved spots, 200 waypoints',
] as const;
