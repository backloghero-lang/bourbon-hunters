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
