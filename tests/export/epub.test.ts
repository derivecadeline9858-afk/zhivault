import { describe, expect, it } from 'vitest'
import { buildEpub } from '@/core/export/epub'
import { unzipSync } from 'fflate'
import { makeBook } from './helpers'

function entriesOf(data: Uint8Array): [string, Uint8Array][] {
  return Object.entries(unzipSync(data))
}

describe('EPUB 导出（PRD §5.5：mimetype 首条 stored + 署名 dc:creator）', () => {
  it('结构合规且含署名', () => {
    const book = makeBook()
    const [data] = buildEpub(book)
    const entries = entriesOf(data)
    const names = entries.map(([n]) => n)
    expect(names[0]).toBe('mimetype')
    expect(new TextDecoder().decode(entries[0][1])).toBe('application/epub+zip')
    expect(names).toContain('META-INF/container.xml')
    expect(names).toContain('OEBPS/content.opf')
    expect(names).toContain('OEBPS/toc.ncx')
    expect(names).toContain('OEBPS/chapter-1.xhtml')
    expect(names).toContain('OEBPS/chapter-2.xhtml')

    const opf = new TextDecoder().decode(entries.find(([n]) => n === 'OEBPS/content.opf')![1])
    expect(opf).toContain('<dc:creator>橙茶星（知藏 ZhiVault 导出）</dc:creator>')
    expect(opf).toContain('<dc:title>测试书</dc:title>')
    expect(opf).toContain('chapter-1.xhtml')

    const ch1 = new TextDecoder().decode(entries.find(([n]) => n === 'OEBPS/chapter-1.xhtml')![1])
    expect(ch1).toContain('回答正文')
    expect(ch1).not.toContain('<script')
  })

  it('mimetype 以 stored（不压缩）方式打包', () => {
    const book = makeBook()
    const [data] = buildEpub(book)
    // zip local file header: PK\x03\x04, 压缩方式在 offset 8 (2 字节 little-endian)
    expect(data[0]).toBe(0x50)
    expect(data[1]).toBe(0x4b)
    expect(data[2]).toBe(0x03)
    expect(data[3]).toBe(0x04)
    expect(data[8] | (data[9] << 8)).toBe(0)
  })

  it('超过每卷上限自动分卷（默认 10000 条/卷）', () => {
    const book = makeBook()
    const volumes = buildEpub(book, { maxItemsPerVolume: 1 })
    expect(volumes).toHaveLength(2)
    const names1 = entriesOf(volumes[0]).map(([n]) => n)
    const names2 = entriesOf(volumes[1]).map(([n]) => n)
    expect(names1).toContain('OEBPS/chapter-1.xhtml')
    expect(names1).not.toContain('OEBPS/chapter-2.xhtml')
    expect(names2).toContain('OEBPS/chapter-1.xhtml')
  })
})
