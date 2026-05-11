#!/usr/bin/env bash
set -e

echo "[INFO] Installing dependencies..."

sudo apt update

sudo apt install -y \
    build-essential \
    cmake \
    pkg-config \
    libopencv-dev \
    libcurl4-openssl-dev \
    nlohmann-json3-dev

echo "[OK] Dependencies installed."