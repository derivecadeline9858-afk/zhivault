// OpenAI 兼容客户端（PRD §10-9；DeepSeek/OpenAI 皆兼容 /chat/completions）
// 安全：apiKey 仅出现在 Authorization 头（日志脱敏器已遮蔽该类头），本模块不做任何日志输出。
import { ZhiVaultError } from '@/core/fetch/errors'

export const AI_REQUEST_FAILED = 'AI_REQUEST_FAILED'
export const AI_EMPTY_RESPONSE = 'AI_EMPTY_RESPONSE'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
}

export interface ChatResult {
  content: string
  usage: ChatUsage
}

export interface OpenAIClient {
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResult>
}

export function createOpenAIClient(deps: {
  apiKey: string
  baseUrl?: string
  model: string
  fetchImpl?: typeof fetch
}): OpenAIClient {
  const baseUrl = (deps.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '')
  const fetchImpl = deps.fetchImpl ?? fetch
  return {
    async chat(messages, opts = {}) {
      let res: Response
      try {
        res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${deps.apiKey}`,
          },
          body: JSON.stringify({
            model: deps.model,
            messages,
            temperature: opts.temperature ?? 0.3,
          }),
        })
      } catch (e) {
        throw new ZhiVaultError(AI_REQUEST_FAILED, `AI_REQUEST_FAILED：${(e as Error).message ?? '网络异常'}`, {
          cause: e,
        })
      }
      if (!res.ok) {
        throw new ZhiVaultError(AI_REQUEST_FAILED, `AI_REQUEST_FAILED：HTTP ${res.status}`, {
          httpStatus: res.status,
        })
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      const content = data.choices?.[0]?.message?.content ?? ''
      if (!content.trim()) {
        throw new ZhiVaultError(AI_EMPTY_RESPONSE, 'AI_EMPTY_RESPONSE：模型返回空内容')
      }
      return {
        content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
        },
      }
    },
  }
}
