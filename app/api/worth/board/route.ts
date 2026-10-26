import { NextResponse } from 'next/server'

import { board } from '../../../../lib/worth/board'

/**
 * /api/worth/board — the board again, for a page that just added somebody to
 * it: the account checked a second ago should find itself in the table it is
 * scrolling down to, not on the next reload.
 */

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  return NextResponse.json(await board(), { headers: { 'cache-control': 'no-store' } })
}
