import type { SaveResult } from '@/core/store/types'
import type { Fetcher, ZhihuSession } from '../fetcher'
import type { ImageDownloader, ImageMode } from '../images'

/** 采集器需要的最小仓储面（ContentStore 结构化满足；浏览器演示模式用内存实现） */
export interface StoreLike {
  saveAnswer(r: unknown): Promise<SaveResult>
  saveQuestion(r: unknown): Promise<SaveResult>
  saveArticle(r: unknown): Promise<SaveResult>
  savePin(r: unknown): Promise<SaveResult>
  saveComment(r: unknown): Promise<SaveResult>
  saveAuthor(r: unknown): Promise<void>
  saveCollection(r: unknown): Promise<void>
  replaceCollectionItems(id: string, items: unknown[]): Promise<void>
  saveColumn(r: unknown): Promise<void>
  replaceColumnItems(id: string, items: unknown[]): Promise<void>
  saveTopic(r: unknown): Promise<void>
  replaceTopicItems(id: string, items: unknown[]): Promise<void>
  saveActivity(r: unknown): Promise<void>
  getActivity(id: string): Promise<unknown>
  getCaptureMeta(taskId: string, key: string): Promise<string | undefined>
  saveCaptureMeta(taskId: string, key: string, value: string): Promise<void>
  listComments(entityType: string, entityId: string): Promise<unknown[]>
}

export interface CollectStats {
  fetched: number
  created: number
  updated: number
  unchanged: number
  failed: number
}

export const emptyStats = (): CollectStats => ({ fetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 })

export interface CollectResult {
  stats: CollectStats
  /** paused = 协作式暂停（游标已保存，可断点续抓） */
  status: 'done' | 'paused'
  cursor?: string
}

export interface CollectorDeps {
  fetcher: Fetcher
  store: StoreLike
  /** 游标按任务独立持久化（PRD §0-3） */
  taskId: string
  session?: ZhihuSession
  /** 执行器注入的暂停探针 */
  isPaused?: () => boolean
  onProgress?: (p: { done: number; total?: number }) => void
}

export interface CollectorOptions {
  images?: ImageMode
  downloadImage?: ImageDownloader
  imageExists?: (fileName: string) => Promise<boolean>
  /** 截断上限（整问题/搜索等列表采集） */
  maxItems?: number
  /** 整问题排序：default=赞同 created=时间（PRD §5.1） */
  sort?: 'default' | 'created'
  includeComments?: boolean
  commentLikeMin?: number
  commentOrder?: 'score' | 'time'
  /** user 子模式：created=公开创作（匿名可） activities=赞同动态（需登录） */
  subMode?: 'created' | 'activities'
  timeWindow?: { createdAfter?: string; createdBefore?: string }
}

export type CollectorFn = (
  deps: CollectorDeps,
  target: { id: string; questionId?: string },
  options?: CollectorOptions,
) => Promise<CollectResult>
