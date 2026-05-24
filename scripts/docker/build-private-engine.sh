#!/usr/bin/env bash
# Build the private MergeSignal analysis engine and emit dist + engine-manifest.json.
#
# Pre-checked-out repo (GitHub Actions / local):
#   ENGINE_ROOT=/path/to/mergesignal-engine bash build-private-engine.sh
#
# Clone mode (Docker engine-builder):
#   ENGINE_REPO_TOKEN=... MERGESIGNAL_ENGINE_REF=v1.2.3 ENGINE_ROOT=/build ENGINE_OUTPUT=/engine-out bash build-private-engine.sh
#
# Never echo ENGINE_REPO_TOKEN.

set -euo pipefail

MERGESIGNAL_ENGINE_IMPL_FILE="${ENGINE_IMPL_FILE:-${MERGESIGNAL_ENGINE_IMPL_FILE:-packages/analysis-engine/dist/index.js}}"
MERGESIGNAL_ENGINE_REPOSITORY="${MERGESIGNAL_ENGINE_REPOSITORY:-MergeSignal/mergesignal-engine}"
MERGESIGNAL_ENGINE_REF="${MERGESIGNAL_ENGINE_REF:-}"
ENGINE_OUTPUT="${ENGINE_OUTPUT:-}"
ENGINE_ROOT="${ENGINE_ROOT:-}"
ENGINE_REPO_TOKEN="${ENGINE_REPO_TOKEN:-}"

log() {
  echo "[build-private-engine] $*" >&2
}

fail() {
  echo "::error::$*" >&2
  exit 1
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

clone_engine() {
  if [ -z "$MERGESIGNAL_ENGINE_REF" ]; then
    fail "MERGESIGNAL_ENGINE_REF is required for clone mode"
  fi
  if [ -z "$ENGINE_REPO_TOKEN" ]; then
    fail "ENGINE_REPO_TOKEN is required for clone mode"
  fi

  ENGINE_ROOT="${ENGINE_ROOT:-/build}"
  log "Cloning ${MERGESIGNAL_ENGINE_REPOSITORY}@${MERGESIGNAL_ENGINE_REF} into ${ENGINE_ROOT}"
  rm -rf "$ENGINE_ROOT"
  mkdir -p "$ENGINE_ROOT"

  git clone --depth 1 --branch "$MERGESIGNAL_ENGINE_REF" \
    "https://x-access-token:${ENGINE_REPO_TOKEN}@github.com/${MERGESIGNAL_ENGINE_REPOSITORY}.git" \
    "$ENGINE_ROOT"
}

build_engine_in_root() {
  local root="$1"
  cd "$root"

  if [ -f pnpm-lock.yaml ]; then
    corepack enable
    corepack prepare pnpm@9.0.0 --activate
    pnpm install --frozen-lockfile
    pnpm run build
  elif [ -f package-lock.json ]; then
    npm ci
    npm run build
  else
    fail "MergeSignal could not prepare the analysis engine (unsupported project layout)."
  fi
}

resolve_impl_file() {
  local root="$1"
  local rel="${MERGESIGNAL_ENGINE_IMPL_FILE#./}"
  rel="${rel#/}"
  echo "${root}/${rel}"
}

write_manifest() {
  local root="$1"
  local impl_file="$2"
  local manifest_path="$3"
  local git_sha package_version dist_sha node_version pnpm_version built_at
  local release_ref release_version

  git_sha="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo "")"
  package_version="$(node -e "
    const fs = require('fs');
    const path = require('path');
    const impl = process.argv[1];
    const pkgJson = path.join(path.dirname(impl), 'package.json');
    try {
      const v = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
      if (v) process.stdout.write(String(v));
    } catch { /* optional */ }
  " "$impl_file")"
  dist_sha="$(sha256_file "$impl_file")"
  node_version="$(node -v 2>/dev/null || echo "")"
  pnpm_version="$(pnpm -v 2>/dev/null || echo "")"
  built_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  release_ref="${MERGESIGNAL_ENGINE_REF:-${git_sha}}"
  release_version="${MERGESIGNAL_ENGINE_REF:-${package_version}}"

  mkdir -p "$(dirname "$manifest_path")"
  MS_ENGINE_REPO="$MERGESIGNAL_ENGINE_REPOSITORY" \
  MS_RELEASE_REF="$release_ref" \
  MS_RELEASE_VERSION="$release_version" \
  MS_GIT_SHA="$git_sha" \
  MS_PACKAGE_VERSION="$package_version" \
  MS_NODE_VERSION="$node_version" \
  MS_PNPM_VERSION="$pnpm_version" \
  MS_DIST_SHA256="$dist_sha" \
  MS_BUILT_AT="$built_at" \
  MS_MANIFEST_PATH="$manifest_path" \
  node - <<'NODE'
const fs = require('fs');
const manifest = {
  schemaVersion: 1,
  repository: process.env.MS_ENGINE_REPO,
  ref: process.env.MS_RELEASE_REF,
  engineReleaseVersion: process.env.MS_RELEASE_VERSION,
  engineReleaseGitSha: process.env.MS_GIT_SHA,
  packageVersion: process.env.MS_PACKAGE_VERSION,
  nodeVersion: process.env.MS_NODE_VERSION,
  pnpmVersion: process.env.MS_PNPM_VERSION,
  distSha256: process.env.MS_DIST_SHA256,
  implPath: 'dist/index.js',
  builtAt: process.env.MS_BUILT_AT,
};
fs.writeFileSync(process.env.MS_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
NODE
}

copy_dist_output() {
  local impl_file="$1"
  local output_dir="$2"
  local dist_dir
  dist_dir="$(dirname "$impl_file")"
  rm -rf "${output_dir}/dist"
  mkdir -p "${output_dir}/dist"
  cp -a "${dist_dir}/." "${output_dir}/dist/"
}

main() {
  if [ -n "$ENGINE_REPO_TOKEN" ]; then
    clone_engine
  elif [ -z "$ENGINE_ROOT" ]; then
    fail "ENGINE_ROOT is required when not cloning"
  elif [ ! -d "$ENGINE_ROOT" ]; then
    fail "ENGINE_ROOT does not exist: ${ENGINE_ROOT}"
  fi

  build_engine_in_root "$ENGINE_ROOT"

  local impl_file
  impl_file="$(resolve_impl_file "$ENGINE_ROOT")"
  if [ ! -f "$impl_file" ]; then
    fail "MergeSignal could not prepare the analysis engine (expected build output was not found)."
  fi

  if [ -n "$ENGINE_OUTPUT" ]; then
    mkdir -p "$ENGINE_OUTPUT"
    copy_dist_output "$impl_file" "$ENGINE_OUTPUT"
    write_manifest "$ENGINE_ROOT" "$impl_file" "${ENGINE_OUTPUT}/engine-manifest.json"
    log "Wrote dist + manifest to ${ENGINE_OUTPUT}"
  fi

  local spec="file:${impl_file}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "spec=${spec}" >> "$GITHUB_OUTPUT"
  fi
  echo "$spec"
}

main "$@"
