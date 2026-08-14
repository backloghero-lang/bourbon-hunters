-- Bourbon Hunters v74: moderacja komentarzy i blokowanie uzytkownikow.
-- Wykonaj po migracji v73.

ALTER TABLE bottle_recommendations
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'active';

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

CREATE INDEX IF NOT EXISTS idx_comment_reports_queue
  ON comment_reports(status, created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id),
  FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON user_blocks(blocked_user_id, blocker_user_id);

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

CREATE INDEX IF NOT EXISTS idx_comment_moderation_actions_comment
  ON comment_moderation_actions(recommendation_id, created_at);
