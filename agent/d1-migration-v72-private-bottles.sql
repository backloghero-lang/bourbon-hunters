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
