import { expect, test } from '@playwright/test'

// PRD §10-5 验收：Playwright 走通"粘贴 URL → 运行（mock）→ 导出"全链路
test('粘贴 URL → 运行(mock) → 导出 全链路', async ({ page }) => {
  await page.goto('/')

  // 1) 首页：粘贴 URL → 类型识别 → 添加任务
  await page.locator('#url-input').fill('https://www.zhihu.com/question/1/answer/a1')
  await expect(page.getByTestId('type-chip')).toContainText('回答')
  await page.locator('#add-task').click()
  await expect(page.getByTestId('task-card')).toHaveCount(1)

  // 2) 运行视图：演示模式 → 开始 → 计数与日志
  await page.locator('#goto-run').click()
  await expect(page).toHaveURL(/#\/run/)
  await page.locator('#demo-mode').check()
  await page.locator('#start-run').click()
  await expect(page.getByTestId('count-新增')).not.toHaveText('0', { timeout: 20_000 })
  await expect(page.getByTestId('log-stream')).toContainText('运行结束', { timeout: 20_000 })

  // 3) 导出中心：勾选格式 → 导出 → 报告成功
  await page.getByRole('link', { name: '导出中心' }).click()
  await expect(page).toHaveURL(/#\/export/)
  await page.getByTestId('fmt-epub').check()
  await page.locator('#do-export').click()
  await expect(page.getByTestId('export-report')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('report-html')).toContainText('✅')
  await expect(page.getByTestId('report-epub')).toContainText('✅')
  await expect(page.getByTestId('report-json')).toContainText('✅')
  await expect(page.getByTestId('report-markdown')).toContainText('✅')
})
