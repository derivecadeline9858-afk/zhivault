import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Splash } from '@/components/Splash'

describe('启动 Splash（PRD §3 露出点 2）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染头像、产品名与作者署名', () => {
    render(<Splash onDone={() => {}} />)
    expect(screen.getByAltText('知藏头像')).toBeInTheDocument()
    expect(screen.getByText('知藏 ZhiVault')).toBeInTheDocument()
    expect(screen.getByText('作者：橙茶星')).toBeInTheDocument()
  })

  it('durationMs 之后触发 onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Splash onDone={onDone} durationMs={1000} />)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('卸载后不再触发 onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { unmount } = render(<Splash onDone={onDone} durationMs={1000} />)
    unmount()
    vi.advanceTimersByTime(2000)
    expect(onDone).not.toHaveBeenCalled()
  })
})
