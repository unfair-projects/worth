'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Key } from '../../../components/kit/keys'
import type { Board as BoardData, FeedItem, Row } from '../../../lib/worth/board'
import { count, money } from '../../../lib/worth/model'
import { WORTH } from '../words'
import { Face, Tick } from './bits'

/**
 * The board: everybody anybody checked, and every creator on unfair.so
 * (Fedor 2026-10-20). A creator's row wears the tick — their page is live and
 * brands book it; every other row is Unclaimed, which is the point: your
 * number is already public, and claiming it is one key away.
 *
 * Two tabs (Fedor 2026-10-21): Live, which it opens on, and Top. Live is the
 * board being valued as you watch: a row drops in at the head every few
 * seconds, "now", and the ones under it age a second at a time. It is timed
 * by the page, as if somebody had just pressed Calculate on each (Fedor:
 * "fake" live); the accounts and their numbers are the real ones. A real
 * check, yours or anybody's the feed brings, drops in the same way.
 *
 * It sits right under the hero and opens as a peek: the top rows, fading out
 * into a key for the rest.
 */

export type { BoardData }

type Tab = 'live' | 'top'
const PEEK = 8
const STEP = 30

export function Board({
  data,
  latest,
  feed,
}: {
  data: BoardData
  /** the account this reader just valued, for the head of Live */
  latest: Row | null
  /** what really happened lately, newest first */
  feed: FeedItem[]
}) {
  const [tab, setTab] = useState<Tab>('live')
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(STEP)
  const { entries, clock } = useLive(data.live, latest, feed)
  const total = tab === 'live' ? entries.length : data.top.length
  const visible = open ? (tab === 'live' ? entries.length : shown) : PEEK
  const peeking = !open && total > PEEK
  const grid =
    'grid grid-cols-[28px_minmax(0,1fr)_84px] items-center gap-x-3 land:grid-cols-[36px_minmax(0,1fr)_92px_108px_96px_104px] land:gap-x-4'

  /* nobody's row stays lit, the reader's own included (Fedor 2026-10-21): a row that just arrived in Live flashes, and that is all */
  const row = (r: Row, lead: React.ReactNode, key: string | number, className = '') => {
    return (
      <Link
        key={key}
        href={`/worth/${r.handle}`}
        className={`${grid} h-14 overflow-hidden border-b border-k-border/70 px-4 transition-colors last:border-b-0 hover:bg-k-hover/60 land:px-5 ${className}`}
      >
        {lead}
        <span className="flex min-w-0 items-center gap-3">
          <Face src={r.avatar} handle={r.handle} size={32} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-[14px] leading-5 font-semibold">
              <span className="truncate">{r.name}</span>
              {r.listed && <Tick size={14} />}
            </span>
            <span className="flex items-center gap-1.5 truncate text-[12px] leading-4 text-k-muted">
              <span className="truncate">@{r.handle}</span>
              {!r.listed && (
                <span className="shrink-0 rounded-full border border-dashed border-k-border px-1.5 text-[11px] leading-4 text-k-faint">
                  {WORTH.unclaimed}
                </span>
              )}
            </span>
          </span>
        </span>
        <span className="hidden text-right text-[14px] tabular-nums land:block">{count(r.followers)}</span>
        <span className="hidden text-right text-[14px] text-k-muted tabular-nums land:block">
          {r.medianViews != null ? count(r.medianViews) : '—'}
        </span>
        <span className="hidden text-right text-[14px] text-k-muted tabular-nums land:block">{money(r.perYear)}</span>
        <span className="text-right text-[15px] font-semibold tabular-nums">{money(r.worth)}</span>
      </Link>
    )
  }

  return (
    <section id="board" className="mx-auto mt-12 w-full max-w-[960px] scroll-mt-8 px-4 land:mt-16 land:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-[36px] leading-[0.96] tracking-[-0.04em] land:text-[48px]">{WORTH.board}</h2>
        {/* the house's tabs (components/dash ShellScreen Tabs): a grey tray, the one you are on a white tile (Fedor 2026-10-21: square, not a pill) */}
        <div role="tablist" className="flex w-fit items-center gap-[3px] rounded-[10px] bg-k-hover p-[3px]">
          {(['live', 'top'] as const).map((t) => {
            const on = tab === t
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setTab(t)
                  setShown(STEP)
                }}
                className={`flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] px-3 transition-colors duration-150 ${
                  on ? 'bg-k-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'hover:bg-k-border'
                }`}
              >
                {t === 'live' && (
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="w-glow absolute inset-0 rounded-full bg-k-money" />
                    <span className="relative size-1.5 rounded-full bg-k-money" />
                  </span>
                )}
                <span className={`text-[13px] leading-[17px] whitespace-nowrap ${on ? 'font-semibold text-k-ink' : 'font-medium text-k-muted'}`}>
                  {WORTH.tabs[t]}
                </span>
                {t === 'top' && (
                  <span className={`text-[13px] leading-[17px] tabular-nums ${on ? 'text-k-muted' : 'text-k-faint'}`}>{count(data.total)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-[18px] border border-k-border bg-k-surface">
        <div className={`${grid} h-10 border-b border-k-border px-4 text-[11px] font-medium tracking-[0.08em] text-k-faint uppercase land:px-5`}>
          <span>{tab === 'top' ? '#' : ''}</span>
          <span>{WORTH.cols.creator}</span>
          <span className="hidden text-right land:block">{WORTH.cols.followers}</span>
          <span className="hidden text-right land:block">{WORTH.cols.views}</span>
          <span className="hidden text-right land:block">{WORTH.cols.year}</span>
          <span className="text-right">{WORTH.cols.worth}</span>
        </div>

        {total === 0 && <div className="px-5 py-10 text-center text-[14px] text-k-muted">{WORTH.filling}</div>}

        {tab === 'live'
          ? entries.slice(0, visible).map((e) => {
              const age = clock - e.born
              return row(
                e.row,
                <span className={`text-[12px] tabular-nums ${age < 3 ? 'font-semibold text-k-accent' : 'text-k-muted'}`}>{since(age)}</span>,
                e.id,
                /* the opening rows were there when the page came; only the ones that arrive drop in */
                e.id >= AGES.length ? 'w-row-in' : '',
              )
            })
          : data.top.slice(0, visible).map((r, i) =>
              row(
                r,
                <span
                  className={`tabular-nums ${i < 3 ? 'font-display text-[22px] leading-none tracking-[-0.04em] text-k-accent' : 'text-[13px] text-k-muted'}`}
                >
                  {i + 1}
                </span>,
                r.handle,
              ),
            )}

        {/* the peek: the last rows fade into the key for the rest */}
        {peeking && (
          <div className="absolute inset-x-0 bottom-0 flex h-[168px] items-end justify-center bg-gradient-to-b from-transparent via-k-surface/80 to-k-surface pb-5">
            <Key face="white" size="md" onClick={() => setOpen(true)}>
              {WORTH.more}
            </Key>
          </div>
        )}
      </div>

      {open && tab === 'top' && shown < total && (
        <div className="mt-4 flex justify-center">
          <Key face="white" size="md" onClick={() => setShown((n) => n + STEP)}>
            {WORTH.more}
          </Key>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------- live */

/** a row of the Live tab: who, and on the stream's clock (seconds since the page opened) when they were valued */
type Entry = { id: number; row: Row; born: number }

/* how long ago the opening rows were valued, in seconds, as the page opens */
const AGES = [2, 7, 13, 22, 34, 47, 63, 84, 109, 138, 171, 212]
/* the next one drops in 2.5 to 6.5 seconds after the last */
const NEXT_MS = [2_500, 6_500] as const
/* no account twice among the newest this many */
const FRESH = 16
const KEEP = 40

/** "now", "7s", "2m": how long ago, the way a notification says it */
const since = (s: number) => (s < 3 ? 'now' : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`)

function useLive(pool: Row[], latest: Row | null, feed: FeedItem[]) {
  /* the opening rows come off the pool in order, so the server and the browser draw the same ones */
  const [entries, setEntries] = useState<Entry[]>(() => pool.slice(0, AGES.length).map((row, i) => ({ id: i, row, born: -AGES[i] })))
  const [clock, setClock] = useState(0)
  const time = useRef(0)
  const ids = useRef(AGES.length)
  const deck = useRef(pool)
  const opened = useRef(Number.POSITIVE_INFINITY)
  const heard = useRef(new Set<string>())

  useEffect(() => {
    deck.current = pool
  }, [pool])

  /** drops a row in at the head, unless that account was just valued already (the reader's own always goes up) */
  const drop = useRef((row: Row, mine = false) => {
    const k = row.handle.toLowerCase()
    setEntries((es) => {
      if (!mine && es.some((e) => e.row.handle.toLowerCase() === k && time.current - e.born < 120)) return es
      const rest = es.filter((e) => e.row.handle.toLowerCase() !== k)
      return [{ id: ids.current++, row, born: time.current }, ...rest].slice(0, KEEP)
    })
  })

  /* the stream's clock, a second at a time */
  useEffect(() => {
    opened.current = Date.now()
    const t = window.setInterval(() => {
      time.current += 1
      setClock(time.current)
    }, 1_000)
    return () => clearInterval(t)
  }, [])

  /* somebody else every few seconds, while the tab is in sight */
  useEffect(() => {
    let t = 0
    const next = () => {
      t = window.setTimeout(
        () => {
          if (!document.hidden) {
            setEntries((es) => {
              const near = new Set(es.slice(0, FRESH).map((e) => e.row.handle.toLowerCase()))
              const free = deck.current.filter((r) => !near.has(r.handle.toLowerCase()))
              if (!free.length) return es
              const row = free[Math.floor(Math.random() * free.length)]
              return [{ id: ids.current++, row, born: time.current }, ...es.filter((e) => e.row.handle !== row.handle)].slice(0, KEEP)
            })
          }
          next()
        },
        NEXT_MS[0] + Math.random() * (NEXT_MS[1] - NEXT_MS[0]),
      )
    }
    next()
    return () => clearTimeout(t)
  }, [])

  /* the reader's own check, the moment it lands */
  useEffect(() => {
    if (latest) drop.current(latest, true)
  }, [latest])

  /* real checks by anybody else, as the feed brings them */
  useEffect(() => {
    for (const item of [...feed].reverse()) {
      if (item.kind !== 'checked' || item.at <= opened.current) continue
      const key = `${item.handle}-${item.at}`
      if (heard.current.has(key)) continue
      heard.current.add(key)
      drop.current(item)
    }
  }, [feed])

  return { entries, clock }
}
