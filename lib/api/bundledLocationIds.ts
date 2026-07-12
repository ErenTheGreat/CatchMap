/** Deterministic PostGIS location UUIDs from migration 007 (Bay Area seed). */
export const BUNDLED_SPOT_TO_LOCATION_UUID: Record<string, string> = {
  spot_001: '11111111-1111-4111-8111-000000000001',
  spot_002: '11111111-1111-4111-8111-000000000002',
  spot_003: '11111111-1111-4111-8111-000000000003',
  spot_004: '11111111-1111-4111-8111-000000000004',
  spot_005: '11111111-1111-4111-8111-000000000005',
  spot_006: '11111111-1111-4111-8111-000000000006',
  spot_007: '11111111-1111-4111-8111-000000000007',
  spot_008: '11111111-1111-4111-8111-000000000008',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bundledSpotIdToLocationUuid(spotId: string): string | null {
  return BUNDLED_SPOT_TO_LOCATION_UUID[spotId] ?? null;
}

/** Resolve a map spot id (postgis-*, spot_00N, or raw UUID) to a locations.id UUID. */
export function resolvePostgisLocationUuid(spotId: string | null): string | null {
  if (!spotId) return null;

  const stripped = spotId.startsWith('postgis-')
    ? spotId.slice('postgis-'.length)
    : spotId;

  if (UUID_RE.test(stripped)) return stripped;

  return bundledSpotIdToLocationUuid(stripped);
}
