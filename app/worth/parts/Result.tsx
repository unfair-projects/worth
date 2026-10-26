'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { Key } from '../../../components/kit/keys'
import type { Result as Answer } from '../../../lib/worth/board'
import { CPM, PER_WEEK, YEARS, byFollowers, byViews, count, handleFrom, money, moneyFull, mrr, pageLift, perMonth, rate, rateCard, times, type Month } from '../../../lib/worth/model'
import { WORTH } from '../words'
import { DownGlyph, Face, LinkGlyph, OutGlyph, PHONE, Shine, Tick, XMark, cardSrc, narrow } from './bits'

/**
 * One account's answer, in three groups with air between them (Fedor
 * 2026-10-21: cleaner, more spacing, no small print, grouped so it reads —
 * and the blocks stay blocks, just further apart):
 * the number — the card and what to do with it, a friend to compare with
 * among the keys; the page we would publish for them, priced, which is the
 * whole point of the page; and the detail: the next five years as monthly
 * income, the methodology, and their best post.
 */

/* --------------------------------------------------------------- sharing */

/** `png` may be asked at the press: a phone downloads its own card */
export function useShare(url: string, png: string | (() => string), file: string) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const post = (text: string) => {
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${window.location.origin}${url}`)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    const at = typeof png === 'function' ? png() : png
    const src = `${at}${at.includes('?') ? '&' : '?'}download=1`
    try {
      const blob = await (await fetch(src)).blob()
      const f = new File([blob], file, { type: 'image/png' })
      /* a phone saves a picture through its share sheet ("Save Image"); a desktop downloads a file */
      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] }).catch(() => {})
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = f.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4_000)
      }
    } catch {
      window.open(src, '_blank')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1_600)
    } catch {
      /* a browser that refuses the clipboard still has the address bar */
    }
  }

  return { post, save, copy, copied, saving }
}

export function ShareKeys({ share, text, compare }: { share: ReturnType<typeof useShare>; text: string; compare?: string }) {
  const [comparing, setComparing] = useState(false)
  /* a friend to compare with is a key among the others (Fedor 2026-10-21); pressed, the row becomes its field */
  if (compare && comparing) return <Compare me={compare} onClose={() => setComparing(false)} />
  const wide = compare ? 'w-full' : ''
  return (
    <div className={compare ? 'grid w-full grid-cols-2 gap-2.5 land:grid-cols-4' : 'flex w-full flex-wrap items-center justify-center gap-2.5'}>
      <Key face="ink" size="lg" onClick={() => share.post(text)} className={wide}>
        <XMark size={14} />
        {WORTH.share}
      </Key>
      <Key face="white" size="lg" onClick={share.save} disabled={share.saving} className={wide}>
        <DownGlyph />
        {WORTH.download}
      </Key>
      <Key face="white" size="lg" onClick={share.copy} className={wide}>
        <LinkGlyph />
        {share.copied ? WORTH.copied : WORTH.copy}
      </Key>
      {compare && (
        <Key face="white" size="lg" onClick={() => setComparing(true)} className={wide}>
          <span className="font-display text-[17px] leading-none tracking-[-0.04em]">vs</span>
          {WORTH.versus.go}
        </Key>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- result */

export function Result({ result, fresh }: { result: Answer; fresh: boolean }) {
  const { account, valuation } = result
  const share = useShare(
    `/worth/${account.handle}`,
    () => cardSrc(result, narrow() ? 'portrait' : 'tall'),
    `x-account-worth-${account.handle}.png`,
  )
  const rise = (ms: number) => (fresh ? { className: 'w-rise', style: { animationDelay: `${ms}ms` } } : { className: '', style: {} })

  return (
    <div className="flex w-full flex-col">
      {/* the number, and what to do with it */}
      <div className={`w-full ${fresh ? 'w-land' : ''}`}>
        <Shine>
          {/* a phone gets the portrait card, set for its width; a wide screen the tall one */}
          <picture>
            <source media={PHONE} srcSet={cardSrc(result, 'portrait')} width={1080} height={1350} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardSrc(result)}
              width={1200}
              height={750}
              alt={`${account.name}'s X account can earn up to ${money(perMonth(valuation))} a month`}
              className="block aspect-[1080/1350] w-full rounded-[18px] border border-k-border bg-k-surface land:aspect-[1200/750]"
            />
          </picture>
        </Shine>
      </div>
      <div className={`mt-4 w-full ${rise(100).className}`} style={rise(100).style}>
        <ShareKeys share={share} text={WORTH.tweet(money(perMonth(valuation)))} compare={account.handle} />
      </div>

      {/* the post that earns most, right under the card (Ilya 2026-10-21) */}
      {account.top && (
        <div className={`mt-12 w-full land:mt-14 ${rise(200).className}`} style={rise(200).style}>
          <BestPost result={result} />
        </div>
      )}

      {/* the page */}
      <div className={`mt-5 w-full land:mt-6 ${rise(250).className}`} style={rise(250).style}>
        <PageReady result={result} />
      </div>

      {/* the income, and how it is counted */}
      <div className={`mt-12 flex w-full flex-col gap-5 land:mt-14 land:gap-6 ${rise(300).className}`} style={rise(300).style}>
        <Earnings result={result} fresh={fresh} />
        <Methodology result={result} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- the push */

/** the page we would publish for them, priced off their own numbers: one key from live */
export function PageReady({ result }: { result: Answer }) {
  const { account, valuation, rank } = result

  if (account.listed) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-[20px] bg-k-canvas px-5 py-6 text-center land:flex-row land:justify-between land:px-7 land:text-left">
        <div className="min-w-0">
          <div className="flex items-center justify-center gap-1.5 text-[17px] leading-6 font-semibold land:justify-start">
            <Tick size={16} />
            {WORTH.page.live}
          </div>
          {rank && <div className="mt-1 text-[15px] leading-5 text-k-muted">{WORTH.page.rank(rank.place, rank.of)}</div>}
        </div>
        <Key face="white" size="lg" href={`https://unfair.so/x/@${account.handle}`}>
          {WORTH.page.open}
          <OutGlyph />
        </Key>
      </div>
    )
  }

  /* the prices the page would carry, and the worth it would add: their own numbers with the page's multiplier in place of the missing one */
  const withPage = pageLift(valuation)
  const card = rateCard(valuation.perPartnership * withPage)
  const gain = perMonth(valuation) * (withPage - 1)
  return (
    <div className="w-full rounded-[24px] border-2 border-k-accent bg-k-surface px-5 pt-6 pb-5 shadow-[0_0_0_6px_var(--color-k-accent-soft)] land:px-8 land:pt-8 land:pb-7">
      <h2 className="font-display text-[34px] leading-[0.98] tracking-[-0.04em] land:text-[44px]">
        {/* one ink for the whole line: green in the middle of it read as loud (Fedor 2026-10-21) */}
        {WORTH.page.title}
      </h2>
      <p className="mt-3 text-[17px] leading-6 text-k-muted land:text-[19px] land:leading-7">{WORTH.page.sub(money(gain))}</p>

      <div className="mt-7 grid grid-cols-3 gap-3 land:mt-8">
        {/* every dollar, as a creator types a price: "$2.4K" beside "$360" read as $24K */}
        {[
          [WORTH.page.post, moneyFull(card.post), ''],
          [WORTH.page.repost, moneyFull(card.repost), ''],
          [WORTH.page.bio, moneyFull(card.bio), WORTH.page.week],
        ].map(([label, price, per]) => (
          <div key={label} className="min-w-0">
            <div className="truncate text-[22px] leading-7 font-semibold tracking-[-0.02em] tabular-nums land:text-[28px] land:leading-8">
              {price}
              {per && <span className="text-[15px] font-medium text-k-muted land:text-[17px]">{per}</span>}
            </div>
            <div className="mt-1.5 truncate text-[14px] leading-5 text-k-muted">{label}</div>
          </div>
        ))}
      </div>

      <Key face="accent" size="lg" href={`/@${account.handle}`} className="mt-8 w-full land:h-12 land:text-[16px]">
        {WORTH.page.publish}
      </Key>
      <p className="mt-4 text-center text-[14px] leading-5 text-k-muted">{WORTH.page.note}</p>
    </div>
  )
}

/* ----------------------------------------------------------- the blocks */

/** every block under the page's: one frame, one head (Fedor 2026-10-21: blocks, with air between them) */
const BLOCK = 'w-full rounded-[22px] border border-k-border bg-k-surface p-5 land:p-7'

/** a block's head: what it is on the left, its number big on the right, and what that number is under it */
function Head({ title, sub, value, note, aside }: { title: string; sub?: ReactNode; value?: ReactNode; note?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[18px] leading-6 font-semibold land:text-[20px] land:leading-7">{title}</h2>
        {sub && <div className="mt-1 text-[15px] leading-5 text-k-muted">{sub}</div>}
      </div>
      {value && (
        <div className="flex shrink-0 flex-col items-end">
          <div className="font-display text-[34px] leading-none tracking-[-0.04em] whitespace-nowrap text-k-accent tabular-nums land:text-[40px]">
            {value}
          </div>
          {note && <div className="mt-1.5 text-right text-[14px] leading-5 text-k-muted">{note}</div>}
        </div>
      )}
      {aside}
    </div>
  )
}

/* -------------------------------------------------------------- the MRR */

/* the chart's own units: the lines are drawn in these and stretched to the plot */
const W = 600
const H = 200

/**
 * The coming year as income, month by month (Fedor 2026-10-21: a potential
 * MRR rather than a price, so it reads as earning, not selling; a line with
 * the seasons in it; a month to read under the pointer, posts and price;
 * "still naive: more detail, months, the growth"; "count it by months — the
 * five years are only for the multiplier"; and "make it grow, make it
 * interesting"). So it is this month to the same month a year on, drawn as a
 * forecast is, a grid with its dollars and every month named: the page goes
 * live, brands find it over a quarter, and the line climbs through the
 * seasons to the month a year out, which is what it quotes until somebody
 * points, and what the card says.
 *
 * The calendar is UTC's, so the server and the browser draw the same months.
 */
function Earnings({ result, fresh }: { result: Answer; fresh: boolean }) {
  const [start] = useState(() => {
    const d = new Date()
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })
  /* this month and the twelve after it, so the year's growth shows month to same month */
  const months = useMemo(() => mrr(result.valuation, start.m).slice(0, 13), [result.valuation, start.m])
  const [at, setAt] = useState<number | null>(null)
  const [drawn, setDrawn] = useState(!fresh)
  const fill = `mrr-${useId().replace(/:/g, '')}`

  useEffect(() => {
    if (drawn) return
    const t = window.setTimeout(() => setDrawn(true), 120)
    return () => clearTimeout(t)
  }, [drawn])

  const last = months.length - 1
  const end = months.length - 1
  const step = niceStep(Math.max(...months.map((x) => x.mrr)) / 3)
  const top = Math.ceil((Math.max(...months.map((x) => x.mrr)) * 1.06) / step) * step
  const grid = Array.from({ length: Math.round(top / step) }, (_, k) => (k + 1) * step)
  const y = (v: number) => H - (v / top) * H
  const points = months.map((x, m) => [(m / last) * W, y(x.mrr)] as const)
  const line = curve(points)
  const i = at ?? end
  const date = (m: number) => new Date(Date.UTC(start.y, start.m + m, 1))
  const name = (m: number, month: 'short' | 'long') => date(m).toLocaleDateString('en-US', { month, timeZone: 'UTC' })
  const read = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setAt(Math.min(last, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * last))))
  }
  const x = (m: number) => `${(m / last) * 100}%`

  return (
    <div className={BLOCK}>
      <Head
        title={WORTH.chart.title}
        sub={at == null ? WORTH.chart.later : date(at).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        value={
          <>
            {moneyFull(months[i].mrr)}
            <span className="text-[0.6em] text-k-accent/60">{WORTH.chart.mo}</span>
          </>
        }
      />

      {/* the plot, its dollars in a gutter on the right */}
      <div className="relative mt-8 h-[170px] pr-11 land:h-[210px] land:pr-12">
        {grid.map((v) => (
          <Fragment key={v}>
            <span className="absolute right-11 left-0 border-t border-dashed border-k-border land:right-12" style={{ top: `${(y(v) / H) * 100}%` }} />
            <span
              className="absolute right-0 -translate-y-1/2 text-[12px] leading-4 text-k-muted tabular-nums"
              style={{ top: `${(y(v) / H) * 100}%` }}
            >
              {money(v)}
            </span>
          </Fragment>
        ))}
        <span className="absolute right-11 bottom-0 left-0 border-t border-k-border land:right-12" />

        <div className="absolute inset-y-0 right-11 left-0 cursor-crosshair touch-pan-y text-k-accent land:right-12" onPointerMove={read} onPointerDown={read} onPointerLeave={() => setAt(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
            style={{ clipPath: drawn ? 'inset(-8px -8px -8px -8px)' : 'inset(-8px 100% -8px -8px)', transition: 'clip-path 1.1s cubic-bezier(0.3, 0.7, 0.2, 1)' }}
          >
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${fill})`} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* the month under the pointer: a hairline down to it, a dot on the line (the year-out month's when nobody points), and what the month is made of */}
          {at != null && <span className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-k-ink/20" style={{ left: x(at) }} />}
          <span
            className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-k-surface bg-k-accent shadow-[0_0_0_4px_var(--color-k-accent-soft)] transition-opacity"
            style={{ left: x(i), top: `${(points[i][1] / H) * 100}%`, opacity: drawn ? 1 : 0 }}
          />
          {at != null && (
            <Tip
              month={months[at]}
              notes={[WORTH.chart.ramp[at] ?? WORTH.chart.season[date(at).getUTCMonth()]].filter(Boolean)}
              x={(at / last) * 100}
              y={(points[at][1] / H) * 100}
            />
          )}
        </div>
      </div>

      {/* every month named (every other on a phone), the year under the first and under January */}
      <div className="relative mt-2 mr-11 h-9 land:mr-12">
        {months.map((_, m) => (
          <span
            key={m}
            className={`absolute top-0 flex -translate-x-1/2 flex-col items-center ${m % 2 ? 'hidden land:flex' : ''}`}
            style={{ left: x(m) }}
          >
            <span className={`text-[12px] leading-4 ${m === i && at != null ? 'font-semibold text-k-ink' : 'text-k-muted'}`}>{name(m, 'short')}</span>
            {(m === 0 || date(m).getUTCMonth() === 0) && (
              <span className="mt-0.5 text-[12px] leading-4 font-semibold text-k-ink tabular-nums">{date(m).getUTCFullYear()}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

/** a round step for the grid: 1, 2, 2.5 or 5 of a power of ten */
function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

/**
 * A month, read: how many posts at what price, and under it what the month
 * is going through, the ramp or the season. Over the dot, or under it where
 * the line runs high; kept inside the plot by sliding along its own width as
 * it nears an edge.
 */
function Tip({ month, notes, x, y }: { month: Month; notes: string[]; x: number; y: number }) {
  return (
    <span
      className="pointer-events-none absolute z-10 rounded-[12px] border border-k-border bg-k-surface px-3 py-2 whitespace-nowrap shadow-[0_10px_24px_-10px_rgba(0,0,0,0.22)]"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-${x}%, ${y > 40 ? 'calc(-100% - 16px)' : '16px'})` }}
    >
      <span className="block text-[15px] leading-5 font-semibold tabular-nums">{WORTH.chart.posts(month.posts, moneyFull(month.price))}</span>
      {notes.length > 0 && <span className="mt-0.5 block text-[13px] leading-[18px] text-k-muted">{notes.join(' · ')}</span>}
    </span>
  )
}

/** a smooth line through the points: Catmull-Rom, as cubic Béziers */
function curve(p: readonly (readonly [number, number])[]): string {
  const f = (n: number) => n.toFixed(2)
  let d = `M${f(p[0][0])},${f(p[0][1])}`
  for (let k = 0; k < p.length - 1; k++) {
    const a = p[k - 1] ?? p[k]
    const b = p[k]
    const c = p[k + 1]
    const e = p[k + 2] ?? c
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`
  }
  return d
}

/* ---------------------------------------------------------- methodology */

/**
 * How the number is made (Fedor 2026-10-21: a block of its own called
 * Methodology; then, of the statement it first was, "too complex, make it
 * serious but clear, not so huge — maybe it opens on a press, with the
 * formula's text"). Folded, it is one line of figures, each with what it is,
 * multiplying out to the worth; opened, each figure's formula and where its
 * inputs come from, and the sources.
 */
function Methodology({ result }: { result: Answer }) {
  const { account: a, valuation: v } = result
  const [open, setOpen] = useState(false)
  const views = v.medianViews != null && v.medianViews > 0 ? v.medianViews : null
  const span = v.worth / v.perYear
  const pct = `${trimmed((v.growth * 100).toFixed(1))}%`
  const growth = Array.from({ length: YEARS }, (_, k) => trimmed(Math.pow(1 + v.growth, k).toFixed(2)))
  const factors: { label: string; x: number; bad?: boolean }[] = [
    { label: a.engagement != null ? `${WORTH.x.engagement.toLowerCase()} ${rate(a.engagement)}` : WORTH.x.engagement.toLowerCase(), x: v.x.engagement },
    ...(v.x.nicheLabel ? [{ label: v.x.nicheLabel, x: v.x.niche }] : []),
    {
      label: a.perWeek != null ? `${WORTH.x.posting.toLowerCase()} ${WORTH.formula.perWeek(Math.round(a.perWeek))}` : WORTH.x.posting.toLowerCase(),
      x: v.x.posting,
    },
    /* no page is the one that costs, and says so in red */
    a.listed ? { label: WORTH.x.verified.toLowerCase(), x: v.x.verified } : { label: WORTH.x.unverified.toLowerCase(), x: v.x.verified, bad: true },
  ]
  const terms: { value: string; say: string; total?: boolean }[] = [
    { value: moneyFull(v.base), say: WORTH.formula.terms.post },
    { value: trimmed(v.x.all.toFixed(2)), say: WORTH.formula.terms.account },
    { value: String(PER_WEEK * 52), say: WORTH.formula.terms.deals },
    { value: span.toFixed(1), say: WORTH.formula.terms.years },
    { value: money(v.worth), say: WORTH.formula.terms.worth, total: true },
  ]

  return (
    <div className={BLOCK}>
      <Head
        title={WORTH.formula.title}
        aside={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[14px] leading-5 font-medium text-k-muted transition-colors hover:bg-k-hover hover:text-k-ink"
          >
            {open ? WORTH.formula.close : WORTH.formula.open}
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      {/* the formula, in one line of figures on a wide screen (Fedor 2026-10-21), wrapping on a phone */}
      <div className="mt-6 flex flex-wrap items-start gap-x-3 gap-y-4 land:flex-nowrap land:justify-between land:gap-x-2">
        {terms.map((t, i) => (
          <Fragment key={t.say}>
            {i > 0 && <span className="pt-0.5 font-display text-[24px] leading-7 text-k-faint">{t.total ? '=' : '×'}</span>}
            <span className="flex flex-col">
              <span
                className={
                  t.total
                    ? 'font-display text-[30px] leading-7 tracking-[-0.04em] whitespace-nowrap text-k-accent tabular-nums land:text-[32px] land:leading-8'
                    : 'text-[22px] leading-7 font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums land:text-[24px] land:leading-8'
                }
              >
                {t.value}
              </span>
              <span className="mt-1 text-[13px] leading-5 whitespace-nowrap text-k-muted">{t.say}</span>
            </span>
          </Fragment>
        ))}
      </div>

      {/* the math, folded until asked for */}
      <div className="w-fold" data-open={open}>
        <div>
          <dl className="mt-6 border-t border-k-border pt-2 text-[15px] leading-6">
            <Math_ label={WORTH.formula.base} value={moneyFull(v.base)}>
              {views
                ? WORTH.formula.baseHow(moneyFull(byFollowers(v.followers)), moneyFull(byViews(views)))
                : WORTH.formula.baseAlone(moneyFull(byFollowers(v.followers)))}
              <span className="block text-k-faint">{WORTH.formula.baseFrom(count(v.followers), views ? count(views) : null, CPM)}</span>
            </Math_>
            <Math_ label={WORTH.formula.x} value={times(v.x.all)}>
              {factors.map((f, i) => (
                <Fragment key={f.label}>
                  {i > 0 && ' × '}
                  <span className={f.bad ? 'text-k-danger' : undefined}>
                    {trimmed(f.x.toFixed(2))} {f.label}
                  </span>
                </Fragment>
              ))}
            </Math_>
            <Math_ label={WORTH.formula.deals} value={`×${PER_WEEK * 52}`}>
              {WORTH.formula.dealsHow}
            </Math_>
            <Math_ label={WORTH.formula.years} value={`×${span.toFixed(1)}`}>
              {WORTH.formula.yearsHow(growth.join(' + '), pct)}
            </Math_>
          </dl>
          <p className="mt-3 text-[14px] leading-5 text-k-faint">{WORTH.formula.sources}</p>
        </div>
      </div>
    </div>
  )
}

/** a line of the math: what it is and its figure, then how it is made */
function Math_({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="border-b border-k-border/70 py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-semibold">{label}</dt>
        <span className="shrink-0 font-semibold tabular-nums">{value}</span>
      </div>
      <dd className="mt-0.5 text-k-muted">{children}</dd>
    </div>
  )
}

const trimmed = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s)

/* ------------------------------------------------------------- best post */

/** their most viewed post, drawn the way X draws a post, priced as a sponsored one */
function BestPost({ result }: { result: Answer }) {
  const { account, valuation } = result
  const top = account.top
  if (!top) return null
  const worth = (top.views / 1000) * CPM * valuation.x.all
  return (
    <a href={top.url} target="_blank" rel="noopener noreferrer" className={`group block transition-colors hover:border-k-accent/40 ${BLOCK}`}>
      <Head title={WORTH.best.title} sub={WORTH.best.sub(count(top.views))} value={money(worth)} note={WORTH.best.note} />
      <div className="mt-6 rounded-[16px] bg-k-canvas p-4 land:p-5">
        <div className="flex items-center gap-3">
          <Face src={account.avatar} handle={account.handle} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] leading-5 font-semibold">{account.name}</div>
            <div className="truncate text-[14px] leading-5 text-k-muted">@{account.handle}</div>
          </div>
          <span className="text-k-ink transition-transform group-hover:scale-110">
            <XMark size={18} />
          </span>
        </div>
        <p className="mt-3 line-clamp-4 text-[16px] leading-[1.5] whitespace-pre-line">{top.text}</p>
      </div>
    </a>
  )
}

/* ---------------------------------------------------------------- versus */

/** the keys' row turned into a friend's handle: read first, so the page it opens is already in the store */
function Compare({ me, onClose }: { me: string; onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  const go = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const friend = handleFrom(text)
    if (!friend) return setError(WORTH.errors.handle)
    if (friend.toLowerCase() === me.toLowerCase()) return setError(WORTH.versus.self)
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/worth/${encodeURIComponent(friend)}`)
      const body = (await res.json().catch(() => null)) as { account?: { handle: string }; error?: { message?: string } } | null
      if (!res.ok || !body?.account) throw new Error(body?.error?.message || 'X is not answering. Try again in a minute.')
      router.push(`/worth/${me}/vs/${body.account.handle}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={go} className="w-full" noValidate>
      <div
        className="w-rise flex h-12 w-full items-center gap-2 rounded-[14px] border-2 border-k-accent bg-k-surface pr-1.5 pl-4"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <span className="font-display text-[18px] leading-none tracking-[-0.04em] text-k-faint">vs</span>
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          placeholder={WORTH.versus.placeholder}
          aria-label={WORTH.versus.placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-k-faint"
        />
        <Key face="accent" size="md" type="submit" disabled={busy}>
          {busy ? '…' : WORTH.versus.go}
        </Key>
        <button
          type="button"
          onClick={onClose}
          aria-label={WORTH.versus.close}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-k-muted transition-colors hover:bg-k-hover hover:text-k-ink"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {error && <p className="mt-2 text-center text-[14px] leading-5 font-medium text-k-tangerine">{error}</p>}
    </form>
  )
}
