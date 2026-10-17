import { describe, expect, it } from 'vitest'
import { canCapture, requiredLoginLevel } from '@/core/zhihu/visibility'

describe('匿名/登录可见性矩阵（PRD §0 审查-5）', () => {
  it('匿名可采：公开回答/文章/想法/问题/专栏/话题/公开收藏夹/用户公开创作', () => {
    const anonymousOk = [
      ['answer', undefined],
      ['article', undefined],
      ['pin', undefined],
      ['question', undefined],
      ['collection', undefined],
      ['column', undefined],
      ['topic', undefined],
      ['user', 'created'],
    ] as const
    for (const [type, subMode] of anonymousOk) {
      expect(canCapture(type, subMode, false)).toBe(true)
      expect(requiredLoginLevel(type, subMode)).toBe('anonymous')
    }
  })

  it('需登录：用户赞同动态', () => {
    expect(canCapture('user', 'activities', false)).toBe(false)
    expect(canCapture('user', 'activities', true)).toBe(true)
    expect(requiredLoginLevel('user', 'activities')).toBe('login')
  })

  it('未提供 subMode 的 user 默认 created（匿名可采公开创作）', () => {
    expect(requiredLoginLevel('user')).toBe('anonymous')
    expect(canCapture('user', undefined, false)).toBe(true)
  })
})
