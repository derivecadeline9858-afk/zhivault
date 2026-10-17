import { invoke } from '@tauri-apps/api/core'

import type { ExportSink } from './sink'

/** 生产落盘：经 Rust 命令写盘（服务端二次校验路径），base64 传输二进制 */
export function createRustSink(rootDir: string): ExportSink {
  return {
    writeText: (relPath, content) => invoke<void>('export_write_text', { root: rootDir, path: relPath, content }),
    writeBinary: (relPath, data) =>
      invoke<void>('export_write_binary', {
        root: rootDir,
        path: relPath,
        dataBase64: base64FromBytes(data),
      }),
    exists: () => Promise.resolve(false), // 引擎导出流程不依赖 exists；任务 5 后按需补 Rust 命令
  }
}

function base64FromBytes(data: Uint8Array): string {
  let bin = ''
  for (const b of data) bin += String.fromCharCode(b)
  return btoa(bin)
}
