import { CARD, renderAsk } from '../../lib/worth/card'

/** what a link to /worth itself unfurls as: the question, in the card's own frame */

export const runtime = 'nodejs'
export const size = CARD
export const contentType = 'image/png'
export const alt = 'How much is your X account worth?'

export default function Image() {
  return renderAsk()
}
