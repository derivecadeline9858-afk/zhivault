import { describe, expect, it } from 'vitest'
import { redactLog } from '@/core/security/log-redact'

describe('日志脱敏器（PRD §8-1：键名含 cookie/token 即 redact + 值模式匹配）', () => {
  it.each([
    ['获取 cookie=abc123456 完成', 'cookie=***'],
    ['头 Cookie: z_c0=2|1:f00; d_c0=ghi789', 'Cookie: ***'],
    ['匿名 d_c0=abc123def 已生成', 'd_c0=***'],
    ['登录态 z_c0=2|1:abc 有效', 'z_c0=***'],
    ['Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.token', 'Authorization: ***'],
    ['api_key=sk-1234567890abcdef', 'api_key=***'],
    ['access_token=xyz 过期', 'access_token=***'],
    ['X-API-Key: abcdef123456', 'X-API-Key: ***'],
  ])('脱敏：%s', (line, expectedFragment) => {
    const out = redactLog(line)
    expect(out).toContain(expectedFragment)
    expect(out).not.toMatch(/abc123456|f00|ghi789|eyJhbGciOi|sk-1234567890abcdef|abcdef123456|access_token=xyz/)
  })

  it('URL 查询参数中的 token 被清除', () => {
    const out = redactLog('请求 https://api.zhihu.com/x?token=secret123&limit=20')
    expect(out).not.toContain('secret123')
    expect(out).toContain('limit=20')
  })

  it('多处于一行同时脱敏', () => {
    const out = redactLog('a=1 cookie=aaa b=2 token=bbb')
    expect(out).toBe('a=1 cookie=*** b=2 token=***')
  })

  it('普通日志原样保留', () => {
    const line = 'INFO 采集回答 a1 完成，新增 1 条'
    expect(redactLog(line)).toBe(line)
  })

  it('无敏感参数的 URL 原样保留', () => {
    const line = 'GET https://www.zhihu.com/api/v4/answers/1?limit=20'
    expect(redactLog(line)).toBe(line)
  })

  it('大小写混合键名', () => {
    expect(redactLog('ToKeN=aaa111')).toBe('ToKeN=***')
  })

  it('等号与冒号两种分隔', () => {
    expect(redactLog('token:aaa111')).toBe('token: ***')
  })
})
