import { hashContent } from '@/core/store/hash'

export type ImageMode = 'original' | 'webp' | 'none'

/** 下载并落盘一张图，返回文件名；失败返回 null（保留原 URL） */
export interface ImageDownloader {
  (url: string, fileName: string): Promise<{ fileName: string } | null>
}

export interface ProcessImagesOptions {
  mode: ImageMode
  download: ImageDownloader
  /** 跨任务去重：图片池已存在该文件则跳过下载 */
  exists?: (fileName: string) => Promise<boolean>
}

export interface ProcessImagesResult {
  html: string
  downloaded: number
  reused: number
  failed: number
}

const IMG_RE = /<img\b[^>]*?\bsrc="([^"]+)"[^>]*>/gi

function extOf(url: string, mode: ImageMode): string {
  if (mode === 'webp') return '.webp'
  const m = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.exec(url)
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg'
}

/**
 * 图片三档处理（PRD §4/§5.1）。
 * 原图/压缩 WebP：下载入池（URL 哈希命名，跨任务去重），src 改写为 images/ 相对路径；
 * 无图：剥掉 img 标签。下载失败保留原 URL 不破坏正文。
 */
export async function processContentImages(
  html: string,
  opts: ProcessImagesOptions,
): Promise<ProcessImagesResult> {
  if (opts.mode === 'none') {
    return { html: html.replace(IMG_RE, ''), downloaded: 0, reused: 0, failed: 0 }
  }
  const matches = [...html.matchAll(IMG_RE)]
  if (matches.length === 0) return { html, downloaded: 0, reused: 0, failed: 0 }

  let downloaded = 0
  let reused = 0
  let failed = 0

  const results = await Promise.all(
    matches.map(async (m) => {
      const url = m[1]
      const hash = (await hashContent(url)).slice(0, 24)
      const fileName = `${hash}${extOf(url, opts.mode)}`
      if (await opts.exists?.(fileName)) {
        reused++
        return { src: `images/${fileName}` }
      }
      const r = await opts.download(url, fileName).catch(() => null)
      if (!r) {
        failed++
        return { src: url }
      }
      downloaded++
      return { src: `images/${r.fileName}` }
    }),
  )

  let i = 0
  const finalHtml = html.replace(IMG_RE, (tag, src: string) => {
    const r = results[i++]
    return r.src === src ? tag : tag.replace(src, r.src)
  })
  return { html: finalHtml, downloaded, reused, failed }
}
