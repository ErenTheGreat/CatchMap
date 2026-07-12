#!/usr/bin/env bash
# Production smoke test — automated portion + printable manual checklist.
# Run after installing a production APK/IPA on a physical device.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> CatchMap production smoke test"
echo ""
echo "Phase 1: Automated (local + remote)"
bash scripts/verify-pro-launch.sh

echo ""
echo "Phase 2: Manual device checklist"
cat <<'EOF'

Install production build on a physical device, then verify:

[ ] Map loads and fishing spots appear when panning
[ ] Tap a spot — weather, tides, species panel loads
[ ] Log Catch tab — save a catch with species + photo
[ ] History tab — new catch appears; edit works
[ ] Species tab — guide loads with rig diagrams
[ ] Settings → Export JSON/CSV works
[ ] Settings → Privacy Policy and Terms links open
[ ] Auth → Sign up with email (check inbox for confirmation)
[ ] Auth → Sign in after confirming email
[ ] Pro gate → Subscribe monthly (sandbox / test account)
[ ] Pro gate → Restore purchases works after reinstall
[ ] Catch AI tab → send a message, receive reply (requires Pro + GEMINI_API_KEY)
[ ] Log Catch → photo species ID suggests a species (Pro)
[ ] Fish Today / Trip planner cards show on map (Pro)
[ ] Remind me → notification permission prompt appears
[ ] Settings → Send feedback submits successfully

Android only:
[ ] Uninstall any old app.catchmap build before installing (signature mismatch)

EOF

echo "Mark each item in docs/PRO_LAUNCH_SETUP.md when complete."
