import { describe, expect, it } from 'vitest'
import { RATE_LIMITED, RISK_CONTROL, ZhiVaultError, classifyHttpError, isRiskControlText } from '@/core/fetch/errors'

describe('结构化错误码（PRD §10-2）', () => {
  it('HTTP 状态映射', () => {
    expect(classifyHttpError(429).code).toBe(RATE_LIMITED)
    expect(classifyHttpError(403).code).toBe('FORBIDDEN')
    expect(classifyHttpError(404).code).toBe('NOT_FOUND')
    expect(classifyHttpError(418).code).toBe('HTTP_418')
  })

  it('携带 httpStatus 与 url', () => {
    const e = classifyHttpError(429, 'https://www.zhihu.com/api/v4/x')
    expect(e).toBeInstanceOf(ZhiVaultError)
    expect(e.httpStatus).toBe(429)
    expect(e.url).toBe('https://www.zhihu.com/api/v4/x')
  })

  it('风控文案识别（PRD §7.4-2 风控自动退避）', () => {
    expect(isRiskControlText('系统检测到你的操作存在异常，请完成安全验证')).toBe(true)
    expect(isRiskControlText('访问频率过快，已触发风控')).toBe(true)
    expect(isRiskControlText('<p>正常回答正文</p>')).toBe(false)
    expect(isRiskControlText('')).toBe(false)
  })

  it('错误码常量稳定（外部依赖此值做分支）', () => {
    expect(RATE_LIMITED).toBe('RATE_LIMITED')
    expect(RISK_CONTROL).toBe('RISK_CONTROL')
  })
})
