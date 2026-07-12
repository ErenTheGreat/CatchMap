/** CatchMap Pro — lifetime and monthly IAP products and fair-use limits. */

export const PRO_PRODUCT_ID = 'catchmap_pro_lifetime';

/** Monthly subscription product (App Store / Play + RevenueCat). */
export const PRO_MONTHLY_PRODUCT_ID = 'catchmap_pro_monthly';

/** Fallback monthly price shown before store prices load (USD). */
export const PRO_MONTHLY_PRICE_USD = 4;

/** RevenueCat entitlement identifier (configure in RevenueCat dashboard). */
export const PRO_ENTITLEMENT_ID = 'pro';

/** List price shown in paywall (USD). */
export const PRO_LIST_PRICE_USD = 59.99;

/** Launch promo price (USD) — first 30–60 days. */
export const PRO_LAUNCH_PRICE_USD = 49.99;

export const PRO_LAUNCH_PROMO_ACTIVE =
  process.env.EXPO_PUBLIC_PRO_LAUNCH_PROMO !== 'false';

export function getProDisplayPrice(): string {
  const amount = PRO_LAUNCH_PROMO_ACTIVE ? PRO_LAUNCH_PRICE_USD : PRO_LIST_PRICE_USD;
  return `$${amount.toFixed(2)}`;
}

export function getProMonthlyDisplayPrice(): string {
  return `$${PRO_MONTHLY_PRICE_USD.toFixed(2)}/mo`;
}

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

export const PRO_FEATURE_BULLETS = [
  'Hosted Catch AI — chat, photo species ID, coach enhance (30 requests/day)',
  'Cloud backup & sync for catches, photos, and waypoints',
  'Trip planner with calendar, reminders, and pattern scoring',
  'Pattern-match push alerts on saved spots',
  'Personal insights & bite fingerprint — instant unlock',
  'Catch Coach rig and technique advice',
  'Premium map layers: radar, heatmap, community activity',
  'Daily fishing plan — species, spots, rigs, bite windows & AI briefing',
  'Go/No-Go daily verdict + bite-window reminders',
  'Weekend planner across saved spots',
  'Pro spot compare — side-by-side contenders',
  'Bite Storm alerts when conditions flip hot at saved spots',
  'Autopilot Saturday — full-day trip across your lakes, reminders included',
  'On-Water Copilot — ask what\'s biting at your GPS pin',
  'Lure Pulse — see what\'s catching near you this week',
  'Spot Trust Score — learn which lakes deliver for you',
  'Water Whisper — AI reads the water from a photo',
  'Higher limits: 100 saved spots, 200 waypoints',
] as const;
