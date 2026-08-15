-- Bourbon Hunters v76: anonymous, aggregate APK download counters.

CREATE TABLE IF NOT EXISTS app_download_stats (
  day TEXT NOT NULL,
  source TEXT NOT NULL,
  artifact_version TEXT NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, source, artifact_version)
);

CREATE INDEX IF NOT EXISTS idx_app_download_stats_day
  ON app_download_stats(day, artifact_version);
