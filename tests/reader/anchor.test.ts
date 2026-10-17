import { describe, expect, it } from 'vitest'
import { locateAnchor } from '@/core/reader/anchor'

const CONTENT_V1 = '<p>前导内容</p><p>目标段落的首句与关键论点都在这</p><p>结尾</p>'

describe('标注跨版本定位（PRD §0 UI-2：前后缀指纹 + 段落级降级）', () => {
  it('内容未变：精确命中', () => {
    const prefix = '目标段落的首句'
    const suffix = '关键论点都在这'
    const r = locateAnchor(CONTENT_V1, prefix, suffix)
    expect(r.status).toBe('exact')
    // index 为纯文本坐标（去标签后的文本空间）
    expect(r.index).toBe(4)
  })

  it('选文中间被小幅修改：前后指纹仍定位（降级可用）', () => {
    // 选中"目标段落的首句……关键论点都在这"，中间被插入新词
    const edited = '<p>前导内容</p><p>目标段落的首句与关键论点（改）都在这</p><p>结尾</p>'
    const r = locateAnchor(edited, '目标段落的首句', '关键论点都在这')
    expect(r.status).toBe('paragraph')
    expect(r.index).toBeGreaterThanOrEqual(0)
  })

  it('内容大幅修改：定位失败并提示', () => {
    const rewritten = '<p>前导内容</p><p>完全不同的新段落</p><p>结尾</p>'
    const r = locateAnchor(rewritten, '目标段落的首句', '关键论点都在这')
    expect(r.status).toBe('missing')
    expect(r.message).toContain('内容已被大幅修改')
  })

  it('前缀命中但后缀缺失：段落级降级', () => {
    const edited = '<p>目标段落的首句之后被整段重写</p>'
    const r = locateAnchor(edited, '目标段落的首句', '不存在的后缀')
    expect(r.status).toBe('paragraph')
  })

  it('短选文指纹即全文', () => {
    const r = locateAnchor('<p>短句</p>', '短句', '短句')
    expect(r.status).toBe('exact')
  })
})
