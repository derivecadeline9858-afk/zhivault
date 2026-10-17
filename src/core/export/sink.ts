/** 导出落盘边界：生产由 fs 插件实现（任务 5 接线），测试用 MemorySink */
export interface ExportSink {
  writeText(relPath: string, content: string): Promise<void>
  writeBinary(relPath: string, data: Uint8Array): Promise<void>
  exists(relPath: string): Promise<boolean>
}
