-- 008_api_key_budget.sql
-- Add budget configuration columns to api_keys table
-- Create new api_key_budget_ledger table for immutable usage tracking

-- Add budget config columns to api_keys
ALTER TABLE api_keys ADD COLUMN budget_metric TEXT DEFAULT NULL;
ALTER TABLE api_keys ADD COLUMN budget_daily_limit REAL DEFAULT NULL;
ALTER TABLE api_keys ADD COLUMN budget_weekly_limit REAL DEFAULT NULL;
ALTER TABLE api_keys ADD COLUMN budget_monthly_limit REAL DEFAULT NULL;

-- Create index for budget lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_budget_metric ON api_keys(budget_metric);

-- Create immutable budget ledger table
CREATE TABLE IF NOT EXISTS api_key_budget_ledger (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  api_key_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  endpoint_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  success INTEGER DEFAULT 1,
  request_count INTEGER DEFAULT 1,
  cost_usd REAL DEFAULT NULL,
  cost_source TEXT DEFAULT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_budget_ledger_api_key ON api_key_budget_ledger(api_key_id);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_timestamp ON api_key_budget_ledger(timestamp);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_api_key_ts ON api_key_budget_ledger(api_key_id, timestamp);

-- Cleanup trigger to prevent unbounded growth (keep 90 days by default)
CREATE TRIGGER IF NOT EXISTS trg_budget_ledger_cleanup
AFTER INSERT ON api_key_budget_ledger
BEGIN
  DELETE FROM api_key_budget_ledger
  WHERE timestamp < (strftime('%s', 'now') - 90 * 24 * 60 * 60) * 1000;
END;
