import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

// pandoc-wasm 的 browser 入口用裸 import('./pandoc.wasm') 并期望得到 URL（webpack asset 语义）。
// Vite 不认该语义，这里把任何 *.wasm 的裸导入改写为指向 public/pandoc.wasm 的 URL 导出；
// Node 侧（vitest）走 pandoc-wasm 的 node 入口读文件系统，不受影响。
function wasmUrlPlugin(): Plugin {
  const VIRTUAL = '\0virtual:pandoc-wasm-url'
  return {
    name: 'pandoc-wasm-url',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.wasm')) return VIRTUAL
      return null
    },
    load(id) {
      if (id === VIRTUAL) return 'export default "/pandoc.wasm"'
      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), wasmUrlPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  // 开发时由 vite 服务器托管；构建时 public/pandoc.wasm 原样进入 dist
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
})
