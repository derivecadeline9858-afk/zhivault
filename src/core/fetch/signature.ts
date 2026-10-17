import { SIGNATURE_UNAVAILABLE, ZhiVaultError } from './errors'

export { SIGNATURE_UNAVAILABLE }

/** 签名桥接口（PRD §7.4-1：`sign(url, d_c0)`） */
export interface SignatureBridge {
  sign(url: string, dC0: string): Promise<string>
}

/** 隐藏签名窗口的最小抽象（生产 = Tauri WebviewWindow，测试 = fake） */
export interface SignatureWindow {
  eval(js: string): Promise<unknown>
}

export interface WebviewSignatureBridgeDeps {
  /** 直接注入 eval（测试优先于 windowFactory） */
  evalFn?: (js: string) => Promise<unknown>
  /** 窗口工厂：默认创建 Tauri 隐藏 WebviewWindow 加载知乎页面 */
  windowFactory?: () => Promise<SignatureWindow>
  windowLabel?: string
  bridgeUrl?: string
}

/** 签名入口在知乎页面内，运行时获取（PRD §9.5：不打包知乎 JS）；入口名在真实环境校准 */
export const ZHIHU_BRIDGE_URL = 'https://www.zhihu.com/404'

function buildSignScript(url: string, dC0: string): string {
  return `(() => {
  const u = ${JSON.stringify(url)};
  const c = ${JSON.stringify(dC0)};
  const entry = window.__zhivault_sign_entry__;
  if (typeof entry !== 'function') throw new Error('zhihu sign entry unavailable');
  return entry(u, c);
})()`
}

/** 生产窗口工厂：JS 侧创建隐藏 WebviewWindow；eval 走 Rust 命令（壳提供 `eval_in_webview`） */
async function createTauriBridgeWindow(url: string, label: string): Promise<SignatureWindow> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const win = new WebviewWindow(label, {
    url,
    visible: false,
    width: 1,
    height: 1,
    focus: false,
    skipTaskbar: true,
  })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('签名桥窗口加载超时')), 20_000)
    void win.once('tauri://loaded', () => {
      clearTimeout(timer)
      resolve()
    })
    void win.once('tauri://error', (e) => {
      clearTimeout(timer)
      reject(new Error(`签名桥窗口加载失败：${String(e)}`))
    })
  })
  const { invoke } = await import('@tauri-apps/api/core')
  return { eval: (js) => invoke('eval_in_webview', { label, js }) }
}

/** 基于隐藏 WebviewWindow + eval 的签名桥（PRD §7.4-1）；任何失败统一映射 SIGNATURE_UNAVAILABLE */
export class WebviewSignatureBridge implements SignatureBridge {
  private windowPromise: Promise<SignatureWindow> | null = null

  constructor(private readonly deps: WebviewSignatureBridgeDeps = {}) {}

  async sign(url: string, dC0: string): Promise<string> {
    try {
      const evalFn =
        this.deps.evalFn ??
        ((js: string) => this.getWindow().then((win) => win.eval(js)))
      const result = await evalFn(buildSignScript(url, dC0))
      if (typeof result !== 'string' || result.length === 0) {
        throw new Error('签名结果为空')
      }
      return result
    } catch (e) {
      if (e instanceof ZhiVaultError) throw e
      throw new ZhiVaultError(
        SIGNATURE_UNAVAILABLE,
        `SIGNATURE_UNAVAILABLE：签名桥不可用（${(e as Error).message ?? String(e)}）`,
        { url, cause: e },
      )
    }
  }

  private getWindow(): Promise<SignatureWindow> {
    this.windowPromise ??= this.deps.windowFactory
      ? this.deps.windowFactory()
      : createTauriBridgeWindow(this.deps.bridgeUrl ?? ZHIHU_BRIDGE_URL, this.deps.windowLabel ?? 'signature-bridge')
    return this.windowPromise
  }
}
