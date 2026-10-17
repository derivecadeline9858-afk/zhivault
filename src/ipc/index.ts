import { invoke } from '@tauri-apps/api/core'

export interface AppInfo {
  name: string
  version: string
  author: string
}

/** 便携数据目录（exe 旁 ./zhivault-data/），由 Rust 壳解析 */
export function getDataDir(): Promise<string> {
  return invoke<string>('get_data_dir')
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('get_app_info')
}

/** 导出落盘（Rust 侧二次路径校验，PRD §8-5） */
export function exportWriteText(root: string, path: string, content: string): Promise<void> {
  return invoke<void>('export_write_text', { root, path, content })
}

export function exportWriteBinary(root: string, path: string, dataBase64: string): Promise<void> {
  return invoke<void>('export_write_binary', { root, path, dataBase64 })
}

export function openPath(path: string): Promise<void> {
  return invoke<void>('open_path', { path })
}

/** 弹层：应用内从顶部导航打开 */
export const DIALOG_EVENT = 'zhivault:open-login-dialog'

