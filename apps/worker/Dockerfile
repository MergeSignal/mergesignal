# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy all package.json files for workspace resolution
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @reposentinel/worker...

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
COPY packages/engine ./packages/engine
COPY packages/engine-stub ./packages/engine-stub
COPY packages/typescript-config ./packages/typescript-config

# Build packages
RUN pnpm --filter @reposentinel/shared build
RUN pnpm --filter @reposentinel/engine build
RUN pnpm --filter @reposentinel/engine-stub build
RUN pnpm --filter @reposentinel/worker build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package.json files
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @reposentinel/worker...

# Copy built artifacts from builder
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine-stub/dist ./packages/engine-stub/dist

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "--enable-source-maps", "apps/worker/dist/worker.js"]
