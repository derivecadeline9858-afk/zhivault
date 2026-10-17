import { ZhiVaultError } from '@/core/fetch/errors'
import { INVALID_URL } from './errors'

export type EntityType = 'answer' | 'article' | 'pin' | 'question' | 'collection' | 'column' | 'topic' | 'user'

export interface ParsedTarget {
  type: EntityType
  id: string
  /** answer 类型附带问题 id */
  questionId?: string
}

const HOSTS = /(^|\.)zhihu\.com$/i

/**
 * URL 解析器（PRD §10-3）。支持 8 类实体（§5.1 P0 清单），
 * 剥掉查询串与 hash；无法归类一律 INVALID_URL。
 */
export function parseZhihuUrl(raw: string): ParsedTarget {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ZhiVaultError(INVALID_URL, `INVALID_URL：无法解析的 URL（${raw}）`)
  }
  if (!HOSTS.test(url.hostname)) {
    throw new ZhiVaultError(INVALID_URL, `INVALID_URL：非知乎域名（${url.hostname}）`)
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const kind = parts[0]

  if (kind === 'question' && parts[1]) {
    if (parts[2] === 'answer' && parts[3]) {
      return { type: 'answer', id: parts[3], questionId: parts[1] }
    }
    return { type: 'question', id: parts[1] }
  }
  if (kind === 'p' && parts[1]) return { type: 'article', id: parts[1] }
  if (kind === 'pin' && parts[1]) return { type: 'pin', id: parts[1] }
  if (kind === 'collection' && parts[1]) return { type: 'collection', id: parts[1] }
  if (kind === 'column' && parts[1]) return { type: 'column', id: parts[1] }
  if (kind === 'topic' && parts[1]) return { type: 'topic', id: parts[1] }
  if (kind === 'people' && parts[1]) return { type: 'user', id: parts[1] }

  throw new ZhiVaultError(INVALID_URL, `INVALID_URL：无法识别的知乎 URL（${url.pathname}）`)
}
