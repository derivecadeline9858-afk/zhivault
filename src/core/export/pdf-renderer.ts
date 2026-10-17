import { invoke } from '@tauri-apps/api/core'

import { ZhiVaultError } from '@/core/fetch/errors'
import type { BookSource } from './book'
import { renderBookHtml } from './html'

export const PDF_NO_EDGE = 'PDF_NO_EDGE'

/** 应用内 PDF 渲染器：检测系统 Edge → 无头打印（缺失降级由报告 partial 呈现） */
export function createEdgePdfRenderer(rootDir: string): (book: BookSource) => Promise<string[]> {
  return async (book) => {
    const edge = await invoke<string | null>('detect_edge').catch(() => null)
    if (!edge) {
      throw new ZhiVaultError(PDF_NO_EDGE, 'PDF_NO_EDGE：未检测到系统 Edge，已记录 partial（可安装 Edge 后重试）')
    }
    const html = renderBookHtml(book)
    const rel = await invoke<string>('print_pdf', { root: rootDir, bookDir: book.title, html })
    return [rel]
  }
}
