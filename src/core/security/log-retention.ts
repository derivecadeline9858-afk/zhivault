// 日志留存与诊断导出（PRD §8-9：保留 5 天滚动；诊断导出自动脱敏）
import { redactLog } from './log-redact'

export interface RetainedLogEntry {
  at: string
  level: 'INFO' | 'WARN' | 'ERROR'
  text: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'zhivault.logs.ring'
export const LOG_TTL_MS = 5 * 24 * 60 * 60 * 1000

export class LogRetention {
  constructor(
    private readonly deps: {
      storage?: StorageLike
      now?: () => number
      ttlMs?: number
    } = {},
  ) {}

  private get storage(): StorageLike {
    return this.deps.storage ?? localStorage
  }

  private get now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private get ttlMs(): number {
    return this.deps.ttlMs ?? LOG_TTL_MS
  }

  all(): RetainedLogEntry[] {
    try {
      return JSON.parse(this.storage.getItem(KEY) ?? '[]') as RetainedLogEntry[]
    } catch {
      return []
    }
  }

  private write(entries: RetainedLogEntry[]): void {
    this.storage.setItem(KEY, JSON.stringify(entries))
  }

  append(entry: RetainedLogEntry): void {
    const entries = [...this.all(), entry].filter(
      (e) => this.now - Date.parse(e.at) <= this.ttlMs,
    )
    this.write(entries)
  }

  prune(): void {
    this.write(this.all().filter((e) => this.now - Date.parse(e.at) <= this.ttlMs))
  }

  /** 诊断导出：全量日志逐条脱敏后输出（PRD §8-9） */
  exportDiagnostics(): string {
    const header = `zhivault-diagnostics ${new Date(this.now).toISOString()}\n`
    return header + this.all().map((e) => `[${e.at}] [${e.level}] ${redactLog(e.text)}`).join('\n')
  }
}
