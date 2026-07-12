#!/usr/bin/env bash
# Automated Pro launch readiness checks (local + remote).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE="${EXPO_PUBLIC_SUPABASE_URL:-https://cpzwvlpqdzjjsdlnmfgg.supabase.co}"
BASE="${BASE%/}"
ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"

failures=0
warn=0

ok() { echo "OK   $*"; }
warn_msg() { echo "WARN $*"; warn=$((warn + 1)); }
fail() { echo "FAIL $*"; failures=$((failures + 1)); }

echo "==> CatchMap Pro launch verification"
echo ""

echo "-- Code quality --"
if npm run typecheck >/dev/null 2>&1; then ok "TypeScript"; else fail "TypeScript (npm run typecheck)"; fi
if npm test >/dev/null 2>&1; then ok "Unit tests (202+)"; else fail "Unit tests (npm test)"; fi
if npm run lint >/dev/null 2>&1; then ok "ESLint"; else warn_msg "ESLint warnings present"; fi

echo ""
echo "-- Client env (local .env or EAS production) --"
[[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]] && ok "EXPO_PUBLIC_SUPABASE_URL" || fail "EXPO_PUBLIC_SUPABASE_URL missing"
[[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]] && ok "EXPO_PUBLIC_SUPABASE_ANON_KEY" || fail "EXPO_PUBLIC_SUPABASE_ANON_KEY missing"
[[ -n "${EXPO_PUBLIC_PRIVACY_POLICY_URL:-}" ]] && ok "EXPO_PUBLIC_PRIVACY_POLICY_URL" || warn_msg "EXPO_PUBLIC_PRIVACY_POLICY_URL missing (paywall legal links)"
[[ -n "${EXPO_PUBLIC_TERMS_OF_SERVICE_URL:-}" ]] && ok "EXPO_PUBLIC_TERMS_OF_SERVICE_URL" || warn_msg "EXPO_PUBLIC_TERMS_OF_SERVICE_URL missing"
[[ -n "${EXPO_PUBLIC_REVENUECAT_IOS_KEY:-}" ]] && ok "EXPO_PUBLIC_REVENUECAT_IOS_KEY" || warn_msg "EXPO_PUBLIC_REVENUECAT_IOS_KEY missing — run scripts/setup-revenuecat-eas-env.sh"
[[ -n "${EXPO_PUBLIC_REVENUECAT_ANDROID_KEY:-}" ]] && ok "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY" || warn_msg "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY missing — run scripts/setup-revenuecat-eas-env.sh"

echo ""
echo "-- EAS production env (optional; requires eas login) --"
if command -v eas >/dev/null 2>&1; then
  if eas env:list --environment production --non-interactive 2>/dev/null | grep -q REVENUECAT; then
    ok "EAS production has RevenueCat keys"
  else
    warn_msg "EAS production missing RevenueCat keys — run scripts/setup-revenuecat-eas-env.sh"
  fi
else
  warn_msg "EAS CLI not installed — cannot verify remote build env"
fi

echo ""
echo "-- Edge functions --"
if bash scripts/verify-edge-functions.sh; then
  ok "Legal + delete-account edge functions"
else
  fail "Edge function smoke check (scripts/verify-edge-functions.sh)"
fi

if [[ -n "$ANON_KEY" ]]; then
  ai_code=$(curl -sS -o /tmp/catchmap-ai-proxy.json -w "%{http_code}" \
    -X POST "$BASE/functions/v1/ai-proxy" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON_KEY" \
    -d '{"mode":"usage"}' 2>/dev/null || echo "000")
  if [[ "$ai_code" == "401" || "$ai_code" == "403" ]]; then
    ok "ai-proxy deployed (auth/entitlement gate active — HTTP $ai_code)"
  elif [[ "$ai_code" == "200" ]]; then
    ok "ai-proxy deployed (HTTP 200)"
  else
    fail "ai-proxy — unexpected HTTP $ai_code"
  fi

  rc_code=$(curl -sS -o /tmp/catchmap-rc-webhook.json -w "%{http_code}" \
    -X POST "$BASE/functions/v1/revenuecat-webhook" \
    -H "Content-Type: application/json" \
    -d '{"event":{"type":"TEST"}}' 2>/dev/null || echo "000")
  if [[ "$rc_code" == "200" || "$rc_code" == "401" ]]; then
    ok "revenuecat-webhook deployed (HTTP $rc_code)"
  else
    fail "revenuecat-webhook — unexpected HTTP $rc_code"
  fi
else
  warn_msg "Skipping ai-proxy / webhook HTTP checks (no anon key)"
fi

echo ""
echo "-- Auth redirect allowlist (manual Supabase Dashboard step) --"
echo "     Add these URLs in Supabase → Authentication → URL Configuration → Redirect URLs:"
for url in "catchmap://auth" "exp+bolt-expo-nativewind://auth"; do
  echo "     - $url"
done
warn_msg "Confirm redirect URLs manually in Supabase Dashboard"

echo ""
echo "-- Manual steps before public Pro launch --"
echo "     - Supabase secrets: GEMINI_API_KEY, REVENUECAT_SECRET_API_KEY"
echo "     - RevenueCat webhook URL + optional REVENUECAT_WEBHOOK_SECRET"
echo "     - App Store / Play products: catchmap_pro_monthly, catchmap_pro_lifetime"
echo "     - Production APK/IPA smoke test on device (npm run smoke:production)"
echo "     - Store screenshots + support@catchmap.app mailbox"
echo "     - Offline maps excluded from marketing (v1.0 uses WebView map in release)"

echo ""
if [[ "$failures" -gt 0 ]]; then
  echo "Result: $failures failure(s), $warn warning(s) — NOT ready for Pro launch"
  exit 1
fi
if [[ "$warn" -gt 0 ]]; then
  echo "Result: 0 failures, $warn warning(s) — code ready; complete launch ops warnings above"
  exit 0
fi
echo "Result: All automated checks passed"
