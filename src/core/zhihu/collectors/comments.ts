import type { CommentParentEntity } from '@/core/store/types'
import { inTimeWindow, mapAuthor, mapCommentRecord, toNum } from '../mappers'
import { API_V4, bump } from './shared'
import type { CollectorDeps, CollectResult, CollectStats } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

export interface CommentAnchor {
  entityType: CommentParentEntity
  entityId: string
}

export interface CommentCollectOptions {
  /** 赞数筛选（PRD §10-3：低于阈值不入库） */
  likeMin?: number
  order?: 'score' | 'time'
  timeWindow?: { createdAfter?: string; createdBefore?: string }
}

/** 评论树采集（PRD §10-3）：根评论 + 子评论两层，层级由 parent_id 表达 */
export async function collectComments(
  deps: CollectorDeps,
  anchor: CommentAnchor,
  options: CommentCollectOptions = {},
): Promise<CollectResult> {
  const stats: CollectStats = emptyStats()
  const min = options.likeMin ?? 0
  const order = options.order ?? 'score'
  const base = `${API_V4}/comment_v5/comment/${anchor.entityType}/${anchor.entityId}`

  let offset = 0
  for (;;) {
    const page = (await deps.fetcher.fetchJson(`${base}/root_comment`, {
      params: { order_by: order, limit: 20, offset },
    })) as { data?: Raw[]; paging?: { is_end?: boolean } }
    const roots = page.data ?? []
    if (roots.length === 0) break

    for (const root of roots) {
      stats.fetched++
      const like = toNum(root.like_count) ?? 0
      const rec = mapCommentRecord(root, anchor.entityType, anchor.entityId)
      if (like < min || !inTimeWindow(rec.createdAt, options.timeWindow)) continue
      const author = mapAuthor(root.author)
      if (author) await deps.store.saveAuthor(author)
      bump(stats, await deps.store.saveComment(rec))

      const childCount = toNum(root.child_comment_count) ?? 0
      if (childCount === 0) continue
      let childOffset = 0
      for (;;) {
        const childPage = (await deps.fetcher.fetchJson(`${base}/child_comment`, {
          params: { root_comment_id: String(root.id), limit: 20, offset: childOffset },
        })) as { data?: Raw[]; paging?: { is_end?: boolean } }
        const children = childPage.data ?? []
        if (children.length === 0) break
        for (const child of children) {
          stats.fetched++
          const childLike = toNum(child.like_count) ?? 0
          const childRec = mapCommentRecord(child, anchor.entityType, anchor.entityId, String(root.id))
          if (childLike < min || !inTimeWindow(childRec.createdAt, options.timeWindow)) continue
          const childAuthor = mapAuthor(child.author)
          if (childAuthor) await deps.store.saveAuthor(childAuthor)
          bump(stats, await deps.store.saveComment(childRec))
        }
        if (childPage.paging?.is_end) break
        childOffset += children.length
      }
    }

    if (page.paging?.is_end) break
    offset += roots.length
  }

  return { stats, status: 'done' }
}
