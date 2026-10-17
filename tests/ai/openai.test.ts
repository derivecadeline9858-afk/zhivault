import { describe, expect, it, vi } from 'vitest'
import { AI_EMPTY_RESPONSE, AI_REQUEST_FAILED, createOpenAIClient } from '@/core/ai/openai'

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    void init
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
}

const chatBody = {
  choices: [{ message: { content: '摘要结果' } }],
  usage: { prompt_tokens: 100, completion_tokens: 20 },
}

describe('OpenAI 兼容客户端（PRD §10-9：mock API 单测）', () => {
  it('成功请求：解析内容与用量', async () => {
    const f = fakeFetch(chatBody)
    const client = createOpenAIClient({ apiKey: 'sk-test', model: 'deepseek-chat', fetchImpl: f })
    const r = await client.chat([{ role: 'user', content: 'hi' }])
    expect(r.content).toBe('摘要结果')
    expect(r.usage).toEqual({ promptTokens: 100, completionTokens: 20 })
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('/chat/completions')
  })

  it('自定义 baseUrl 与模型入体', async () => {
    const f = fakeFetch(chatBody)
    const client = createOpenAIClient({
      apiKey: 'k',
      baseUrl: 'https://api.example.com/v1',
      model: 'm1',
      fetchImpl: f,
    })
    await client.chat([{ role: 'user', content: 'x' }])
    const call = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(call[0])).toBe('https://api.example.com/v1/chat/completions')
    expect(JSON.parse(String(call[1].body))).toMatchObject({ model: 'm1' })
  })

  it('HTTP 错误结构化 AI_REQUEST_FAILED', async () => {
    const f = fakeFetch({ error: 'bad key' }, 401)
    const client = createOpenAIClient({ apiKey: 'k', model: 'm', fetchImpl: f })
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      code: AI_REQUEST_FAILED,
      httpStatus: 401,
    })
  })

  it('空响应判败 AI_EMPTY_RESPONSE', async () => {
    const f = fakeFetch({ choices: [{ message: { content: '  ' } }], usage: { prompt_tokens: 1, completion_tokens: 0 } })
    const client = createOpenAIClient({ apiKey: 'k', model: 'm', fetchImpl: f })
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: AI_EMPTY_RESPONSE })
  })

  it('网络异常包装为 AI_REQUEST_FAILED', async () => {
    const f = (async () => {
      throw new Error('dns fail')
    }) as unknown as typeof fetch
    const client = createOpenAIClient({ apiKey: 'k', model: 'm', fetchImpl: f })
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: AI_REQUEST_FAILED })
  })
})
