# Dockerfile for backend_api + camera_interface compilation
FROM oven/bun:1.3.9 AS builder

# Install C++ compilation tools and dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    libopencv-dev \
    libcurl4-openssl-dev \
    nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy camera_interface files and build the C++ binary
COPY --exclude=build camera_interface /app/camera_interface
RUN mkdir -p /app/camera_interface/build && \
    cd /app/camera_interface/build && \
    cmake .. && \
    make -j$(nproc)

# Copy backend dependencies
COPY backend_api/package.json backend_api/bun.lock* /app/backend_api/
RUN cd /app/backend_api && bun install --frozen-lockfile

# Copy backend source files
COPY --exclude=.env backend_api /app/backend_api

WORKDIR /app/backend_api

EXPOSE 4000
CMD ["bun", "run", "src/index.ts"]
