import { lookup } from '../../../../../lib/worth/board'
import { CARD, renderAsk, renderVersus } from '../../../../../lib/worth/card'
import { handleFrom } from '../../../../../lib/worth/model'

/** what X draws under a shared comparison: the versus card itself */

export const runtime = 'nodejs'
export const size = CARD
export const contentType = 'image/png'
export const alt = 'Whose X account is worth more?'

export default async function Image({ params }: { params: Promise<{ handle: string; other: string }> }) {
  const { handle, other } = await params
  const a = handleFrom(decodeURIComponent(handle ?? ''))
  const b = handleFrom(decodeURIComponent(other ?? ''))
  if (!a || !b) return renderAsk()
  const [fa, fb] = await Promise.all([lookup(a), lookup(b)])
  return fa.ok && fb.ok ? renderVersus(fa.result, fb.result) : renderAsk()
}
