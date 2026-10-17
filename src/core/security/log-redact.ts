// 日志脱敏器（PRD §8-1：键名含 cookie/token 即 redact + 值模式匹配；全链路日志出口统一走这里）

const KEY = '(?:[A-Za-z_][\\w.-]*?)?(?:cookie|token|d_c0|z_c0|api[-_]?key|ai[-_]?key|openai[-_]?key|session|secret)[\\w.-]*'
const VALUE = '[\\w|.:~+-]+'

const EQ_RE = new RegExp(`(${KEY})(\\s*=\\s*)(${VALUE})`, 'gi')
const COLON_RE = new RegExp(`(${KEY})(\\s*:\\s*)(${VALUE})`, 'gi')
const AUTH_RE = /(\bAuthorization\s*:\s*).*/gi
const COOKIE_HDR_RE = /(\bCookie\s*:\s*)[^;]*/gi

/** 脱敏一条日志：Authorization/Cookie 头整值遮蔽，敏感键的等号/冒号值替换为 *** */
export function redactLog(line: string): string {
  return line
    .replace(AUTH_RE, '$1***')
    .replace(COOKIE_HDR_RE, '$1***')
    .replace(EQ_RE, '$1=***')
    .replace(COLON_RE, '$1: ***')
}
