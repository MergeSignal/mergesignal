# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @mergesignal/api...

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/engine ./packages/engine
COPY packages/engine-stub ./packages/engine-stub
COPY packages/typescript-config ./packages/typescript-config

# Build packages
RUN pnpm --filter @mergesignal/shared build
RUN pnpm --filter @mergesignal/engine build
RUN pnpm --filter @mergesignal/engine-stub build
RUN pnpm --filter @mergesignal/api build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Root has "prepare": "husky"; --prod does not install husky, but prepare still runs — strip it for the image.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.scripts.prepare;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"

# Copy package.json files
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @mergesignal/api...

# Copy built artifacts from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine-stub/dist ./packages/engine-stub/dist

# Copy migrations (needed for runtime at dist/sql for migration code)
COPY apps/api/sql ./apps/api/dist/sql

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run the application
CMD ["node", "--enable-source-maps", "apps/api/dist/src/server.js"]
