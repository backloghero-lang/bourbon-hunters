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
