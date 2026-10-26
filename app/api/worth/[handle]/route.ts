import { NextResponse } from 'next/server'

import { known, lookup, markChecked } from '../../../../lib/worth/board'
import { handleFrom } from '../../../../lib/worth/read'

/**
 * /api/worth/[handle] — what the /worth page asks when somebody presses
 * Calculate. Our shapes only: the account, its valuation, its place on the
 * board. Where the numbers came from stays on the server (lib/worth/read.ts).
 *
 * A fresh read costs vendor credits, so each address gets a budget: a share
 * wave reopening the same handle is free (stored for a day), somebody typing
 * fifty handles in an hour is not.
 */

export const runtime = 'nodejs'

const BUDGET = 30
const WINDOW_MS = 60 * 60_000
const g = globalThis as unknown as { __worthBudget?: Map<string, { n: number; from: number }> }
const spent = (g.__worthBudget ??= new Map())

function allowed(ip: string): boolean {
  const now = Date.now()
  const used = spent.get(ip)
  if (!used || now - used.from > WINDOW_MS) {
    spent.set(ip, { n: 1, from: now })
    return true
  }
  used.n++
  return used.n <= BUDGET
}

const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status })

export async function GET(request: Request, ctx: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await ctx.params
  const clean = handleFrom(decodeURIComponent(handle ?? ''))
  if (!clean) return fail(400, 'not_a_handle', 'That is not an X handle.')

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  if (!(await known(clean)) && !allowed(ip)) {
    return fail(429, 'slow_down', 'That is a lot of accounts. Try again in an hour.')
  }

  const found = await lookup(clean)
  if (!found.ok) {
    return found.reason === 'nobody'
      ? fail(404, 'nobody', `X has nobody at @${clean}.`)
      : fail(503, 'x_down', 'X is not answering. Try again in a minute.')
  }
  /* a person asked: the account joins the board and the live feed */
  await markChecked(found.result.account.handle)
  return NextResponse.json(found.result, { headers: { 'cache-control': 'no-store' } })
}
