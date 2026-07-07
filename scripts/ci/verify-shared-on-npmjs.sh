#!/usr/bin/env bash
# Wait for @mergesignal/shared@VERSION to appear on registry.npmjs.org.
set -euo pipefail

VERSION="${1:?usage: verify-shared-on-npmjs.sh VERSION}"
MAX_ATTEMPTS="${2:-12}"
SLEEP_SECONDS="${3:-5}"

PUBLISHED=""
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  PUBLISHED=$(npm view "@mergesignal/shared@${VERSION}" version \
    --@mergesignal:registry=https://registry.npmjs.org/ 2>/dev/null || true)
  if [ "$PUBLISHED" = "$VERSION" ]; then
    echo "Confirmed @mergesignal/shared@${VERSION} on npm (attempt ${attempt}/${MAX_ATTEMPTS})."
    exit 0
  fi
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}: registry not ready (got: ${PUBLISHED:-<none>}), sleeping ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

echo "::error::Expected @mergesignal/shared@${VERSION} on npm after ${MAX_ATTEMPTS} attempts; last result: ${PUBLISHED:-<none>}" >&2
exit 1
