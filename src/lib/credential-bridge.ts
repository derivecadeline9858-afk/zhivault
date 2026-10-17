import { invoke } from '@tauri-apps/api/core'

/** 凭据桥接：应用内走 DPAPI（Rust），浏览器演示走内存（不落盘） */
export interface CredentialBridge {
  save(data: string): Promise<void>
  load(): Promise<string | null>
  clear(): Promise<void>
}

export function createTauriCredentialBridge(): CredentialBridge {
  return {
    save: (data) => invoke<void>('credential_save', { data }),
    load: () => invoke<string | null>('credential_load'),
    clear: () => invoke<void>('credential_clear'),
  }
}

export function createMemoryCredentialBridge(): CredentialBridge {
  let value: string | null = null
  return {
    save: async (data) => {
      value = data
    },
    load: async () => value,
    clear: async () => {
      value = null
    },
  }
}
