import { ZhiVaultError } from '@/core/fetch/errors'
import type { StoreLike } from '@/core/zhihu/collectors'
import { collectAnswer, collectArticle, collectCollection, collectColumn, collectPin, collectQuestion, collectTopic, collectUser } from '@/core/zhihu/collectors'
import type { CollectorOptions, CollectResult, CollectStats } from '@/core/zhihu/collectors'
import { addStats, emptyStats } from '@/core/zhihu/collectors/shared'
import type { Fetcher, ZhihuSession } from '@/core/zhihu/fetcher'
import { parseZhihuUrl, type EntityType } from '@/core/zhihu/url-parser'

export interface TaskSpec {
  id: string
  url: string
  options?: CollectorOptions
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'paused'

export interface TaskState {
  taskId: string
  status: TaskStatus
  stats: CollectStats
  error?: { code: string; message: string }
}

export interface BatchSummary {
  status: 'done' | 'paused' | 'failed'
  tasks: TaskState[]
  totals: CollectStats
}

const COLLECTORS = {
  answer: collectAnswer,
  article: collectArticle,
  pin: collectPin,
  question: collectQuestion,
  collection: collectCollection,
  column: collectColumn,
  topic: collectTopic,
  user: collectUser,
} satisfies Record<EntityType, (...args: never[]) => Promise<CollectResult>>

export interface BatchExecutorDeps {
  fetcher: Fetcher
  store: StoreLike
  session: ZhihuSession
  /** 默认 1；Pro 上限 3（PRD §5.3：总速率恒定，并发只影响穿插顺序） */
  maxConcurrency?: number
  onTaskEvent?: (state: TaskState) => void
}

/**
 * 多用户批量执行器（PRD §5.3/§10-3）：worker 池并发 + 全局共享限速桶 +
 * 协作式暂停（页间检查）+ 游标断点续抓。单任务失败不影响整批。
 */
export class BatchExecutor {
  private paused = false
  private queue: TaskSpec[] = []
  private states = new Map<string, TaskState>()

  constructor(private readonly deps: BatchExecutorDeps) {}

  pause(): void {
    this.paused = true
  }

  /** 恢复：继续跑未完成（含暂停重排）的任务 */
  resume(): Promise<BatchSummary> {
    this.paused = false
    return this.drain()
  }

  run(tasks: TaskSpec[]): Promise<BatchSummary> {
    this.queue = [...tasks]
    this.states = new Map(
      tasks.map((t) => [t.id, { taskId: t.id, status: 'pending' as TaskStatus, stats: emptyStats() }]),
    )
    return this.drain()
  }

  get isPaused(): boolean {
    return this.paused
  }

  private async drain(): Promise<BatchSummary> {
    if (this.paused) return this.summary()
    const workers = Array.from({ length: Math.max(1, this.deps.maxConcurrency ?? 1) }, () => this.worker())
    await Promise.all(workers)
    return this.summary()
  }

  private async worker(): Promise<void> {
    for (;;) {
      if (this.paused) return
      const spec = this.queue.shift()
      if (!spec) return
      const state = this.states.get(spec.id)
      if (!state) continue
      state.status = 'running'
      try {
        const target = parseZhihuUrl(spec.url)
        const collect = COLLECTORS[target.type]
        const result = await collect(
          {
            fetcher: this.deps.fetcher,
            store: this.deps.store,
            taskId: spec.id,
            session: this.deps.session,
            isPaused: () => this.paused,
          },
          target,
          spec.options,
        )
        state.stats = addStats(state.stats, result.stats)
        if (result.status === 'paused') {
          state.status = 'paused'
          this.queue.push(spec) // 恢复后从游标续抓
        } else {
          state.status = 'done'
        }
      } catch (e) {
        state.status = 'failed'
        state.stats.failed++
        const err = e as Partial<ZhiVaultError>
        state.error = { code: err.code ?? 'UNKNOWN', message: (e as Error).message ?? String(e) }
      }
      this.deps.onTaskEvent?.({ ...state, stats: { ...state.stats } })
    }
  }

  private summary(): BatchSummary {
    const tasks = [...this.states.values()]
    const totals = tasks.reduce((acc, t) => addStats(acc, t.stats), emptyStats())
    const status: BatchSummary['status'] = this.paused
      ? 'paused'
      : tasks.some((t) => t.status === 'failed')
        ? 'failed'
        : 'done'
    return { status, tasks, totals }
  }
}
