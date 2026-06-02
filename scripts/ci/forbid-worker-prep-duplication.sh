#!/usr/bin/env bash
# Fail if worker packages reintroduce scan-prep modules locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FORBIDDEN=(
  "lockfile-diff.ts"
  "github-files.ts"
  "github-auth.ts"
  "file-cache.ts"
)

SEARCH_DIRS=(
  "$ROOT/apps/worker"
)

if [[ -d "$ROOT/../mergesignal-engine/packages/worker" ]]; then
  SEARCH_DIRS+=("$ROOT/../mergesignal-engine/packages/worker")
fi

failed=0
for dir in "${SEARCH_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  for name in "${FORBIDDEN[@]}"; do
    if find "$dir" -name "$name" -print -quit | grep -q .; then
      echo "::error::Forbidden prep module $name under $dir — use @mergesignal/scan-prep"
      find "$dir" -name "$name"
      failed=1
    fi
  done
done

exit "$failed"
