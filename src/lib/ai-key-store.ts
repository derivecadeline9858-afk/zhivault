// AI Key 存取（PRD §10-9）：经 DPAPI 加密文件落盘（应用内 ai_key 命令对）
export interface AiKeyBridge {
  save(data: string): Promise<void>
  load(): Promise<string | null>
  clear(): Promise<void>
}

export async function loadAiKey(bridge: AiKeyBridge): Promise<string | null> {
  try {
    return await bridge.load()
  } catch {
    return null
  }
}

export async function saveAiKey(bridge: AiKeyBridge, key: string): Promise<void> {
  await bridge.save(key.trim())
}

export async function clearAiKey(bridge: AiKeyBridge): Promise<void> {
  await bridge.clear()
}

/** 应用内桥：Rust ai_key 命令（DPAPI 加密 ai-key.bin） */
export function createTauriAiKeyBridge(): AiKeyBridge {
  return {
    save: async (data) => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('ai_key_save', { data })
    },
    load: async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<string | null>('ai_key_load')
    },
    clear: async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('ai_key_clear')
    },
  }
}

/** 浏览器演示桥：内存态（不落盘） */
export function createMemoryAiKeyBridge(): AiKeyBridge {
  let value: string | null = null
  return {
    save: async (d) => {
      value = d
    },
    load: async () => value,
    clear: async () => {
      value = null
    },
  }
}
