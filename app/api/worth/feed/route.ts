import { NextResponse } from 'next/server'

import { feed } from '../../../../lib/worth/board'

/**
 * /api/worth/feed — what just happened on /worth, for the live strip under the
 * field: the latest checks and the latest pages published on unfair.so, plus
 * the running totals. Read every few seconds by every open page, so it is
 * served from the store and never reaches X.
 */

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  return NextResponse.json(await feed(), { headers: { 'cache-control': 'no-store' } })
}
