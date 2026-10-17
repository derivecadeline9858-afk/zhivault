/** SHA-256 十六进制（Web Crypto，WebView2 / Node / jsdom 均可用），用于内容版本哈希 */
export async function hashContent(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
