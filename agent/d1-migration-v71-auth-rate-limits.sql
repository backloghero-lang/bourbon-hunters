-- Bourbon Hunters v71: atomowa ochrona endpointow uwierzytelniania.
-- Tabela przechowuje wylacznie skroty identyfikatora konta i adresu IP.

CREATE TABLE IF NOT EXISTS auth_rate_events (
  id TEXT PRIMARY KEY,
  window_key TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'login',
    'register',
    'password_reset',
    'verification_resend',
    'email_confirm',
    'password_update'
  )),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_actor
  ON auth_rate_events(window_key, operation, actor_hash);

CREATE INDEX IF NOT EXISTS idx_auth_rate_ip
  ON auth_rate_events(window_key, operation, ip_hash);

CREATE INDEX IF NOT EXISTS idx_auth_rate_created
  ON auth_rate_events(created_at);
