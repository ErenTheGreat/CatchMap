#!/usr/bin/env bash
# Install a repo-local Android SDK on macOS (no Android Studio required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_HOME="$ROOT/.tools/android-sdk"
CMDLINE_ZIP="$ROOT/.tools/commandlinetools-mac.zip"
CMDLINE_DIR="$ANDROID_HOME/cmdline-tools"
SDKMANAGER="$CMDLINE_DIR/latest/bin/sdkmanager"

mkdir -p "$ROOT/.tools" "$ANDROID_HOME"

if [[ ! -x "$SDKMANAGER" ]]; then
  echo "Downloading Android command-line tools..."
  curl -fsSL -o "$CMDLINE_ZIP" \
    https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip
  rm -rf "$CMDLINE_DIR"
  mkdir -p "$CMDLINE_DIR/latest"
  unzip -q -o "$CMDLINE_ZIP" -d "$ROOT/.tools/_cmdline"
  # Zip extracts to cmdline-tools/ — move contents into latest/
  if [[ -d "$ROOT/.tools/_cmdline/cmdline-tools" ]]; then
    mv "$ROOT/.tools/_cmdline/cmdline-tools/"* "$CMDLINE_DIR/latest/"
  else
    mv "$ROOT/.tools/_cmdline/"* "$CMDLINE_DIR/latest/"
  fi
  rm -rf "$ROOT/.tools/_cmdline" "$CMDLINE_ZIP"
  chmod +x "$SDKMANAGER" "$CMDLINE_DIR/latest/bin/"* 2>/dev/null || true
  echo "Command-line tools installed."
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$CMDLINE_DIR/latest/bin:$PATH"

echo "Installing SDK packages (first run may take 10–20 min)..."
yes | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;27.1.12297006"

# Gradle reads this for local builds.
mkdir -p "$ROOT/android"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/android/local.properties"

echo ""
echo "Android SDK ready at: $ANDROID_HOME"
echo "Run: npm run android:device"
