# Authorization Security Fix

## Overview

This fix addresses critical security vulnerabilities in the MergeSignal API authorization layer.

## Issues Fixed

### 1. ✅ Org-Scoped API Keys

- **Before**: Single shared API key (`MERGESIGNAL_API_KEY`) with no tenant scoping
- **After**: Database-backed API keys with org-level scoping via `api_keys` table
- Each API key is associated with a specific GitHub organization/user (`owner`)
- Keys are stored as SHA-256 hashes, not plaintext

### 2. ✅ Path Manipulation Protection

- **Before**: Any authenticated client could access `/org/:owner/*` for ANY owner
- **After**: All org-scoped endpoints verify that `req.params.owner` matches the authenticated owner
- Protected endpoints:
  - `GET /org/:owner/policies`
  - `POST /org/:owner/policies`
  - `GET /org/:owner/policy/violations`
  - `GET /org/:owner/alerts`
  - `GET /org/:owner/dashboard`
  - `GET /benchmark/org/:owner`

### 3. ✅ Policy Ownership Checks

- **Before**: `PATCH /policies/:id` lacked ownership verification
- **After**: Fetches policy owner before update and verifies against authenticated owner
- Returns 403 Forbidden if ownership doesn't match

### 4. ✅ Repository Access Control

- **Before**: Any authenticated client could access any repo's data
- **After**: All repo-scoped endpoints verify repo owner matches authenticated owner
- Protected endpoints:
  - `POST /scan`
  - `GET /scan/:id`
  - `GET /scans?repoId=...`
  - `GET /scan/:id/events`
  - `GET /alerts?repoId=...`
  - `GET /benchmark/repo?repoId=...`

### 5. ✅ Fail-Secure Authentication

- **Before**: When `MERGESIGNAL_API_KEY` was unset, API was completely unauthenticated. Legacy API key set `req.authenticatedOwner = undefined`, bypassing all multi-tenant checks.
- **After**: Auth hook always runs and validates API keys from database. Legacy key support **removed** to enforce multi-tenant isolation.
- **Security Impact**: All authorization checks now properly enforce tenant boundaries. No path to bypass ownership verification.

### 6. ✅ Timing Attack Prevention

- **Before**: Non-constant-time string comparison (`===`)
- **After**: Constant-time comparison using `crypto.timingSafeEqual()`
- Prevents timing-based key extraction attacks

## Database Schema

New table `api_keys`:

```sql
CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,
  key_hash    TEXT NOT NULL UNIQUE,
  owner       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

## Generating API Keys

Use the new script to generate org-scoped API keys:

```bash
cd apps/api
npm run generate-api-key -- acme "Production key for Acme Corp"
```

This will:

1. Generate a cryptographically secure random key (prefix: `ms_`)
2. Hash it with SHA-256
3. Store the hash in the database
4. Display the plaintext key once (save it securely!)

## Migration Path

1. **Immediate**: Deploy the fix (legacy key support removed for security)
2. **Generate org-scoped keys**: Run `generate-api-key` for each organization
3. **Distribute keys**: Provide each org with their specific API key
4. **Update environment**: Remove `MERGESIGNAL_API_KEY` from environment (no longer used)

## Security Testing

### Test 1: Cross-Org Access Prevention

```bash
# Generate keys for two orgs
npm run generate-api-key -- acme
npm run generate-api-key -- octocat

# Try to access acme's data with octocat's key (should fail with 403)
curl -H "Authorization: Bearer <octocat-key>" \
  https://mergesignal-api.fly.dev/org/acme/policies
```

Expected: `403 Forbidden - Access denied to this organization`

### Test 2: Policy Update Authorization

```bash
# Create policy for acme
POLICY_ID=$(curl -X POST -H "Authorization: Bearer <acme-key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","rules":[{"type":"no_deprecated"}]}' \
  https://mergesignal-api.fly.dev/org/acme/policies | jq -r .id)

# Try to update with octocat's key (should fail with 403)
curl -X PATCH -H "Authorization: Bearer <octocat-key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacked"}' \
  https://mergesignal-api.fly.dev/policies/$POLICY_ID
```

Expected: `403 Forbidden - Access denied to this policy`

### Test 3: Invalid Key Rejection

```bash
curl -H "Authorization: Bearer invalid_key_12345" \
  https://mergesignal-api.fly.dev/org/acme/policies
```

Expected: `401 Unauthorized - Missing or invalid API key`

## Backward Compatibility

- **BREAKING CHANGE**: Legacy `MERGESIGNAL_API_KEY` environment variable is **no longer supported**
- All API clients must use org-scoped API keys from the `api_keys` table
- Recommended: Generate org-scoped keys before deploying this security fix
