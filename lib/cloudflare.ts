import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * WHERE THE APP IS RUNNING — on Cloudflare Workers (deployed, or `npm run preview`),
 * or in plain Node (`npm run dev` without the Workers bindings, tests, `next build`).
 *
 * The pieces of /worth that touch a disk or a binding ask here, so each one has a
 * Node way and a Workers way and nothing else has to know which it is.
 */

/** the bindings /worth uses; every one may be missing, locally or before it is set up */
export interface Bindings {
  WORTH_KV?: KV
  ASSETS?: { fetch(input: Request | string): Promise<Response> }
}

/** the corner of a KV namespace /worth uses */
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export interface Edge {
  env: Bindings
  ctx: { waitUntil(p: Promise<unknown>): void }
}

/** the Workers environment of this request, or null outside Workers */
export function edge(): Edge | null {
  try {
    const { env, ctx } = getCloudflareContext()
    return { env: env as unknown as Bindings, ctx }
  } catch {
    return null
  }
}

/** true inside a Worker, whether or not a request is being served right now */
export const onWorkers = (): boolean => typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

/** keeps a promise alive past the response (a Worker stops when the response is sent); a plain promise elsewhere */
export function later(p: Promise<unknown>): void {
  const e = edge()
  if (e) e.ctx.waitUntil(p.catch(() => {}))
}
