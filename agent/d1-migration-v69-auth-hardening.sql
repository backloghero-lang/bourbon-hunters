ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Existing accounts remain usable. New local accounts are verified only through
-- a one-time email token created by the hardened Worker.
UPDATE users
SET email_verified_at = COALESCE(age_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','moderator')),
  granted_at TEXT NOT NULL,
  granted_by TEXT,
  revoked_at TEXT,
  note TEXT,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(role, revoked_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_link_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  nonce_hash TEXT NOT NULL UNIQUE,
  return_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_link_user ON auth_link_requests(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_auth_link_expires ON auth_link_requests(expires_at);

-- Before deploying the hardened Worker, grant the first administrator explicitly:
-- INSERT INTO user_roles (user_id, role, granted_at, granted_by, note)
-- SELECT id, 'admin', datetime('now'), 'migration-v69', 'Initial administrator'
-- FROM users WHERE email = 'YOUR_ADMIN_EMAIL'
-- ON CONFLICT(user_id, role) DO UPDATE SET revoked_at = NULL;
