import { ZhiVaultError } from '@/core/fetch/errors'
import { LOGIN_REQUIRED } from '../errors'
import { isLoggedIn } from '../fetcher'
import { mapActivityRecord, mapAnswerRecord, mapArticleRecord, mapAuthor, mapPinRecord, mapQuestionRecord } from '../mappers'
import { canCapture } from '../visibility'
import { API_V4, applyImages, bump, fetchEntityList } from './shared'
import type { CollectorFn } from './types'
import { emptyStats } from './types'

type Raw = Record<string, unknown>

interface Page {
  data?: Raw[]
  paging?: { is_end?: boolean; after_id?: string }
}

async function saveTargetEntity(
  store: Parameters<CollectorFn>[0]['store'],
  target: Raw,
  stats: ReturnType<typeof emptyStats>,
): Promise<void> {
  const type = String(target.type ?? '')
  const a = mapAuthor(target.author)
  if (a) await store.saveAuthor(a)
  if (type === 'answer') {
    const q = target.question as Raw | undefined
    if (q?.id) bump(stats, await store.saveQuestion(mapQuestionRecord(q)))
    bump(stats, await store.saveAnswer(mapAnswerRecord(target)))
    return
  }
  if (type === 'article') {
    bump(stats, await store.saveArticle(mapArticleRecord(target)))
    return
  }
  if (type === 'pin') {
    bump(stats, await store.savePin(mapPinRecord(target)))
  }
}

/** 用户采集：created=公开创作（匿名可采） activities=赞同动态（需登录，游标增量） */
export const collectUser: CollectorFn = async (deps, target, options = {}) => {
  const stats = emptyStats()
  const { store, taskId } = deps
  const subMode = options.subMode ?? 'created'

  if (!canCapture('user', subMode, isLoggedIn(deps.session))) {
    throw new ZhiVaultError(LOGIN_REQUIRED, `LOGIN_REQUIRED：用户${subMode === 'activities' ? '赞同动态' : '创作'}采集需要登录`)
  }

  if (subMode === 'created') {
    // 用户自身作为 author 落库（主页信息任务 5 补全）
    await store.saveAuthor({ id: target.id, username: target.id, name: target.id })

    for (const list of ['answers', 'articles', 'pins'] as const) {
      const cursorKey = `user.${target.id}.${list}.offset`
      let seen = Number((await store.getCaptureMeta(taskId, cursorKey)) ?? 0)
      for (;;) {
        if (deps.isPaused?.()) {
          await store.saveCaptureMeta(taskId, cursorKey, String(seen))
          return { stats, status: 'paused', cursor: String(seen) }
        }
        const page = (await fetchEntityList(deps.fetcher, `${API_V4}/members/${target.id}/${list}`, {
          limit: 20,
          offset: seen,
        })) as Page
        const data = page.data ?? []
        if (data.length === 0) break
        for (const item of data) {
          stats.fetched++
          const author = mapAuthor(item.author)
          if (author) await store.saveAuthor(author)
          if (list === 'answers') {
            const q = item.question as Raw | undefined
            if (q?.id) {
              bump(stats, await store.saveQuestion(mapQuestionRecord(q)))
            }
            const rec = mapAnswerRecord(item)
            rec.contentHtml = await applyImages(rec.contentHtml, options)
            bump(stats, await store.saveAnswer(rec))
          } else if (list === 'articles') {
            const rec = mapArticleRecord(item)
            rec.contentHtml = await applyImages(rec.contentHtml, options)
            bump(stats, await store.saveArticle(rec))
          } else {
            const rec = mapPinRecord(item)
            rec.contentHtml = await applyImages(rec.contentHtml, options)
            bump(stats, await store.savePin(rec))
          }
          seen++
          deps.onProgress?.({ done: seen })
        }
        await store.saveCaptureMeta(taskId, cursorKey, String(seen))
        if (page.paging?.is_end) break
      }
      // 创作列表完整一轮后归零重扫（增量幂等）
      await store.saveCaptureMeta(taskId, cursorKey, '0')
    }
    return { stats, status: 'done' }
  }

  // activities：游标增量，不重置——只抓新动态
  const cursorKey = `user.${target.id}.activities.after_id`
  let after = (await store.getCaptureMeta(taskId, cursorKey)) ?? ''
  for (;;) {
    if (deps.isPaused?.()) {
      await store.saveCaptureMeta(taskId, cursorKey, after)
      return { stats, status: 'paused', cursor: after }
    }
    const params: Record<string, string | number> = { limit: 20 }
    if (after) params.after_id = after
    const page = (await deps.fetcher.fetchJson(`${API_V4}/members/${target.id}/activities`, {
      params,
    })) as Page
    const data = page.data ?? []
    if (data.length === 0) break
    for (const item of data) {
      stats.fetched++
      const record = mapActivityRecord(item)
      const existed = await store.getActivity(record.id)
      await store.saveActivity(record)
      if (existed) stats.updated++
      else stats.created++
      const targetRaw = item.target as Raw | undefined
      if (targetRaw?.id) await saveTargetEntity(store, targetRaw, stats)
      deps.onProgress?.({ done: stats.fetched })
    }
    if (page.paging?.after_id) {
      after = String(page.paging.after_id)
      await store.saveCaptureMeta(taskId, cursorKey, after)
    }
    if (page.paging?.is_end) break
  }
  return { stats, status: 'done' }
}
