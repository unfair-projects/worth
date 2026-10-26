'use client'

import { useEffect, useRef, useState } from 'react'

import type { Result } from '../../../lib/worth/board'
import { money, moneyFull, percent, times } from '../../../lib/worth/model'
import { WORTH } from '../words'
import { Dots, Face, Tick, reduced, useRun } from './bits'

/**
 * The reading: the page doing the arithmetic in front of you, row by row, so
 * the number at the bottom is something you watched add up rather than
 * something you were told. While X answers, the waiting line changes every
 * couple of seconds; once it has, each row runs up to its value, the
 * multipliers pop in one by one, and the total lands with money flying off it.
 */

const STEP = 420
const CHIPS = 760
const RUN = 400
const TOTAL = 1100
const HOLD = 700

/** each row's start, after the answer arrives */
const AT = (() => {
  const t = [200]
  t.push(t[0] + STEP) // views
  t.push(t[1] + STEP) // base price
  t.push(t[2] + STEP) // multipliers
  t.push(t[3] + CHIPS) // a deal a week
  t.push(t[4] + STEP) // growth
  t.push(t[5] + STEP) // total runs
  t.push(t[6] + TOTAL) // landed
  return t
})()

export function Reading({ handle, result, onDone }: { handle: string; result: Result | null; onDone: (r: Result) => void }) {
  /* -1 waiting on X; 0–5 the rows; 6 the total running; 7 landed */
  const [step, setStep] = useState(-1)
  const [said, setSaid] = useState(0)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (result) return
    const t = window.setInterval(() => setSaid((n) => Math.min(n + 1, WORTH.reading(handle).length - 1)), 2_200)
    return () => clearInterval(t)
  }, [result, handle])

  useEffect(() => {
    if (!result) return
    if (reduced()) {
      done.current(result)
      return
    }
    const timers = AT.map((ms, i) => window.setTimeout(() => setStep(i), ms))
    timers.push(window.setTimeout(() => done.current(result), AT[AT.length - 1] + HOLD))
    return () => timers.forEach(clearTimeout)
  }, [result])

  const a = result?.account
  const v = result?.valuation
  const progress = step < 0 ? 0.12 : Math.min(1, (step + 1) / AT.length)

  const chips = v
    ? [
        { label: WORTH.x.engagement, x: v.x.engagement },
        ...(v.x.nicheLabel ? [{ label: v.x.nicheLabel, x: v.x.niche }] : []),
        { label: WORTH.x.posting, x: v.x.posting },
        /* no page is the one multiplier that costs them, and it says so in red */
        a?.listed ? { label: WORTH.x.verified, x: v.x.verified } : { label: WORTH.x.unverified, x: v.x.verified, bad: true },
      ]
    : []

  return (
    <div className="w-rise relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[20px] border border-k-border bg-k-surface shadow-[0_12px_32px_-14px_rgba(0,0,0,0.16)]">
      <div
        className="absolute top-0 left-0 h-[3px] bg-k-accent"
        style={{
          width: `${progress * 100}%`,
          transition: step < 0 ? 'width 3s cubic-bezier(0.1, 0.6, 0.3, 1)' : 'width 0.45s ease-out',
        }}
      />

      <div className="flex items-center gap-3 px-5 pt-5 pb-3 land:px-6">
        {a ? <Face src={a.avatar} handle={a.handle} size={44} className="w-rise" /> : <span className="w-shimmer h-11 w-11 shrink-0 rounded-full" />}
        <div className="min-w-0">
          {a ? (
            <div className="w-rise">
              <div className="flex items-center gap-1 truncate text-[15px] leading-5 font-semibold">
                <span className="truncate">{a.name}</span>
                {a.verified && <Tick />}
              </div>
              <div className="text-[13px] leading-[18px] text-k-muted">@{a.handle}</div>
            </div>
          ) : (
            <div key={said} className="w-rise text-[15px] leading-5 font-medium text-k-muted">
              {WORTH.reading(handle)[said]}
              <Dots />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 land:px-6">
        <Line label={WORTH.rows.followers} on={step >= 0} done={step > 0} value={a?.followers ?? 0} show={(n) => Math.round(n).toLocaleString('en-US')} />
        <Line
          label={WORTH.rows.views}
          on={step >= 1}
          done={step > 1}
          value={a?.medianViews ?? 0}
          show={(n) => Math.round(n).toLocaleString('en-US')}
          none={!!a && a.medianViews == null}
        />
        <Line label={WORTH.rows.base} on={step >= 2} done={step > 2} value={v?.base ?? 0} show={moneyFull} />

        {/* the multipliers: one chip at a time, then their product */}
        <div className="flex min-h-11 flex-col justify-center gap-2 border-b border-k-border/70 py-2.5">
          <div className="flex items-center justify-between">
            <span className={`text-[14px] transition-colors duration-300 ${step >= 3 ? 'text-k-ink' : 'text-k-muted'}`}>{WORTH.rows.x}</span>
            <span className="flex items-center gap-2">
              {step >= 4 ? (
                <span className="w-settle text-[15px] font-semibold tabular-nums">{times(v?.x.all ?? 1)}</span>
              ) : (
                <span className="w-shimmer h-3 w-12 rounded-full" />
              )}
              <Check on={step >= 4} />
            </span>
          </div>
          {step >= 3 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <span
                  key={c.label}
                  className={`w-rise inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] leading-4 font-medium ${chipTone(c.x, 'bad' in c && c.bad)}`}
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {c.label}
                  <span className="tabular-nums">{times(c.x)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <Line
          label={WORTH.rows.year}
          on={step >= 4}
          done={step > 4}
          value={v?.perYear ?? 0}
          show={(n) => WORTH.perYear(money(n))}
        />
        <Line
          label={WORTH.rows.growth}
          on={step >= 5}
          done={step > 5}
          value={(v?.growth ?? 0) * 100}
          show={(n) => WORTH.growth(`${Math.round(n)}%`)}
        />
      </div>

      <div className="mx-5 mt-1 flex items-end justify-between border-t border-k-border pt-4 pb-5 land:mx-6">
        <div>
          <div className="text-[15px] leading-5 font-semibold">{WORTH.total}</div>
          <div className="text-[12px] leading-4 text-k-muted">
            {WORTH.totalSub}
            {step >= 7 && v && <span className="w-rise inline-block">&nbsp;· better than {percent(v.beats)}</span>}
          </div>
        </div>
        <Total value={v?.worth ?? 0} run={step >= 6} landed={step >= 7} />
      </div>
    </div>
  )
}

/** a multiplier's colour: cobalt when it pays, red when the missing page costs, grey otherwise */
export const chipTone = (x: number, bad?: boolean) =>
  bad ? 'bg-[#FDECEC] text-k-danger' : x > 1 ? 'bg-k-accent-soft text-k-accent' : 'bg-k-canvas text-k-muted'

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full bg-k-accent text-white transition-all duration-300 ${on ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
      aria-hidden
    >
      <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
        <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function Line({
  label,
  on,
  done,
  value,
  show,
  none,
}: {
  label: string
  on: boolean
  done: boolean
  value: number
  show: (n: number) => string
  none?: boolean
}) {
  const n = useRun(value, on && !none, RUN)
  return (
    /* the last row leaves its rule to the total's, or the two lie a few pixels apart */
    <div className="flex h-11 items-center justify-between border-b border-k-border/70 last:border-b-0">
      <span className={`text-[14px] transition-colors duration-300 ${on ? 'text-k-ink' : 'text-k-muted'}`}>{label}</span>
      <span className="flex items-center gap-2">
        {on ? (
          <span className={`text-[15px] font-semibold tabular-nums ${done ? 'w-settle' : ''}`}>{none ? '—' : show(done ? value : n)}</span>
        ) : (
          <span className="w-shimmer h-3 w-16 rounded-full" />
        )}
        <Check on={done} />
      </span>
    </div>
  )
}

function Total({ value, run, landed }: { value: number; run: boolean; landed: boolean }) {
  const n = useRun(value, run, TOTAL)
  return (
    <div className="relative">
      <span
        className={`block font-display text-[40px] leading-none tracking-[-0.04em] text-k-accent tabular-nums land:text-[52px] ${landed ? 'w-settle' : ''} ${run ? '' : 'opacity-30'}`}
      >
        {moneyFull(landed ? value : n)}
      </span>
      {landed &&
        ['-34px', '-8px', '18px', '40px'].map((dx, i) => (
          <span
            key={dx}
            className="w-fly pointer-events-none absolute right-6 bottom-6 font-display text-[22px] text-k-money"
            style={{ '--dx': dx, '--rot': `${(i - 1.5) * 12}deg`, animationDelay: `${i * 70}ms` } as React.CSSProperties}
            aria-hidden
          >
            $
          </span>
        ))}
    </div>
  )
}
