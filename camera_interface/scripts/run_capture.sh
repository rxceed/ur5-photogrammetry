#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/config.env"

EXECUTABLE_PATH="$PROJECT_DIR/$BUILD_DIR/$EXECUTABLE_NAME"

if [ ! -f "$EXECUTABLE_PATH" ]; then
    echo "[ERROR] Executable not found: $EXECUTABLE_PATH"
    echo "[HINT] Run: ./scripts/build.sh"
    exit 1
fi

cd "$PROJECT_DIR"

mkdir -p "$DATASET_DIR/images"

echo "[INFO] Starting UR5 OpenSfM capture..."
echo "[INFO] Endpoint    : $ENDPOINT_URL"
echo "[INFO] Dataset     : $DATASET_DIR"
echo "[INFO] Trigger pin : $TRIGGER_PIN"
echo "[INFO] Stop pin    : $STOP_PIN"
echo "[INFO] Camera      : $CAMERA_INDEX"
echo ""

"$EXECUTABLE_PATH" \
    "$ENDPOINT_URL" \
    "$DATASET_DIR" \
    "$TRIGGER_PIN" \
    "$CAMERA_INDEX"