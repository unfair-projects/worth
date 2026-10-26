import { lookup } from '../../../../../../lib/worth/board'
import { renderVersus } from '../../../../../../lib/worth/card'
import { handleFrom } from '../../../../../../lib/worth/model'

/** the versus card as a file: what the page shows, and with ?download=1 what Download saves */

export const runtime = 'nodejs'

export async function GET(request: Request, ctx: { params: Promise<{ handle: string; other: string }> }): Promise<Response> {
  const { handle, other } = await ctx.params
  const a = handleFrom(decodeURIComponent(handle ?? ''))
  const b = handleFrom(decodeURIComponent(other ?? ''))
  if (!a || !b) return new Response('not a handle', { status: 404 })

  const [fa, fb] = await Promise.all([lookup(a), lookup(b)])
  if (!fa.ok || !fb.ok) return new Response('no account', { status: 404 })

  const download = new URL(request.url).searchParams.has('download')
  return renderVersus(fa.result, fb.result, {
    headers: {
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      ...(download
        ? { 'content-disposition': `attachment; filename="x-account-worth-${fa.result.account.handle}-vs-${fb.result.account.handle}.png"` }
        : {}),
    },
  })
}
