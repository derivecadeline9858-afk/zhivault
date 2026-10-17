-- 迁移 v2（任务 7）：监控计划调度表
CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
