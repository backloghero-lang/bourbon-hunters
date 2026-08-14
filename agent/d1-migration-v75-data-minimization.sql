-- Bourbon Hunters v75: retain the 18+ decision, not the full date of birth.
-- Existing Google accounts must confirm adulthood once inside the application.

UPDATE users
SET birth_date = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE birth_date IS NOT NULL;

UPDATE users
SET age_verified_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE password_algo = 'google-oauth2'
  AND age_gate_country = 'google';

CREATE TABLE IF NOT EXISTS google_oauth_requests (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('login','link')),
  return_url TEXT NOT NULL,
  nonce_hash TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_expires
  ON google_oauth_requests(expires_at, used_at);

CREATE TABLE IF NOT EXISTS storage_operations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started','asset_staged','cleanup_pending','completed','failed')),
  result_json TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_storage_operations_status
  ON storage_operations(status, updated_at);
