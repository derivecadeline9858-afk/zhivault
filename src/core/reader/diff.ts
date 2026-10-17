// 版本并排 diff：按块级元素切分后 LCS（增/删/同三色基础）

export interface DiffBlock {
  type: 'same' | 'add' | 'del'
  text: string
}

const BLOCK_RE =
  /<(?:h[1-6]|ul|ol|p|blockquote|pre)\b[^>]*>[\s\S]*?<\/(?:h[1-6]|ul|ol|p|blockquote|pre)>|<li\b[^>]*>[\s\S]*?<\/li>/gi

export function splitBlocks(html: string): string[] {
  const blocks = html.match(BLOCK_RE) ?? []
  // 未匹配到块级元素时整体作为一个块，避免内容丢失
  return blocks.length > 0 ? blocks : [html]
}

/** 块级 LCS diff；修改表现为相邻的 del+add（并排视图左侧删右侧增） */
export function diffBlocks(oldHtml: string, newHtml: string): DiffBlock[] {
  const a = splitBlocks(oldHtml)
  const b = splitBlocks(newHtml)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffBlock[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}
