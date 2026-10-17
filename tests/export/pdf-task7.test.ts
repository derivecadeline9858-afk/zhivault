import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportEngine } from '@/core/export/engine'
import { createTestStore } from '../store/helpers'
import { RunStore } from '@/lib/run-store'
import { BrowserDemoStore } from '@/lib/browser-demo-store'
import { createDemoFetcher } from '@/lib/demo-fixtures'
import { MemorySink, makeBook } from '../export/helpers'

describe('PDF 渲染器注入（PRD §10-7）', () => {
  it('注入 renderer：pdf 格式成功', async () => {
    const sink = new MemorySink()
    const renderer = vi.fn(async () => ['测试书/pdf/测试书.pdf'])
    const engine = new ExportEngine({ sink, appVersion: '0.1.0', pdfRenderer: renderer })
    const report = await engine.exportBook(makeBook(), ['pdf'])
    expect(report.status).toBe('success')
    expect(renderer).toHaveBeenCalledTimes(1)
    expect(report.results[0]).toMatchObject({ format: 'pdf', status: 'success', files: ['测试书/pdf/测试书.pdf'] })
  })

  it('未注入：PDF_DEFERRED partial（浏览器降级语义保留）', async () => {
    const sink = new MemorySink()
    const engine = new ExportEngine({ sink, appVersion: '0.1.0' })
    const report = await engine.exportBook(makeBook(), ['pdf'])
    expect(report.status).toBe('failed')
    expect(report.results[0].error?.code).toBe('PDF_DEFERRED')
  })
})

describe('监控命中系统通知（PRD §10-7）', () => {
  let store: Awaited<ReturnType<typeof createTestStore>>

  beforeEach(async () => {
    store = await createTestStore()
  })

  it('有新增/更新时触发通知', async () => {
    const notify = vi.fn(async (_t: string, _b: string) => {})
    const rs = new RunStore({ store, fetcherFactory: () => createDemoFetcher(), notifier: { notify } })
    rs.setDemoMode(true)
    rs.addTask('https://www.zhihu.com/question/1/answer/demo-1')
    await rs.start()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toContain('知藏')
  })

  it('零命中不通知', async () => {
    const notify = vi.fn(async (_t: string, _b: string) => {})
    const rs = new RunStore({
      store,
      fetcherFactory: () => ({
        fetchJson: async () => {
          throw new Error('全部失败')
        },
      }),
      notifier: { notify },
    })
    rs.addTask('https://www.zhihu.com/question/1/answer/a1')
    await rs.start()
    expect(notify).not.toHaveBeenCalled()
  })

  it('BrowserDemoStore 走通 demo fetcher（组合冒烟）', async () => {
    const rs = new RunStore({ store: new BrowserDemoStore(), fetcherFactory: () => createDemoFetcher() })
    rs.addTask('https://www.zhihu.com/question/1/answer/demo-2')
    await rs.start()
    expect(rs.state.tasks[0].status).toBe('done')
  })
})
