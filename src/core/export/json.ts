import type { BookSource } from './book'

export interface JsonExportRecord {
  entityType: string
  entityId: string
  title: string
  url?: string
  capturedAt: string
  /** 原始 API 响应（解析后嵌入；保留以便未来重新解析，PRD §7.3） */
  raw: unknown
}

export interface JsonExport {
  schema: 'zhivault.export.v1'
  app: { name: 'zhivault'; version: string; author: '橙茶星' }
  exportedAt: string
  records: JsonExportRecord[]
  indexes: unknown[]
  relations: unknown[]
}

/** JSON 导出（PRD §5.5 schema v1） */
export function buildJsonExport(
  book: BookSource,
  opts: { appVersion: string; now?: string },
): JsonExport {
  return {
    schema: 'zhivault.export.v1',
    app: { name: 'zhivault', version: opts.appVersion, author: '橙茶星' },
    exportedAt: opts.now ?? new Date().toISOString(),
    records: book.items.map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
      url: item.url,
      capturedAt: item.capturedAt,
      raw: JSON.parse(item.rawJson) as unknown,
    })),
    indexes: [],
    relations: [],
  }
}
