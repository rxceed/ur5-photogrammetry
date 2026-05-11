#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/config.env"

cd "$PROJECT_DIR"

echo "[INFO] Project dir : $PROJECT_DIR"
echo "[INFO] Build dir   : $BUILD_DIR"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

cmake ..
make -j"$(nproc)"

echo "[OK] Build finished."
echo "[OK] Executable: $PROJECT_DIR/$BUILD_DIR/$EXECUTABLE_NAME"