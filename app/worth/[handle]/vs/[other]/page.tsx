import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { board, feed, lookup } from '../../../../../lib/worth/board'
import { handleFrom, money } from '../../../../../lib/worth/model'
import { WorthPage } from '../../../WorthPage'

/**
 * /worth/<handle>/vs/<friend> — two accounts side by side, the link a
 * comparison post carries (its preview is the versus card). Both are read
 * once and stored, like any profile.
 */

export const dynamic = 'force-dynamic'

const pair = cache(async (rawA: string, rawB: string) => {
  const a = handleFrom(decodeURIComponent(rawA ?? ''))
  const b = handleFrom(decodeURIComponent(rawB ?? ''))
  if (!a || !b) return null
  const [fa, fb] = await Promise.all([lookup(a), lookup(b)])
  return { a, b, fa, fb }
})

type Params = { params: Promise<{ handle: string; other: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, other } = await params
  const hit = await pair(handle, other)
  if (!hit?.fa.ok || !hit.fb.ok) return {}
  const A = hit.fa.result
  const B = hit.fb.result
  const title = `@${A.account.handle} ${money(A.valuation.worth)} vs @${B.account.handle} ${money(B.valuation.worth)}`
  const description = 'Whose X account is worth more? Check yours on unfair.so.'
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, url: `/worth/${A.account.handle}/vs/${B.account.handle}`, siteName: 'unfair.so for creators', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function WorthVersus({ params }: Params) {
  const { handle, other } = await params
  const hit = await pair(handle, other)
  if (!hit) redirect('/worth')
  if (!hit.fa.ok) return hit.fa.reason === 'nobody' ? notFound() : redirect('/worth')
  if (!hit.fb.ok) redirect(`/worth/${hit.fa.result.account.handle}`)
  const [b, f] = await Promise.all([board(), feed()])
  return <WorthPage initial={null} versus={{ a: hit.fa.result, b: hit.fb.result }} board={b} feed={f} />
}
