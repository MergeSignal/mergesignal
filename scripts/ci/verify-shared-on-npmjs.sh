#!/usr/bin/env bash
# Wait for @mergesignal/shared@VERSION on registry.npmjs.org (exact-version HTTP contract).
set -euo pipefail

VERSION="${1:?usage: verify-shared-on-npmjs.sh VERSION}"
MAX_ATTEMPTS="${2:-24}"
SLEEP_SECONDS="${3:-5}"
# Per-request bounds (retry loop remains outer resilience). Align max with governance fetch timeout.
CURL_CONNECT_TIMEOUT_SECONDS="${CURL_CONNECT_TIMEOUT_SECONDS:-10}"
CURL_MAX_TIME_SECONDS="${CURL_MAX_TIME_SECONDS:-30}"

PACKAGE_NAME="@mergesignal/shared"
ENCODED_PACKAGE="@mergesignal%2Fshared"
ENCODED_VERSION="$(node -pe "encodeURIComponent(process.argv[1])" "$VERSION")"
REGISTRY_URL="https://registry.npmjs.org/${ENCODED_PACKAGE}/${ENCODED_VERSION}"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

LAST_HTTP=""
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  LAST_HTTP="$(
    curl -sS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT_SECONDS" \
      --max-time "$CURL_MAX_TIME_SECONDS" \
      -o "$BODY_FILE" \
      -w "%{http_code}" \
      "$REGISTRY_URL" || true
  )"
  if [ "$LAST_HTTP" = "200" ]; then
    PARSED="$(
      node -e "
        const fs = require('fs');
        const doc = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        if (doc.name !== process.argv[2] || doc.version !== process.argv[3]) process.exit(2);
        console.log(doc.version);
      " "$BODY_FILE" "$PACKAGE_NAME" "$VERSION" 2>/dev/null || true
    )"
    if [ "$PARSED" = "$VERSION" ]; then
      echo "Confirmed @mergesignal/shared@${VERSION} on npm (attempt ${attempt}/${MAX_ATTEMPTS}, HTTP 200)."
      exit 0
    fi
    echo "Attempt ${attempt}/${MAX_ATTEMPTS}: HTTP 200 but document mismatch (got: ${PARSED:-<invalid>}), sleeping ${SLEEP_SECONDS}s..."
  else
    echo "Attempt ${attempt}/${MAX_ATTEMPTS}: registry not ready (HTTP ${LAST_HTTP:-<none>}), sleeping ${SLEEP_SECONDS}s..."
  fi
  sleep "$SLEEP_SECONDS"
done

echo "::error::Expected @mergesignal/shared@${VERSION} on npm after ${MAX_ATTEMPTS} attempts; last HTTP: ${LAST_HTTP:-<none>}" >&2
exit 1
