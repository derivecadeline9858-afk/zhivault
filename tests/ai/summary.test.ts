import { describe, expect, it } from 'vitest'
import { buildSummaryMessages, generateSummary, parseSummaryOutput, stripHtml } from '@/core/ai/summary'
import type { OpenAIClient } from '@/core/ai/openai'

describe('摘要/标签生成（PRD §10-9）', () => {
  it('stripHtml 去标签留文本', () => {
    expect(stripHtml('<p>甲<b>乙</b></p><p>丙</p>')).toBe('甲乙丙')
  })

  it('prompt 要求 JSON 输出且限制摘要长度', () => {
    const msgs = buildSummaryMessages('标题', '正文内容')
    const sys = msgs.find((m) => m.role === 'system')?.content ?? ''
    expect(sys).toContain('JSON')
    expect(sys).toContain('summary')
    expect(sys).toContain('tags')
    const user = msgs.find((m) => m.role === 'user')?.content ?? ''
    expect(user).toContain('标题')
    expect(user).toContain('正文内容')
  })

  it('parseSummaryOutput 解析 ```json 围栏', () => {
    const r = parseSummaryOutput('```json\n{"summary":"好","tags":["甲","乙"]}\n```')
    expect(r).toEqual({ summary: '好', tags: ['甲', '乙'] })
  })

  it('非 JSON 降级：摘要截断 + 空标签', () => {
    const r = parseSummaryOutput('这是一段普通回答'.repeat(20))
    expect(r.summary.length).toBeLessThanOrEqual(120)
    expect(r.tags).toEqual([])
  })

  it('generateSummary 全链路（mock client）', async () => {
    const client: OpenAIClient = {
      chat: async () => ({
        content: '{"summary":"核心观点","tags":["RAG","备份"]}',
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    }
    const r = await generateSummary(client, { title: '题', html: '<p>内容</p>' })
    expect(r).toEqual({ summary: '核心观点', tags: ['RAG', '备份'], usage: { promptTokens: 10, completionTokens: 5 } })
  })
})
