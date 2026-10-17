// 摘要/标签生成（PRD §10-9）：HTML→纯文本→OpenAI 兼容调用→JSON 解析（围栏容错/降级）
import type { ChatMessage, OpenAIClient } from './openai'

export const stripHtml = (html: string): string =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function buildSummaryMessages(title: string, text: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是知识管理助手。对给定内容输出严格 JSON：{"summary":"120字以内的中文摘要","tags":["3-5个标签"]}。只输出 JSON，不要多余文字。',
    },
    { role: 'user', content: `标题：${title}\n\n正文：${text.slice(0, 6000)}` },
  ]
}

export interface SummaryResult {
  summary: string
  tags: string[]
}

export function parseSummaryOutput(content: string): SummaryResult {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const obj = JSON.parse(trimmed) as { summary?: unknown; tags?: unknown }
    if (typeof obj.summary === 'string') {
      return {
        summary: obj.summary.slice(0, 120),
        tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 8) : [],
      }
    }
  } catch {
    // 降级
  }
  return { summary: stripHtml(content).slice(0, 120), tags: [] }
}

export async function generateSummary(
  client: OpenAIClient,
  entity: { title: string; html: string },
): Promise<SummaryResult & { usage: { promptTokens: number; completionTokens: number } }> {
  const text = stripHtml(entity.html)
  const r = await client.chat(buildSummaryMessages(entity.title, text))
  return { ...parseSummaryOutput(r.content), usage: r.usage }
}
