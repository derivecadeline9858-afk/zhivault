/** 系统通知边界（PRD §10-7：监控命中系统通知）；应用内经 tauri-plugin-notification */
export interface Notifier {
  notify(title: string, body: string): Promise<void>
}

export function createNullNotifier(): Notifier {
  return { notify: async () => {} }
}

export function createTauriNotifier(): Notifier {
  return {
    async notify(title, body) {
      try {
        const mod = await import('@tauri-apps/plugin-notification')
        const granted = await mod.isPermissionGranted()
        if (!granted) {
          const req = await mod.requestPermission()
          if (req !== 'granted') return
        }
        await mod.sendNotification({ title, body })
      } catch {
        // 无桌面通知能力时静默降级
      }
    },
  }
}
