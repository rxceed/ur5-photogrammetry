# Dockerfile for user_interface
FROM oven/bun:1.3.9

WORKDIR /app/user_interface

# Copy frontend package definitions and install dependencies
COPY user_interface/package.json user_interface/bun.lock* /app/user_interface/
RUN bun install --frozen-lockfile

# Copy frontend source files
COPY --exclude=.env user_interface /app/user_interface

EXPOSE 4001
CMD ["bun", "run", "start"]
