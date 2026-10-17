// 更新包校验通道（PRD §8-2：Ed25519 签名 + SHA-256 双校验；更新请求零凭据，失败拒绝安装）
import { ZhiVaultError } from '@/core/fetch/errors'

export const UPDATE_TAMPERED = 'UPDATE_TAMPERED'
export const UPDATE_BAD_SIGNATURE = 'UPDATE_BAD_SIGNATURE'
export const UPDATE_FETCH_FAILED = 'UPDATE_FETCH_FAILED'

export interface UpdateManifest {
  version: string
  url: string
  sha256: string
  /** base64 的 Ed25519 签名，签名对象为 manifest 去掉 signature 字段后的规范 JSON */
  signature: string
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function canonicalManifest(manifest: Omit<UpdateManifest, 'signature'>): Uint8Array {
  // 键序固定（version/url/sha256）以保证签名可复算
  const canonical = JSON.stringify({
    version: manifest.version,
    url: manifest.url,
    sha256: manifest.sha256,
  })
  return new TextEncoder().encode(canonical)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 校验更新包：先 SHA-256 比对（篡改必拒），再 Ed25519 验签（公钥内置，不信任 manifest 携带） */
export async function verifyUpdateArchive(
  archive: Uint8Array,
  manifest: UpdateManifest,
  publicKey: Uint8Array,
): Promise<void> {
  const actualSha = await sha256Hex(archive)
  if (actualSha !== manifest.sha256.toLowerCase()) {
    throw new ZhiVaultError(
      UPDATE_TAMPERED,
      `UPDATE_TAMPERED：SHA-256 不符（期望 ${manifest.sha256.slice(0, 16)}…，实际 ${actualSha.slice(0, 16)}…），拒绝安装`,
    )
  }

  const key = await crypto.subtle.importKey('raw', publicKey as unknown as BufferSource, { name: 'Ed25519' }, false, ['verify'])
  const sig = fromBase64(manifest.signature)
  const { signature: _ignored, ...unsigned } = manifest
  void _ignored
  const valid = await crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    sig as unknown as BufferSource,
    canonicalManifest(unsigned) as unknown as BufferSource,
  )
  if (!valid) {
    throw new ZhiVaultError(UPDATE_BAD_SIGNATURE, 'UPDATE_BAD_SIGNATURE：Ed25519 验签失败，拒绝安装')
  }
}

export interface UpdateCheckerDeps {
  manifestUrl: string
  /** 应用内置的 Ed25519 公钥（32 字节 raw） */
  publicKey: Uint8Array
  /** 只传 URL 的取数器：更新请求零凭据（无 Cookie/Authorization 头概念） */
  fetchBytes: (url: string) => Promise<Uint8Array>
}

export class UpdateChecker {
  constructor(private readonly deps: UpdateCheckerDeps) {}

  /** 拉取 manifest → 下载包 → 双校验；任何失败都拒绝并结构化报错 */
  async check(): Promise<{ version: string; archive: Uint8Array }> {
    let manifest: UpdateManifest
    let archive: Uint8Array
    try {
      const manifestBytes = await this.deps.fetchBytes(this.deps.manifestUrl)
      manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as UpdateManifest
      archive = await this.deps.fetchBytes(manifest.url)
    } catch (e) {
      if (e instanceof ZhiVaultError) throw e
      throw new ZhiVaultError(UPDATE_FETCH_FAILED, `UPDATE_FETCH_FAILED：${(e as Error).message ?? String(e)}`, {
        cause: e,
      })
    }
    await verifyUpdateArchive(archive, manifest, this.deps.publicKey)
    return { version: manifest.version, archive }
  }
}
