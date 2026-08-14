-- Bourbon Hunters v73: grupowe odczyty ocen.
-- Migracja jest idempotentna i nie zmienia istniejacych ocen.

CREATE INDEX IF NOT EXISTS idx_user_ratings_bottle
  ON user_ratings(bottle_id);
