import type { ContentStore } from '@/core/store/content-store'
import type { Fetcher, ZhihuSession } from '../fetcher'
import type { ImageDownloader, ImageMode } from '../images'

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
  store: ContentStore
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
