# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy all package.json files for workspace resolution
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter web...

# Copy source code
COPY apps/web ./apps/web
COPY packages/ui ./packages/ui
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

# Build the Next.js application
RUN pnpm --filter web build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package.json files
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter web...

# Copy built Next.js artifacts from builder
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the Next.js application
CMD ["pnpm", "--filter", "web", "start"]
