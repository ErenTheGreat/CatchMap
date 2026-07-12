# CatchMap Pro Launch Setup

Step-by-step guide to complete Pro launch ops. Code is ready; these are dashboard and store tasks.

## 1. RevenueCat + store products

### App Store Connect (iOS)

1. Create app `app.catchmap` (bundle ID must match [`app.config.ts`](../app.config.ts))
2. Add in-app purchases:
   - **catchmap_pro_monthly** — Auto-renewable subscription, $4.99/mo (or $4.00)
   - **catchmap_pro_lifetime** — Non-consumable, $49.99 launch price
3. Submit products for review (can test in sandbox before approval)

### Google Play Console (Android)

1. Create app with package **app.catchmap**
2. Monetization → Products:
   - **catchmap_pro_monthly** — Subscription, $4.99/mo
   - **catchmap_pro_lifetime** — One-time product, $49.99
3. Activate products in internal testing track first

### RevenueCat dashboard

1. Create project → add iOS + Android apps
2. Create entitlement **`pro`**
3. Attach both products to entitlement `pro`
4. Create offering **default** with monthly + lifetime packages
5. Copy public API keys (appl_xxx, goog_xxx)
6. Webhook: `POST https://cpzwvlpqdzjjsdlnmfgg.supabase.co/functions/v1/revenuecat-webhook`
   - Optional: set `REVENUECAT_WEBHOOK_SECRET` in Supabase and matching Authorization header in RC

### EAS environment variables

```bash
REVENUECAT_IOS_KEY=appl_xxx REVENUECAT_ANDROID_KEY=goog_xxx ./scripts/setup-revenuecat-eas-env.sh
```

Or manually:

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --environment production
eas env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_xxx --environment production
eas env:create --name EXPO_PUBLIC_PRO_LAUNCH_PROMO --value true --environment production
```

---

## 2. Supabase secrets (Edge Functions)

Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Required | Purpose |
|--------|----------|---------|
| `GEMINI_API_KEY` | Yes | Catch AI, species ID, coach enhance |
| `REVENUECAT_SECRET_API_KEY` | Yes | Verify anonymous Pro purchasers in ai-proxy |
| `REVENUECAT_WEBHOOK_SECRET` | Optional | Authenticate RevenueCat webhooks |
| `PRO_DEV_BYPASS` | Staging only | Skip Pro checks when `true` |

Edge functions (already deployed — redeploy after code changes):

- `ai-proxy` — hosted Catch AI
- `revenuecat-webhook` — sync Pro to `pro_entitlements` table

Database migration `pro_entitlements` is applied (tables: `pro_entitlements`, `pro_ai_usage`).

Verify:

```bash
npm run verify:pro-launch
```

---

## 3. Auth redirect URLs

Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**:

- `catchmap://auth`
- `exp+bolt-expo-nativewind://auth` (dev client only)

Site URL can remain the project URL. The app builds redirects via [`lib/auth/deepLinkAuth.ts`](../lib/auth/deepLinkAuth.ts).

---

## 4. Production smoke test

```bash
# Build
eas build --platform android --profile production
# or
eas build --platform ios --profile production

# Automated checks + manual checklist
npm run smoke:production
```

Install on a physical device and complete the checklist printed by the script.

---

## 5. Store submission

### Assets needed

1. Map + discovery dashboard
2. Spot detail (weather, tides, species)
3. Log catch form
4. Catch history
5. Species guide
6. Catch AI chat (Pro)
7. Trip planner / Fish Today (Pro)
8. Settings (account, Pro, legal links)

Sizes: iPhone 6.7" + 6.1", Android 1080×1920. See [`docs/STORE_LISTING.md`](STORE_LISTING.md).

### Support email

Route **support@catchmap.app** before public launch (feedback fallback in app).

### Submit

```bash
eas submit --platform android --profile production --latest
eas submit --platform ios --profile production --latest
```

Play track is `internal` in [`eas.json`](../eas.json) — promote to production after beta.

---

## 6. Marketing scope (v1.0)

**Do not advertise offline maps** in store copy for v1.0. Production builds use a WebView map; offline tile packs require native MapLibre (dev builds only today).

Pro features to highlight:

- Hosted Catch AI + photo species ID
- Cloud backup (signed-in Pro users)
- Trip planner, Fish Today, weekend planner
- Pattern alerts, personal insights, premium map layers

---

## Pre-launch checklist

- [ ] RevenueCat products + entitlement `pro` configured
- [ ] EAS production env has `EXPO_PUBLIC_REVENUECAT_*` keys
- [ ] Supabase secrets: `GEMINI_API_KEY`, `REVENUECAT_SECRET_API_KEY`
- [ ] RevenueCat webhook pointing to Supabase
- [ ] Auth redirect URLs include `catchmap://auth`
- [ ] `npm run verify:pro-launch` passes (warnings OK for manual steps)
- [ ] Production device smoke test complete
- [ ] Screenshots captured
- [ ] support@catchmap.app live
- [ ] Store listings updated (offline maps removed from copy)
