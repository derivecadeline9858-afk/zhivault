-- 知藏 ZhiVault 内容库结构（PRD §7.3，16 表）
-- 通用字段：id TEXT PK、raw_json TEXT、content_html TEXT、author_id TEXT、captured_at、updated_at
-- 说明：captured_at = 首次入库时间（upsert 不覆盖）；updated_at = 最近写入时间

CREATE TABLE IF NOT EXISTS author (
  id TEXT PRIMARY KEY,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  raw_json TEXT,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question (
  id TEXT PRIMARY KEY,
  title TEXT,
  content_html TEXT,
  author_id TEXT,
  created_at TEXT,
  answer_count INTEGER,
  follower_count INTEGER,
  raw_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answer (
  id TEXT PRIMARY KEY,
  question_id TEXT,
  content_html TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT,
  voteup_count INTEGER,
  comment_count INTEGER,
  raw_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answer_question ON answer(question_id);

CREATE TABLE IF NOT EXISTS article (
  id TEXT PRIMARY KEY,
  title TEXT,
  content_html TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT,
  voteup_count INTEGER,
  comment_count INTEGER,
  column_id TEXT,
  raw_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pin (
  id TEXT PRIMARY KEY,
  content_html TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT,
  like_count INTEGER,
  comment_count INTEGER,
  raw_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  parent_id TEXT,
  content_html TEXT NOT NULL,
  author_id TEXT,
  like_count INTEGER,
  created_at TEXT,
  raw_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comment_entity ON comment(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment(parent_id);

CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  creator_id TEXT,
  item_count INTEGER,
  raw_json TEXT,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_item (
  collection_id TEXT NOT NULL REFERENCES collection(id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  order_idx INTEGER,
  added_at TEXT,
  PRIMARY KEY (collection_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS "column" (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  creator_id TEXT,
  article_count INTEGER,
  raw_json TEXT,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS column_item (
  column_id TEXT NOT NULL REFERENCES "column"(id),
  article_id TEXT NOT NULL,
  order_idx INTEGER,
  PRIMARY KEY (column_id, article_id)
);

CREATE TABLE IF NOT EXISTS topic (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  question_count INTEGER,
  follower_count INTEGER,
  raw_json TEXT,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_item (
  topic_id TEXT NOT NULL REFERENCES topic(id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (topic_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  created_at TEXT,
  raw_json TEXT,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_author ON activity(author_id, created_at);

CREATE TABLE IF NOT EXISTS content_revision (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  content_html TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, revision_no)
);
CREATE INDEX IF NOT EXISTS idx_revision_entity ON content_revision(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS annotation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  anchor_prefix TEXT NOT NULL,
  anchor_suffix TEXT NOT NULL,
  selected_text TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotation_entity ON annotation(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS capture_meta (
  task_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (task_id, key)
);

-- FTS5 全文索引挂 answer/article/pin/comment（PRD §7.3）
-- trigram 分词：中文按三元组索引，查询需 >= 3 字符；由仓储层同步维护
CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  title,
  content,
  tokenize = 'trigram'
);
