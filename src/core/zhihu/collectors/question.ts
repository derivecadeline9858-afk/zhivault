import { inTimeWindow, mapAnswerRecord, mapAuthor, mapQuestionRecord } from '../mappers'
import { API_V4, applyImages, bump, fetchEntityList } from './shared'
import type { CollectorFn } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

/** 整问题全量（PRD §5.1：赞同/时间排序 + 截断 + 断点续抓） */
export const collectQuestion: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const id = target.id
  const { store, taskId } = deps

  const metaRaw = (await deps.fetcher.fetchJson(`${API_V4}/questions/${id}`, {
    params: { include: 'detail' },
  })) as Raw
  const author = mapAuthor(metaRaw.author)
  if (author) await store.saveAuthor(author)
  bump(stats, await store.saveQuestion(mapQuestionRecord(metaRaw)))

  const sort = options.sort === 'created' ? 'created' : 'default'
  const cursorKey = `question.${id}.answers.offset`
  let seen = Number((await store.getCaptureMeta(taskId, cursorKey)) ?? 0)

  for (;;) {
    if (deps.isPaused?.()) {
      await store.saveCaptureMeta(taskId, cursorKey, String(seen))
      return { stats, status: 'paused', cursor: String(seen) }
    }
    if (options.maxItems !== undefined && seen >= options.maxItems) break

    const page = (await fetchEntityList(deps.fetcher, `${API_V4}/questions/${id}/answers`, {
      sort_by: sort,
      limit: 20,
      offset: seen,
    })) as { data?: Raw[]; paging?: { is_end?: boolean } }
    const data = page.data ?? []

    if (data.length === 0) break
    for (const item of data) {
      if (options.maxItems !== undefined && seen >= options.maxItems) break
      stats.fetched++
      const record = mapAnswerRecord(item, id)
      if (!inTimeWindow(record.createdAt, options.timeWindow)) {
        seen++
        continue
      }
      record.contentHtml = await applyImages(record.contentHtml, options)
      const a = mapAuthor(item.author)
      if (a) await store.saveAuthor(a)
      bump(stats, await store.saveAnswer(record))
      seen++
      deps.onProgress?.({ done: seen })
    }
    await store.saveCaptureMeta(taskId, cursorKey, String(seen))
    if (page.paging?.is_end) break
  }

  // 完整跑完一轮：游标归零，二次运行自然全量扫（增量幂等由版本比对承担，PRD §7.4-4）
  await store.saveCaptureMeta(taskId, cursorKey, '0')
  return { stats, status: 'done' }
}
