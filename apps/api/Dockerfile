# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy all package.json files for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @reposentinel/api...

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/engine ./packages/engine
COPY packages/engine-stub ./packages/engine-stub
COPY packages/typescript-config ./packages/typescript-config

# Build packages
RUN pnpm --filter @reposentinel/shared build
RUN pnpm --filter @reposentinel/engine build
RUN pnpm --filter @reposentinel/engine-stub build
RUN pnpm --filter @reposentinel/api build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package.json files
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @reposentinel/api...

# Copy built artifacts from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine-stub/dist ./packages/engine-stub/dist

# Copy migrations (needed for runtime)
COPY apps/api/src/migrations ./apps/api/src/migrations

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run the application
CMD ["node", "--enable-source-maps", "apps/api/dist/server.js"]
