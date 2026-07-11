import { getCurrentUserId } from '@/lib/authState';
import { getProEntitled } from '@/lib/pro/proState';

export type ProFeature =
  | 'cloud_sync'
  | 'offline_maps'
  | 'trip_planner'
  | 'pattern_alerts'
  | 'catch_coach'
  | 'personal_insights'
  | 'hosted_ai'
  | 'premium_map_layers'
  | 'species_id'
  | 'ai_trip_brief'
  | 'ai_fish_today';

/** Kill switch — set EXPO_PUBLIC_ENABLE_PRO=false to disable all Pro gating (beta rollback). */
export function isProMonetizationEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_PRO !== 'false';
}

export function isProFeatureEnabled(_feature: ProFeature): boolean {
  if (!isProMonetizationEnabled()) {
    return true;
  }
  return getProEntitled();
}

export function hasProPersonalInsights(): boolean {
  return isProFeatureEnabled('personal_insights');
}

/**
 * Rollout kill switch for the cloud sync + community contribution feature.
 * users can back up catches, sync waypoints, and opt into anonymous community intel.
 */
export function isCloudSyncFeatureAvailable(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true';
}

/**
 * Cloud catch sync requires the feature flag, a signed-in user, and Pro.
 */
export function isCloudSyncEnabled(): boolean {
  return (
    isCloudSyncFeatureAvailable() &&
    getCurrentUserId() != null &&
    isProFeatureEnabled('cloud_sync')
  );
}

/** Structured catch coaching from rigs, bite scores, and catch history. */
export function isCatchCoachEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_ENABLE_CATCH_COACH === 'true' &&
    isProFeatureEnabled('catch_coach')
  );
}

/** Vision-based species suggestions in the catch log form (Pro hosted AI). */
export function isSpeciesIdEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_ENABLE_SPECIES_ID === 'true' &&
    isProFeatureEnabled('species_id')
  );
}

/** Personal bite fingerprint and pattern-match scoring from catch history. */
export function isPersonalBiteEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_PERSONAL_BITE !== 'false';
}

/** Conversational Catch AI assistant tab visibility (tab always shown; Pro gates usage). */
export function isCatchAiTabVisible(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CATCH_AI_CHAT !== 'false';
}

/** Conversational Catch AI assistant (Pro hosted AI). */
export function isCatchAiChatEnabled(): boolean {
  return isCatchAiTabVisible() && isProFeatureEnabled('hosted_ai');
}

/** LLM enhancement for Catch Coach advice (Pro hosted AI). */
export function isCatchAiCoachEnhanceEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_ENABLE_CATCH_AI_COACH !== 'false' &&
    isProFeatureEnabled('hosted_ai')
  );
}

export function isTripPlannerEnabled(): boolean {
  return isProFeatureEnabled('trip_planner');
}

export function isOfflineMapsProEnabled(): boolean {
  return isProFeatureEnabled('offline_maps');
}

export function isPatternAlertsEnabled(): boolean {
  return isProFeatureEnabled('pattern_alerts');
}

export function isPremiumMapLayersEnabled(): boolean {
  return isProFeatureEnabled('premium_map_layers');
}

export function isAiTripBriefEnabled(): boolean {
  return isProFeatureEnabled('ai_trip_brief');
}

export function isAiFishTodayEnabled(): boolean {
  return isProFeatureEnabled('ai_fish_today');
}
