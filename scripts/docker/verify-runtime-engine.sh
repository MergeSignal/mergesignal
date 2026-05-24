#!/usr/bin/env sh
# Runtime ABI smoke — run inside the final worker image (Node 22, production env).
set -eu

export NODE_ENV=production
export MERGESIGNAL_ENGINE_IMPL="${MERGESIGNAL_ENGINE_IMPL:-file:/app/engine/dist/index.js}"

cd /app/apps/worker

node --input-type=module <<'NODE'
import { validateEngineAbi } from "@mergesignal/engine";

const spec = process.env.MERGESIGNAL_ENGINE_IMPL ?? "";
if (!spec) {
  console.error("MERGESIGNAL_ENGINE_IMPL is required");
  process.exit(1);
}

const result = await validateEngineAbi(spec);
console.log(
  JSON.stringify({
    msg: "runtime_engine_abi_ok",
    spec,
    methodologyVersion: result.methodologyVersion,
    probeDurationMs: result.probeDurationMs,
  }),
);
NODE
