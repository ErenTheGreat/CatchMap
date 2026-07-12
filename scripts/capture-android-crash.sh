#!/usr/bin/env bash
# Capture CatchMap crash logs from a USB-connected Android device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/.tools/android-sdk/platform-tools/adb"

if [[ ! -x "$ADB" ]]; then
  echo "adb not found. Run from project root after platform-tools are installed."
  exit 1
fi

echo "=== Connected devices ==="
"$ADB" devices -l

DEVICE_STATE=$("$ADB" devices | awk 'NR>1 && $1 != "" { print $2; exit }')
if [[ "$DEVICE_STATE" == "unauthorized" ]]; then
  echo ""
  echo "Phone is UNAUTHORIZED. On your phone:"
  echo "  1. Unlock the screen"
  echo "  2. Tap Allow on the USB debugging popup"
  echo "  3. Optionally enable 'Always allow from this computer'"
  echo "  4. Run this script again"
  exit 1
fi

if [[ -z "$DEVICE_STATE" || "$DEVICE_STATE" == "offline" ]]; then
  echo "No device ready. Plug in USB, enable Developer options → USB debugging."
  exit 1
fi

echo ""
echo "=== Clearing old logs, then launch CatchMap on your phone now ==="
"$ADB" logcat -c
sleep 2
echo "Capturing 15 seconds of logs..."
"$ADB" logcat -v time 2>&1 | head -n 5000 > "$ROOT/android-crash-log.txt" &
LOG_PID=$!
sleep 15
kill "$LOG_PID" 2>/dev/null || true

echo ""
echo "=== Crash lines (if any) ==="
grep -iE "FATAL|AndroidRuntime|app\.catchmap|ReactNativeJS|Expo|crash|Exception" "$ROOT/android-crash-log.txt" | tail -60 || true

echo ""
echo "Full log saved to: $ROOT/android-crash-log.txt"
