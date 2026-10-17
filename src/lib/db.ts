import type { ContentStore } from '@/core/store/content-store'
import { getContentStore } from '@/core/store/connection'
import type { BookItem, BookSource } from '@/core/export/book'

let dbPromise: Promise<ContentStore | null> | null = null

/** 应用内返回便携库仓储；纯浏览器（无 Tauri）返回 null，页面给空态 */
export function getDb(): Promise<ContentStore | null> {
  dbPromise ??= getContentStore().catch(() => null)
  return dbPromise
}

const toItem = (entityType: BookItem['entityType'], row: Record<string, unknown>): BookItem => ({
  entityType,
  entityId: String(row.id),
  title: String(row.title ?? `${entityType}-${row.id}`),
  authorName: undefined,
  url: undefined,
  capturedAt: String(row.captured_at ?? new Date().toISOString()),
  contentHtml: String(row.content_html ?? ''),
  rawJson: String(row.raw_json ?? '{}'),
})

const ITEM_TYPES: { type: BookItem['entityType']; list: (s: ContentStore) => Promise<Record<string, unknown>[]> }[] = [
  { type: 'answer', list: (s) => s.listAnswers(0, 500) },
  { type: 'article', list: (s) => s.listArticles(0, 500) },
  { type: 'pin', list: (s) => s.listPins(0, 500) },
  { type: 'question', list: (s) => s.listQuestions(0, 500) },
]

/** 按类型组装书源（MVP：全部合并 / 单类型书；任务级分书随任务 8 扩展） */
export async function buildBookFromStore(store: ContentStore, types: string[]): Promise<BookSource> {
  const items: BookItem[] = []
  for (const { type, list } of ITEM_TYPES) {
    if (!types.includes(type)) continue
    const rows = await list(store)
    for (const row of rows) items.push(toItem(type, row))
  }
  return { title: '知藏全书库', items }
}
