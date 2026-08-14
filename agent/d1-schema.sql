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
  email_verified_at TEXT,
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

CREATE INDEX IF NOT EXISTS idx_user_ratings_bottle ON user_ratings(bottle_id);

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
  moderation_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, bottle_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bottle_recommendations_bottle ON bottle_recommendations(bottle_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_bottle_recommendations_feed ON bottle_recommendations(active, updated_at);

CREATE TABLE IF NOT EXISTS comment_reports (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  UNIQUE (recommendation_id, reporter_user_id),
  FOREIGN KEY (recommendation_id) REFERENCES bottle_recommendations(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_queue ON comment_reports(status, created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id),
  FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_user_id, blocker_user_id);

CREATE TABLE IF NOT EXISTS comment_moderation_actions (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (recommendation_id) REFERENCES bottle_recommendations(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_moderation_actions_comment ON comment_moderation_actions(recommendation_id, created_at);

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

CREATE TABLE IF NOT EXISTS auth_rate_events (
  id TEXT PRIMARY KEY,
  window_key TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('login','register','password_reset','verification_resend','email_confirm','password_update')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_actor ON auth_rate_events(window_key, operation, actor_hash);
CREATE INDEX IF NOT EXISTS idx_auth_rate_ip ON auth_rate_events(window_key, operation, ip_hash);
CREATE INDEX IF NOT EXISTS idx_auth_rate_created ON auth_rate_events(created_at);

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

CREATE TABLE IF NOT EXISTS catalog_moderation_queue (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  bottle_id TEXT NOT NULL,
  bottle_name TEXT NOT NULL,
  bottle_data TEXT NOT NULL,
  review_image_key TEXT,
  asset_sha256 TEXT,
  orchestrator_status TEXT NOT NULL CHECK (orchestrator_status IN ('passed','needs_review','failed')),
  orchestrator_confidence REAL NOT NULL DEFAULT 0,
  orchestrator_json TEXT,
  admin_status TEXT NOT NULL DEFAULT 'pending' CHECK (admin_status IN ('pending','approved','rejected')),
  admin_user_id TEXT,
  admin_note TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES bottle_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_moderation_status ON catalog_moderation_queue(admin_status, created_at);
CREATE INDEX IF NOT EXISTS idx_catalog_moderation_bottle ON catalog_moderation_queue(bottle_id, admin_status);

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

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt_pl TEXT NOT NULL,
  excerpt_en TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'whisky',
  article_published_at TEXT,
  issue_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_articles_feed
  ON news_articles(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_articles_issue
  ON news_articles(issue_key, status);

CREATE TABLE IF NOT EXISTS news_agent_runs (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed','skipped')),
  candidates_found INTEGER NOT NULL DEFAULT 0,
  articles_added INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_agent_runs_issue
  ON news_agent_runs(issue_key, started_at DESC);

CREATE TABLE IF NOT EXISTS user_private_bottles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  distillery TEXT,
  category TEXT,
  type TEXT,
  region TEXT,
  abv REAL,
  proof REAL,
  price_range TEXT,
  general_info TEXT,
  nose TEXT,
  taste TEXT,
  finish TEXT,
  mashbill TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_private_bottles_owner_id
  ON user_private_bottles(user_id, id);

CREATE INDEX IF NOT EXISTS idx_user_private_bottles_owner_updated
  ON user_private_bottles(user_id, updated_at DESC);
