import { ZhiVaultError } from '@/core/fetch/errors'

const normalize = (p: string): string[] =>
  p
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg !== '' && seg !== '.')

/** 输出路径解析：resolve 后必须位于根目录内（PRD §8-5 路径穿越校验） */
export function resolveSafe(root: string, rel: string): string {
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(rel)) {
    throw new ZhiVaultError('PATH_TRAVERSAL', `PATH_TRAVERSAL：路径穿越——禁止使用绝对路径（${rel}）`)
  }
  const rootSegs = normalize(root)
  const stack = [...rootSegs]
  for (const seg of normalize(rel)) {
    if (seg === '..') {
      if (stack.length === 0 || stack.length === rootSegs.length) {
        throw new ZhiVaultError('PATH_TRAVERSAL', `PATH_TRAVERSAL：路径穿越——越出输出根目录（${rel}）`)
      }
      stack.pop()
    } else {
      stack.push(seg)
    }
  }
  return stack.join('/')
}
