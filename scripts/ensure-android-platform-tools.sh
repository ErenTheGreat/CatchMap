#!/usr/bin/env bash
# Install Android platform-tools (adb) into the repo-local .tools directory.
# Avoids needing system-wide Android Studio / sudo on Fedora.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="$ROOT/.tools/android-sdk"
ADB="$TOOLS_DIR/platform-tools/adb"

if [[ -x "$ADB" ]]; then
  echo "adb already present: $ADB"
  exit 0
fi

if command -v adb >/dev/null 2>&1; then
  echo "system adb found: $(command -v adb)"
  exit 0
fi

ZIP="$ROOT/.tools/platform-tools-latest-linux.zip"
mkdir -p "$ROOT/.tools"

echo "Downloading Android platform-tools..."
curl -fsSL -o "$ZIP" https://dl.google.com/android/repository/platform-tools-latest-linux.zip

TMP="$ROOT/.tools/_platform-tools-extract"
rm -rf "$TMP"
mkdir -p "$TMP"
unzip -q -o "$ZIP" -d "$TMP"
rm -rf "$TOOLS_DIR/platform-tools"
mkdir -p "$TOOLS_DIR"
mv "$TMP/platform-tools" "$TOOLS_DIR/"
rm -rf "$TMP" "$ZIP"

echo "Installed adb at $ADB"
