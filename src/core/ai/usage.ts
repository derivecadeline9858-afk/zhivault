// AI 用量统计（PRD §10-9）：按模型聚合 token 与调用次数

export interface UsageEntry {
  model: string
  promptTokens: number | null | undefined
  completionTokens: number | null | undefined
}

export interface UsageStats {
  jobs: number
  promptTokens: number
  completionTokens: number
  byModel: Record<string, { jobs: number; promptTokens: number; completionTokens: number }>
}

export function usageStats(entries: UsageEntry[]): UsageStats {
  const stats: UsageStats = { jobs: entries.length, promptTokens: 0, completionTokens: 0, byModel: {} }
  for (const e of entries) {
    const p = e.promptTokens ?? 0
    const c = e.completionTokens ?? 0
    stats.promptTokens += p
    stats.completionTokens += c
    const slot = (stats.byModel[e.model] ??= { jobs: 0, promptTokens: 0, completionTokens: 0 })
    slot.jobs++
    slot.promptTokens += p
    slot.completionTokens += c
  }
  return stats
}
