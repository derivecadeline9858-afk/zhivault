import { describe, expect, it } from 'vitest'
import { diffBlocks } from '@/core/reader/diff'

describe('版本并排 diff（PRD §10-8：diff 快照测试）', () => {
  it('新增段落', () => {
    const d = diffBlocks('<p>甲</p>', '<p>甲</p><p>乙</p>')
    expect(d).toEqual([
      { type: 'same', text: '<p>甲</p>' },
      { type: 'add', text: '<p>乙</p>' },
    ])
  })

  it('删除段落', () => {
    const d = diffBlocks('<p>甲</p><p>乙</p>', '<p>甲</p>')
    expect(d).toEqual([
      { type: 'same', text: '<p>甲</p>' },
      { type: 'del', text: '<p>乙</p>' },
    ])
  })

  it('修改段落 = 删旧增新（三色高亮基础）', () => {
    const d = diffBlocks('<p>原文</p><p>不变</p>', '<p>新文</p><p>不变</p>')
    expect(d).toEqual([
      { type: 'del', text: '<p>原文</p>' },
      { type: 'add', text: '<p>新文</p>' },
      { type: 'same', text: '<p>不变</p>' },
    ])
  })

  it('复杂快照：首中尾增删改混合', () => {
    const oldHtml = '<h1>标题</h1><p>一</p><p>二</p><p>三</p><blockquote>尾</blockquote>'
    const newHtml = '<h1>标题新</h1><p>一</p><p>二改</p><p>三</p><p>四</p><blockquote>尾</blockquote>'
    expect(diffBlocks(oldHtml, newHtml)).toEqual([
      { type: 'del', text: '<h1>标题</h1>' },
      { type: 'add', text: '<h1>标题新</h1>' },
      { type: 'same', text: '<p>一</p>' },
      { type: 'del', text: '<p>二</p>' },
      { type: 'add', text: '<p>二改</p>' },
      { type: 'same', text: '<p>三</p>' },
      { type: 'add', text: '<p>四</p>' },
      { type: 'same', text: '<blockquote>尾</blockquote>' },
    ])
  })

  it('块级切分覆盖 p/h/li/blockquote/pre', () => {
    const d = diffBlocks('<ul><li>项</li></ul><pre>code</pre>', '<ul><li>项2</li></ul><pre>code</pre>')
    expect(d).toEqual([
      { type: 'del', text: '<ul><li>项</li></ul>' },
      { type: 'add', text: '<ul><li>项2</li></ul>' },
      { type: 'same', text: '<pre>code</pre>' },
    ])
  })
})
