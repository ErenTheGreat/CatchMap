import { getCurrentUserId } from '@/lib/authState';

/**
 * Rollout kill switch for the cloud sync + community contribution feature.
 * users can back up catches, sync waypoints, and opt into anonymous community intel.
 */
export function isCloudSyncFeatureAvailable(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true';
}

/**
 * Cloud catch sync requires the feature flag AND a signed-in user: catch_logs
 * rows are protected by per-user RLS, so anonymous clients cannot write to the
 * cloud. Signed-out users keep the original local-only behavior.
 */
export function isCloudSyncEnabled(): boolean {
  return isCloudSyncFeatureAvailable() && getCurrentUserId() != null;
}

/** Structured catch coaching from rigs, bite scores, and catch history. */
export function isCatchCoachEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CATCH_COACH === 'true';
}

/** Vision-based species suggestions in the catch log form. */
export function isSpeciesIdEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_SPECIES_ID === 'true';
}

/** Personal bite fingerprint and pattern-match scoring from catch history. */
export function isPersonalBiteEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_PERSONAL_BITE !== 'false';
}

/** Conversational Catch AI assistant tab (BYOK Gemini). */
export function isCatchAiChatEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CATCH_AI_CHAT !== 'false';
}

/** LLM enhancement for Catch Coach advice (BYOK Gemini). */
export function isCatchAiCoachEnhanceEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_CATCH_AI_COACH !== 'false';
}
