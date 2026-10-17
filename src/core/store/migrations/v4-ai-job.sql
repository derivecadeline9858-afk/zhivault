-- 迁移 v4（任务 9）：AI 生成记录（摘要/标签，可回溯可导出）
CREATE TABLE IF NOT EXISTS ai_job (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  result_json TEXT,
  created_at TEXT NOT NULL
);
