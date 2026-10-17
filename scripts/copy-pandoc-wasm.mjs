// 把 pandoc.wasm 从依赖复制到 public/（58MB 二进制不入库，postinstall 自动准备）
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/pandoc-wasm/src/pandoc.wasm')
const dest = resolve(root, 'public/pandoc.wasm')

if (!existsSync(src)) {
  console.warn('[prepare:wasm] pandoc-wasm 未安装，跳过（导出 pandoc 系格式不可用）')
  process.exit(0)
}
mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log('[prepare:wasm] 已复制 pandoc.wasm → public/')
