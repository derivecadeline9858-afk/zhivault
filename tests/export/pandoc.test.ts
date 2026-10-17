// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXPORT_EMPTY_OUTPUT, PandocQueue, createPandocRunner } from '@/core/export/pandoc'

describe('pandoc 串行队列（PRD §10-4：串行队列 + 空输出判败）', () => {
  it('HTML → GFM（真实 pandoc-wasm）', async () => {
    const run = createPandocRunner()
    const r = await run.convertText('<h1>标题</h1><p>正文 <strong>粗体</strong></p>', 'gfm')
    expect(r).toContain('# 标题')
    expect(r).toContain('**粗体**')
  }, 30_000)

  it('HTML → DOCX 二进制经 files 回传（PK 头且非空）', async () => {
    const run = createPandocRunner()
    const bytes = await run.convertBinary('<p>文档内容</p>', 'docx')
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  }, 30_000)

  it('串行执行：第二个任务等第一个完成', async () => {
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const queue = new PandocQueue({
      async convertText() {
        order.push('start-a')
        await gate
        order.push('end-a')
        return 'a'
      },
      async convertBinary() {
        return new Uint8Array([1])
      },
    })
    const p1 = queue.convertText('x', 'gfm')
    const p2 = queue.convertText('y', 'plain')
    await Promise.resolve()
    expect(order).toEqual(['start-a'])
    release()
    await expect(p1).resolves.toBe('a')
    await expect(p2).resolves.toBe('a')
    expect(order).toEqual(['start-a', 'end-a', 'start-a', 'end-a'])
  })

  it('空输出判败 EXPORT_EMPTY_OUTPUT', async () => {
    const queue = new PandocQueue({ convertText: async () => '', convertBinary: async () => new Uint8Array(0) })
    await expect(queue.convertText('<p>x</p>', 'gfm')).rejects.toMatchObject({ code: EXPORT_EMPTY_OUTPUT })
    await expect(queue.convertBinary('<p>x</p>', 'docx')).rejects.toMatchObject({ code: EXPORT_EMPTY_OUTPUT })
  })
})
