import { ImageResponse } from 'next/og'

import { readPublic } from './assets'

/**
 * The OpenGraph card — Keycap v2 grammar from Paper: canvas page, one white
 * surface card, the name in the New Pixel display face, and the wordmark on the
 * foot line. Satori needs ttf/otf (never woff2) and can't fetch by URL, so the
 * faces live in public/fonts/og and covers are inlined as data URIs.
 *
 * ONE card here, where the customer repo's copy of this file carries four. The
 * others draw a company invite, a public creator page and the generic share
 * card — all of them for routes that live on the other host. The public creator
 * page in particular is deliberately not ours (HANDOFF §4).
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

/* Keycap v2 tokens (Paper --color-k-*) */
const K = {
  canvas: '#F4F4F4',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#6E6E6E',
  faint: '#A6A6A6',
  border: '#E8E8E8',
  accent: '#0033FF',
  accentDeep: '#0026BF',
  accentSoft: '#EBEFFF',
  tangerine: '#FF7A00',
  money: '#17A45C',
}

/* exported since /nowatermark draws its own card (Fedor 2026-08-11) — one
   place that knows where the ttf files live, whoever is drawing */
export async function ogFonts() {
  const [pixel, regular, semibold] = await Promise.all([
    readPublic('fonts/og/NewPixel.ttf'),
    readPublic('fonts/og/Inter-400.ttf'),
    readPublic('fonts/og/Inter-600.ttf'),
  ])
  return [
    { name: 'NewPixel', data: pixel, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
  ]
}

/** covers ship as files under public/ — Satori can only read them inlined */
async function inlineCover(publicPath?: string) {
  if (!publicPath || publicPath.startsWith('linear-gradient')) return undefined
  /* A live creator's portrait and their followers' faces live on X, not in our
     public/ folder (ADR-0109). Satori fetches an absolute URL itself, so it is
     handed straight through; only OUR OWN paths need reading off disk. */
  if (/^https?:\/\//i.test(publicPath)) return publicPath
  try {
    const buf = await readPublic(publicPath)
    const mime = /\.jpe?g$/i.test(publicPath) ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

/** keeps a blurb to a couple of lines so the card never overflows */
const clamp = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

/* --- the creators' door ----------------------------------------------------
   One card for the whole creator side, so it says the one thing that screen
   says: this is where creators work with brands, and we take nothing. The
   headline is the door's own (data.ts DOOR_COPY) rather than a line written
   for a share preview — a card that promises something the page does not open
   with is a card that lies for a living.

   Beside it stands the demo's own hero object, the three-card pile with the
   creator's portrait on the cobalt one. It is the most recognisable thing this
   product draws, and it is what makes the card personal instead of a slogan.

   TWO CARDS COME OUT OF HERE (2026-08-12), and they are one layout: the door's,
   which anybody sees, and the personal invite at /@handle, which is addressed
   to the creator in the address and wears their own face. Sharing the layout is
   the point — the invite is the same door with their name on it, and two copies
   of this composition would have drifted the first time either was touched. */

export interface DoorCard {
  /** the headline, already broken the way the screen breaks it */
  title: readonly string[]
  subtitle: string
  cta: string
  /** whoever is on the trading card */
  creator: { display: string; handle: string; avatar: string; followers: string }
}

export async function renderCreatorsDoorCard({ title, subtitle, cta, creator }: DoorCard) {
  const face = await inlineCover(creator.avatar)
  return renderDoorLayout({
    title,
    subtitle,
    cta,
    pile: { handle: creator.handle, face, foot: { display: creator.display, followers: creator.followers } },
  })
}

export interface InviteCard {
  /** the handle in the address, without the @ */
  handle: string
  /**
   * Their portrait, ALREADY a data URI — fetched by the route rather than
   * handed to Satori as a URL (app/[handle]/opengraph-image.tsx). A handle
   * nobody holds answers 404 at the avatar resolver, and a fetch that throws
   * inside the renderer is a card that never renders at all; undefined here
   * simply leaves the frame empty.
   */
  face?: string
  title: readonly string[]
  subtitle: string
  cta: string
}

/** The door's card, addressed to one creator: their face, their handle. */
export async function renderCreatorInviteCard({ handle, face, title, subtitle, cta }: InviteCard) {
  /* no foot row: the display name and the follower count are things a page
     READ knows, and nothing has been read yet — this link is an invitation, and
     inventing a number under somebody's portrait is the one thing it must not
     do */
  return renderDoorLayout({ title, subtitle, cta, pile: { handle, face, fill: true } })
}

interface Pile {
  handle: string
  face?: string
  /** the name chip and the reach, for a card drawn off a page we have read */
  foot?: { display: string; followers: string }
  /**
   * Zoom the portrait to the circle inside it rather than fitting the whole
   * file (ui.tsx SQUARE_FILL, Fedor 2026-08-12).
   *
   * True for an X avatar: it was uploaded for a round crop, so the corners of
   * the file are flat padding nobody chose, and in this frame they read as a
   * stamp floating in a box. False for the door card, whose portrait is our own
   * art and was framed by whoever made it.
   */
  fill?: boolean
}

/** √2, the same number and the same reason as ui.tsx SQUARE_FILL. */
const FACE_FILL = 1.42

async function renderDoorLayout({
  title,
  subtitle,
  cta,
  pile,
}: {
  title: readonly string[]
  subtitle: string
  cta: string
  pile: Pile
}) {
  /* the pile, drawn once so the three layers keep one set of numbers */
  const PLATE = { width: 226, height: 292 }
  const CARD = { width: 252, height: 306 }
  /* the portrait takes whatever the foot row is not using */
  const PHOTO_H = pile.foot ? 214 : 252

  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', background: K.canvas, padding: 40 }}>
        <div
          style={{
            display: 'flex',
            flex: 1,
            background: K.surface,
            border: `1px solid ${K.border}`,
            borderRadius: 28,
            padding: '44px 44px',
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: 600 }}>
            <div style={{ display: 'flex', fontFamily: 'NewPixel', fontSize: 32, color: K.ink, letterSpacing: -1.4 }}>
              unfair.so
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
              {title.map((line) => (
                <div
                  key={line}
                  style={{
                    display: 'flex',
                    fontFamily: 'NewPixel',
                    fontSize: 74,
                    lineHeight: 1.14,
                    letterSpacing: -3,
                    color: K.ink,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                marginTop: 24,
                maxWidth: 585,
                fontFamily: 'Inter',
                fontSize: 27,
                lineHeight: 1.42,
                color: K.muted,
              }}
            >
              {clamp(subtitle, 120)}
            </div>

            <div style={{ display: 'flex', flex: 1 }} />

            {/* a key, because every door in this product is one */}
            <div style={{ display: 'flex' }}>
              <div
                style={{
                  display: 'flex',
                  background: K.accent,
                  borderRadius: 14,
                  padding: '15px 28px',
                  boxShadow: `0 5px 0 0 ${K.accentDeep}`,
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: 24,
                  color: '#FFFFFF',
                }}
              >
                {cta}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1 }} />

          {/* the pile: two plates leaning out from under the creator's card */}
          <div style={{ display: 'flex', alignSelf: 'center', position: 'relative', width: 400, height: 420 }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 76,
                width: PLATE.width,
                height: PLATE.height,
                borderRadius: 18,
                background: K.accentSoft,
                transform: 'rotate(-9deg)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 150,
                top: 70,
                width: PLATE.width,
                height: PLATE.height,
                borderRadius: 18,
                background: K.canvas,
                border: `1px solid ${K.border}`,
                transform: 'rotate(7deg)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 72,
                top: 44,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: CARD.width,
                height: CARD.height,
                borderRadius: 20,
                background: K.accent,
                boxShadow: `0 6px 0 0 ${K.accentDeep}`,
                padding: 11,
                transform: 'rotate(-3deg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  paddingLeft: 2,
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: 1.4,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                @{pile.handle}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: pile.fill ? 'center' : 'flex-end',
                  justifyContent: 'center',
                  height: PHOTO_H,
                  borderRadius: 12,
                  background: K.accentSoft,
                  overflow: 'hidden',
                }}
              >
                {pile.face ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pile.face}
                    alt=""
                    width={Math.round(228 * (pile.fill ? FACE_FILL : 1))}
                    height={Math.round(PHOTO_H * (pile.fill ? FACE_FILL : 1))}
                    style={{
                      width: Math.round(228 * (pile.fill ? FACE_FILL : 1)),
                      height: Math.round(PHOTO_H * (pile.fill ? FACE_FILL : 1)),
                      /* the frame's own radius does the clipping once the
                         picture is bigger than it */
                      borderRadius: pile.fill ? 0 : 10,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : null}
              </div>
              {pile.foot ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 2 }}>
                  <div style={{ display: 'flex', background: '#FFFFFF', borderRadius: 7, padding: '3px 8px' }}>
                    <div style={{ display: 'flex', fontFamily: 'NewPixel', fontSize: 15, color: K.accent, letterSpacing: -0.5 }}>
                      {pile.foot.display}
                    </div>
                  </div>
                  <div style={{ display: 'flex', fontFamily: 'NewPixel', fontSize: 30, color: '#FFFFFF', letterSpacing: -1.2 }}>
                    {pile.foot.followers}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  )
}
