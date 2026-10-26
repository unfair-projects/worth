'use client'

import { useEffect, useState, type ReactNode } from 'react'

import type { Result } from '../../../lib/worth/board'

/** The small things every part of /worth draws with. */

/* the card's look, in its address: bumped whenever the picture changes, so no
   browser or CDN keeps showing the old one (2: the footnote gave way to the MRR;
   3: the MRR set in the card's own type, a year out; 4: in ink; 5: closer to its label;
   6: taller on the page and in the download; 7: the money to one decimal; 8: a phone's own) */
export const LOOK = 8

/** the page's card and the download's: the taller one on a wide screen, the portrait one on a phone (lib/worth/card); a link's preview keeps X's frame */
export const cardSrc = (r: Result, size: 'tall' | 'portrait' = 'tall') =>
  `/worth/${r.account.handle}/card.png?v=${r.account.at}&look=${LOOK}&size=${size}`

/** a phone's width, where the portrait card stands (globals.css land is 680) */
export const PHONE = '(max-width: 679.98px)'
export const narrow = () => typeof window !== 'undefined' && window.matchMedia?.(PHONE).matches === true

export const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** a number running up to its value: ease-out, so it slows into the answer */
export function useRun(target: number, run: boolean, ms: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setValue(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return run ? value : 0
}

/**
 * The card, held in the hand (Fedor 2026-10-21: some life in it, a glint on
 * hover; a still glint always and nothing played on load; no rainbow, but the
 * round shape the rainbow foil had). A round light lies on it: a breath of
 * cobalt round it so it shows on white, and a glare that lifts the ink under
 * it. At rest it sits on the top right; under a mouse it follows the pointer,
 * the card leans after it and the shadow shifts the other way, and it glides
 * back when the mouse leaves. A finger, or a reader who asked for less
 * motion, gets the card at rest.
 */
export function Shine({ children }: { children: ReactNode }) {
  const [p, setP] = useState<{ x: number; y: number } | null>(null)
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || reduced()) return
    const r = e.currentTarget.getBoundingClientRect()
    setP({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }
  return (
    <div className="[perspective:1400px]" onPointerMove={move} onPointerLeave={() => setP(null)}>
      <div
        className="w-shine relative rounded-[18px]"
        style={
          {
            ...(p
              ? {
                  '--mx': `${(p.x * 100).toFixed(1)}%`,
                  '--my': `${(p.y * 100).toFixed(1)}%`,
                  '--glint': 1,
                  transform: `rotateX(${((0.5 - p.y) * 7).toFixed(2)}deg) rotateY(${((p.x - 0.5) * 9).toFixed(2)}deg) scale(1.012)`,
                }
              : {}),
            boxShadow: p
              ? `${((0.5 - p.x) * 24).toFixed(1)}px ${(26 + (0.5 - p.y) * 10).toFixed(1)}px 48px -22px rgba(0,0,0,0.3)`
              : '0 18px 40px -18px rgba(0,0,0,0.22)',
          } as React.CSSProperties
        }
      >
        {children}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
          <span className="w-shine-halo absolute inset-0" />
          <span className="w-shine-glare absolute inset-0" />
        </span>
      </div>
    </div>
  )
}

export function Face({ src, handle, size, className = '' }: { src: string | null; handle: string; size: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-k-accent-soft font-semibold text-k-accent ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {handle.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full border border-k-border object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function Dots() {
  return (
    <span className="ml-0.5 inline-flex gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="ellipsis-dot inline-block h-1 w-1 rounded-full bg-current" />
      ))}
    </span>
  )
}

export function Tick({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Verified" className="shrink-0 text-k-accent">
      <path
        fill="currentColor"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
      />
    </svg>
  )
}

export function XMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden className="shrink-0">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function DownGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LinkGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path
        d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.76 2.76 0 0 0-3.9-3.9l-.6.6M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.76 2.76 0 0 0 3.9 3.9l.6-.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Arrow({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden className="shrink-0">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function OutGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden className="shrink-0">
      <path d="M4 2.5h5.5V8M9.5 2.5 2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
