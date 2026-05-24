# ── Worker build ──
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/engine-test-fixture/package.json ./packages/engine-test-fixture/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile --filter @mergesignal/worker...

COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
COPY packages/engine ./packages/engine
COPY packages/engine-stub ./packages/engine-stub
COPY packages/engine-test-fixture ./packages/engine-test-fixture
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

RUN pnpm --filter @mergesignal/shared build
RUN pnpm --filter @mergesignal/engine-stub build
RUN pnpm --filter @mergesignal/engine build
RUN pnpm --filter @mergesignal/engine-test-fixture build
RUN pnpm --filter @mergesignal/worker build

# ── Engine output (private clone OR CI fixture) ──
FROM node:22-alpine AS engine-builder

ARG MERGESIGNAL_ENGINE_FIXTURE=0
ARG MERGESIGNAL_ENGINE_REPOSITORY=MergeSignal/mergesignal-engine
ARG MERGESIGNAL_ENGINE_REF
ARG MERGESIGNAL_ENGINE_IMPL_FILE=packages/analysis-engine/dist/index.js
ENV ENGINE_OUTPUT=/engine-out

COPY scripts/docker/build-private-engine.sh /scripts/build-private-engine.sh
COPY scripts/docker/write-fixture-engine-manifest.mjs /scripts/write-fixture-engine-manifest.mjs
COPY --from=builder /app/packages/engine-test-fixture/dist /fixture-dist/

RUN if [ "$MERGESIGNAL_ENGINE_FIXTURE" = "1" ]; then \
      mkdir -p /engine-out/dist && cp -a /fixture-dist/. /engine-out/dist/ && \
      node /scripts/write-fixture-engine-manifest.mjs /engine-out; \
    fi

RUN --mount=type=secret,id=engine_repo_token \
    if [ "$MERGESIGNAL_ENGINE_FIXTURE" != "1" ]; then \
      chmod +x /scripts/build-private-engine.sh && \
      apk add --no-cache git bash && \
      test -n "$MERGESIGNAL_ENGINE_REF" || (echo "MERGESIGNAL_ENGINE_REF is required" >&2; exit 1) && \
      ENGINE_REPO_TOKEN="$(cat /run/secrets/engine_repo_token)" && \
      test -n "$ENGINE_REPO_TOKEN" || (echo "engine_repo_token build secret is required" >&2; exit 1) && \
      ENGINE_REPO_TOKEN="$ENGINE_REPO_TOKEN" \
      ENGINE_ROOT=/engine-src \
      MERGESIGNAL_ENGINE_REPOSITORY="$MERGESIGNAL_ENGINE_REPOSITORY" \
      MERGESIGNAL_ENGINE_REF="$MERGESIGNAL_ENGINE_REF" \
      MERGESIGNAL_ENGINE_IMPL_FILE="$MERGESIGNAL_ENGINE_IMPL_FILE" \
      ENGINE_OUTPUT="$ENGINE_OUTPUT" \
      bash /scripts/build-private-engine.sh; \
    fi

# ── Lean runtime ──
FROM node:22-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.scripts.prepare;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"

COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-stub/package.json ./packages/engine-stub/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile --prod --filter @mergesignal/worker...

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine-stub/dist ./packages/engine-stub/dist

COPY --from=engine-builder /engine-out/dist /app/engine/dist
COPY --from=engine-builder /engine-out/engine-manifest.json /app/engine/engine-manifest.json

ENV NODE_ENV=production
ENV MERGESIGNAL_ENGINE_IMPL=file:/app/engine/dist/index.js
ENV MERGESIGNAL_ENGINE_MANIFEST=/app/engine/engine-manifest.json

RUN test -f /app/engine/dist/index.js && test -f /app/engine/engine-manifest.json

COPY scripts/docker/verify-runtime-engine.sh /scripts/verify-runtime-engine.sh
COPY scripts/docker/verify-runtime-image-clean.sh /scripts/verify-runtime-image-clean.sh
RUN chmod +x /scripts/verify-runtime-engine.sh /scripts/verify-runtime-image-clean.sh

RUN /scripts/verify-runtime-image-clean.sh && /scripts/verify-runtime-engine.sh

CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]
