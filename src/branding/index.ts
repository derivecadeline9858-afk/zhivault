// 品牌常量（PRD §3 品牌与署名规范）
export const APP_NAME = '知藏 ZhiVault'
export const AUTHOR = '橙茶星'

export const REPO_URL = 'https://github.com/derivecadeline9858-afk/zhivault'

/** 设置页底栏署名（露出点 3）：「知藏 v{version} · 作者：橙茶星」 */
export function settingsFooter(version: string): string {
  return `知藏 v${version} · 作者：${AUTHOR}`
}
