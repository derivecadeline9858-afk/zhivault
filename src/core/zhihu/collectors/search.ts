import { mapAnswerRecord, mapArticleRecord, mapAuthor, mapPinRecord, mapQuestionRecord } from '../mappers'
import { API_V4, applyImages, bump } from './shared'
import type { CollectorDeps, CollectResult, CollectStats } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

/** 关键词搜索采集（PRD §5.1 P1，采集器先行）：search_v3 分页，结果批量入库 */
export async function collectSearch(
  deps: CollectorDeps,
  target: { query: string },
  options: { maxItems?: number; timeWindow?: { createdAfter?: string; createdBefore?: string } } = {},
): Promise<CollectResult> {
  const stats: CollectStats = emptyStats()
  const cursorKey = `search.${target.query}.offset`
  let seen = Number((await deps.store.getCaptureMeta(deps.taskId, cursorKey)) ?? 0)

  for (;;) {
    if (deps.isPaused?.()) {
      await deps.store.saveCaptureMeta(deps.taskId, cursorKey, String(seen))
      return { stats, status: 'paused', cursor: String(seen) }
    }
    if (options.maxItems !== undefined && seen >= options.maxItems) break
    const page = (await deps.fetcher.fetchJson(`${API_V4}/search_v3`, {
      params: { t: 'general', q: target.query, correction: 1, limit: 20, offset: seen },
    })) as { items?: { type: string; object: Raw }[]; paging?: { is_end?: boolean } }
    const items = page.items ?? []
    if (items.length === 0) break
    for (const item of items) {
      if (options.maxItems !== undefined && seen >= options.maxItems) break
      stats.fetched++
      const type = item.type
      const raw = item.object ?? {}
      const author = mapAuthor(raw.author)
      if (author) await deps.store.saveAuthor(author)
      if (type === 'answer') {
        const q = raw.question as Raw | undefined
        if (q?.id) bump(stats, await deps.store.saveQuestion(mapQuestionRecord(q)))
        const rec = mapAnswerRecord(raw)
        rec.contentHtml = await applyImages(rec.contentHtml, options)
        bump(stats, await deps.store.saveAnswer(rec))
      } else if (type === 'article') {
        const rec = mapArticleRecord(raw)
        rec.contentHtml = await applyImages(rec.contentHtml, options)
        bump(stats, await deps.store.saveArticle(rec))
      } else if (type === 'pin') {
        const rec = mapPinRecord(raw)
        rec.contentHtml = await applyImages(rec.contentHtml, options)
        bump(stats, await deps.store.savePin(rec))
      } else if (type === 'question') {
        bump(stats, await deps.store.saveQuestion(mapQuestionRecord(raw)))
      }
      seen++
      deps.onProgress?.({ done: seen })
    }
    await deps.store.saveCaptureMeta(deps.taskId, cursorKey, String(seen))
    if (page.paging?.is_end) break
  }

  await deps.store.saveCaptureMeta(deps.taskId, cursorKey, '0')
  return { stats, status: 'done' }
}
