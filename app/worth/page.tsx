import type { Metadata } from 'next'

import { board, feed } from '../../lib/worth/board'
import { WORTH } from './words'
import { WorthPage } from './WorthPage'

/**
 * creators.unfair.so/worth — the special project (Fedor 2026-10-20). The
 * page is the client component; this file reads the board and the live feed
 * on the server so they arrive drawn, and says what a link to the page
 * unfurls as.
 */

/* read per request: a deploy's first visitor starts the seed, and a page baked
   at build time would carry an empty board forever */
export const dynamic = 'force-dynamic'

const TITLE = WORTH.title.join(' ')

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · unfair.so` },
  description: 'Put in your handle. We show what your account can earn a month from brand deals, and what a page on Unfair adds.',
  openGraph: { title: TITLE, url: '/worth', siteName: 'unfair.so for creators', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE },
}

export default async function Worth() {
  const [b, f] = await Promise.all([board(), feed()])
  return <WorthPage initial={null} board={b} feed={f} />
}
