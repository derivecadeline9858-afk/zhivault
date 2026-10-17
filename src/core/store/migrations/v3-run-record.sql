-- 迁移 v3（任务 8）：运行记录（变更报告页与监控计划页共用数据源，PRD §0 UI-1）
CREATE TABLE IF NOT EXISTS run_record (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'manual',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  totals_json TEXT NOT NULL
);
