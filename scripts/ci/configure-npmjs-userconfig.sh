#!/usr/bin/env bash
# Point npm @mergesignal scope at registry.npmjs.org for publish/verify steps.
#
# actions/setup-node may set NPM_CONFIG_USERCONFIG that overrides repo .npmrc.
# This helper ensures scoped npm view/publish targets npmjs for @mergesignal packages.
set -euo pipefail

NPMRC="${RUNNER_TEMP}/npmrc-npmjs-publish"
{
  echo "registry=https://registry.npmjs.org/"
  echo "@mergesignal:registry=https://registry.npmjs.org/"
  if [ -n "${NPM_PUBLISH_TOKEN:-}" ]; then
    echo "//registry.npmjs.org/:_authToken=${NPM_PUBLISH_TOKEN}"
  elif [ -n "${NPM_TOKEN:-}" ]; then
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
  fi
} >"$NPMRC"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "NPM_CONFIG_USERCONFIG=${NPMRC}" >>"$GITHUB_ENV"
else
  export NPM_CONFIG_USERCONFIG="$NPMRC"
fi

echo "npm @mergesignal scope → registry.npmjs.org (${NPMRC})"
