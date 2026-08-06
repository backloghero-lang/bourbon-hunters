-- Bourbon Hunters v70: atomowe budzety kosztownych operacji skanera.
-- Tabela nie przechowuje surowego IP, e-maila ani identyfikatora urzadzenia.

CREATE TABLE IF NOT EXISTS scanner_budget_events (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('guest', 'user')),
  actor_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('identify', 'cutout', 'analysis')),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0 AND units <= 10),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scanner_budget_actor
  ON scanner_budget_events(period_key, operation, actor_hash);

CREATE INDEX IF NOT EXISTS idx_scanner_budget_ip
  ON scanner_budget_events(period_key, operation, ip_hash);

CREATE INDEX IF NOT EXISTS idx_scanner_budget_created
  ON scanner_budget_events(created_at);
