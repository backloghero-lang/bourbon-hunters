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
  source_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (image_submission_id) REFERENCES bottle_submissions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_bottles_recent ON catalog_bottles(status, created_at);
