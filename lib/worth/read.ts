import { fetchCreatorPage } from '../api/creator'

/**
 * WHERE /worth GETS AN ACCOUNT'S NUMBERS — server only.
 *
 * Followers, the median views of the account's own recent posts, how much
 * those posts are engaged with, how often the account posts, what its bio is
 * about, and its best post — read in this order:
 *
 *   1. its page on unfair.so, when it has a published one. Our scan reads
 *      far more posts than this route can afford to (160 for @notmiramurati),
 *      and a creator comparing this page with their own must see one median.
 *   2. X itself, through the data vendor /x-algorithm already pays for — the
 *      same one or two pages give every number, so the extras cost nothing.
 *   3. X's public profile reader, followers only — but ONLY on a deployment
 *      with no vendor key (Fedor 2026-10-21: "use the paid one for all of
 *      it"). With the key, a vendor that does not answer after its retries is
 *      an error, never a price on followers alone: that number is a
 *      different number (@jason $1.9M against $793K read whole), and it
 *      would stand for a day.
 *
 * EVERYTHING UPSTREAM STAYS IN THIS FILE, as in Product's x-algorithm route:
 * the vendor, its key, its URLs and its field names never reach the browser,
 * the response body or an error message. Callers see `Account` and a reason.
 */

export interface Post {
  url: string
  text: string
  views: number
}

export interface Account {
  /** as X capitalises it */
  handle: string
  name: string
  avatar: string | null
  verified: boolean
  followers: number
  /** null: nothing original lately, or the posts are protected */
  medianViews: number | null
  /** the originals the median was read over */
  posts: number
  /** likes + replies + reposts + quotes per view on those originals, 0..1 */
  engagement: number | null
  /** originals a week over the window read */
  perWeek: number | null
  /** the bio, plus a creator's own niches: what the niche is read from */
  about: string | null
  /** the most-viewed original in the window */
  top: Post | null
  /** has a published page on unfair.so — the board marks these, the rest are unclaimed */
  listed: boolean
  /** when the page went up on unfair.so, ms (the live feed says so) */
  publishedAt?: number | null
  /** when somebody last pressed Calculate on it, ms (the feed and the Live tab) */
  checkedAt?: number | null
  /** read off the public profile alone, followers and nothing else: kept for minutes, not a day */
  thin?: boolean
  /** when it was read, ms */
  at: number
}

export type Read = { ok: true; account: Account } | { ok: false; reason: 'nobody' | 'down' }

/* the parser lives with the pure arithmetic, so the browser can use it without this file */
export { handleFrom } from './model'

/** X serves a 48px avatar by default; the card wants the 400px one */
const sharp = (url: string | null | undefined): string | null =>
  url ? url.replace(/_normal(\.[a-z]+)$/i, '_400x400$1') : null

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/* ------------------------------------------------------------- 1. unfair */

async function fromUnfair(handle: string): Promise<Account | null> {
  const page = await fetchCreatorPage(handle)
  if (!page || page.status !== 'published' || page.followers_count == null) return null
  const pct = page.stats?.engagement_pct
  return {
    handle: page.x_handle || handle,
    name: page.display_name?.trim() || page.x_handle || handle,
    avatar: sharp(page.avatar_url),
    verified: page.verified === true,
    followers: page.followers_count,
    medianViews: page.stats?.median_impressions ?? null,
    posts: page.stats?.posts ?? 0,
    engagement: typeof pct === 'number' ? pct / 100 : null,
    perWeek: null,
    about: [page.bio, ...(page.niches ?? [])].filter(Boolean).join(' · ') || null,
    top: null,
    listed: true,
    at: Date.now(),
  }
}

/* -------------------------------------------------------------- 2. vendor */

/* The key lives in the deployment's environment (X_SCAN_KEY, the one
   /x-algorithm reads), never in this repo. Without it the vendor is skipped:
   creators are still read off their pages, everyone else on followers alone. */
const DATA_KEY = (process.env.X_SCAN_KEY ?? '').trim().replace(/^["']|["']$/g, '')
const DATA_BASE = 'https://api.twitterapi.io/twitter'

/** the deployment has the vendor: every X read goes through it */
export const vendorReady = DATA_KEY.length > 0
if (!vendorReady) console.error('[worth] X_SCAN_KEY is not set: accounts off unfair.so are priced on followers alone')

interface UpUser {
  userName?: string
  name?: string
  profilePicture?: string
  followers?: number
  isBlueVerified?: boolean
  protected?: boolean
  description?: string
  profile_bio?: { description?: string }
}

interface UpTweet {
  url?: string
  text?: string
  isReply?: boolean
  viewCount?: number
  likeCount?: number
  replyCount?: number
  retweetCount?: number
  quoteCount?: number
  createdAt?: string
  retweeted_tweet?: unknown
}

/* a refusal worth asking again: too many at once, the vendor's own trouble, a dropped line */
const AGAIN = [600, 1_600]

/**
 * One vendor call, asked again twice on a 429, a 5xx, a timeout or a
 * dropped connection; null when it still has not answered, or on a refusal
 * asking again will not fix (no key, 401, 402 out of credits). Every refusal
 * is logged by its status, never with the key.
 */
async function pull(path: string): Promise<Record<string, unknown> | null> {
  if (!DATA_KEY) return null
  const route = path.split('?')[0]
  for (let attempt = 0; ; attempt++) {
    let status = 0
    try {
      const res = await fetch(`${DATA_BASE}${path}`, {
        headers: { 'X-API-Key': DATA_KEY },
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      })
      if (res.ok) return (await res.json()) as Record<string, unknown>
      status = res.status
    } catch {
      status = 0
    }
    const again = status === 0 || status === 429 || status >= 500
    if (!again || attempt >= AGAIN.length) {
      console.warn(`[worth] vendor ${route} gave up: ${status || 'no answer'} after ${attempt + 1} tries`)
      return null
    }
    await new Promise((r) => setTimeout(r, AGAIN[attempt]))
  }
}

/** written by the account itself: no reposts, no replies */
const isOwn = (t: UpTweet): boolean =>
  typeof t.text === 'string' && !t.text.startsWith('RT @') && !t.retweeted_tweet && !t.isReply

/**
 * A median wants ten posts. Most accounts give that in one page of twenty
 * (each page is a second or two of somebody watching a spinner); one that
 * mostly reposts (eighteen of twenty for @notmiramurati) needs more, and
 * three pages is where it stops being worth the wait or the credits.
 */
const ENOUGH = 10
const PAGES = 3

async function ownPosts(handle: string): Promise<UpTweet[] | null> {
  const own: UpTweet[] = []
  let cursor = ''
  let answered = false
  for (let page = 0; page < PAGES; page++) {
    const q = `userName=${encodeURIComponent(handle)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const body = (await pull(`/user/last_tweets?${q}`)) as {
      tweets?: UpTweet[]
      data?: { tweets?: UpTweet[] }
      has_next_page?: boolean
      next_cursor?: string
    } | null
    if (!body) break
    answered = true
    const tweets = body.tweets ?? body.data?.tweets ?? []
    for (const t of tweets) if (isOwn(t) && (t.viewCount ?? 0) > 0) own.push(t)
    if (own.length >= ENOUGH || !body.has_next_page || !body.next_cursor) break
    cursor = body.next_cursor
  }
  return answered ? own : null
}

const WEEK = 7 * 24 * 60 * 60_000

/** what the account's own posts say about it */
function readPosts(own: UpTweet[]) {
  const views = own.map((t) => t.viewCount as number)
  const seen = views.reduce((s, v) => s + v, 0)
  const acted = own.reduce((s, t) => s + (t.likeCount ?? 0) + (t.replyCount ?? 0) + (t.retweetCount ?? 0) + (t.quoteCount ?? 0), 0)
  const stamps = own.map((t) => Date.parse(t.createdAt ?? '')).filter((n) => Number.isFinite(n))
  /* the window is from the oldest post read to now; a day's burst is not a habit, so never under a week */
  const weeks = stamps.length ? Math.max(1, (Date.now() - Math.min(...stamps)) / WEEK) : null
  const best = own.reduce<UpTweet | null>((b, t) => (!b || (t.viewCount ?? 0) > (b.viewCount ?? 0) ? t : b), null)
  return {
    medianViews: median(views),
    engagement: seen > 0 ? acted / seen : null,
    perWeek: weeks ? Math.min(50, own.length / weeks) : null,
    top: best?.url ? { url: best.url, text: (best.text ?? '').slice(0, 200), views: best.viewCount ?? 0 } : null,
  }
}

/** undefined: the vendor did not answer; null: X has nobody by that name */
async function fromVendor(handle: string): Promise<Account | null | undefined> {
  const [info, posts] = await Promise.all([pull(`/user/info?userName=${encodeURIComponent(handle)}`), ownPosts(handle)])
  if (!info) return undefined
  const user = (info.data ?? null) as UpUser | null
  /* the vendor says "user not found" for nobody; any other error is the vendor's, not the account's */
  if (info.status === 'error') return /not found|suspend|does not exist/i.test(String(info.msg ?? '')) ? null : undefined
  if (!user || typeof user.userName !== 'string') return null
  const own = user.protected ? [] : (posts ?? [])
  const read = readPosts(own)
  return {
    handle: user.userName,
    name: user.name?.trim() || user.userName,
    avatar: sharp(user.profilePicture),
    verified: user.isBlueVerified === true,
    followers: user.followers ?? 0,
    medianViews: read.medianViews,
    posts: own.length,
    engagement: read.engagement,
    perWeek: own.length ? read.perWeek : null,
    about: (user.description || user.profile_bio?.description || '').trim() || null,
    top: read.top,
    listed: false,
    at: Date.now(),
  }
}

/* ---------------------------------------------------- 3. followers only */

async function fromProfile(handle: string): Promise<Account | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/${handle}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      user?: {
        screen_name?: string
        name?: string
        avatar_url?: string
        followers?: number
        description?: string
        verification?: { verified?: boolean }
      }
    }
    const u = body.user
    if (!u?.screen_name) return null
    return {
      handle: u.screen_name,
      name: u.name?.trim() || u.screen_name,
      avatar: sharp(u.avatar_url),
      verified: u.verification?.verified === true,
      followers: u.followers ?? 0,
      medianViews: null,
      posts: 0,
      engagement: null,
      perWeek: null,
      about: u.description?.trim() || null,
      top: null,
      listed: false,
      thin: true,
      at: Date.now(),
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ read */

/**
 * A creator with a page is read off the page, and X fills what the page does
 * not carry (how often they post, their best post) when X answers. A page with
 * no scan yet knows who it is but not its reach, so X carries the reach.
 */
export async function readAccount(handle: string): Promise<Read> {
  const [listed, fresh] = await Promise.all([fromUnfair(handle), fromVendor(handle)])
  if (fresh === null && !listed) return { ok: false, reason: 'nobody' }

  if (listed) {
    if (!fresh) return { ok: true, account: listed }
    return {
      ok: true,
      account: {
        ...listed,
        medianViews: listed.medianViews ?? fresh.medianViews,
        engagement: listed.engagement ?? fresh.engagement,
        perWeek: fresh.perWeek,
        top: fresh.top,
      },
    }
  }
  if (fresh) return { ok: true, account: fresh }
  /* with the vendor on, its silence is an error: no price on followers alone */
  if (vendorReady) return { ok: false, reason: 'down' }

  const bare = await fromProfile(handle)
  return bare ? { ok: true, account: bare } : { ok: false, reason: 'down' }
}

/** one published page, as the board seeds it — never the paid vendor */
export const readListed = fromUnfair
