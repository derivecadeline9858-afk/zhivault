import { describe, expect, it } from 'vitest'
import { parseZhihuUrl } from '@/core/zhihu/url-parser'
import { INVALID_URL, ZhiVaultError } from '@/core/zhihu/errors'

describe('URL 解析器（PRD §10-3：7+1 类实体 + 报错）', () => {
  it.each([
    ['https://www.zhihu.com/question/123/answer/456', { type: 'answer', id: '456', questionId: '123' }],
    ['https://www.zhihu.com/question/123', { type: 'question', id: '123' }],
    ['https://www.zhihu.com/question/123?utm_source=wechat&si=xxx', { type: 'question', id: '123' }],
    ['https://www.zhihu.com/p/789', { type: 'article', id: '789' }],
    ['https://zhuanlan.zhihu.com/p/789', { type: 'article', id: '789' }],
    ['https://www.zhihu.com/pin/111', { type: 'pin', id: '111' }],
    ['https://www.zhihu.com/collection/222', { type: 'collection', id: '222' }],
    ['https://www.zhihu.com/column/333', { type: 'column', id: '333' }],
    ['https://www.zhihu.com/topic/444/hot', { type: 'topic', id: '444' }],
    ['https://www.zhihu.com/people/token-abc/activities', { type: 'user', id: 'token-abc' }],
    ['https://www.zhihu.com/people/token-abc', { type: 'user', id: 'token-abc' }],
  ])('解析 %s', (url, expected) => {
    expect(parseZhihuUrl(url)).toEqual(expected)
  })

  it('剥掉查询串与 hash', () => {
    expect(parseZhihuUrl('https://www.zhihu.com/question/123/answer/456?si=1#detail')).toEqual({
      type: 'answer',
      id: '456',
      questionId: '123',
    })
  })

  it('非知乎域名报 INVALID_URL', () => {
    const err = (() => {
      try {
        parseZhihuUrl('https://www.baidu.com/question/123')
      } catch (e) {
        return e as ZhiVaultError
      }
      throw new Error('should throw')
    })()
    expect(err).toBeInstanceOf(ZhiVaultError)
    expect(err.code).toBe(INVALID_URL)
  })

  it('知乎但无法归类报 INVALID_URL', () => {
    expect(() => parseZhihuUrl('https://www.zhihu.com/')).toThrowError(
      expect.objectContaining({ code: INVALID_URL }),
    )
    expect(() => parseZhihuUrl('https://www.zhihu.com/notifications')).toThrowError(
      expect.objectContaining({ code: INVALID_URL }),
    )
  })
})
