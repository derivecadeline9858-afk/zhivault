import type { SaveResult } from '@/core/store/types'
import { processContentImages } from '../images'
import type { CollectorOptions, CollectStats } from './types'
import { emptyStats } from './types'

export { emptyStats }

export const API_V4 = 'https://www.zhihu.com/api/v4'

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
