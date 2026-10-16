import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { getAppInfo, getDataDir } from '@/ipc'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)

describe('IPC 命令封装（PRD §7.5）', () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  it('getDataDir 调用 get_data_dir 命令并返回路径', async () => {
    mockedInvoke.mockResolvedValueOnce('D:\\apps\\zhivault-data')
    await expect(getDataDir()).resolves.toBe('D:\\apps\\zhivault-data')
    expect(mockedInvoke).toHaveBeenCalledWith('get_data_dir')
  })

  it('getAppInfo 调用 get_app_info 命令并返回署名信息', async () => {
    mockedInvoke.mockResolvedValueOnce({ name: '知藏 ZhiVault', version: '0.1.0', author: '橙茶星' })
    const info = await getAppInfo()
    expect(mockedInvoke).toHaveBeenCalledWith('get_app_info')
    expect(info).toEqual({ name: '知藏 ZhiVault', version: '0.1.0', author: '橙茶星' })
  })
})
