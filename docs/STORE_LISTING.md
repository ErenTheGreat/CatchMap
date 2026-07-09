# CatchMap — Store Listing Metadata

Use this document when submitting to the App Store and Google Play.

## App identity

| Field | Value |
|-------|-------|
| **App name** | CatchMap: Fishing Spots & Log |
| **Short name** | CatchMap |
| **Expo slug (internal)** | `bolt-expo-nativewind` — must match installed dev client |
| **Bundle ID (iOS)** | `app.catchmap` |
| **Package (Android)** | `app.catchmap` |
| **Version** | 1.0.0 |
| **Category** | Sports / Lifestyle |
| **Content rating** | Everyone (no mature content) |

## Short description (Play Store, 80 chars)

Discover US fishing spots, bite forecasts, and log catches with optional cloud backup.

## Full description

CatchMap helps anglers fish smarter across the United States.

**Discover spots** — Explore tens of thousands of US lakes, rivers, and coastal waters on an interactive map with depth contours and community activity.

**Know when to fish** — Bite forecasts combine solunar periods, weather, tides, species patterns, and your personal catch history.

**Log every catch** — Record species, weight, lure, photos, and conditions. Export your log as JSON or CSV.

**Learn as you go** — Species guide with rig diagrams, Catch Coach tips, regulations notices, Catch AI chat (BYOK), and optional photo species ID using your free Google API key.

**Your data, your choice** — Use CatchMap without an account (everything stays on your device) or sign in for private cloud backup. Community insights use only anonymized, opt-in catch data. AI features use your own Google Gemini key — CatchMap never charges for AI.

Free to use. US waterbody focus.

## Keywords (App Store)

fishing,angler,spots,map,bite,solunar,tides,catch log,species,lures,trip planner

## Support & legal URLs

| Item | URL |
|------|-----|
| Privacy policy | `https://cpzwvlpqdzjjsdlnmfgg.supabase.co/functions/v1/privacy-policy` |
| Terms of service | `https://cpzwvlpqdzjjsdlnmfgg.supabase.co/functions/v1/terms-of-service` |
| Support email | `support@catchmap.app` (route this mailbox before public launch) |

## Screenshots to capture (before submit)

Capture on phone and tablet where applicable:

1. **Map + discovery** — Dashboard showing “best right now” and bite score
2. **Spot detail** — Weather, tides, species predictions, regulations
3. **Log catch** — Catch form with species picker and conditions
4. **History** — Catch list with insights panel
5. **Species guide** — Catalog with rig diagram card
6. **Catch AI** — Chat assistant and API key setup in Settings
7. **Trip planner** — Ranked spots for today/tomorrow
8. **Settings** — Account, Catch AI key, export, privacy/terms links

Recommended sizes: iPhone 6.7" and 6.1", iPad 12.9" (if supporting tablet prominently), Android phone 1080×1920.

## Pre-submit checklist

- [ ] Production EAS build smoke-tested (map, log, sign-up, sync, export)
- [x] `delete-account`, `privacy-policy`, and `terms-of-service` edge functions deployed (ACTIVE; verified via `npm run verify:edge`)
- [ ] Supabase Auth → URL Configuration → Redirect URLs includes `catchmap://auth` (and `exp+bolt-expo-nativewind://auth` for local/dev-client testing)
- [ ] Create a Sentry React Native project, then set `EXPO_PUBLIC_SENTRY_DSN` (EAS secret or production env) and optional `SENTRY_AUTH_TOKEN` for source maps
- [x] Play Store submit track set to `internal` (closed testing) in `eas.json` — flip to `production` only after beta
- [ ] App Store Connect / Play Console assets uploaded (screenshots above)
- [x] Native package IDs aligned to `app.catchmap` (Android `applicationId` / iOS `PRODUCT_BUNDLE_IDENTIFIER`)

## Auth redirect setup (required once)

In the Supabase Dashboard for this project:

1. Authentication → URL Configuration
2. Add to **Redirect URLs**: `catchmap://auth`
3. Optionally add: `exp+bolt-expo-nativewind://auth` for Expo dev client
4. Site URL can remain the project URL; deep links use the redirect allow-list

The app builds redirects via `getAuthRedirectUrl()` → `catchmap://auth` ([lib/auth/deepLinkAuth.ts](../lib/auth/deepLinkAuth.ts)).

## Crash reporting

Sentry is wired in the app (`lib/sentry.ts`, root `Sentry.wrap`, Expo + Metro plugins). Reporting stays **off** until `EXPO_PUBLIC_SENTRY_DSN` is set. Recommended:

```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@o....ingest.sentry.io/..."
eas secret:create --name SENTRY_AUTH_TOKEN --value "sntrys_..."
```

## EAS build & submit (closed testing first)

```bash
# Build production binary
eas build --profile production --platform android

# Submit to Play Internal testing (track: internal)
eas submit --profile production --platform android

# After closed beta, change eas.json submit.production.android.track to "production"
# then re-submit, or use:
# eas submit --profile production --platform android --track production
```

Helper script: `scripts/release-play-beta.sh`
