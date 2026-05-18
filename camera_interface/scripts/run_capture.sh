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

echo "[INFO] Starting UR5 capture system..."
echo "[INFO] Input URL         : $INPUT_URL"
echo "[INFO] Start relay URL   : $START_RELAY_URL"
echo "[INFO] Dataset           : $DATASET_DIR"
echo "[INFO] Photo trigger pin : $PHOTO_TRIGGER_PIN"
echo "[INFO] Camera path       : $CAMERA_PATH"
echo "[INFO] Max captures      : $MAX_CAPTURES"
echo ""

"$EXECUTABLE_PATH" \
    "$INPUT_URL" \
    "$DATASET_DIR" \
    "$PHOTO_TRIGGER_PIN" \
    "$CAMERA_PATH" \
    "$MAX_CAPTURES" \
    "$START_RELAY_URL"