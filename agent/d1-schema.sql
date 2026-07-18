CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algo TEXT NOT NULL,
  birth_date TEXT,
  age_gate_country TEXT,
  age_gate_min INTEGER,
  age_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_bottles (
  user_id TEXT NOT NULL,
  bottle_id TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('wishlist','collection')),
  bottle_name TEXT,
  bottle_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, bottle_id, list_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_bottles_type ON user_bottles(user_id, list_type);

CREATE TABLE IF NOT EXISTS user_ratings (
  user_id TEXT NOT NULL,
  bottle_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, bottle_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  badge TEXT NOT NULL DEFAULT 'glass',
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bottle_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bottle_id TEXT NOT NULL,
  bottle_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, bottle_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bottle_recommendations_bottle ON bottle_recommendations(bottle_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_bottle_recommendations_feed ON bottle_recommendations(active, updated_at);

CREATE TABLE IF NOT EXISTS scan_history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  bottle_id TEXT,
  bottle_name TEXT,
  source TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
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

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);

CREATE TABLE IF NOT EXISTS bottle_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bottle_id TEXT NOT NULL,
  bottle_name TEXT NOT NULL,
  bottle_data TEXT NOT NULL,
  original_key TEXT,
  processed_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing','awaiting_confirmation','published','retry','cancelled','failed')),
  image_choice TEXT,
  consent_version TEXT,
  consented_at TEXT,
  original_deleted_at TEXT,
  published_key TEXT,
  asset_sha256 TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bottle_submissions_user ON bottle_submissions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bottle_submissions_bottle ON bottle_submissions(bottle_id, status);

CREATE TABLE IF NOT EXISTS catalog_bottles (
  bottle_id TEXT PRIMARY KEY,
  bottle_name TEXT NOT NULL,
  bottle_data TEXT NOT NULL,
  image_submission_id TEXT,
  image_key TEXT,
  asset_sha256 TEXT,
  license_version TEXT,
  licensed_at TEXT,
  provenance_submission_id TEXT,
  source_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (image_submission_id) REFERENCES bottle_submissions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_bottles_recent ON catalog_bottles(status, created_at);

CREATE TABLE IF NOT EXISTS catalog_asset_receipts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  bottle_id TEXT NOT NULL,
  contributor_hash TEXT NOT NULL,
  license_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  asset_sha256 TEXT,
  image_key TEXT,
  original_deleted_at TEXT,
  account_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_asset_receipts_bottle ON catalog_asset_receipts(bottle_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_catalog_asset_receipts_contributor ON catalog_asset_receipts(contributor_hash, accepted_at);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_hash TEXT,
  scan_id TEXT,
  event_name TEXT NOT NULL,
  event_json TEXT,
  app_version TEXT,
  lang TEXT,
  platform TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_name ON telemetry_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user ON telemetry_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_scan ON telemetry_events(scan_id, created_at);

CREATE TABLE IF NOT EXISTS scanner_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_hash TEXT,
  actor_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  error_code TEXT,
  matched_bottle_id TEXT,
  suggested_bottle_id TEXT,
  confirmed_bottle_id TEXT,
  candidate_ids_json TEXT,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  visual_confidence REAL,
  ocr_confidence REAL,
  db_confidence REAL,
  min_confidence REAL,
  input_bytes INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scanner_runs_created ON scanner_runs(created_at, outcome);
CREATE INDEX IF NOT EXISTS idx_scanner_runs_user ON scanner_runs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scanner_runs_confirmation ON scanner_runs(confirmed_at, suggested_bottle_id, confirmed_bottle_id);

CREATE TABLE IF NOT EXISTS service_usage_events (
  id TEXT PRIMARY KEY,
  scan_id TEXT,
  user_id TEXT,
  provider TEXT NOT NULL,
  stage TEXT NOT NULL,
  model TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  thought_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_usage_created ON service_usage_events(created_at, provider, stage);
CREATE INDEX IF NOT EXISTS idx_service_usage_scan ON service_usage_events(scan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_usage_model ON service_usage_events(model, created_at);
