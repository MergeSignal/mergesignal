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
MERGESIGNAL_COLLECTION_INGRESS_IMPL_FILE="${MERGESIGNAL_COLLECTION_INGRESS_IMPL_FILE:-packages/evidence-collection-ingress/dist/production-scan-ingress.js}"
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
    corepack install
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
  local rel="${2:-$MERGESIGNAL_ENGINE_IMPL_FILE}"
  rel="${rel#./}"
  rel="${rel#/}"
  echo "${root}/${rel}"
}

resolve_analysis_engine_package_dir() {
  local impl_file="$1"
  local pkg_dir
  pkg_dir="$(dirname "$impl_file")"
  while [ "$pkg_dir" != "/" ] && [ ! -f "${pkg_dir}/package.json" ]; do
    pkg_dir="$(dirname "$pkg_dir")"
  done
  if [ ! -f "${pkg_dir}/package.json" ]; then
    echo "::error::analysis-engine package.json not found for ${impl_file}" >&2
    return 1
  fi
  echo "$pkg_dir"
}

write_manifest() {
  local root="$1"
  local impl_file="$2"
  local manifest_path="$3"
  local ingress_file="$4"
  local collection_ingress_rel="${5:-ingress/dist/production-scan-ingress.js}"
  local git_sha package_version dist_sha ingress_sha node_version pnpm_version built_at
  local release_ref release_version
  local pkg_dir

  git_sha="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo "")"
  local source_impl
  source_impl="$(resolve_impl_file "$root")"
  pkg_dir="$(resolve_analysis_engine_package_dir "$source_impl")"
  package_version="$(node -e "
    const fs = require('fs');
    const pkgJson = process.argv[1];
    try {
      const v = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
      if (v) process.stdout.write(String(v));
    } catch { /* optional */ }
  " "${pkg_dir}/package.json")"
  if [ -z "$package_version" ]; then
    fail "analysis-engine package version is required for engine-manifest.json"
  fi
  dist_sha="$(sha256_file "$impl_file")"
  ingress_sha="$(sha256_file "$ingress_file")"
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
  MS_INGRESS_SHA256="$ingress_sha" \
  MS_BUILT_AT="$built_at" \
  MS_MANIFEST_PATH="$manifest_path" \
  MS_COLLECTION_INGRESS_PATH="$collection_ingress_rel" \
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
  collectionIngressPath: process.env.MS_COLLECTION_INGRESS_PATH,
  collectionIngressSha256: process.env.MS_INGRESS_SHA256,
  implPath: 'dist/index.js',
  builtAt: process.env.MS_BUILT_AT,
};
fs.writeFileSync(process.env.MS_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
NODE
}

copy_dist_output() {
  local impl_file="$1"
  local output_dir="$2"
  local ingress_file="$3"
  local dist_dir ingress_dist_dir
  dist_dir="$(dirname "$impl_file")"
  rm -rf "${output_dir}/dist" "${output_dir}/ingress"
  mkdir -p "${output_dir}/dist"
  cp -a "${dist_dir}/." "${output_dir}/dist/"
  if [ ! -f "$ingress_file" ]; then
    fail "Evidence collection ingress build output not found: ${ingress_file}"
  fi
  ingress_dist_dir="$(dirname "$ingress_file")"
  mkdir -p "${output_dir}/ingress/dist"
  cp -a "${ingress_dist_dir}/." "${output_dir}/ingress/dist/"
}

verify_baked_engine_output() {
  local output_dir="$1"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  node "${script_dir}/verify-engine-bake-output.mjs" "$output_dir"
}

copy_engine_runtime_deps() {
  local root="$1"
  local output_dir="$2"
  local impl_file="$3"
  local deploy_ae
  local deploy_ingress
  local pkg_dir
  deploy_ae="$(mktemp -d)"
  deploy_ingress="$(mktemp -d)"
  pkg_dir="$(dirname "$impl_file")"
  while [ "$pkg_dir" != "/" ] && [ ! -f "${pkg_dir}/package.json" ]; do
    pkg_dir="$(dirname "$pkg_dir")"
  done
  test -f "${pkg_dir}/package.json" || fail "analysis-engine package.json not found for ${impl_file}"

  cd "$root"
  pnpm --filter @mergesignal/analysis-engine deploy --prod "$deploy_ae"
  pnpm --filter @mergesignal/evidence-collection-ingress deploy --prod "$deploy_ingress"
  rm -rf "${output_dir}/node_modules"
  mkdir -p "${output_dir}/node_modules"
  cp -a "${deploy_ae}/node_modules/." "${output_dir}/node_modules/"
  cp -a "${deploy_ingress}/node_modules/." "${output_dir}/node_modules/"
  # Both deploys resolve from the same ENGINE_ROOT lockfile; overlapping packages should
  # resolve to identical versions. Ingress deploy runs second and wins on name collisions.
  cp "${pkg_dir}/package.json" "${output_dir}/package.json"
  rm -rf "$deploy_ae" "$deploy_ingress"
}

prune_engine_deploy_test_paths() {
  local output_dir="$1"
  find "$output_dir" -type d \( -name '__tests__' -o -name '*test-fixture*' \) -print0 2>/dev/null \
    | xargs -0 rm -rf 2>/dev/null || true
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
  local ingress_file
  impl_file="$(resolve_impl_file "$ENGINE_ROOT")"
  ingress_file="$(resolve_impl_file "$ENGINE_ROOT" "$MERGESIGNAL_COLLECTION_INGRESS_IMPL_FILE")"
  if [ ! -f "$impl_file" ]; then
    fail "MergeSignal could not prepare the analysis engine (expected build output was not found)."
  fi
  if [ ! -f "$ingress_file" ]; then
    fail "MergeSignal could not prepare evidence collection ingress (expected build output was not found)."
  fi

  if [ -n "$ENGINE_OUTPUT" ]; then
    local baked_impl baked_ingress collection_ingress_rel
    collection_ingress_rel="ingress/dist/production-scan-ingress.js"
    mkdir -p "$ENGINE_OUTPUT"
    copy_dist_output "$impl_file" "$ENGINE_OUTPUT" "$ingress_file"
    copy_engine_runtime_deps "$ENGINE_ROOT" "$ENGINE_OUTPUT" "$impl_file"
    prune_engine_deploy_test_paths "$ENGINE_OUTPUT"
    baked_impl="${ENGINE_OUTPUT}/dist/index.js"
    baked_ingress="${ENGINE_OUTPUT}/${collection_ingress_rel}"
    write_manifest "$ENGINE_ROOT" "$baked_impl" "${ENGINE_OUTPUT}/engine-manifest.json" "$baked_ingress" "$collection_ingress_rel"
    verify_baked_engine_output "$ENGINE_OUTPUT"
    log "Wrote dist + manifest to ${ENGINE_OUTPUT}"
  fi

  local spec="file:${impl_file}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "spec=${spec}" >> "$GITHUB_OUTPUT"
  fi
  echo "$spec"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
