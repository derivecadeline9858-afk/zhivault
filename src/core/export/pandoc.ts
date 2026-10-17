import { ZhiVaultError } from '@/core/fetch/errors'

export const EXPORT_EMPTY_OUTPUT = 'EXPORT_EMPTY_OUTPUT'

/** pandoc 转换边界：生产 = pandoc-wasm（浏览器/Node），测试可注入 fake */
export interface PandocRunner {
  convertText(html: string, to: 'gfm' | 'plain'): Promise<string>
  convertBinary(html: string, format: 'docx'): Promise<Uint8Array>
}

function validateText(output: string, to: string): string {
  if (typeof output !== 'string' || output.trim().length === 0) {
    throw new ZhiVaultError(EXPORT_EMPTY_OUTPUT, `EXPORT_EMPTY_OUTPUT：pandoc 输出为空（to=${to}）`)
  }
  return output
}

function validateBinary(output: Uint8Array, format: string): Uint8Array {
  if (!(output instanceof Uint8Array) || output.length === 0) {
    throw new ZhiVaultError(EXPORT_EMPTY_OUTPUT, `EXPORT_EMPTY_OUTPUT：pandoc 二进制输出为空（to=${format}）`)
  }
  return output
}

/** 串行队列（PRD §10-4）：pandoc-wasm 单实例，转换任务排队执行 */
export class PandocQueue implements PandocRunner {
  private chain: Promise<unknown> = Promise.resolve()

  constructor(private readonly inner: PandocRunner) {}

  convertText(html: string, to: 'gfm' | 'plain'): Promise<string> {
    const run: Promise<string> = this.chain.then(() => this.inner.convertText(html, to)).then((out) => validateText(out, to))
    this.chain = run.catch(() => undefined)
    return run
  }

  convertBinary(html: string, format: 'docx'): Promise<Uint8Array> {
    const run: Promise<Uint8Array> = this.chain
      .then(() => this.inner.convertBinary(html, format))
      .then((out) => validateBinary(out, format))
    this.chain = run.catch(() => undefined)
    return run
  }
}

type PandocWasmModule = typeof import('pandoc-wasm')

/** 生产 runner：按需加载 pandoc-wasm（58MB wasm 懒加载，首次转换时初始化） */
export function createPandocRunner(): PandocRunner {
  let mod: Promise<PandocWasmModule> | null = null
  const load = (): Promise<PandocWasmModule> => (mod ??= import('pandoc-wasm'))
  return {
    async convertText(html, to) {
      const { convert } = await load()
      const r = await convert({ from: 'html', to }, html, {})
      return validateText(r.stdout, to)
    },
    async convertBinary(html, format) {
      const { convert } = await load()
      const outName = `out.${format}`
      const r = await convert({ from: 'html', to: format, 'output-file': outName }, html, {})
      const file = r.files[outName]
      const bytes =
        file instanceof Blob
          ? new Uint8Array(await file.arrayBuffer())
          : typeof file === 'string'
            ? new TextEncoder().encode(file)
            : (file as Uint8Array)
      return validateBinary(bytes, format)
    },
  }
}
