import { beforeEach, describe, expect, it } from 'vitest'
import { RunStore } from '@/lib/run-store'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { createTestStore } from '../store/helpers'

const FIXTURE = {
  id: 'a-demo',
  content: '<p>演示回答</p>',
  created_time: 1700000000,
  voteup_count: 1,
  comment_count: 0,
  question: { id: 'q-demo', title: '演示问题', detail: '', created_time: 1, answer_count: 1, follower_count: 0, author: { url_token: 'u', name: 'u' } },
  author: { url_token: 'u', name: 'u' },
}

function mockFactory(): (demo: boolean) => Fetcher {
  return (demo) => ({
    async fetchJson() {
      if (!demo) throw new Error('real mode 需要签名桥（联调）')
      return FIXTURE
    },
  })
}

let store: Awaited<ReturnType<typeof createTestStore>>

beforeEach(async () => {
  store = await createTestStore()
})

describe('运行状态机（任务 5：粘贴 → 运行(mock) → 计数/日志）', () => {
  it('添加任务：合法 URL 入队并识别类型，非法 URL 报错', () => {
    const rs = new RunStore({ store, fetcherFactory: mockFactory() })
    expect(rs.addTask('https://www.zhihu.com/question/1/answer/a1').ok).toBe(true)
    expect(rs.addTask('https://www.zhihu.com/not-a-thing').ok).toBe(false)
    expect(rs.state.tasks).toHaveLength(1)
    expect(rs.state.tasks[0].typeLabel).toBe('回答')
  })

  it('重复 URL 去重', () => {
    const rs = new RunStore({ store, fetcherFactory: mockFactory() })
    rs.addTask('https://www.zhihu.com/question/1/answer/a1')
    expect(rs.addTask('https://www.zhihu.com/question/1/answer/a1').ok).toBe(false)
  })

  it('演示模式跑通：计数累加 + 完成状态 + 日志经脱敏器', async () => {
    const rs = new RunStore({ store, fetcherFactory: mockFactory() })
    rs.addTask('https://www.zhihu.com/question/1/answer/a1')
    rs.setDemoMode(true)
    const done = rs.start()
    expect(rs.state.phase).toBe('running')
    await done
    expect(rs.state.phase).toBe('idle')
    expect(rs.state.tasks[0].status).toBe('done')
    expect(rs.state.totals.created).toBeGreaterThanOrEqual(1)
    expect(rs.state.logs.length).toBeGreaterThan(0)
  })

  it('任务级失败不拖垮整批，错误进日志', async () => {
    const rs = new RunStore({ store, fetcherFactory: () => ({ fetchJson: async () => { throw new Error('cookie=secret123 泄露模拟') } }) })
    rs.addTask('https://www.zhihu.com/question/1/answer/a1')
    await rs.start()
    expect(rs.state.tasks[0].status).toBe('failed')
    const all = rs.state.logs.map((l) => l.text).join('\n')
    expect(all).not.toContain('secret123')
    expect(all).toContain('cookie=***')
  })

  it('订阅者收到状态推送', async () => {
    const rs = new RunStore({ store, fetcherFactory: mockFactory() })
    rs.setDemoMode(true)
    rs.addTask('https://www.zhihu.com/question/1/answer/a1')
    const seen: string[] = []
    const unsub = rs.subscribe(() => seen.push(rs.state.phase))
    await rs.start()
    unsub()
    expect(seen).toContain('running')
    expect(seen).toContain('idle')
  })
})
