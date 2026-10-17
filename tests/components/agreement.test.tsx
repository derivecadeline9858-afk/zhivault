import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgreementDialog } from '@/components/AgreementDialog'

describe('首次启动协议弹层（PRD §8-8：不可跳过）', () => {
  it('未勾选时确定按钮禁用', () => {
    render(<AgreementDialog onAccept={vi.fn()} />)
    expect(screen.getByRole('button', { name: '同意并进入' })).toBeDisabled()
  })

  it('勾选后可进入，点击触发 onAccept', async () => {
    const onAccept = vi.fn()
    render(<AgreementDialog onAccept={onAccept} />)
    await userEvent.click(screen.getByRole('checkbox'))
    const btn = screen.getByRole('button', { name: '同意并进入' })
    expect(btn).toBeEnabled()
    await userEvent.click(btn)
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('无关闭/跳过入口', () => {
    render(<AgreementDialog onAccept={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /关闭|跳过|稍后/ })).toBeNull()
  })

  it('展示合规要点（个人用途/限速/不碰付费内容/不绕过验证）', () => {
    render(<AgreementDialog onAccept={vi.fn()} />)
    const text = screen.getByTestId('agreement-body').textContent ?? ''
    expect(text).toContain('个人学习存档')
    expect(text).toContain('限速')
    expect(text).toContain('付费内容')
    expect(text).toContain('人机验证')
  })
})
