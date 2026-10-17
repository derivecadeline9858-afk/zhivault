/** 书：导出的最小单元（由导出中心从库中装配） */
export interface BookItem {
  entityType: 'answer' | 'article' | 'pin' | 'question' | 'comment'
  entityId: string
  title: string
  authorName?: string
  url?: string
  capturedAt: string
  contentHtml: string
  /** 原始 API 响应（JSON 字符串，原样进 records） */
  rawJson: string
  /** answer 关联的问题标题（Obsidian 双链用） */
  questionTitle?: string
}

export interface BookSource {
  title: string
  items: BookItem[]
}

export type ExportFormat = 'html' | 'epub' | 'markdown' | 'txt' | 'docx' | 'json' | 'pdf'
