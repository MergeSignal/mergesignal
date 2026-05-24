#!/usr/bin/env sh
# Verify the worker runtime image contains only lean engine artifacts.
set -eu

fail() {
  echo "::error::$1" >&2
  exit 1
}

warn() {
  echo "::warning::$1" >&2
}

test -f /app/engine/dist/index.js || fail "missing engine dist entry"
test -f /app/engine/engine-manifest.json || fail "missing engine manifest"

if find /app -name .git -type d 2>/dev/null | grep -q .; then
  fail "runtime image contains .git"
fi

if find /app/engine/dist -name '*.ts' ! -name '*.d.ts' 2>/dev/null | grep -q .; then
  fail "runtime image contains engine TypeScript source"
fi

for scan_root in /app/engine /app/packages /app/apps; do
  if [ -d "$scan_root" ] && find "$scan_root" \( -path '*test-fixture*' -o -path '*__tests__*' \) 2>/dev/null | grep -q .; then
    fail "runtime image contains test fixtures"
  fi
done

if command -v git >/dev/null 2>&1; then
  fail "runtime image contains git binary"
fi

if test -d /app/engine/packages; then
  fail "runtime image contains full engine repo layout"
fi

if grep -rE 'ghp_|github_pat_' /app 2>/dev/null | grep -q .; then
  fail "runtime image may contain GitHub tokens"
fi

SIZE_MB="$(du -sk /app 2>/dev/null | awk '{printf "%.0f", $1/1024}')"
echo "Runtime image /app size: ${SIZE_MB}MB"
if [ "$SIZE_MB" -gt 600 ]; then
  fail "runtime image exceeds 600MB hard limit (${SIZE_MB}MB)"
elif [ "$SIZE_MB" -gt 350 ]; then
  warn "Runtime image ${SIZE_MB}MB exceeds 350MB soft threshold"
fi

echo "runtime image cleanliness OK"
