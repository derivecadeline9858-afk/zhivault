import { mapAnswerRecord, mapArticleRecord, mapAuthor, mapPinRecord, mapQuestionRecord } from '../mappers'
import type { StoreLike } from './types'
import { API_V4, applyImages, bump } from './shared'
import { collectComments } from './comments'
import type { CollectorFn } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

async function saveEmbeddedQuestion(store: StoreLike, raw: unknown): Promise<void> {
  const q = raw as Raw | undefined
  if (!q?.id) return
  const author = mapAuthor(q.author)
  if (author) await store.saveAuthor(author)
  await store.saveQuestion(mapQuestionRecord(q))
}

export const collectAnswer: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const raw = (await deps.fetcher.fetchJson(`${API_V4}/answers/${target.id}`)) as Raw
  stats.fetched++

  const author = mapAuthor(raw.author)
  if (author) await deps.store.saveAuthor(author)
  await saveEmbeddedQuestion(deps.store, raw.question)

  const record = mapAnswerRecord(raw, target.questionId)
  record.contentHtml = await applyImages(record.contentHtml, options)
  bump(stats, await deps.store.saveAnswer(record))
  deps.onProgress?.({ done: stats.fetched })

  if (options.includeComments) {
    const r = await collectComments(
      deps,
      { entityType: 'answer', entityId: record.id },
      { likeMin: options.commentLikeMin, order: options.commentOrder, timeWindow: options.timeWindow },
    )
    Object.assign(stats, {
      fetched: stats.fetched + r.stats.fetched,
      created: stats.created + r.stats.created,
      updated: stats.updated + r.stats.updated,
      unchanged: stats.unchanged + r.stats.unchanged,
      failed: stats.failed + r.stats.failed,
    })
  }

  return { stats, status: 'done' }
}

export const collectArticle: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const raw = (await deps.fetcher.fetchJson(`${API_V4}/articles/${target.id}`)) as Raw
  stats.fetched++
  const author = mapAuthor(raw.author)
  if (author) await deps.store.saveAuthor(author)
  const record = mapArticleRecord(raw)
  record.contentHtml = await applyImages(record.contentHtml, options)
  bump(stats, await deps.store.saveArticle(record))
  deps.onProgress?.({ done: stats.fetched })
  return { stats, status: 'done' }
}

export const collectPin: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const raw = (await deps.fetcher.fetchJson(`${API_V4}/pins/${target.id}`)) as Raw
  stats.fetched++
  const author = mapAuthor(raw.author)
  if (author) await deps.store.saveAuthor(author)
  const record = mapPinRecord(raw)
  record.contentHtml = await applyImages(record.contentHtml, options)
  bump(stats, await deps.store.savePin(record))
  deps.onProgress?.({ done: stats.fetched })
  return { stats, status: 'done' }
}
