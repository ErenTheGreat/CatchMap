#!/usr/bin/env bash
# Run EAS Android builds with repo-local adb on PATH when available.
# Uses --non-interactive by default so missing adb/emulator never fails the build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/ensure-android-platform-tools.sh" || true

TOOLS_DIR="$ROOT/.tools/android-sdk"
if [[ -d "$TOOLS_DIR/platform-tools" ]]; then
  export ANDROID_HOME="$TOOLS_DIR"
  export ANDROID_SDK_ROOT="$TOOLS_DIR"
  export PATH="$TOOLS_DIR/platform-tools:$PATH"
fi

NON_INTERACTIVE=true
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--interactive" ]]; then
    NON_INTERACTIVE=false
    continue
  fi
  ARGS+=("$arg")
done

if $NON_INTERACTIVE; then
  exec eas build --non-interactive "${ARGS[@]}"
fi

exec eas build "${ARGS[@]}"
