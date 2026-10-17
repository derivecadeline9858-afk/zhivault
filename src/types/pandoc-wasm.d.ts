// pandoc-wasm 无内置类型声明（包内未提供 .d.ts），此处按官方 README 的 API 声明
declare module 'pandoc-wasm' {
  export interface PandocConvertResult {
    stdout: string
    stderr: string
    warnings: unknown[]
    /** 输入 + 输出 + 抽取的媒体文件（DOCX 输出为 Blob/Uint8Array） */
    files: Record<string, Blob | Uint8Array | string>
    mediaFiles?: Record<string, Blob | Uint8Array | string>
  }
  export function convert(
    options: Record<string, unknown>,
    stdin: string | null,
    files: Record<string, unknown>,
  ): Promise<PandocConvertResult>
  export function query(options: Record<string, unknown>): Promise<unknown>
  export const pandoc: unknown
}
