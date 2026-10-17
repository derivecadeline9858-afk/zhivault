import type { CollectionItemRecord, ColumnItemRecord, TopicItemRecord } from '@/core/store/types'
import { mapAnswerRecord, mapArticleRecord, mapAuthor, mapCollectionRecord, mapColumnRecord, mapPinRecord, mapQuestionRecord, mapTopicRecord } from '../mappers'
import { API_V4, applyImages, bump } from './shared'
import type { CollectorFn } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

interface Page {
  data?: Raw[]
  paging?: { is_end?: boolean }
}

async function saveInlineEntity(
  store: Parameters<CollectorFn>[0]['store'],
  type: string,
  raw: Raw,
  stats: ReturnType<typeof emptyStats>,
  options: Parameters<CollectorFn>[2],
): Promise<string | null> {
  const a = mapAuthor(raw.author)
  if (a) await store.saveAuthor(a)
  if (type === 'answer') {
    const q = raw.question as Raw | undefined
    if (q?.id) {
      const qa = mapAuthor(q.author)
      if (qa) await store.saveAuthor(qa)
      bump(stats, await store.saveQuestion(mapQuestionRecord(q)))
    }
    const rec = mapAnswerRecord(raw)
    rec.contentHtml = await applyImages(rec.contentHtml, options ?? {})
    bump(stats, await store.saveAnswer(rec))
    return rec.id
  }
  if (type === 'article') {
    const rec = mapArticleRecord(raw)
    rec.contentHtml = await applyImages(rec.contentHtml, options ?? {})
    bump(stats, await store.saveArticle(rec))
    return rec.id
  }
  if (type === 'pin') {
    const rec = mapPinRecord(raw)
    rec.contentHtml = await applyImages(rec.contentHtml, options ?? {})
    bump(stats, await store.savePin(rec))
    return rec.id
  }
  if (type === 'question') {
    bump(stats, await store.saveQuestion(mapQuestionRecord(raw)))
    return String(raw.id)
  }
  return null
}

export const collectCollection: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const id = target.id
  const { store, taskId } = deps

  const meta = (await deps.fetcher.fetchJson(`${API_V4}/collections/${id}`)) as Raw
  const creator = mapAuthor(meta.creator)
  if (creator) await store.saveAuthor(creator)
  await store.saveCollection(mapCollectionRecord(meta))

  const cursorKey = `collection.${id}.items.offset`
  let seen = Number((await store.getCaptureMeta(taskId, cursorKey)) ?? 0)
  const items: CollectionItemRecord[] = []

  for (;;) {
    if (deps.isPaused?.()) {
      await store.saveCaptureMeta(taskId, cursorKey, String(seen))
      return { stats, status: 'paused', cursor: String(seen) }
    }
    if (options.maxItems !== undefined && seen >= options.maxItems) break
    const page = (await deps.fetcher.fetchJson(`${API_V4}/collections/${id}/items`, {
      params: { limit: 20, offset: seen },
    })) as Page
    const data = page.data ?? []
    if (data.length === 0) break
    for (const entry of data) {
      if (options.maxItems !== undefined && seen >= options.maxItems) break
      stats.fetched++
      const type = String(entry.content_type ?? '').toLowerCase()
      const savedId = await saveInlineEntity(store, type, entry.content as Raw, stats, options)
      if (savedId) items.push({ itemType: type as CollectionItemRecord['itemType'], itemId: savedId, orderIdx: seen })
      seen++
      deps.onProgress?.({ done: seen })
    }
    await store.saveCaptureMeta(taskId, cursorKey, String(seen))
    if (page.paging?.is_end) break
  }

  await store.replaceCollectionItems(id, items)
  await store.saveCaptureMeta(taskId, cursorKey, '0')
  return { stats, status: 'done' }
}

export const collectColumn: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const id = target.id
  const { store, taskId } = deps

  const meta = (await deps.fetcher.fetchJson(`${API_V4}/columns/${id}`)) as Raw
  const creator = mapAuthor(meta.creator)
  if (creator) await store.saveAuthor(creator)
  await store.saveColumn(mapColumnRecord(meta))

  const cursorKey = `column.${id}.items.offset`
  let seen = Number((await store.getCaptureMeta(taskId, cursorKey)) ?? 0)
  const items: ColumnItemRecord[] = []

  for (;;) {
    if (deps.isPaused?.()) {
      await store.saveCaptureMeta(taskId, cursorKey, String(seen))
      return { stats, status: 'paused', cursor: String(seen) }
    }
    if (options.maxItems !== undefined && seen >= options.maxItems) break
    const page = (await deps.fetcher.fetchJson(`${API_V4}/columns/${id}/items`, {
      params: { limit: 20, offset: seen },
    })) as Page
    const data = page.data ?? []
    if (data.length === 0) break
    for (const entry of data) {
      if (options.maxItems !== undefined && seen >= options.maxItems) break
      stats.fetched++
      const savedId = await saveInlineEntity(store, 'article', entry.content as Raw, stats, options)
      if (savedId) items.push({ articleId: savedId, orderIdx: seen })
      seen++
      deps.onProgress?.({ done: seen })
    }
    await store.saveCaptureMeta(taskId, cursorKey, String(seen))
    if (page.paging?.is_end) break
  }

  await store.replaceColumnItems(id, items)
  await store.saveCaptureMeta(taskId, cursorKey, '0')
  return { stats, status: 'done' }
}

export const collectTopic: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const id = target.id
  const { store, taskId } = deps

  const meta = (await deps.fetcher.fetchJson(`${API_V4}/topics/${id}`)) as Raw
  await store.saveTopic(mapTopicRecord(meta))

  const cursorKey = `topic.${id}.questions.offset`
  let seen = Number((await store.getCaptureMeta(taskId, cursorKey)) ?? 0)
  const items: TopicItemRecord[] = []

  for (;;) {
    if (deps.isPaused?.()) {
      await store.saveCaptureMeta(taskId, cursorKey, String(seen))
      return { stats, status: 'paused', cursor: String(seen) }
    }
    if (options.maxItems !== undefined && seen >= options.maxItems) break
    const page = (await deps.fetcher.fetchJson(`${API_V4}/topics/${id}/questions`, {
      params: { limit: 20, offset: seen },
    })) as Page
    const data = page.data ?? []
    if (data.length === 0) break
    for (const entry of data) {
      if (options.maxItems !== undefined && seen >= options.maxItems) break
      stats.fetched++
      const qRaw = (entry.question ?? entry) as Raw
      const a = mapAuthor(qRaw.author)
      if (a) await store.saveAuthor(a)
      const savedId = await saveInlineEntity(store, 'question', qRaw, stats, options)
      if (savedId) items.push({ itemType: 'question', itemId: savedId })
      seen++
      deps.onProgress?.({ done: seen })
    }
    await store.saveCaptureMeta(taskId, cursorKey, String(seen))
    if (page.paging?.is_end) break
  }

  await store.replaceTopicItems(id, items)
  await store.saveCaptureMeta(taskId, cursorKey, '0')
  return { stats, status: 'done' }
}
