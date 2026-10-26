import { lookup } from '../../../../lib/worth/board'
import { renderCard, type CardSize } from '../../../../lib/worth/card'
import { handleFrom } from '../../../../lib/worth/read'

/**
 * /worth/<handle>/card.png — the share card as a file: what the page shows,
 * and with ?download=1 what Download saves (named for the account, so a
 * camera roll of them still says whose is whose).
 */

export const runtime = 'nodejs'

/* the page's card (tall), a phone's (portrait), or a link's preview */
const size = (s: string | null): CardSize => (s === 'tall' || s === 'portrait' ? s : 'wide')

export async function GET(request: Request, ctx: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await ctx.params
  const clean = handleFrom(decodeURIComponent(handle ?? ''))
  if (!clean) return new Response('not a handle', { status: 404 })

  const found = await lookup(clean)
  if (!found.ok) return new Response('no account', { status: found.reason === 'nobody' ? 404 : 503 })

  const params = new URL(request.url).searchParams
  const download = params.has('download')
  return renderCard(found.result, {
    headers: {
      /* the numbers are a day's read: a day of cache, and a new address once they change (?v=) */
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      ...(download
        ? { 'content-disposition': `attachment; filename="x-account-worth-${found.result.account.handle}.png"` }
        : {}),
    },
  }, size(params.get('size')))
}
