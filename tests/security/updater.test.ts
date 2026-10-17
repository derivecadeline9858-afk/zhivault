import { describe, expect, it, vi } from 'vitest'
import { UPDATE_TAMPERED, UpdateChecker, sha256Hex, verifyUpdateArchive, type UpdateManifest } from '@/core/security/updater'

async function makeKeys() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair
  return kp
}

async function signManifest(manifest: Omit<UpdateManifest, 'signature'>, privateKey: CryptoKey): Promise<UpdateManifest> {
  const data = new TextEncoder().encode(JSON.stringify(manifest))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, data))
  return { ...manifest, signature: btoa(String.fromCharCode(...sig)) }
}

const baseManifest = { version: '0.2.0', url: 'https://updates.zhivault.app/zhivault-0.2.0.zip' }

describe('更新包校验通道（PRD §8-2：Ed25519 签名 + SHA-256，篡改必拒）', () => {
  it('合法包通过校验', async () => {
    const kp = await makeKeys()
    const archive = new TextEncoder().encode('zip-bytes-here')
    const unsigned = { ...baseManifest, sha256: await sha256Hex(archive) }
    const manifest = await signManifest(unsigned, kp.privateKey)
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
    await expect(verifyUpdateArchive(archive, manifest, rawPub)).resolves.toBeUndefined()
  }, 30_000)

  it('篡改包体（SHA 不符）必拒 UPDATE_TAMPERED', async () => {
    const kp = await makeKeys()
    const archive = new TextEncoder().encode('original-zip')
    const manifest = await signManifest({ ...baseManifest, sha256: await sha256Hex(archive) }, kp.privateKey)
    const tampered = new TextEncoder().encode('TAMPERED-zip!!')
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
    await expect(verifyUpdateArchive(tampered, manifest, rawPub)).rejects.toMatchObject({ code: UPDATE_TAMPERED })
  }, 30_000)

  it('重打包（SHA 重算但签名不符）必拒 UPDATE_BAD_SIGNATURE', async () => {
    const kp = await makeKeys()
    const attacker = await makeKeys()
    const archive = new TextEncoder().encode('attacker-zip')
    // 攻击者用自己的私钥签了 manifest，但验签用应用内置公钥
    const manifest = await signManifest({ ...baseManifest, sha256: await sha256Hex(archive) }, attacker.privateKey)
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
    await expect(verifyUpdateArchive(archive, manifest, rawPub)).rejects.toMatchObject({ code: 'UPDATE_BAD_SIGNATURE' })
  }, 30_000)

  it('manifest 字段被改（URL 指向劫持地址）签名失效必拒', async () => {
    const kp = await makeKeys()
    const archive = new TextEncoder().encode('zip')
    const manifest = await signManifest({ ...baseManifest, sha256: await sha256Hex(archive) }, kp.privateKey)
    const hijacked = { ...manifest, url: 'https://evil.com/fake.zip' }
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
    await expect(verifyUpdateArchive(archive, hijacked, rawPub)).rejects.toMatchObject({ code: 'UPDATE_BAD_SIGNATURE' })
  }, 30_000)

  it('下载失败结构化报错，且更新请求零凭据（只传 URL）', async () => {
    const kp = await makeKeys()
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
    const fetchBytes = vi.fn(async (url: string) => {
      expect(url).toBe(baseManifest.url)
      throw new Error('network down')
    })
    const checker = new UpdateChecker({
      manifestUrl: 'https://updates.zhivault.app/manifest.json',
      publicKey: rawPub,
      fetchBytes,
    })
    await expect(checker.check()).rejects.toMatchObject({ code: 'UPDATE_FETCH_FAILED' })
  }, 30_000)
})
