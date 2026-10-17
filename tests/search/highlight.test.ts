import { describe, expect, it } from 'vitest'
import { extractTerms, highlightText } from '@/core/search/highlight'

describe('检索高亮（PRD §10-8：中文分词高亮单测）', () => {
  it('中文整词高亮（trigram 语义：查询词整体命中）', () => {
    const out = highlightText('知乎是一个中文问答社区', ['中文问答'])
    expect(out).toBe('知乎是一个<mark>中文问答</mark>社区')
  })

  it('多词命中多处', () => {
    const out = highlightText('全文检索与增量备份，检索要快', ['检索'])
    expect(out).toBe('全文<mark>检索</mark>与增量备份，<mark>检索</mark>要快')
  })

  it('大小写不敏感（英文词）', () => {
    expect(highlightText('RAG 架构与 rag 实践', ['RAG'])).toBe('<mark>RAG</mark> 架构与 <mark>rag</mark> 实践')
  })

  it('HTML 特殊字符先转义再高亮（防注入）', () => {
    const out = highlightText('<b>检索</b> & "引号"', ['检索'])
    expect(out).not.toContain('<b>')
    expect(out).toContain('&lt;b&gt;<mark>检索</mark>&lt;/b&gt;')
  })

  it('无命中原样返回（已转义）', () => {
    expect(highlightText('a<b', ['不存在的词'])).toBe('a&lt;b')
  })

  it('extractTerms：空白切分 + 过滤空串与短词', () => {
    expect(extractTerms('  全文检索   RAG  ab ', { minLength: 3 })).toEqual(['全文检索', 'RAG'])
  })
})
