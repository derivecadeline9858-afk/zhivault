// 仓储记录类型：输入用 camelCase Record，行输出含 capturedAt/updatedAt

export interface AuthorRecord {
  id: string
  username?: string
  name?: string
  avatarUrl?: string
  rawJson?: string
}

export interface QuestionRecord {
  id: string
  title?: string
  contentHtml?: string
  authorId?: string
  createdAt?: string
  answerCount?: number
  followerCount?: number
  rawJson: string
}

export interface AnswerRecord {
  id: string
  questionId?: string
  contentHtml: string
  authorId?: string
  createdAt?: string
  voteupCount?: number
  commentCount?: number
  rawJson: string
}

export interface ArticleRecord {
  id: string
  title?: string
  contentHtml: string
  authorId?: string
  createdAt?: string
  voteupCount?: number
  commentCount?: number
  columnId?: string
  rawJson: string
}

export interface PinRecord {
  id: string
  contentHtml: string
  authorId?: string
  createdAt?: string
  likeCount?: number
  commentCount?: number
  rawJson: string
}

export type CommentParentEntity = 'answer' | 'article' | 'pin' | 'question'

export interface CommentRecord {
  id: string
  entityType: CommentParentEntity
  entityId: string
  parentId?: string
  contentHtml: string
  authorId?: string
  likeCount?: number
  createdAt?: string
  rawJson: string
}

export interface CollectionRecord {
  id: string
  title?: string
  description?: string
  creatorId?: string
  itemCount?: number
  rawJson?: string
}

export interface CollectionItemRecord {
  itemType: 'answer' | 'article' | 'pin'
  itemId: string
  orderIdx?: number
  addedAt?: string
}

export interface ColumnRecord {
  id: string
  title?: string
  description?: string
  creatorId?: string
  articleCount?: number
  rawJson?: string
}

export interface ColumnItemRecord {
  articleId: string
  orderIdx?: number
}

export interface TopicRecord {
  id: string
  name?: string
  description?: string
  questionCount?: number
  followerCount?: number
  rawJson?: string
}

export interface TopicItemRecord {
  itemType: 'question' | 'answer' | 'article'
  itemId: string
}

export interface ActivityRecord {
  id: string
  authorId: string
  activityType: string
  entityType?: string
  entityId?: string
  createdAt?: string
  rawJson?: string
}

export interface SaveResult {
  status: 'created' | 'updated' | 'unchanged'
  revisionNo: number | null
}

export interface RevisionRow {
  entityType: string
  entityId: string
  revisionNo: number
  contentHtml: string
  contentHash: string
  capturedAt: string
}

export type AnnotationColor = 'yellow' | 'emerald' | 'blue' | 'rose'

export interface AnnotationInput {
  entityType: string
  entityId: string
  selectedText: string
  note?: string
  color: AnnotationColor
}

export interface AnnotationRow {
  id: number
  entityType: string
  entityId: string
  anchorPrefix: string
  anchorSuffix: string
  selectedText: string
  note: string | null
  color: string
  createdAt: string
  updatedAt: string
}

export interface SearchHit {
  entityType: string
  entityId: string
  title: string
  snippet: string
}
