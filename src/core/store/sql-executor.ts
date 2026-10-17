export type SqlParam = string | number | null

export interface RunResult {
  changes: number
  lastId: number
}

/** 最小 SQL 执行器抽象：生产由 tauri-plugin-sql 实现，测试由 better-sqlite3 实现 */
export interface SqlExecutor {
  run(sql: string, params?: SqlParam[]): Promise<RunResult>
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>
  get<T>(sql: string, params?: SqlParam[]): Promise<T | undefined>
}
