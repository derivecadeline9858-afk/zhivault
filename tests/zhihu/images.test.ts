import { describe, expect, it, vi } from 'vitest'
import { processContentImages } from '@/core/zhihu/images'
import type { ImageDownloader } from '@/core/zhihu/images'

const HTML = '<p><img src="https://pic1.zhimg.com/v2-abc_r.jpg"></p><img src="https://pic2.zhimg.com/v2-def_r.jpg">'

describe('图片三档（PRD §4/§5.1：原图/压缩 WebP/无图 + 跨任务去重）', () => {
  it('无图档：剥掉全部 img', async () => {
    const download = vi.fn<ImageDownloader>()
    const r = await processContentImages(HTML, { mode: 'none', download })
    expect(r.html).not.toContain('<img')
    expect(r.downloaded).toBe(0)
    expect(download).not.toHaveBeenCalled()
  })

  it('原图档：下载并改写为本地相对路径', async () => {
    const download = vi.fn<ImageDownloader>(async (url) => ({ fileName: `${url.includes('abc') ? 'aaa' : 'bbb'}.jpg` }))
    const r = await processContentImages(HTML, { mode: 'original', download })
    expect(r.downloaded).toBe(2)
    expect(r.html).toContain('images/aaa.jpg')
    expect(r.html).toContain('images/bbb.jpg')
    expect(r.html).not.toContain('zhimg.com')
  })

  it('压缩 WebP 档：文件名用 .webp', async () => {
    const download = vi.fn<ImageDownloader>(async (url) => ({ fileName: `${url.includes('abc') ? 'aaa' : 'bbb'}.webp` }))
    const r = await processContentImages(HTML, { mode: 'webp', download })
    expect(r.html).toContain('images/aaa.webp')
    expect(download).toHaveBeenCalledTimes(2)
  })

  it('跨任务去重：图片池已存在则跳过下载', async () => {
    const pool = new Set<string>()
    const download = vi.fn<ImageDownloader>(async (_url, fileName) => {
      pool.add(fileName)
      return { fileName }
    })
    const first = await processContentImages(HTML, { mode: 'original', download })
    expect(first.downloaded).toBe(2)
    download.mockClear()

    const second = await processContentImages(HTML, { mode: 'original', download, exists: async (f) => pool.has(f) })
    expect(download).not.toHaveBeenCalled()
    expect(second.reused).toBe(2)
    expect(second.html).toContain('images/')
  })

  it('下载失败保留原图 URL 不破坏正文', async () => {
    const download = vi.fn<ImageDownloader>(async () => null)
    const r = await processContentImages(HTML, { mode: 'original', download })
    expect(r.html).toContain('https://pic1.zhimg.com/v2-abc_r.jpg')
    expect(r.failed).toBe(2)
  })
})
