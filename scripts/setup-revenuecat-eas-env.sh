#!/usr/bin/env bash
# Configure RevenueCat public API keys for EAS production/preview builds.
# Run after creating products in App Store Connect + Play Console and linking them in RevenueCat.
#
# Prerequisites:
#   1. npm i -g eas-cli && eas login
#   2. RevenueCat project with entitlement "pro" linked to:
#        - catchmap_pro_monthly (subscription)
#        - catchmap_pro_lifetime (non-consumable)
#   3. Public API keys from RevenueCat → Project → API keys → App-specific keys
#
# Usage:
#   REVENUECAT_IOS_KEY=appl_xxx REVENUECAT_ANDROID_KEY=goog_xxx ./scripts/setup-revenuecat-eas-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v eas >/dev/null 2>&1; then
  echo "Install EAS CLI: npm i -g eas-cli"
  exit 1
fi

IOS_KEY="${REVENUECAT_IOS_KEY:-}"
ANDROID_KEY="${REVENUECAT_ANDROID_KEY:-}"

if [[ -z "$IOS_KEY" || -z "$ANDROID_KEY" ]]; then
  echo "Set REVENUECAT_IOS_KEY and REVENUECAT_ANDROID_KEY environment variables."
  echo ""
  echo "Example:"
  echo "  REVENUECAT_IOS_KEY=appl_xxx REVENUECAT_ANDROID_KEY=goog_xxx ./scripts/setup-revenuecat-eas-env.sh"
  exit 1
fi

set_env() {
  local name="$1"
  local value="$2"
  local env_name="$3"
  echo "==> Setting $name for $env_name ..."
  eas env:create \
    --name "$name" \
    --value "$value" \
    --environment "$env_name" \
    --visibility plaintext \
    --force \
    --non-interactive
}

for ENV in production preview; do
  set_env "EXPO_PUBLIC_REVENUECAT_IOS_KEY" "$IOS_KEY" "$ENV"
  set_env "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY" "$ANDROID_KEY" "$ENV"
  set_env "EXPO_PUBLIC_PRO_LAUNCH_PROMO" "true" "$ENV"
done

echo ""
echo "RevenueCat keys configured for production and preview."
echo "Next:"
echo "  1. Set Supabase secrets (see docs/PRO_LAUNCH_SETUP.md)"
echo "  2. Configure RevenueCat webhook → https://cpzwvlpqdzjjsdlnmfgg.supabase.co/functions/v1/revenuecat-webhook"
echo "  3. Run: npm run verify:pro-launch"
