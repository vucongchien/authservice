# ==============================================================================
# Multi-Stage Dockerfile for AuthService (Elysia + Bun)
# Target Image Size: ~75MB (Alpine-based, minimal attack surface)
# ==============================================================================

# --- Stage 1: Base & Dependencies ---
FROM oven/bun:alpine AS deps
WORKDIR /app

COPY package.json bun.lock* ./
# Install production dependencies only
RUN bun install --production --frozen-lockfile

# --- Stage 2: Test Runner (Used by CI pipelines) ---
FROM oven/bun:alpine AS test
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .

# Run test suites inside Docker container
RUN bun test
RUN bun run test:stress

# --- Stage 3: Production Image ---
FROM oven/bun:alpine AS runner
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/authservice.db

# Create data volume directory for SQLite persistence with non-root permissions
RUN mkdir -p /app/data && chown -R bun:bun /app

# Copy production artifacts from deps stage
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun docs/demo ./docs/demo

# Use non-root user for security best practices
USER bun

# Data directory volume mount
VOLUME ["/app/data"]

# Expose HTTP port
EXPOSE 3000

# Health check using standard wget in Busybox
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/.well-known/jwks.json || exit 1

# Start the standalone server
CMD ["bun", "run", "src/index.ts"]
