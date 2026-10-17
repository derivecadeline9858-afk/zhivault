// 结构化错误码（PRD §10-2）：外部模块依赖这些常量做分支，禁止改名
export const SIGNATURE_UNAVAILABLE = 'SIGNATURE_UNAVAILABLE'
export const RATE_LIMITED = 'RATE_LIMITED'
export const RISK_CONTROL = 'RISK_CONTROL'
export const FORBIDDEN = 'FORBIDDEN'
export const NOT_FOUND = 'NOT_FOUND'
export const TIMEOUT = 'TIMEOUT'
export const NETWORK_ERROR = 'NETWORK_ERROR'
export const INVALID_RESPONSE = 'INVALID_RESPONSE'

export class ZhiVaultError extends Error {
  readonly code: string
  readonly httpStatus?: number
  readonly url?: string

  constructor(
    code: string,
    message?: string,
    opts: { httpStatus?: number; url?: string; cause?: unknown } = {},
  ) {
    super(message ?? code, { cause: opts.cause })
    this.name = 'ZhiVaultError'
    this.code = code
    this.httpStatus = opts.httpStatus
    this.url = opts.url
  }
}

/** HTTP 状态 → 结构化错误码 */
export function classifyHttpError(status: number, url?: string): ZhiVaultError {
  const code =
    status === 429 ? RATE_LIMITED : status === 403 ? FORBIDDEN : status === 404 ? NOT_FOUND : `HTTP_${status}`
  return new ZhiVaultError(code, `${code}（HTTP ${status}）`, { httpStatus: status, url })
}

/** 知乎风控文案特征（PRD §7.4-2：命中即自动退避） */
const RISK_PATTERNS = [/风控/, /安全验证/, /系统检测.*异常/, /操作过于频繁/]

export function isRiskControlText(text: string): boolean {
  return RISK_PATTERNS.some((p) => p.test(text))
}
