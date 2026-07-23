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

CREATE INDEX IF NOT EXISTS idx_catalog_moderation_status
  ON catalog_moderation_queue(admin_status, created_at);

CREATE INDEX IF NOT EXISTS idx_catalog_moderation_bottle
  ON catalog_moderation_queue(bottle_id, admin_status);
