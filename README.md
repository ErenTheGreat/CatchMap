# CatchMap — Fishing Spots & Log

Mobile fishing app (Expo / React Native) for discovering US waterbodies, forecasting bite times, logging catches, and optional cloud sync via Supabase.

## Features

- Interactive map with ~48k US waterbodies (PostGIS)
- Viewport-aware bite scoring (solunar + weather + tides + community)
- Catch logging with conditions snapshot at log time
- Catch Coach — rig and technique advice
- Personal bite fingerprint and pattern-match alerts
- Species guide, regulations, trip planner, offline map packs

## Quick start

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key
npm run dev              # Expo dev client on port 8081
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `EXPO_PUBLIC_ENABLE_CLOUD_SYNC` | No | `"true"` enables sign-in + catch backup |
| `EXPO_PUBLIC_ENABLE_CATCH_COACH` | No | Structured coaching cards |
| `EXPO_PUBLIC_ENABLE_SPECIES_ID` | No | Gemini photo species ID (user API key in Settings) |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Play Store | Hosted privacy policy URL |
| `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` | Play Store | Hosted terms of service URL |
| `EXPO_PUBLIC_SENTRY_DSN` | No | Sentry DSN for crash reporting |
| `EXPO_PUBLIC_BFF_URL` | No | Optional BFF proxy (not in-repo) |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Expo dev client |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit tests |
| `npm run db:import-us` | Import US waterbody JSON batches |
| `npm run db:verify-spatial` | Verify PostGIS spatial RPCs |

## Project structure

```
app/              Expo Router screens (tabs, settings, auth)
components/       UI, map, catch form, coach
hooks/            React Query hooks
lib/api/          fishingApi router (single API surface)
utils/            Bite scoring, insights, storage, regulations
data/             Species catalog, regulations, US regions
supabase/         Migrations, edge functions, import scripts
docs/             UX roadmap, store listing
```

## Feature flags

See [`constants/features.ts`](constants/features.ts). Cloud sync requires both the env flag and a signed-in user.

## Docs

- [UX Roadmap](docs/UX_ROADMAP.md)
- [Store Listing](docs/STORE_LISTING.md) — package IDs, pre-submit checklist, EAS closed testing
- [Rig Guide Plan](docs/RIG_GUIDE_PLAN.md)

## Release (Play closed testing)

Native package IDs are `app.catchmap` (Android + iOS). Submit track defaults to Play **internal** testing.

```bash
# Optional: enable crash reporting
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@o....ingest.sentry.io/..."

# Build + submit helper
./scripts/release-play-beta.sh
```

Before first upload: add `catchmap://auth` to Supabase Auth redirect URLs (see store listing).

## License

Private release.
