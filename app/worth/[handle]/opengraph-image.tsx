import { lookup } from '../../../lib/worth/board'
import { CARD, renderCard, renderAsk } from '../../../lib/worth/card'
import { handleFrom } from '../../../lib/worth/read'

/**
 * What X draws under a shared /worth/<handle> link: the card itself, so the
 * post IS the picture even when nobody attached it. An account that cannot
 * be read gets the page's own question instead of a broken frame.
 */

export const runtime = 'nodejs'
export const size = CARD
export const contentType = 'image/png'
export const alt = 'How much is this X account worth?'

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const clean = handleFrom(decodeURIComponent(handle ?? ''))
  const found = clean ? await lookup(clean) : null
  return found?.ok ? renderCard(found.result) : renderAsk()
}
