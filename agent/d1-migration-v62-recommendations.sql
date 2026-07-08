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
