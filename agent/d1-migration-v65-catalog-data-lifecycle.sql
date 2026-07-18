ALTER TABLE bottle_submissions ADD COLUMN consent_version TEXT;
ALTER TABLE bottle_submissions ADD COLUMN consented_at TEXT;
ALTER TABLE bottle_submissions ADD COLUMN original_deleted_at TEXT;
ALTER TABLE bottle_submissions ADD COLUMN published_key TEXT;
ALTER TABLE bottle_submissions ADD COLUMN asset_sha256 TEXT;

ALTER TABLE catalog_bottles ADD COLUMN image_key TEXT;
ALTER TABLE catalog_bottles ADD COLUMN asset_sha256 TEXT;
ALTER TABLE catalog_bottles ADD COLUMN license_version TEXT;
ALTER TABLE catalog_bottles ADD COLUMN licensed_at TEXT;
ALTER TABLE catalog_bottles ADD COLUMN provenance_submission_id TEXT;

UPDATE catalog_bottles
SET image_key = (
  SELECT bottle_submissions.processed_key
  FROM bottle_submissions
  WHERE bottle_submissions.id = catalog_bottles.image_submission_id
)
WHERE image_key IS NULL AND image_submission_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_asset_receipts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  bottle_id TEXT NOT NULL,
  contributor_hash TEXT NOT NULL,
  license_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  asset_sha256 TEXT,
  image_key TEXT,
  original_deleted_at TEXT,
  account_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_asset_receipts_bottle ON catalog_asset_receipts(bottle_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_catalog_asset_receipts_contributor ON catalog_asset_receipts(contributor_hash, accepted_at);
