'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { Key } from '../../components/kit/keys'
import { CAL_SLUG, useCalEmbed } from '../../lib/cal'
import type { Result as Answer, Row } from '../../lib/worth/board'
import { handleFrom, money, perMonth } from '../../lib/worth/model'
import { Arrow, Dots, Face, Tick, XMark, cardSrc, narrow, reduced } from './parts/bits'
import { Board, type BoardData } from './parts/Board'
import { useFeed, type FeedData } from './parts/Feed'
import { Reading } from './parts/Reading'
import { Result } from './parts/Result'
import { Versus } from './parts/Versus'
import { WORTH } from './words'
import './worth.css'

/**
 * creators.unfair.so/worth — "How much is your X account worth?" (Fedor
 * 2026-10-20), and /worth/<handle> and /worth/<handle>/vs/<friend>, which are
 * the same page holding an answer.
 *
 * One field, one reading, one card — and around them what keeps the page
 * moving and pushes toward the reason it exists: a page on unfair.so. The way
 * in for a creator is on the first screen, above the question; while nobody
 * has asked yet, real accounts visit the hero's margins with what they are
 * worth, on unfair.so's own pixel field; the answer comes with the page
 * already priced; the board right under it, live, marks everyone without one
 * as Unclaimed. Brands get one quiet door, at the foot.
 *
 * When an answer lands, the address becomes the account's own: that is the
 * link a share carries, and it opens straight on the card.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; handle: string; result: Answer | null }
  | { kind: 'done'; result: Answer; fresh: boolean }
  | { kind: 'versus'; a: Answer; b: Answer; fresh: boolean }

export function WorthPage({
  initial,
  versus,
  board,
  feed,
}: {
  initial: Answer | null
  versus?: { a: Answer; b: Answer } | null
  board: BoardData
  feed: FeedData
}) {
  const start: Phase = versus
    ? { kind: 'versus', a: versus.a, b: versus.b, fresh: false }
    : initial
      ? { kind: 'done', result: initial, fresh: false }
      : { kind: 'idle' }
  const [phase, setPhase] = useState<Phase>(start)
  const [boardData, setBoardData] = useState(board)
  const feedData = useFeed(feed)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  useCalEmbed()

  /* right after a deploy the board is still reading its creators: ask again until it has them */
  useEffect(() => {
    if (boardData.total > 0) return
    const t = window.setInterval(async () => {
      try {
        const res = await fetch('/api/worth/board')
        const b = res.ok ? ((await res.json()) as BoardData) : null
        if (b && b.total > 0) setBoardData(b)
      } catch {
        /* the next tick asks again */
      }
    }, 4_000)
    return () => clearInterval(t)
  }, [boardData.total])

  /* the account this reader just valued, for the head of the Live tab */
  const latest = useMemo<Row | null>(() => (phase.kind === 'done' && phase.fresh ? rowOf(phase.result) : null), [phase])

  const refuse = (message: string) => {
    setError(message)
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
  }

  const calculate = async (e: FormEvent) => {
    e.preventDefault()
    if (phase.kind === 'reading') return
    const handle = handleFrom(text)
    if (!handle) return refuse(WORTH.errors.handle)
    setError(null)
    field.current?.blur()
    const before = phase
    setPhase({ kind: 'reading', handle, result: null })
    /* the field stays in sight above the reading: the arithmetic is the show */
    requestAnimationFrame(() => {
      const el = stage.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 120
      if (Math.abs(top - window.scrollY) > 40) window.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' })
    })
    try {
      const res = await fetch(`/api/worth/${encodeURIComponent(handle)}`)
      const body = (await res.json().catch(() => null)) as (Answer & { error?: { message?: string } }) | null
      if (!res.ok || !body?.account) throw new Error(body?.error?.message || 'X is not answering. Try again in a minute.')
      /* the card renders while the reading plays, so it is there the moment it ends */
      new Image().src = cardSrc(body, narrow() ? 'portrait' : 'tall')
      setPhase({ kind: 'reading', handle, result: body })
    } catch (err) {
      setPhase(before)
      refuse((err as Error).message)
    }
  }

  const finish = (result: Answer) => {
    setPhase({ kind: 'done', result, fresh: true })
    window.history.replaceState(null, '', `/worth/${result.account.handle}`)
    document.title = `@${result.account.handle}'s X account can earn up to ${money(perMonth(result.valuation))} a month`
    /* every check goes to PostHog as well, where the list of who was checked
       outlives a deploy (Fedor 2026-10-21: a table of checked handles) */
    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) return
        posthog.capture('worth_checked', {
          handle: result.account.handle,
          followers: result.account.followers,
          median_views: result.account.medianViews,
          worth: Math.round(result.valuation.worth),
          listed: result.account.listed,
        })
      })
      .catch(() => {})
    /* they are on the board now: the table under them should say so */
    fetch('/api/worth/board')
      .then((r) => (r.ok ? r.json() : null))
      .then((b: BoardData | null) => b && setBoardData(b))
      .catch(() => {})
  }

  const reading = phase.kind === 'reading'
  const current = phase.kind === 'done' ? phase.result.account.handle : phase.kind === 'versus' ? phase.a.account.handle : null
  const faces = boardData.faces

  return (
    <div className="relative min-h-dvh bg-k-surface text-k-ink">
      {/* the hero: unfair.so's blue with the share card's pixel city standing on its foot, the bar inside it (Ilya 2026-10-26) */}
      <div className="relative isolate overflow-x-clip pb-[200px]" style={{ background: 'linear-gradient(var(--color-k-accent), var(--color-k-accent)) top / 100% calc(100% - 48px) no-repeat' }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[240px] bg-[url(/worth/city.svg)] bg-repeat-x bg-bottom [image-rendering:pixelated]"
        />
        {phase.kind === 'idle' && <Snow />}
        <Bar join={current ? `/@${current}` : '/'} />

        <section className="mx-auto flex w-full max-w-[680px] flex-col items-center px-4 pt-8 text-white land:px-6 land:pt-14">
          {/* the way in for a creator, on the first screen (Fedor 2026-10-20) */}
          <a
            data-clear
            href={current ? `/@${current}` : '/'}
            className="group flex h-9 items-center gap-2 rounded-full border border-k-border bg-k-surface pr-3 pl-1.5 text-[13px] text-k-ink leading-5 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-k-accent"
          >
            <span className="flex -space-x-1.5">
              {faces.map((f) => (
                <Face key={f.handle} src={f.avatar} handle={f.handle} size={24} className="ring-2 ring-k-surface" />
              ))}
            </span>
            <span>{WORTH.join(Math.max(boardData.creators, 1000))}</span>
            <span className="text-k-accent transition-transform group-hover:translate-x-0.5">
              <Arrow />
            </span>
          </a>

          <h1 data-clear="text" className="mt-6 text-center font-display text-[33px] leading-[0.96] text-white tracking-[-0.04em] land:mt-7 land:text-[62px]">
            {WORTH.title[0]}
            <br />
            {WORTH.title[1]}
          </h1>

          {/* narrower than the card under it: as wide as the card, it sat heavy (Fedor 2026-10-21, both ways) */}
          <form onSubmit={calculate} className="mt-8 w-full max-w-[600px] land:mt-10" noValidate>
            <div
              data-clear
              data-door
              className={`flex w-full items-center gap-2.5 rounded-[16px] border-2 border-k-accent bg-k-surface py-1.5 pr-1.5 pl-4 shadow-[0_0_0_6px_var(--color-k-accent-soft)] land:gap-3 land:py-2 land:pr-2 land:pl-5 ${shaking ? 'w-shake' : ''}`}
              onAnimationEnd={() => setShaking(false)}
            >
              <span className="text-k-ink" aria-hidden>
                <XMark size={18} />
              </span>
              <input
                ref={field}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={WORTH.placeholder}
                aria-label={WORTH.placeholder}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                className="h-11 min-w-0 flex-1 bg-transparent text-[17px] text-k-ink outline-none placeholder:text-k-faint land:h-12 land:text-[20px]"
              />
              <Key face="accent" size="lg" type="submit" disabled={reading} className="land:h-12 land:px-6 land:text-[16px]">
                {reading ? <Dots /> : WORTH.go}
              </Key>
            </div>
            <p role="alert" className="mt-3 min-h-[18px] text-center text-[13px] leading-[18px] font-medium text-white">
              {error}
            </p>
          </form>

          {phase.kind === 'idle' && (
            <div data-clear className="mt-6 w-full max-w-[600px] text-center land:mt-8">
              <h2 className="font-display text-[28px] leading-[1] tracking-[-0.04em] land:text-[36px]">{WORTH.intro.title}</h2>
              <div className="mx-auto mt-4 flex max-w-[560px] flex-col gap-4 text-left text-[16px] leading-[1.55] text-white/85 land:text-[17px]">
                <p>
                  {WORTH.intro.body[0][0]}
                  <a href={WORTH.intro.link} target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/60 underline-offset-2 hover:decoration-white">
                    {WORTH.intro.body[0][1]}
                  </a>
                  {WORTH.intro.body[0][2]}
                </p>
                <p>{WORTH.intro.body[1][0]}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <main className="mx-auto flex w-full max-w-[680px] flex-col items-center px-4 pt-2 land:px-6">
          <div ref={stage} className="w-full scroll-mt-6">
            {phase.kind === 'reading' && (
              <div className="mt-2">
                <Reading key={phase.handle} handle={phase.handle} result={phase.result} onDone={finish} />
              </div>
            )}
            {phase.kind === 'done' && (
              <div className="mt-2">
                <Result key={`${phase.result.account.handle}-${phase.result.account.at}`} result={phase.result} fresh={phase.fresh} />
              </div>
            )}
            {phase.kind === 'versus' && (
              <div className="mt-2">
                <Versus a={phase.a} b={phase.b} fresh={phase.fresh} />
              </div>
            )}
          </div>
      </main>

      <Board data={boardData} latest={latest} feed={feedData.items} />

      <Paid />

      <Launch />

      <footer className="mx-auto mt-16 flex w-full max-w-[960px] items-center border-t border-k-border px-4 py-6 land:px-6">
        <a href="/" className="font-display text-[18px] leading-none tracking-[-0.05em] text-k-ink">
          unfair.so
        </a>
      </footer>
    </div>
  )
}

/** a fresh answer, as a board row */
function rowOf({ account: a, valuation: v }: Answer): Row {
  return {
    handle: a.handle,
    name: a.name,
    avatar: a.avatar,
    listed: a.listed,
    followers: a.followers,
    medianViews: a.medianViews,
    perYear: v.perYear,
    worth: v.worth,
    checkedAt: a.checkedAt ?? null,
  }
}

/* ------------------------------------------------------------------ bar */

function Bar({ join }: { join: string }) {
  return (
    <header className="relative z-10 flex h-14 items-center justify-between gap-3 px-4 land:px-6">
      <a href="/" className="font-display text-[22px] leading-none tracking-[-0.05em] text-white">
        unfair.so
      </a>
      <nav className="flex items-center gap-1 land:gap-2">
        <button
          type="button"
          data-cal-link={CAL_SLUG}
          className="hidden h-8 cursor-pointer items-center rounded-lg px-2.5 text-[13px] leading-4 font-medium text-white/85 transition-colors hover:text-white land:flex"
        >
          {WORTH.forBrands}
        </button>
        <Key face="white" size="sm" href={join}>
          {WORTH.become}
        </Key>
      </nav>
    </header>
  )
}

/* --------------------------------------------------------------- launch */

/** the managed plan, from unfair.so/pricing laid out across: the brands' one door, a call (Ilya 2026-10-26) */
function Launch() {
  const L = WORTH.launch
  return (
    <section id="brands" className="mx-auto mt-20 w-full max-w-[960px] px-4 land:px-6">
      <h2 className="mb-6 font-display text-[34px] leading-[0.96] tracking-[-0.04em] land:mb-8 land:text-[44px]">{L.question}</h2>
      <div className="grid gap-8 rounded-[22px] border border-k-border bg-k-surface px-6 py-7 land:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] land:gap-10 land:px-9 land:py-9">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Castle />
            <h2 className="font-display text-[34px] leading-none tracking-[-0.04em] land:text-[38px]">{L.title}</h2>
            <span className="rounded-lg bg-k-accent-soft px-3 py-1 text-[13px] leading-5 font-medium text-k-accent">{L.badge}</span>
          </div>
          <p className="mt-3 text-[15px] leading-6 text-k-muted">
            <span className="font-semibold text-k-ink">{L.lead}</span> {L.sub}
          </p>
          <div className="mt-5 rounded-[14px] bg-k-canvas px-5 py-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] leading-none tracking-[-0.04em]">{L.price}</span>
              <span className="text-[15px] text-k-muted">{L.per}</span>
            </div>
            <p className="mt-2 text-[14px] leading-5 text-k-muted">
              <span className="font-semibold text-k-ink">{L.fee}</span> {L.cap}
            </p>
          </div>
          <div className="mt-5 land:mt-auto land:pt-5">
            <button
              type="button"
              data-cal-link={CAL_SLUG}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-k-accent px-5 text-[16px] font-medium text-white shadow-[0_4px_0_0_var(--color-k-accent-deep)] transition-transform duration-100 select-none active:translate-y-1 active:shadow-none"
            >
              {L.cta}
              <Arrow />
            </button>
          </div>
        </div>

        <div>
          <div className="text-[15px] leading-6 font-semibold">{L.includes}</div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {L.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-6">
                <span className="mt-1 text-k-faint">
                  <Tick size={16} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] leading-5 text-k-faint">{L.note}</p>
        </div>
      </div>
    </section>
  )
}

/** the plan's mark: a pixel castle, a keep with its battlements */
function Castle() {
  const rows = ['#.#.#.#.#.#', '###########', '###########', '.#########.', '.####.####.', '.####.####.']
  return (
    <svg width={33} height={18} viewBox="0 0 11 6" shapeRendering="crispEdges" aria-hidden className="shrink-0">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  )
}

/* --------------------------------------------------------------- payouts */

/** what has been paid so far, and what one payout can be: round sums from $50 to $3,000 */
const PAID_FROM = 250_000
const PAYOUT = { min: 50, max: 3_000, step: 50, every: 10_000 }

const payout = () => PAYOUT.min + PAYOUT.step * Math.floor((Math.random() * (PAYOUT.max - PAYOUT.min + PAYOUT.step)) / PAYOUT.step)

/** the figure under the board that keeps climbing, as if payouts were going out as you read (Ilya 2026-10-26) */
function Paid() {
  const [paid, setPaid] = useState(PAID_FROM)
  const [last, setLast] = useState<number | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => {
      const n = payout()
      setLast(n)
      setPaid((p) => p + n)
    }, PAYOUT.every)
    return () => window.clearInterval(t)
  }, [])

  return (
    <section className="mx-auto mt-20 w-full max-w-[960px] px-4 land:px-6">
      <div className="relative isolate overflow-hidden rounded-[22px] bg-k-accent px-6 pt-9 pb-[150px] text-center text-white land:px-9 land:pt-12 land:pb-[170px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[240px] bg-[url(/worth/city.svg)] bg-repeat-x bg-bottom [image-rendering:pixelated]"
        />
        <div className="text-[16px] leading-6 font-medium text-white/85 land:text-[18px]">{WORTH.paid.title}</div>
        <div className="mt-3 font-display text-[52px] leading-[0.96] tracking-[-0.04em] tabular-nums land:text-[120px]" aria-live="off">
          ${paid.toLocaleString('en-US')}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-[16px] leading-6 text-white/85 land:text-[18px]">
          <span>{WORTH.paid.sub}</span>
          <span className="inline-block min-w-[72px] rounded-full bg-white/15 px-3 py-0.5 text-[14px] font-medium tabular-nums" aria-hidden>
            {last ? `+$${last.toLocaleString('en-US')}` : '\u00a0'}
          </span>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ snow */

/** a pixel dollar, five cells by seven */
const DOLLAR = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..']

/* where each falls, how big, how fast, how far along it already is: fixed, so the server and the browser draw the same sky */
const FLAKES = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => ((i * 7919 + n * 104729) % 1000) / 1000
  return { left: 3 + r(1) * 94, cell: r(2) < 0.5 ? 3 : 4, fall: 11 + r(3) * 9, delay: -r(4) * 20, alpha: 0.25 + r(5) * 0.35 }
})

/** a few pixel dollars drifting down the opening screen, like snow (Ilya 2026-10-26) */
function Snow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {FLAKES.map((f, i) => (
        <svg
          key={i}
          className="w-fall absolute"
          style={{ left: `${f.left}%`, opacity: f.alpha, '--fall': `${f.fall}s`, '--delay': `${f.delay}s` } as React.CSSProperties}
          width={5 * f.cell}
          height={7 * f.cell}
          viewBox="0 0 5 7"
          shapeRendering="crispEdges"
          fill="white"
        >
          {DOLLAR.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)))}
        </svg>
      ))}
    </div>
  )
}
