import { hashContent } from './hash'
import type { SqlExecutor, SqlParam } from './sql-executor'
import type {
  ActivityRecord,
  AnnotationInput,
  AnnotationRow,
  AnswerRecord,
  ArticleRecord,
  AuthorRecord,
  CollectionItemRecord,
  CollectionRecord,
  ColumnItemRecord,
  ColumnRecord,
  CommentRecord,
  PinRecord,
  QuestionRecord,
  RevisionRow,
  SaveResult,
  SearchHit,
  TopicItemRecord,
  TopicRecord,
} from './types'

/** 表名 → 列清单（白名单，防注入）；captured_at 在 upsert 时保留首次值 */
const TABLE_COLUMNS = {
  author: ['id', 'username', 'name', 'avatar_url', 'raw_json', 'captured_at', 'updated_at'],
  question: [
    'id',
    'title',
    'content_html',
    'author_id',
    'created_at',
    'answer_count',
    'follower_count',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
  answer: [
    'id',
    'question_id',
    'content_html',
    'author_id',
    'created_at',
    'voteup_count',
    'comment_count',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
  article: [
    'id',
    'title',
    'content_html',
    'author_id',
    'created_at',
    'voteup_count',
    'comment_count',
    'column_id',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
  pin: [
    'id',
    'content_html',
    'author_id',
    'created_at',
    'like_count',
    'comment_count',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
  comment: [
    'id',
    'entity_type',
    'entity_id',
    'parent_id',
    'content_html',
    'author_id',
    'like_count',
    'created_at',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
  collection: ['id', 'title', 'description', 'creator_id', 'item_count', 'raw_json', 'captured_at', 'updated_at'],
  column: ['id', 'title', 'description', 'creator_id', 'article_count', 'raw_json', 'captured_at', 'updated_at'],
  topic: ['id', 'name', 'description', 'question_count', 'follower_count', 'raw_json', 'captured_at', 'updated_at'],
  activity: [
    'id',
    'author_id',
    'activity_type',
    'entity_type',
    'entity_id',
    'created_at',
    'raw_json',
    'captured_at',
    'updated_at',
  ],
} as const

type TableName = keyof typeof TABLE_COLUMNS

/** FTS5 索引表（PRD §7.3：answer/article/pin/comment） */
const FTS_TABLES: readonly TableName[] = ['answer', 'article', 'pin', 'comment']

const nowIso = (): string => new Date().toISOString()

function quoteTable(table: TableName): string {
  return table === 'column' ? '"column"' : table
}

function buildUpsert(table: TableName): string {
  const cols = TABLE_COLUMNS[table]
  const colList = cols.join(', ')
  const placeholders = cols.map(() => '?').join(', ')
  const updates = cols
    .filter((c) => c !== 'captured_at')
    .map((c) => `${c}=excluded.${c}`)
    .join(', ')
  return `INSERT INTO ${quoteTable(table)} (${colList}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
}

const UPSERT_SQL = new Map<TableName, string>(
  (Object.keys(TABLE_COLUMNS) as TableName[]).map((t) => [t, buildUpsert(t)]),
)

function valuesOf(table: TableName, row: Record<string, SqlParam>): SqlParam[] {
  return TABLE_COLUMNS[table].map((c) => row[c] ?? null)
}

export class ContentStore {
  constructor(private readonly exec: SqlExecutor) {}

  // ---------- author ----------

  async saveAuthor(r: AuthorRecord): Promise<void> {
    await this.saveRow('author', {
      id: r.id,
      username: r.username ?? null,
      name: r.name ?? null,
      avatar_url: r.avatarUrl ?? null,
      raw_json: r.rawJson ?? null,
    })
  }

  async getAuthor(id: string): Promise<(AuthorRecord & { capturedAt: string; updatedAt: string }) | undefined> {
    const row = await this.exec.get<Record<string, string | null>>('SELECT * FROM author WHERE id = ?', [id])
    if (!row) return undefined
    return {
      id: row.id!,
      username: row.username ?? undefined,
      name: row.name ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }
  }

  // ---------- question ----------

  async saveQuestion(r: QuestionRecord): Promise<SaveResult> {
    return this.saveVersioned('question', {
      id: r.id,
      title: r.title ?? null,
      content_html: r.contentHtml ?? null,
      author_id: r.authorId ?? null,
      created_at: r.createdAt ?? null,
      answer_count: r.answerCount ?? null,
      follower_count: r.followerCount ?? null,
      raw_json: r.rawJson,
    })
  }

  async getQuestion(id: string) {
    return this.getMapped('question', id, (row) => ({
      id: row.id!,
      title: row.title ?? undefined,
      contentHtml: row.content_html ?? undefined,
      authorId: row.author_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      answerCount: row.answer_count == null ? undefined : Number(row.answer_count),
      followerCount: row.follower_count == null ? undefined : Number(row.follower_count),
      rawJson: String(row.raw_json),
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  // ---------- answer ----------

  async saveAnswer(r: AnswerRecord): Promise<SaveResult> {
    return this.saveVersioned('answer', {
      id: r.id,
      question_id: r.questionId ?? null,
      content_html: r.contentHtml,
      author_id: r.authorId ?? null,
      created_at: r.createdAt ?? null,
      voteup_count: r.voteupCount ?? null,
      comment_count: r.commentCount ?? null,
      raw_json: r.rawJson,
    })
  }

  async getAnswer(id: string) {
    return this.getMapped('answer', id, (row) => ({
      id: row.id!,
      questionId: row.question_id ?? undefined,
      contentHtml: row.content_html!,
      authorId: row.author_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      voteupCount: row.voteup_count == null ? undefined : Number(row.voteup_count),
      commentCount: row.comment_count == null ? undefined : Number(row.comment_count),
      rawJson: String(row.raw_json),
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  // ---------- article ----------

  async saveArticle(r: ArticleRecord): Promise<SaveResult> {
    return this.saveVersioned('article', {
      id: r.id,
      title: r.title ?? null,
      content_html: r.contentHtml,
      author_id: r.authorId ?? null,
      created_at: r.createdAt ?? null,
      voteup_count: r.voteupCount ?? null,
      comment_count: r.commentCount ?? null,
      column_id: r.columnId ?? null,
      raw_json: r.rawJson,
    })
  }

  async getArticle(id: string) {
    return this.getMapped('article', id, (row) => ({
      id: row.id!,
      title: row.title ?? undefined,
      contentHtml: row.content_html!,
      authorId: row.author_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      voteupCount: row.voteup_count == null ? undefined : Number(row.voteup_count),
      commentCount: row.comment_count == null ? undefined : Number(row.comment_count),
      columnId: row.column_id ?? undefined,
      rawJson: String(row.raw_json),
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  // ---------- pin ----------

  async savePin(r: PinRecord): Promise<SaveResult> {
    return this.saveVersioned('pin', {
      id: r.id,
      content_html: r.contentHtml,
      author_id: r.authorId ?? null,
      created_at: r.createdAt ?? null,
      like_count: r.likeCount ?? null,
      comment_count: r.commentCount ?? null,
      raw_json: r.rawJson,
    })
  }

  async getPin(id: string) {
    return this.getMapped('pin', id, (row) => ({
      id: row.id!,
      contentHtml: row.content_html!,
      authorId: row.author_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      likeCount: row.like_count == null ? undefined : Number(row.like_count),
      commentCount: row.comment_count == null ? undefined : Number(row.comment_count),
      rawJson: String(row.raw_json),
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  // ---------- comment ----------

  async saveComment(r: CommentRecord): Promise<SaveResult> {
    return this.saveVersioned('comment', {
      id: r.id,
      entity_type: r.entityType,
      entity_id: r.entityId,
      parent_id: r.parentId ?? null,
      content_html: r.contentHtml,
      author_id: r.authorId ?? null,
      like_count: r.likeCount ?? null,
      created_at: r.createdAt ?? null,
      raw_json: r.rawJson,
    })
  }

  async getComment(id: string) {
    return this.getMapped('comment', id, (row) => this.mapComment(row))
  }

  async listComments(entityType: string, entityId: string) {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      'SELECT * FROM comment WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC, id ASC',
      [entityType, entityId],
    )
    return rows.map((row) => this.mapComment(row))
  }

  private mapComment(row: Record<string, string | number | null>) {
    return {
      id: row.id!,
      entityType: row.entity_type!,
      entityId: row.entity_id!,
      parentId: row.parent_id ?? undefined,
      contentHtml: row.content_html!,
      authorId: row.author_id ?? undefined,
      likeCount: row.like_count == null ? undefined : Number(row.like_count),
      createdAt: row.created_at ?? undefined,
      rawJson: String(row.raw_json),
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }
  }

  // ---------- collection ----------

  async saveCollection(r: CollectionRecord): Promise<void> {
    await this.saveRow('collection', {
      id: r.id,
      title: r.title ?? null,
      description: r.description ?? null,
      creator_id: r.creatorId ?? null,
      item_count: r.itemCount ?? null,
      raw_json: r.rawJson ?? null,
    })
  }

  async getCollection(id: string) {
    return this.getMapped('collection', id, (row) => ({
      id: row.id!,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      creatorId: row.creator_id ?? undefined,
      itemCount: row.item_count == null ? undefined : Number(row.item_count),
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  async replaceCollectionItems(collectionId: string, items: CollectionItemRecord[]): Promise<void> {
    await this.exec.run('DELETE FROM collection_item WHERE collection_id = ?', [collectionId])
    for (const item of items) {
      await this.exec.run(
        'INSERT INTO collection_item (collection_id, item_type, item_id, order_idx, added_at) VALUES (?,?,?,?,?)',
        [collectionId, item.itemType, item.itemId, item.orderIdx ?? null, item.addedAt ?? null],
      )
    }
  }

  async getCollectionItems(collectionId: string): Promise<CollectionItemRecord[]> {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      'SELECT * FROM collection_item WHERE collection_id = ? ORDER BY order_idx ASC',
      [collectionId],
    )
    return rows.map((r) => ({
      itemType: r.item_type as CollectionItemRecord['itemType'],
      itemId: String(r.item_id),
      orderIdx: r.order_idx == null ? undefined : Number(r.order_idx),
      addedAt: r.added_at == null ? undefined : String(r.added_at),
    }))
  }

  // ---------- column ----------

  async saveColumn(r: ColumnRecord): Promise<void> {
    await this.saveRow('column', {
      id: r.id,
      title: r.title ?? null,
      description: r.description ?? null,
      creator_id: r.creatorId ?? null,
      article_count: r.articleCount ?? null,
      raw_json: r.rawJson ?? null,
    })
  }

  async getColumn(id: string) {
    return this.getMapped('column', id, (row) => ({
      id: row.id!,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      creatorId: row.creator_id ?? undefined,
      articleCount: row.article_count == null ? undefined : Number(row.article_count),
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  async replaceColumnItems(columnId: string, items: ColumnItemRecord[]): Promise<void> {
    await this.exec.run('DELETE FROM column_item WHERE column_id = ?', [columnId])
    for (const item of items) {
      await this.exec.run('INSERT INTO column_item (column_id, article_id, order_idx) VALUES (?,?,?)', [
        columnId,
        item.articleId,
        item.orderIdx ?? null,
      ])
    }
  }

  async getColumnItems(columnId: string): Promise<ColumnItemRecord[]> {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      'SELECT * FROM column_item WHERE column_id = ? ORDER BY order_idx ASC',
      [columnId],
    )
    return rows.map((r) => ({
      articleId: String(r.article_id),
      orderIdx: r.order_idx == null ? undefined : Number(r.order_idx),
    }))
  }

  // ---------- topic ----------

  async saveTopic(r: TopicRecord): Promise<void> {
    await this.saveRow('topic', {
      id: r.id,
      name: r.name ?? null,
      description: r.description ?? null,
      question_count: r.questionCount ?? null,
      follower_count: r.followerCount ?? null,
      raw_json: r.rawJson ?? null,
    })
  }

  async getTopic(id: string) {
    return this.getMapped('topic', id, (row) => ({
      id: row.id!,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
      questionCount: row.question_count == null ? undefined : Number(row.question_count),
      followerCount: row.follower_count == null ? undefined : Number(row.follower_count),
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  async replaceTopicItems(topicId: string, items: TopicItemRecord[]): Promise<void> {
    await this.exec.run('DELETE FROM topic_item WHERE topic_id = ?', [topicId])
    for (const item of items) {
      await this.exec.run('INSERT INTO topic_item (topic_id, item_type, item_id) VALUES (?,?,?)', [
        topicId,
        item.itemType,
        item.itemId,
      ])
    }
  }

  async getTopicItems(topicId: string): Promise<TopicItemRecord[]> {
    const rows = await this.exec.all<Record<string, string>>('SELECT * FROM topic_item WHERE topic_id = ?', [topicId])
    return rows.map((r) => ({
      itemType: r.item_type as TopicItemRecord['itemType'],
      itemId: r.item_id,
    }))
  }

  // ---------- activity ----------

  async saveActivity(r: ActivityRecord): Promise<void> {
    await this.saveRow('activity', {
      id: r.id,
      author_id: r.authorId,
      activity_type: r.activityType,
      entity_type: r.entityType ?? null,
      entity_id: r.entityId ?? null,
      created_at: r.createdAt ?? null,
      raw_json: r.rawJson ?? null,
    })
  }

  async getActivity(id: string) {
    return this.getMapped('activity', id, (row) => ({
      id: row.id!,
      authorId: row.author_id!,
      activityType: row.activity_type!,
      entityType: row.entity_type ?? undefined,
      entityId: row.entity_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  async listActivities(authorId: string, limit = 100) {
    const rows = await this.exec.all<Record<string, string | null>>(
      'SELECT * FROM activity WHERE author_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      [authorId, limit],
    )
    return rows.map((row) => ({
      id: row.id!,
      authorId: row.author_id!,
      activityType: row.activity_type!,
      entityType: row.entity_type ?? undefined,
      entityId: row.entity_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      rawJson: row.raw_json ?? undefined,
      capturedAt: row.captured_at!,
      updatedAt: row.updated_at!,
    }))
  }

  // ---------- 版本历史 ----------

  async getRevisions(entityType: string, entityId: string): Promise<RevisionRow[]> {
    const rows = await this.exec.all<Record<string, string | number>>(
      'SELECT * FROM content_revision WHERE entity_type = ? AND entity_id = ? ORDER BY revision_no ASC',
      [entityType, entityId],
    )
    return rows.map((r) => ({
      entityType: r.entity_type as string,
      entityId: r.entity_id as string,
      revisionNo: Number(r.revision_no),
      contentHtml: r.content_html as string,
      contentHash: r.content_hash as string,
      capturedAt: r.captured_at as string,
    }))
  }

  async getLatestRevision(entityType: string, entityId: string): Promise<RevisionRow | undefined> {
    const rows = await this.getRevisions(entityType, entityId)
    return rows[rows.length - 1]
  }

  // ---------- annotation ----------

  async saveAnnotation(a: AnnotationInput): Promise<number> {
    const now = nowIso()
    const prefix = a.selectedText.slice(0, 32)
    const suffix = a.selectedText.slice(-32)
    const r = await this.exec.run(
      'INSERT INTO annotation (entity_type, entity_id, anchor_prefix, anchor_suffix, selected_text, note, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [a.entityType, a.entityId, prefix, suffix, a.selectedText, a.note ?? null, a.color, now, now],
    )
    return r.lastId
  }

  async listAnnotations(entityType: string, entityId: string): Promise<AnnotationRow[]> {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      'SELECT * FROM annotation WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC, id ASC',
      [entityType, entityId],
    )
    return rows.map((r) => ({
      id: Number(r.id),
      entityType: r.entity_type as string,
      entityId: r.entity_id as string,
      anchorPrefix: r.anchor_prefix as string,
      anchorSuffix: r.anchor_suffix as string,
      selectedText: r.selected_text as string,
      note: r.note == null ? null : String(r.note),
      color: r.color as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }))
  }

  async updateAnnotation(
    id: number,
    patch: { note?: string; color?: string },
  ): Promise<void> {
    const sets: string[] = []
    const params: SqlParam[] = []
    if (patch.note !== undefined) {
      sets.push('note = ?')
      params.push(patch.note)
    }
    if (patch.color !== undefined) {
      sets.push('color = ?')
      params.push(patch.color)
    }
    if (sets.length === 0) return
    sets.push('updated_at = ?')
    params.push(nowIso(), id)
    await this.exec.run(`UPDATE annotation SET ${sets.join(', ')} WHERE id = ?`, params)
  }

  async deleteAnnotation(id: number): Promise<void> {
    await this.exec.run('DELETE FROM annotation WHERE id = ?', [id])
  }

  // ---------- capture_meta ----------

  async saveCaptureMeta(taskId: string, key: string, value: string): Promise<void> {
    await this.exec.run(
      'INSERT INTO capture_meta (task_id, key, value, updated_at) VALUES (?,?,?,?) ON CONFLICT(task_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
      [taskId, key, value, nowIso()],
    )
  }

  async getCaptureMeta(taskId: string, key: string): Promise<string | undefined> {
    const row = await this.exec.get<{ value: string }>('SELECT value FROM capture_meta WHERE task_id = ? AND key = ?', [
      taskId,
      key,
    ])
    return row?.value
  }

  async listCaptureMeta(taskId: string): Promise<Record<string, string>> {
    const rows = await this.exec.all<{ key: string; value: string }>(
      'SELECT key, value FROM capture_meta WHERE task_id = ?',
      [taskId],
    )
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  async deleteCaptureMeta(taskId: string, key: string): Promise<void> {
    await this.exec.run('DELETE FROM capture_meta WHERE task_id = ? AND key = ?', [taskId, key])
  }

  // ---------- 列表查询（书架/导出中心用，按收录时间倒序分页） ----------

  private async listTable<T>(table: TableName, offset: number, limit: number): Promise<T[]> {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      `SELECT * FROM ${quoteTable(table)} ORDER BY captured_at DESC, id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    )
    return rows as unknown as T[]
  }

  listAnswers(offset = 0, limit = 50) {
    return this.listTable<Record<string, string | number | null>>('answer', offset, limit)
  }

  listArticles(offset = 0, limit = 50) {
    return this.listTable<Record<string, string | number | null>>('article', offset, limit)
  }

  listPins(offset = 0, limit = 50) {
    return this.listTable<Record<string, string | number | null>>('pin', offset, limit)
  }

  listQuestions(offset = 0, limit = 50) {
    return this.listTable<Record<string, string | number | null>>('question', offset, limit)
  }

  // ---------- 监控计划调度（迁移 v2，PRD §6.2 页 8） ----------

  async saveSchedule(input: {
    id: string
    name: string
    spec: unknown
    enabled?: boolean
  }): Promise<void> {
    const now = nowIso()
    await this.exec.run(
      'INSERT INTO schedule (id, name, spec_json, enabled, created_at, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, spec_json=excluded.spec_json, enabled=excluded.enabled, updated_at=excluded.updated_at',
      [input.id, input.name, JSON.stringify(input.spec), input.enabled === false ? 0 : 1, now, now],
    )
  }

  async listSchedules(): Promise<{ id: string; name: string; spec: unknown; enabled: boolean; lastRunAt: string | null }[]> {
    const rows = await this.exec.all<Record<string, string | number | null>>(
      'SELECT * FROM schedule ORDER BY created_at ASC',
    )
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      spec: JSON.parse(String(r.spec_json)) as unknown,
      enabled: Number(r.enabled) === 1,
      lastRunAt: r.last_run_at == null ? null : String(r.last_run_at),
    }))
  }

  async setScheduleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.exec.run('UPDATE schedule SET enabled = ?, updated_at = ? WHERE id = ?', [
      enabled ? 1 : 0,
      nowIso(),
      id,
    ])
  }

  async setScheduleLastRun(id: string, at: string): Promise<void> {
    await this.exec.run('UPDATE schedule SET last_run_at = ?, updated_at = ? WHERE id = ?', [at, nowIso(), id])
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.exec.run('DELETE FROM schedule WHERE id = ?', [id])
  }

  // ---------- 运行记录（迁移 v3，变更报告页数据源） ----------

  async saveRunRecord(rec: {
    id: string
    source: 'manual' | 'monitor' | string
    startedAt: string
    finishedAt: string | null
    totals: unknown
  }): Promise<void> {
    await this.exec.run(
      'INSERT INTO run_record (id, source, started_at, finished_at, totals_json) VALUES (?,?,?,?,?)',
      [rec.id, rec.source, rec.startedAt, rec.finishedAt, JSON.stringify(rec.totals)],
    )
  }

  async listRunRecords(limit = 100): Promise<
    { id: string; source: string; startedAt: string; finishedAt: string | null; totals: unknown }[]
  > {
    const rows = await this.exec.all<Record<string, string | null>>(
      'SELECT * FROM run_record ORDER BY started_at DESC LIMIT ?',
      [limit],
    )
    return rows.map((r) => ({
      id: String(r.id),
      source: String(r.source),
      startedAt: String(r.started_at),
      finishedAt: r.finished_at == null ? null : String(r.finished_at),
      totals: JSON.parse(String(r.totals_json)) as unknown,
    }))
  }

  /** 时间窗内的版本记录（变更清单：某次运行产生了哪些修订） */
  async listRevisionsBetween(since: string, until: string): Promise<RevisionRow[]> {
    const rows = await this.exec.all<Record<string, string | number>>(
      'SELECT * FROM content_revision WHERE captured_at > ? AND captured_at <= ? ORDER BY captured_at ASC',
      [since, until],
    )
    return rows.map((r) => ({
      entityType: r.entity_type as string,
      entityId: r.entity_id as string,
      revisionNo: Number(r.revision_no),
      contentHtml: r.content_html as string,
      contentHash: r.content_hash as string,
      capturedAt: r.captured_at as string,
    }))
  }

  // ---------- FTS 检索 ----------

  async searchContent(
    query: string,
    opts: { entityTypes?: string[]; limit?: number } = {},
  ): Promise<SearchHit[]> {
    const q = query.trim()
    if (q.length < 3) {
      throw new Error(`检索词至少 3 个字符（trigram 分词限制），当前 ${q.length} 个`)
    }
    const match = q
      .split(/\s+/)
      .map((term) => `"${term.replace(/"/g, '""')}"`)
      .join(' ')
    const params: SqlParam[] = [match]
    let typeFilter = ''
    if (opts.entityTypes && opts.entityTypes.length > 0) {
      typeFilter = ` AND entity_type IN (${opts.entityTypes.map(() => '?').join(', ')})`
      params.push(...opts.entityTypes)
    }
    params.push(opts.limit ?? 50)
    const rows = await this.exec.all<Record<string, string | null>>(
      `SELECT entity_type, entity_id, title, content FROM content_fts WHERE content_fts MATCH ?${typeFilter} ORDER BY bm25(content_fts) LIMIT ?`,
      params,
    )
    const firstTerm = q.split(/\s+/)[0].toLowerCase()
    return rows.map((r) => ({
      entityType: r.entity_type as string,
      entityId: r.entity_id as string,
      title: r.title ?? '',
      snippet: makeSnippet(r.content ?? '', firstTerm),
    }))
  }

  // ---------- 内部实现 ----------

  private async saveRow(table: TableName, row: Record<string, SqlParam>): Promise<void> {
    const now = nowIso()
    await this.exec.run(UPSERT_SQL.get(table)!, valuesOf(table, { captured_at: now, updated_at: now, ...row }))
  }

  private async saveVersioned(table: TableName, row: Record<string, SqlParam>): Promise<SaveResult> {
    const id = String(row.id)
    const contentHtml = String(row.content_html ?? '')
    const now = nowIso()
    const hash = await hashContent(contentHtml)

    const latest = await this.exec.get<{ content_hash: string; revision_no: number }>(
      'SELECT content_hash, revision_no FROM content_revision WHERE entity_type = ? AND entity_id = ? ORDER BY revision_no DESC LIMIT 1',
      [table, id],
    )

    let status: SaveResult['status']
    let revisionNo: number | null = null
    if (!latest) {
      status = 'created'
      revisionNo = 1
    } else if (latest.content_hash !== hash) {
      status = 'updated'
      revisionNo = Number(latest.revision_no) + 1
    } else {
      status = 'unchanged'
    }

    await this.exec.run(UPSERT_SQL.get(table)!, valuesOf(table, { captured_at: now, updated_at: now, ...row }))
    if (revisionNo !== null) {
      await this.exec.run(
        'INSERT INTO content_revision (entity_type, entity_id, revision_no, content_html, content_hash, captured_at) VALUES (?,?,?,?,?,?)',
        [table, id, revisionNo, contentHtml, hash, now],
      )
    }
    if ((FTS_TABLES as readonly string[]).includes(table)) {
      await this.syncFts(table, id, String(row.title ?? ''), contentHtml)
    }
    return { status, revisionNo }
  }

  private async syncFts(table: string, entityId: string, title: string, content: string): Promise<void> {
    await this.exec.run('DELETE FROM content_fts WHERE entity_type = ? AND entity_id = ?', [table, entityId])
    await this.exec.run('INSERT INTO content_fts (entity_type, entity_id, title, content) VALUES (?,?,?,?)', [
      table,
      entityId,
      title,
      content,
    ])
  }

  private async getMapped<T>(
    table: TableName,
    id: string,
    map: (row: Record<string, string | number | null>) => T,
  ): Promise<T | undefined> {
    const row = await this.exec.get<Record<string, string | number | null>>(
      `SELECT * FROM ${quoteTable(table)} WHERE id = ?`,
      [id],
    )
    return row ? map(row) : undefined
  }
}

function makeSnippet(content: string, firstTerm: string): string {
  const plain = content.replace(/<[^>]*>/g, '')
  const idx = plain.toLowerCase().indexOf(firstTerm)
  if (idx < 0) return plain.slice(0, 80)
  const start = Math.max(0, idx - 30)
  const end = Math.min(plain.length, idx + firstTerm.length + 50)
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '')
}
