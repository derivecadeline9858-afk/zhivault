import { describe, expect, it } from 'vitest'
import { APP_NAME, AUTHOR, settingsFooter } from '@/branding'

describe('品牌常量（PRD §3 品牌与署名规范）', () => {
  it('产品名为「知藏 ZhiVault」', () => {
    expect(APP_NAME).toBe('知藏 ZhiVault')
  })

  it('作者署名为「橙茶星」', () => {
    expect(AUTHOR).toBe('橙茶星')
  })

  it('设置页底栏格式为「知藏 v{version} · 作者：橙茶星」', () => {
    expect(settingsFooter('1.2.3')).toBe('知藏 v1.2.3 · 作者：橙茶星')
  })
})
