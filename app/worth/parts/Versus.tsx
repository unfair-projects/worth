'use client'

import Link from 'next/link'

import type { Result as Answer } from '../../../lib/worth/board'
import { money, percent } from '../../../lib/worth/model'
import { WORTH } from '../words'
import { Arrow, Face, LOOK, Shine, Tick } from './bits'
import { PageReady, ShareKeys, useShare } from './Result'

/**
 * Two accounts side by side — /worth/<me>/vs/<friend>. The one mechanic on the
 * page that brings in people who never asked: the post tags the friend, the
 * friend gets the notification, the friend checks their own (Fedor
 * 2026-10-20). Whoever is worth more is in cobalt on the card; the friend gets
 * the same claim key every unclaimed account gets.
 */

export const versusSrc = (a: Answer, b: Answer) =>
  `/worth/${a.account.handle}/vs/${b.account.handle}/card.png?v=${a.account.at}-${b.account.at}&look=${LOOK}`

export function Versus({ a, b, fresh }: { a: Answer; b: Answer; fresh: boolean }) {
  const share = useShare(
    `/worth/${a.account.handle}/vs/${b.account.handle}`,
    versusSrc(a, b),
    `x-account-worth-${a.account.handle}-vs-${b.account.handle}.png`,
  )

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className={`w-full ${fresh ? 'w-land' : ''}`}>
        <Shine>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={versusSrc(a, b)}
            width={1200}
            height={630}
            alt={`@${a.account.handle} vs @${b.account.handle}`}
            className="block aspect-[1200/630] w-full rounded-[18px] border border-k-border bg-k-surface"
          />
        </Shine>
      </div>

      <ShareKeys
        share={share}
        text={WORTH.versus.tweet(money(a.valuation.worth), b.account.handle, money(b.valuation.worth))}
        compare={a.account.handle}
      />

      <div className="mt-2 w-full overflow-hidden rounded-[18px] border border-k-border bg-k-surface">
        {[a, b].map((r) => (
          <div key={r.account.handle} className="flex items-center gap-3 border-b border-k-border/70 px-4 py-3 last:border-b-0 land:px-5">
            <Face src={r.account.avatar} handle={r.account.handle} size={36} />
            <Link href={`/worth/${r.account.handle}`} className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate text-[14px] leading-5 font-semibold">
                <span className="truncate">{r.account.name}</span>
                {r.account.listed && <Tick size={14} />}
              </span>
              <span className="block truncate text-[12px] leading-4 text-k-muted">
                @{r.account.handle} · better than {percent(r.valuation.beats)}
              </span>
            </Link>
            <span className="font-display text-[22px] leading-none tracking-[-0.04em] tabular-nums">{money(r.valuation.worth)}</span>
          </div>
        ))}
        {!b.account.listed && (
          <Link
            href={`/@${b.account.handle}`}
            className="flex h-11 items-center justify-center gap-1.5 bg-k-canvas text-[13px] font-medium text-k-ink transition-colors hover:bg-k-hover"
          >
            @{b.account.handle}: {WORTH.versus.claim}
            <Arrow />
          </Link>
        )}
      </div>

      <div className="mt-7 w-full land:mt-9">
        <PageReady result={a} />
      </div>
    </div>
  )
}
