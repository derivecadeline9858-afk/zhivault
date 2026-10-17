// 标注锚定（PRD §0 UI-2）：选中文本的前 32/后 32 字符指纹在当前版本内容中定位；
// 精确命中失败降级段落级（前缀命中），全失效提示"内容已被大幅修改"。

export interface AnchorResult {
  status: 'exact' | 'paragraph' | 'missing'
  index: number
  message?: string
}

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '')

export function locateAnchor(contentHtml: string, prefix: string, suffix: string): AnchorResult {
  const text = stripTags(contentHtml)
  const p = prefix || suffix
  const s = suffix || prefix
  if (!p) return { status: 'missing', index: -1, message: '内容已被大幅修改，无法定位标注' }

  const pi = text.indexOf(p)
  if (pi < 0) {
    return { status: 'missing', index: -1, message: '内容已被大幅修改，无法定位标注（段落级锚点亦失效）' }
  }
  if (p === s) return { status: 'exact', index: pi }

  const si = text.indexOf(s, pi + p.length)
  return si >= 0
    ? { status: 'exact', index: pi }
    : { status: 'paragraph', index: pi, message: '内容已被修改，已降级到段落级锚点' }
}
