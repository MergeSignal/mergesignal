CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id    BIGINT NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  name         TEXT,
  avatar_url   TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_github_login_idx ON users(github_login);
