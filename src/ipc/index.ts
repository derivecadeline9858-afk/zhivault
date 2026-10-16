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
