import type { BookItem, BookSource } from '@/core/export/book'

export class MemorySink {
  readonly files = new Map<string, string | Uint8Array>()
  async writeText(rel: string, content: string): Promise<void> {
    this.files.set(rel, content)
  }
  async writeBinary(rel: string, data: Uint8Array): Promise<void> {
    this.files.set(rel, data)
  }
  async exists(rel: string): Promise<boolean> {
    return this.files.has(rel)
  }
  text(rel: string): string {
    const v = this.files.get(rel)
    if (typeof v !== 'string') throw new Error(`not a text file: ${rel}`)
    return v
  }
  binary(rel: string): Uint8Array {
    const v = this.files.get(rel)
    if (!(v instanceof Uint8Array)) throw new Error(`not a binary file: ${rel}`)
    return v
  }
}

const RAW_ANSWER = JSON.stringify({ id: 'a1', content: '<p>回答正文</p>', voteup_count: 10 })

export function makeBook(): BookSource {
  const answer: BookItem = {
    entityType: 'answer',
    entityId: 'a1',
    title: '回答：如何评价 RAG？',
    authorName: '答主甲',
    url: 'https://www.zhihu.com/question/1/answer/a1',
    capturedAt: '2026-01-02T03:04:05.000Z',
    contentHtml: '<p>回答正文</p><script>alert(1)</script><img src="images/h1.jpg" onerror="x()">',
    rawJson: RAW_ANSWER,
    questionTitle: '如何评价 RAG？',
  }
  const article: BookItem = {
    entityType: 'article',
    entityId: 'ar1',
    title: '文章：RAG 入门',
    authorName: '作者乙',
    url: 'https://zhuanlan.zhihu.com/p/ar1',
    capturedAt: '2026-01-03T03:04:05.000Z',
    contentHtml: '<p>文章内容</p><a href="https://x.com/?utm_source=zhihu&id=1">链接</a>',
    rawJson: JSON.stringify({ id: 'ar1', title: 'RAG 入门' }),
  }
  return { title: '测试书', items: [answer, article] }
}
