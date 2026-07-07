#!/usr/bin/env bash
# Point npm @mergesignal scope at registry.npmjs.org for publish/verify steps.
#
# actions/setup-node sets NPM_CONFIG_USERCONFIG with @mergesignal → GitHub Packages
# (needed for pnpm install of @mergesignal/contracts). That userconfig overrides
# repo .npmrc --location=project, so npm view after publish falsely queries GH Packages.
set -euo pipefail

NPMRC="${RUNNER_TEMP}/npmrc-npmjs-publish"
{
  echo "@mergesignal:registry=https://registry.npmjs.org/"
  if [ -n "${NODE_AUTH_TOKEN:-}" ]; then
    echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}"
  fi
} >"$NPMRC"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "NPM_CONFIG_USERCONFIG=${NPMRC}" >>"$GITHUB_ENV"
else
  export NPM_CONFIG_USERCONFIG="$NPMRC"
fi

echo "npm @mergesignal scope → registry.npmjs.org (${NPMRC})"
