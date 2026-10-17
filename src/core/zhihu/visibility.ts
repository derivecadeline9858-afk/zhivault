import type { EntityType } from './url-parser'

export type UserSubMode = 'created' | 'activities'
export type LoginLevel = 'anonymous' | 'login'

/**
 * 匿名/登录可见性矩阵（PRD §0 审查-5）：
 * 匿名可采 = 公开回答/文章/想法/问题/专栏/话题/公开收藏夹/用户公开创作
 * 需登录   = 用户赞同动态（收藏夹"完整列表"与"个人主页统计"属账号级入口，由任务 5 登录层控制）
 */
export function requiredLoginLevel(type: EntityType, subMode?: string): LoginLevel {
  if (type === 'user' && subMode === 'activities') return 'login'
  return 'anonymous'
}

export function canCapture(type: EntityType, subMode: string | undefined, loggedIn: boolean): boolean {
  return requiredLoginLevel(type, subMode) === 'anonymous' || loggedIn
}
