/**
 * When the server starts: /worth's board starts reading its creators now,
 * rather than on its first visitor, so the minutes after a deploy (which
 * starts the board's file empty) are not an empty board (Fedor 2026-10-21).
 *
 * Node only, and imported only inside the check, the way Next asks: the edge
 * build drops the branch, and with it the disk the board is kept on.
 *
 * Not on Cloudflare: a Worker has no "start" to hang this on and may not do
 * network work outside a request. There the first board view starts the seed
 * (board() calls it) and keeps it alive with waitUntil.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !(typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers')) {
    const { seed } = await import('./lib/worth/board')
    seed()
  }
}
