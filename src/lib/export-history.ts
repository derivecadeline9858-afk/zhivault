export interface ExportHistoryEntry {
  at: string
  bookTitle: string
  formats: string[]
  status: string
  outputDir: string
}

const KEY = 'zhivault.export.history'

export function loadExportHistory(): ExportHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ExportHistoryEntry[]
  } catch {
    return []
  }
}

export function pushExportHistory(entry: ExportHistoryEntry): ExportHistoryEntry[] {
  const list = [entry, ...loadExportHistory()].slice(0, 50)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}
