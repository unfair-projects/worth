import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ReactNode } from 'react'

import { WORTH } from '../../app/worth/words'
import { ogFonts } from '../og'
import { money, percent, perMonth } from './model'
import { ground } from './pixels'
import type { Result } from './board'

/**
 * THE SHARE CARDS — the pictures /worth exists to hand out (Fedor 2026-10-20:
 * "My X account is worth $Xk, which makes me better than X% of accounts on
 * X", unfair.so on the foot line, wide; since 2026-10-21 the foot line's
 * right is the account's potential MRR, where a footnote used to be).
 *
 * One renderer per card for every door: the link preview X draws under a
 * shared link (opengraph-image), the PNG behind Download, and the picture the
 * page itself shows — so what somebody sees, saves and posts is the same
 * pixels. 1200×630, the frame X gives a summary_large_image.
 *
 * Keycap v2 on a card: white, the money in cobalt in the New Pixel face
 * tracked in the way unfair.so tracks it (−4%, the wordmark −5%), Inter for
 * every other word, the wordmark under a hairline.
 */

export const CARD = { width: 1200, height: 630 } as const
/**
 * The same card a little taller, for the page and the download (Fedor
 * 2026-10-21): a picture attached to a post shows whole, where a link's
 * preview is cut to X's 1.91:1, so the preview keeps CARD.
 */
export const TALL = { width: 1200, height: 750 } as const
/**
 * The card on a phone (Fedor 2026-10-21: the wide one, shrunk to a phone's
 * width, set its words at a few pixels): portrait, its words set for a
 * screen a third of its width, and what a phone downloads, the shape a post
 * or a story shows whole.
 */
export const PORTRAIT = { width: 1080, height: 1350 } as const

export type CardSize = 'wide' | 'tall' | 'portrait'

const K = {
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#6E6E6E',
  faint: '#A6A6A6',
  border: '#E8E8E8',
  accent: '#0033FF',
  accentSoft: '#EBEFFF',
}

/** the portrait as a data URI: a face X no longer serves must not take the card down with it */
async function inline(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return null
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

function Face({ src, handle, size, ring }: { src: string | null; handle: string; size: number; ring?: string }) {
  const border = ring ? `4px solid ${ring}` : `1px solid ${K.border}`
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} style={{ width: size, height: size, borderRadius: size, border }} alt="" />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        border,
        background: K.accentSoft,
        color: K.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.44,
        fontWeight: 600,
      }}
    >
      {handle.slice(0, 1).toUpperCase()}
    </div>
  )
}

function Foot({ right, big = false }: { right: ReactNode; big?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
        height: big ? 132 : 92,
        borderTop: `${big ? 2 : 1}px solid ${K.border}`,
      }}
    >
      <div style={{ display: 'flex', fontFamily: 'NewPixel', fontSize: big ? 52 : 38, lineHeight: 1, letterSpacing: '-0.05em' }}>unfair.so</div>
      <div style={{ display: 'flex', fontSize: 20, color: K.muted, maxWidth: 880, textAlign: 'right' }}>{right}</div>
    </div>
  )
}

const frame = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  background: K.surface,
  fontFamily: 'Inter',
  color: K.ink,
  padding: '56px 72px 0',
}

/** /worth's own link preview: the question, in the card's frame, the same foot line */
export async function renderAsk() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <div style={{ ...frame, padding: '0 72px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 120 }}>
          {WORTH.title.map((line, i) => (
            <div
              key={line}
              style={{
                display: 'flex',
                fontFamily: 'NewPixel',
                fontSize: 112,
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                color: i ? K.accent : K.ink,
              }}
            >
              {line}
            </div>
          ))}
        </div>
        <Foot right="creators.unfair.so/worth" />
      </div>
    ),
    { ...CARD, fonts },
  )
}

/* the five who stand beside the badge, one to an account (Ilya 2026-10-21); public/worth/heroes/N.png */
const HEROES = 5
const heroCache = new Map<number, Promise<{ src: string; ratio: number }>>()

function hero(n: number) {
  let p = heroCache.get(n)
  if (!p) {
    p = readFile(path.join(process.cwd(), 'public', 'worth', 'heroes', `${n}.png`)).then((buf) => ({
      src: `data:image/png;base64,${buf.toString('base64')}`,
      /* width over height, from the PNG header */
      ratio: buf.readUInt32BE(16) / buf.readUInt32BE(20),
    }))
    heroCache.set(n, p)
  }
  return p
}

/** the same account always gets the same one */
const heroOf = (handle: string) => 1 + ([...handle].reduce((s, ch) => s + ch.charCodeAt(0), 0) % HEROES)

/** what each size lays out: pixels, set for the screen the card is looked at on */
const SIZES = {
  wide: { ...CARD, pad: 80, top: 50, face: 76, name: 30, at: 24, label: 27, num: 128, month: 36, foot: 92, wm: 38, pill: 30, right: 236, gap: 8, show: 270, mark: 640 },
  tall: { ...TALL, pad: 80, top: 64, face: 76, name: 30, at: 24, label: 30, num: 148, month: 40, foot: 92, wm: 38, pill: 30, right: 312, gap: 36, show: 330, mark: 590 },
  portrait: { ...PORTRAIT, pad: 70, top: 84, face: 108, name: 44, at: 36, label: 44, num: 200, month: 52, foot: 132, wm: 52, pill: 40, right: 520, gap: 56, show: 440, mark: 540 },
} as const

/**
 * One account: what it is worth, what it can earn a month, and who it beats.
 * Blue like unfair.so's home with the picture crumbling at its edges, a pixel
 * skyline on the foot line, and one of five figures standing on it. `wide` is
 * a link's preview, `tall` the page and the download on a wide screen,
 * `portrait` the same on a phone.
 */
export async function renderCard({ account, valuation }: Result, init?: ResponseInit, size: CardSize = 'wide') {
  const k = SIZES[size]
  const n = heroOf(account.handle)
  const [fonts, face, figure] = await Promise.all([ogFonts(), inline(account.avatar), hero(n)])
  const [before, pct, after] = WORTH.card.beats(percent(valuation.beats))
  const white = '#ffffff'
  const label = { display: 'flex', fontSize: k.label, lineHeight: 1.2 } as const
  const num = { display: 'flex', fontFamily: 'NewPixel', fontSize: k.num, lineHeight: 1, letterSpacing: '-0.04em', marginTop: Math.round(k.num * 0.14) } as const
  /* the figure stands on the foot line, cut off by it, its height set by how much of it shows */
  const img = Math.round(k.show * 1.26)
  const w = Math.round(img * figure.ratio)

  return new ImageResponse(
    (
      <div style={{ width: k.width, height: k.height, display: 'flex', position: 'relative', background: K.surface, fontFamily: 'Inter', color: white }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ground(k.width, k.height, k.foot)} width={k.width} height={k.height} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />

        <div style={{ position: 'absolute', left: Math.round(k.mark - w / 2), top: k.height - k.foot - k.show, width: w, height: k.show, display: 'flex', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={figure.src} width={w} height={img} alt="" />
        </div>

        <div style={{ position: 'absolute', left: k.pad, top: k.top, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Face src={face} handle={account.handle} size={k.face} />
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: Math.round(k.face * 0.3) }}>
              <div style={{ display: 'flex', fontSize: k.name, fontWeight: 600, lineHeight: 1.15, maxWidth: 700 }}>{account.name}</div>
              <div style={{ display: 'flex', fontSize: k.at, opacity: 0.75, lineHeight: 1.3, marginTop: 2 }}>{`@${account.handle}`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: k.gap }}>
            <div style={label}>{WORTH.card.worth}</div>
            <div style={num}>{money(valuation.worth)}</div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: k.pad, top: k.right, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={label}>{WORTH.card.earn}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={num}>{money(perMonth(valuation))}</div>
            <div style={{ display: 'flex', fontSize: k.month, marginLeft: 14, marginBottom: Math.round(k.num * 0.08), opacity: 0.9 }}>{WORTH.card.month}</div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: k.pad,
            right: k.pad,
            bottom: 0,
            height: k.foot,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.4)',
          }}
        >
          <div style={{ display: 'flex', fontFamily: 'NewPixel', fontSize: k.wm, lineHeight: 1, letterSpacing: '-0.05em' }}>unfair.so</div>
          <div style={{ display: 'flex', background: white, color: K.accent, fontSize: k.pill, padding: `${Math.round(k.pill * 0.33)}px ${Math.round(k.pill * 0.73)}px` }}>
            <span style={{ display: 'flex' }}>{before}</span>
            <span style={{ display: 'flex', fontWeight: 600, margin: '0 0.25em' }}>{pct}</span>
            <span style={{ display: 'flex' }}>{after}</span>
          </div>
        </div>
      </div>
    ),
    { width: k.width, height: k.height, fonts, ...init },
  )
}

/** two accounts, side by side: whoever is worth more in cobalt */
export async function renderVersus(a: Result, b: Result, init?: ResponseInit) {
  const [fonts, faceA, faceB] = await Promise.all([ogFonts(), inline(a.account.avatar), inline(b.account.avatar)])
  const aWins = a.valuation.worth >= b.valuation.worth
  const lead = aWins ? a : b
  const lag = aWins ? b : a
  const ratio = lag.valuation.worth > 0 ? lead.valuation.worth / lag.valuation.worth : 0

  const side = (r: Result, face: string | null, wins: boolean, align: 'flex-start' | 'flex-end') => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, width: 470 }}>
      <Face src={face} handle={r.account.handle} size={96} ring={wins ? K.accent : undefined} />
      <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, marginTop: 18, maxWidth: 470 }}>{r.account.name}</div>
      <div style={{ display: 'flex', fontSize: 22, color: K.muted, marginTop: 2 }}>{`@${r.account.handle}`}</div>
      <div
        style={{
          display: 'flex',
          fontFamily: 'NewPixel',
          fontSize: 132,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          marginTop: 18,
          color: wins ? K.accent : K.ink,
        }}
      >
        {money(r.valuation.worth)}
      </div>
    </div>
  )

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10 }}>
          {side(a, faceA, aWins, 'flex-start')}
          <div
            style={{
              display: 'flex',
              alignSelf: 'center',
              fontFamily: 'NewPixel',
              fontSize: 64,
              letterSpacing: '-0.04em',
              color: K.faint,
              marginTop: 40,
            }}
          >
            vs
          </div>
          {side(b, faceB, !aWins, 'flex-end')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 30, marginTop: 34 }}>
          {ratio >= 1.05 ? WORTH.versus.verdict(lead.account.handle, ratio) : WORTH.versus.tie}
        </div>
        <Foot right={WORTH.versus.foot} />
      </div>
    ),
    { ...CARD, fonts, ...init },
  )
}
