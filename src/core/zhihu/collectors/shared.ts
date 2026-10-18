import type { SaveResult } from '@/core/store/types'
import { processContentImages } from '../images'
import type { CollectorOptions, CollectStats } from './types'
import { emptyStats } from './types'

export { emptyStats }

export const API_V4 = 'https://www.zhihu.com/api/v4'

/**
 * 列表实体（回答/文章等）正文 include 的自适应获取（Ruling-64 真实联调）：
 * 知乎 v4 列表默认不返回 content（问题 meta 亦需 include=detail），include 语法随端点可能为
 * 'content' 或 'data[*].content'；按首条响应探测并锁定模式，均失败则按无正文降级。
 */
type IncludeMode = 'try-content' | 'try-data' | 'off'
let includeMode: IncludeMode = 'try-content'

export async function fetchEntityList(
  fetcher: { fetchJson(url: string, opts?: { params?: Record<string, string | number> }): Promise<unknown> },
  url: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  for (;;) {
    const p: Record<string, string | number> =
      includeMode === 'off' ? params : { ...params, include: includeMode === 'try-content' ? 'content' : 'data[*].content' }
    const page = (await fetcher.fetchJson(url, { params: p })) as { data?: Array<Record<string, unknown>> }
    const first = page?.data?.[0]
    if (includeMode !== 'off' && first && typeof first.content !== 'string') {
      includeMode = includeMode === 'try-content' ? 'try-data' : 'off'
      continue
    }
    return page
  }
}

/** 记录一次实体保存结果（fetched 由采集器按 API 条目自行累加） */
export function bump(stats: CollectStats, r: SaveResult): void {
  if (r.status === 'created') stats.created++
  else if (r.status === 'updated') stats.updated++
  else stats.unchanged++
}

export function addStats(a: CollectStats, b: CollectStats): CollectStats {
  return {
    fetched: a.fetched + b.fetched,
    created: a.created + b.created,
    updated: a.updated + b.updated,
    unchanged: a.unchanged + b.unchanged,
    failed: a.failed + b.failed,
  }
}

/** 图片三档改写（PRD §4）；未配置 mode/download 时保持原样 */
export async function applyImages(html: string, options: CollectorOptions): Promise<string> {
  if (!options.images || options.images === 'none' || !options.downloadImage) {
    if (options.images === 'none' && options.downloadImage) {
      const r = await processContentImages(html, { mode: 'none', download: options.downloadImage })
      return r.html
    }
    return html
  }
  const r = await processContentImages(html, {
    mode: options.images,
    download: options.downloadImage,
    exists: options.imageExists,
  })
  return r.html
}
