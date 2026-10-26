import { edge } from './cloudflare'

/**
 * A file from public/ as bytes. Satori needs the fonts and the card's pictures
 * inlined, and a Worker has no disk to read them from: there they come through
 * the ASSETS binding, which serves the same public/ folder. In Node they are
 * read off disk.
 */
export async function readPublic(rel: string): Promise<Buffer> {
  const path = rel.replace(/^\/+/, '')
  const assets = edge()?.env.ASSETS
  if (assets) {
    const res = await assets.fetch(new Request(`https://assets.invalid/${path}`))
    if (!res.ok) throw new Error(`public/${path}: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  const [{ readFile }, nodePath] = await Promise.all([import('node:fs/promises'), import('node:path')])
  return readFile(nodePath.join(process.cwd(), 'public', path))
}
