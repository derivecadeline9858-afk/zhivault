import type { Fetcher } from '@/core/zhihu/fetcher'

const author = (token: string, name: string) => ({ id: `id-${token}`, url_token: token, name, avatar_url: `https://pic1.zhimg.com/${token}` })

const mkAnswer = (id: string, title: string, content: string) => ({
  id,
  content: `<p>${content}</p><img src="https://pic1.zhimg.com/demo-${id}.jpg">`,
  created_time: 1700000000,
  voteup_count: 42,
  comment_count: 3,
  question: { id: `q-${id}`, title, detail: '<p>演示问题描述</p>', created_time: 1699999999, answer_count: 1, follower_count: 7, author: author('demo-asker', '演示提问者') },
  author: author('demo-author', '演示答主'),
})

const FIXTURES: Record<string, unknown> = {
  'answers/demo-1': mkAnswer('demo-1', '什么是好的知识管理工具？', '演示回答一：本地优先、数据可迁移是底线。'),
  'answers/demo-2': mkAnswer('demo-2', '如何备份知乎收藏夹？', '演示回答二：增量采集 + 版本历史，被删也能找回来。'),
  'questions/demo-q': { id: 'demo-q', title: '演示整问题', detail: '<p>详情</p>', created_time: 1700000000, answer_count: 2, follower_count: 9, author: author('demo-asker', '演示提问者') },
  'questions/demo-q/answers': {
    data: [mkAnswer('demo-1', '什么是好的知识管理工具？', '演示回答一：本地优先、数据可迁移是底线。'), mkAnswer('demo-2', '如何备份知乎收藏夹？', '演示回答二：增量采集 + 版本历史，被删也能找回来。')],
    paging: { is_end: true },
  },
  'articles/demo-ar1': { id: 'demo-ar1', title: '演示文章：RAG 入门', content: '<p>演示文章内容，向量检索与全文检索互补。</p>', created: 1700000001, voteup_count: 15, comment_count: 2, author: author('demo-author', '演示答主') },
  'pins/demo-p1': { id: 'demo-p1', content: '<p>演示想法：今天的咖啡很好喝。</p>', created: 1700000002, like_count: 6, comment_count: 1, author: author('demo-author', '演示答主') },
}

/** 演示数据 fetcher：按 URL 路径返回罐头数据（真实模式需签名桥，联调期启用） */
export function createDemoFetcher(): Fetcher {
  return {
    async fetchJson(url: string) {
      const path = new URL(url).pathname.replace('/api/v4/', '')
      const hit = FIXTURES[path]
      if (hit === undefined) {
        // 未收录的 answer/article/pin 泛化生成
        const m = /^(answers|articles|pins)\/([\w-]+)/.exec(path)
        if (m?.[1] === 'answers') return mkAnswer(m[2], '演示问题（泛化）', `演示回答（${m[2]}）`)
        if (m?.[1] === 'articles')
          return { id: m[2], title: `演示文章（${m[2]}）`, content: '<p>演示文章内容</p>', created: 1700000000, voteup_count: 1, comment_count: 0, author: author('demo-author', '演示答主') }
        if (m?.[1] === 'pins')
          return { id: m[2], content: `<p>演示想法（${m[2]}）</p>`, created: 1700000000, like_count: 0, comment_count: 0, author: author('demo-author', '演示答主') }
        throw new Error(`演示数据未收录：${path}`)
      }
      return hit
    },
  }
}
