import { strToU8, zipSync, type Zippable } from 'fflate'

import type { BookItem, BookSource } from './book'
import { sanitizeHtml } from './sanitize'

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const XHTML_NS = 'http://www.w3.org/1999/xhtml'

function chapterHtml(item: BookItem): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><title>${escapeXml(item.title)}</title></head>
<body>
<h1>${escapeXml(item.title)}</h1>
<p class="meta">${escapeXml([item.authorName, item.url].filter(Boolean).join(' · '))}</p>
<div>${sanitizeHtml(item.contentHtml)}</div>
</body>
</html>
`
}

function buildVolume(book: BookSource, items: BookItem[], volumeNo: number, volumeCount: number): Uint8Array {
  const title = volumeCount > 1 ? `${book.title}（第 ${volumeNo} 卷）` : book.title
  const chapters = items.map((_, i) => `OEBPS/chapter-${i + 1}.xhtml`)

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">zhivault-${Date.now()}-v${volumeNo}</dc:identifier>
<dc:title>${escapeXml(title)}</dc:title>
<dc:creator>橙茶星（知藏 ZhiVault 导出）</dc:creator>
<dc:language>zh-CN</dc:language>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
</metadata>
<manifest>
<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${chapters.map((_, i) => `<item id="ch${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine toc="toc">
${chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('\n')}
</spine>
</package>
`

  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="zhivault-${volumeNo}"/></head>
<docTitle><text>${escapeXml(title)}</text></docTitle>
<navMap>
${items
  .map(
    (item, i) => `  <navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(item.title)}</text></navLabel><content src="chapter-${i + 1}.xhtml"/></navPoint>`,
  )
  .join('\n')}
</navMap>
</ncx>
`

  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`

  const files: Zippable = {
    // mimetype 必须首条且 stored（不压缩）——EPUB 规范硬性要求
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(container),
    'OEBPS/content.opf': strToU8(opf),
    'OEBPS/toc.ncx': strToU8(ncx),
  }
  items.forEach((item, i) => {
    files[`OEBPS/chapter-${i + 1}.xhtml`] = strToU8(chapterHtml(item))
  })
  return zipSync(files, { level: 6 })
}

/** EPUB 3 打包（PRD §5.5：mimetype 首条 stored、OPF/NCX、署名 dc:creator、≤10000 条/卷） */
export function buildEpub(
  book: BookSource,
  opts: { maxItemsPerVolume?: number } = {},
): Uint8Array[] {
  const max = opts.maxItemsPerVolume ?? 10_000
  const volumes: Uint8Array[] = []
  for (let start = 0; start < book.items.length; start += max) {
    const items = book.items.slice(start, start + max)
    volumes.push(buildVolume(book, items, volumes.length + 1, Math.ceil(book.items.length / max)))
  }
  return volumes
}
