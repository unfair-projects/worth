import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { board, feed, lookup } from '../../../lib/worth/board'
import { handleFrom, money, perMonth } from '../../../lib/worth/model'
import { WorthPage } from '../WorthPage'

/**
 * /worth/<handle> — one account's answer, the address a share carries (the
 * card is its link preview, opengraph-image.tsx). The same page as /worth,
 * opened on the result: whoever followed the link sees the card first and
 * the field to check their own right above it.
 *
 * An account never read is read here, once; after that it is stored for a
 * day (lib/worth/board.ts), so a share wave costs one read, not thousands.
 */

export const dynamic = 'force-dynamic'

/* once per request: the metadata and the page ask the same question */
const find = cache(async (raw: string) => {
  const handle = handleFrom(decodeURIComponent(raw ?? ''))
  if (!handle) return null
  return { handle, found: await lookup(handle) }
})

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const hit = await find(handle)
  if (!hit?.found.ok) return {}
  const { account, valuation } = hit.found.result
  const title = `@${account.handle}'s X account can earn up to ${money(perMonth(valuation))} a month`
  const description = 'How much is yours? Put in your handle on unfair.so.'
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, url: `/worth/${account.handle}`, siteName: 'unfair.so for creators', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function WorthOf({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const hit = await find(handle)
  if (!hit) redirect('/worth')
  if (!hit.found.ok) {
    if (hit.found.reason === 'nobody') notFound()
    redirect('/worth')
  }
  const [b, f] = await Promise.all([board(), feed()])
  return <WorthPage initial={hit.found.result} board={b} feed={f} />
}
