import type {
  ActivityRecord,
  AnswerRecord,
  ArticleRecord,
  AuthorRecord,
  CollectionRecord,
  ColumnRecord,
  CommentParentEntity,
  CommentRecord,
  PinRecord,
  QuestionRecord,
  TopicRecord,
} from '@/core/store/types'

/** 知乎 epoch 秒 → ISO；已是字符串则原样返回 */
export const toIso = (v: unknown): string | undefined =>
  typeof v === 'number' ? new Date(v * 1000).toISOString() : typeof v === 'string' ? v : undefined

export const toNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

/** 内容时间窗过滤（PRD §5.3；与增量游标正交，任务 7 完善叠加语义） */
export function inTimeWindow(
  createdAt: string | undefined,
  window?: { createdAfter?: string; createdBefore?: string },
): boolean {
  if (!window || !createdAt) return true
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return true
  if (window.createdAfter && t < Date.parse(window.createdAfter)) return false
  if (window.createdBefore && t > Date.parse(window.createdBefore)) return false
  return true
}

type Raw = Record<string, unknown>

export function mapAuthor(raw: unknown): AuthorRecord | undefined {
  const r = raw as Raw | null | undefined
  if (!r) return undefined
  const id = (r.url_token as string) ?? (r.id as string)
  if (!id) return undefined
  return {
    id,
    username: (r.url_token as string) ?? undefined,
    name: (r.name as string) ?? undefined,
    avatarUrl: (r.avatar_url as string) ?? undefined,
    rawJson: JSON.stringify(raw),
  }
}

export function mapQuestionRecord(raw: Raw): QuestionRecord {
  return {
    id: String(raw.id),
    title: (raw.title as string) ?? undefined,
    contentHtml: (raw.detail as string) ?? undefined,
    authorId: mapAuthor(raw.author)?.id,
    createdAt: toIso(raw.created_time),
    answerCount: toNum(raw.answer_count),
    followerCount: toNum(raw.follower_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapAnswerRecord(raw: Raw, questionId?: string): AnswerRecord {
  return {
    id: String(raw.id),
    questionId: questionId ?? ((raw.question as Raw | undefined)?.id as string | undefined),
    contentHtml: (raw.content as string) ?? '',
    authorId: mapAuthor(raw.author)?.id,
    createdAt: toIso(raw.created_time),
    voteupCount: toNum(raw.voteup_count),
    commentCount: toNum(raw.comment_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapArticleRecord(raw: Raw): ArticleRecord {
  return {
    id: String(raw.id),
    title: (raw.title as string) ?? undefined,
    contentHtml: (raw.content as string) ?? '',
    authorId: mapAuthor(raw.author)?.id,
    createdAt: toIso(raw.created ?? raw.created_time),
    voteupCount: toNum(raw.voteup_count),
    commentCount: toNum(raw.comment_count),
    columnId: (raw.column as Raw | undefined)?.id as string | undefined,
    rawJson: JSON.stringify(raw),
  }
}

export function mapPinRecord(raw: Raw): PinRecord {
  const content = typeof raw.content === 'string' ? raw.content : ''
  return {
    id: String(raw.id),
    contentHtml: content,
    authorId: mapAuthor(raw.author)?.id,
    createdAt: toIso(raw.created ?? raw.created_time),
    likeCount: toNum(raw.like_count),
    commentCount: toNum(raw.comment_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapCommentRecord(
  raw: Raw,
  entityType: CommentParentEntity,
  entityId: string,
  parentId?: string,
): CommentRecord {
  return {
    id: String(raw.id),
    entityType,
    entityId,
    parentId,
    contentHtml: (raw.content as string) ?? '',
    authorId: mapAuthor(raw.author)?.id,
    likeCount: toNum(raw.like_count),
    createdAt: toIso(raw.created_time),
    rawJson: JSON.stringify(raw),
  }
}

export function mapCollectionRecord(raw: Raw): CollectionRecord {
  return {
    id: String(raw.id),
    title: (raw.title as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    creatorId: mapAuthor(raw.creator)?.id,
    itemCount: toNum(raw.item_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapColumnRecord(raw: Raw): ColumnRecord {
  return {
    id: String(raw.id),
    title: (raw.title as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    creatorId: mapAuthor(raw.creator)?.id,
    articleCount: toNum(raw.items_count ?? raw.article_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapTopicRecord(raw: Raw): TopicRecord {
  return {
    id: String(raw.id),
    name: (raw.name as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    questionCount: toNum(raw.questions_count ?? raw.question_count),
    followerCount: toNum(raw.followers_count ?? raw.follower_count),
    rawJson: JSON.stringify(raw),
  }
}

export function mapActivityRecord(raw: Raw): ActivityRecord {
  return {
    id: String(raw.id),
    authorId: mapAuthor(raw.actor)?.id ?? String(raw.author_id ?? ''),
    activityType: (raw.type as string) ?? 'unknown',
    entityType: ((raw.target as Raw | undefined)?.type as string) ?? undefined,
    entityId: ((raw.target as Raw | undefined)?.id as string) ?? undefined,
    createdAt: toIso(raw.created_time),
    rawJson: JSON.stringify(raw),
  }
}
