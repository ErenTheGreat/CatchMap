#!/usr/bin/env bash
# One-shot Play Store closed-testing release helper for CatchMap.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Starting EAS production Android build (package app.catchmap)..."
eas build --platform android --profile production --non-interactive

echo ""
echo "==> When the build finishes, submit to Play Internal testing:"
echo "    eas submit --platform android --profile production --latest"
echo "    (eas.json submit.production.android.track = internal)"
echo ""
echo "Before first upload, confirm:"
echo "  - Android applicationId / iOS bundle ID are app.catchmap"
echo "  - Supabase Auth redirect URLs include catchmap://auth"
echo "  - RevenueCat keys: ./scripts/setup-revenuecat-eas-env.sh"
echo "  - Supabase secrets: GEMINI_API_KEY, REVENUECAT_SECRET_API_KEY"
echo "  - npm run verify:pro-launch"
echo ""
echo "Privacy policy (live):"
echo "  https://cpzwvlpqdzjjsdlnmfgg.supabase.co/functions/v1/privacy-policy"
echo ""
echo "Play Store assets in repo:"
echo "  assets/images/play-store-icon.png"
echo "  legal/play-store-listing.txt"
