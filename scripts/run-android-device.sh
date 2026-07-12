#!/usr/bin/env bash
# Build CatchMap and install on a USB-connected Android phone.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_HOME="$ROOT/.tools/android-sdk"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

ADB="$ANDROID_HOME/platform-tools/adb"
if [[ ! -x "$ADB" ]]; then
  echo "Android SDK not set up. Run: bash scripts/setup-android-mac.sh"
  exit 1
fi

if ! "$ADB" devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "No Android device found."
  echo "Plug in your phone, enable USB debugging, and tap Allow."
  "$ADB" devices -l
  exit 1
fi

cd "$ROOT"
npx expo run:android --device
