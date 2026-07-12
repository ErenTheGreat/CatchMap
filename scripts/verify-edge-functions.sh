#!/usr/bin/env bash
# Smoke-check hosted edge functions required for store listing / account deletion.
set -euo pipefail

BASE="${EXPO_PUBLIC_SUPABASE_URL:-https://cpzwvlpqdzjjsdlnmfgg.supabase.co}"
BASE="${BASE%/}"

check_html() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -sS -o /tmp/catchmap-fn-body -w "%{http_code}" "$url")
  if [[ "$code" != "200" ]]; then
    echo "FAIL $name — HTTP $code ($url)"
    exit 1
  fi
  if ! grep -q 'CatchMap' /tmp/catchmap-fn-body; then
    echo "FAIL $name — response missing CatchMap branding"
    exit 1
  fi
  echo "OK   $name — HTTP $code"
}

echo "Checking edge functions at $BASE ..."
check_html "privacy-policy" "$BASE/functions/v1/privacy-policy"
check_html "terms-of-service" "$BASE/functions/v1/terms-of-service"

delete_code=$(curl -sS -o /tmp/catchmap-delete-body -w "%{http_code}" \
  -X POST "$BASE/functions/v1/delete-account" \
  -H "Content-Type: application/json")
# Unauthenticated calls must be rejected (401/403), proving the function is deployed and gated.
if [[ "$delete_code" != "401" && "$delete_code" != "403" ]]; then
  echo "FAIL delete-account — expected 401/403 without auth, got $delete_code"
  cat /tmp/catchmap-delete-body
  exit 1
fi
echo "OK   delete-account — HTTP $delete_code (auth required)"

echo ""
echo "All required edge functions look healthy."
echo ""
echo "Manual checklist (see docs/PRO_LAUNCH_SETUP.md):"
echo "  - Supabase Auth → Redirect URLs: catchmap://auth"
echo "  - Supabase Edge secrets: GEMINI_API_KEY, REVENUECAT_SECRET_API_KEY"
echo "  - EAS production: EXPO_PUBLIC_REVENUECAT_IOS_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY"
