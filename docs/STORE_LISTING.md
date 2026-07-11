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

**Learn as you go** — Species guide with rig diagrams, regulations notices, and Catch Coach tips. **CatchMap Pro** adds hosted Catch AI, photo species ID, trip planner, offline maps, and cloud backup.

**Your data, your choice** — Use CatchMap without an account (everything stays on your device). **CatchMap Pro** unlocks private cloud backup when signed in. Community insights use only anonymized, opt-in catch data.

**CatchMap Pro** — Monthly subscription ($4/mo) or one-time lifetime purchase ($49.99 launch / $59.99 list). Unlock hosted AI, cloud sync, offline maps, trip planner, pattern alerts, and personal insights.

Free map and catch logging. Pro unlocks the serious angler toolkit.

## Keywords (App Store)

fishing,angler,spots,map,bite,solunar,tides,catch log,species,lures,trip planner

## Supabase secrets (Pro + hosted AI)

Set in Supabase Dashboard → Edge Functions → Secrets:

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | Hosted Catch AI (Pro) |
| `REVENUECAT_SECRET_API_KEY` | Verify Pro purchases for anonymous users |
| `REVENUECAT_WEBHOOK_SECRET` | Optional auth for `revenuecat-webhook` |
| `PRO_DEV_BYPASS` | Set `true` in staging only to skip Pro checks |

Deploy edge functions: `ai-proxy`, `revenuecat-webhook`. Apply migration `20260710100000_026_pro_entitlements.sql`.

## IAP setup (RevenueCat)

1. Create products in App Store Connect and Play Console:
   - `catchmap_pro_monthly` — auto-renewable subscription at **$4/mo**
   - `catchmap_pro_lifetime` — non-consumable lifetime purchase
2. Configure RevenueCat entitlement `pro` linked to **both** products
3. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in EAS secrets
4. Webhook URL: `https://<project>.supabase.co/functions/v1/revenuecat-webhook`
5. Launch lifetime at **$49.99** (`EXPO_PUBLIC_PRO_LAUNCH_PROMO=true`); move to **$59.99** after 30–60 days
6. First launch shows the monthly subscription gate; users can continue with the free plan


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
- [ ] (Optional later) Crash reporting — skipped for now; app runs without Sentry
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

Skipped for now (keeps phone installs simple). Add later only if you want crash reports.

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
