import { fetchPublishedCreators } from '../api/creator'
import { later, onWorkers } from '../cloudflare'
import { value, type Valuation } from './model'
import { readAccount, readListed, type Account, type Read } from './read'
import { everyone, recall, remember } from './store'

/**
 * THE BOARD, THE FEED, AND THE ONE WAY INTO A NUMBER — server only.
 *
 * The board is everybody: the creators with a page on unfair.so, and every
 * account anybody has ever checked (Fedor 2026-10-20: more life). The two are
 * told apart on it the way TrustMRR tells verified revenue from a claim: a
 * creator's page is verified (audience read, rates public, bookable), every
 * other row is UNCLAIMED, with the key to claim it one press away. That
 * label is the push the whole page exists for.
 */

/** an account read once is the same account all day — shares reopen it, they do not re-read it */
const FRESH_FOR = 24 * 60 * 60_000
/** one read off the public profile alone (no vendor on this deployment) is asked again after minutes */
const THIN_FOR = 10 * 60_000
const stale = (a: Account) => Date.now() - a.at > (a.thin ? THIN_FOR : FRESH_FOR)
/** the published creators are re-read from their own pages twice a day */
const SEED_EVERY = 12 * 60 * 60_000
/* our own API answers a page in about 0.3s: sixteen at once read the 1,262 in about 25s */
const SEED_AT_ONCE = 16
/* a Worker may make about 50 subrequests on the free plan, 1,000 on a paid one: it reads this many
   pages a run and the next run carries on from the book, which already holds what the last one read */
const SEED_RUN_ON_WORKERS = 40

export interface Result {
  account: Account
  valuation: Valuation
  /** place on the board; null while the board is empty */
  rank: { place: number; of: number } | null
}

export type Lookup = { ok: true; result: Result } | { ok: false; reason: Extract<Read, { ok: false }>['reason'] }

export const valueOf = (a: Account): Valuation =>
  value({
    followers: a.followers,
    medianViews: a.medianViews,
    engagement: a.engagement ?? null,
    perWeek: a.perWeek ?? null,
    about: a.about ?? null,
    listed: a.listed,
  })

/** read today: answering it costs nothing */
export async function known(handle: string): Promise<boolean> {
  const account = await recall(handle)
  return !!account && !stale(account)
}

/** stored if read today, otherwise read now and stored */
export async function lookup(handle: string): Promise<Lookup> {
  let account = await recall(handle)
  if (!account || stale(account)) {
    const read = await readAccount(handle)
    if (!read.ok) return read
    /* a re-read keeps what the account already had: its page date, its last check */
    account = { ...read.account, publishedAt: account?.publishedAt ?? null, checkedAt: account?.checkedAt ?? null }
    await remember(account)
  }
  return { ok: true, result: await resultOf(account) }
}

/** somebody pressed Calculate: the account joins the board and the feed */
export async function markChecked(handle: string): Promise<void> {
  const account = await recall(handle)
  if (account) await remember({ ...account, checkedAt: Date.now() })
}

async function resultOf(account: Account): Promise<Result> {
  const valuation = valueOf(account)
  const rows = await ranked()
  if (!rows.length) return { account, valuation, rank: null }
  const mine = rows.findIndex((r) => r.handle.toLowerCase() === account.handle.toLowerCase())
  if (mine >= 0) return { account, valuation, rank: { place: mine + 1, of: rows.length } }
  const place = rows.findIndex((r) => r.worth < valuation.worth)
  return { account, valuation, rank: { place: (place < 0 ? rows.length : place) + 1, of: rows.length + 1 } }
}

/* ---------------------------------------------------------------- board */

export interface Row {
  handle: string
  name: string
  avatar: string | null
  listed: boolean
  followers: number
  medianViews: number | null
  perYear: number
  worth: number
  checkedAt: number | null
}

const onBoard = (a: Account) => a.listed || !!a.checkedAt

const rowOf = (a: Account): Row => {
  const v = valueOf(a)
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

async function ranked(): Promise<Row[]> {
  const all = await everyone()
  return all
    .filter(onBoard)
    .map(rowOf)
    .sort((a, b) => b.worth - a.worth)
}

/** how many accounts the Live tab is dealt from */
const LIVE_POOL = 90

export interface Board {
  /** the Top tab: the most valuable first */
  top: Row[]
  /**
   * who the Live tab shows being valued (Fedor 2026-10-21: "fake" live, as if
   * somebody checked them a second ago): the real checks first, newest
   * first, then the rest of the board dealt fresh on every load, so the
   * stream is every size of account, not the top of the board over again.
   * The accounts and their numbers are real; the page times them.
   */
  live: Row[]
  /** three creators with a face, for the way in over the headline */
  faces: Row[]
  /** everybody on the board */
  total: number
  /** creators with a page */
  creators: number
}

/** the board as a page draws it, seeding it first when it is stale */
export async function board(limit = 100): Promise<Board> {
  seed()
  const rows = await ranked()
  const unfair = rows.filter((r) => r.listed)
  const faced = rows.filter((r) => r.avatar)
  const checked = faced.filter((r) => r.checkedAt).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0))
  return {
    top: rows.slice(0, limit),
    live: [...checked, ...shuffle(faced.filter((r) => !r.checkedAt))].slice(0, LIVE_POOL),
    faces: unfair.filter((r) => r.avatar).slice(0, 3),
    total: rows.length,
    creators: unfair.length,
  }
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ----------------------------------------------------------------- feed */

export interface FeedItem extends Row {
  kind: 'checked' | 'joined'
  at: number
}

/**
 * What just happened, newest first: the checks people ran, and the pages
 * creators published on unfair.so (the published list carries the date, so
 * these arrive by themselves). The faces round the hero are dealt from it,
 * and the Live tab takes a real check from it the moment one lands.
 */
export async function feed(limit = 24): Promise<{ items: FeedItem[] }> {
  const all = await everyone()
  const items: FeedItem[] = []
  for (const a of all) {
    if (a.checkedAt) items.push({ ...rowOf(a), kind: 'checked', at: a.checkedAt })
    if (a.listed && a.publishedAt) items.push({ ...rowOf(a), kind: 'joined', at: a.publishedAt })
  }
  items.sort((x, y) => y.at - x.at)
  return { items: items.slice(0, limit) }
}

/* ----------------------------------------------------------------- seed */

type Seeding = { at: number; running: Promise<void> | null }
const g = globalThis as unknown as { __worthSeed?: Seeding }
const seeding: Seeding = (g.__worthSeed ??= { at: 0, running: null })

/**
 * The creators the team vouched for (ADR-0132). Its own read because the full
 * list stops at the newest 1,000 pages, and the vouched veterans are exactly
 * the ones that fall past it (Product/lib/api/creator.ts fetchListedCreators).
 */
async function fetchVouched(): Promise<{ x_handle: string; published_at?: string | null }[]> {
  const base = process.env.UNFAIR_API_BASE_URL
  if (!base) return []
  try {
    const res = await fetch(`${base}/v2/app/creators?listed=true`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    return res.ok ? (((await res.json()) as { x_handle: string; published_at?: string | null }[]) ?? []) : []
  } catch {
    return []
  }
}

/**
 * Every published creator we can name, read off their own public page (free,
 * ours) and stored: the newest thousand plus every vouched one. Runs in the
 * background: the first visitor after a deploy sees the board fill in on their
 * next load, nobody waits for a thousand reads.
 *
 * A page leaves the board when reading it stops answering, never because it
 * fell off the end of a capped list.
 */
export function seed(): void {
  if (seeding.running || Date.now() - seeding.at < SEED_EVERY) return
  /* an API that did not answer is asked again in five minutes, not on every view */
  seeding.at = Date.now() - SEED_EVERY + 5 * 60_000
  seeding.running = (async () => {
    try {
      const [newest, vouched] = await Promise.all([fetchPublishedCreators(), fetchVouched()])
      if (!newest.length && !vouched.length) return
      const known = new Map((await everyone()).map((a) => [a.handle.toLowerCase(), a]))

      const names = new Map<string, string>()
      const published = new Map<string, number>()
      for (const p of [...vouched, ...newest]) {
        const k = p.x_handle.toLowerCase()
        names.set(k, p.x_handle)
        const at = p.published_at ? Date.parse(p.published_at) : NaN
        if (Number.isFinite(at)) published.set(k, at)
      }
      /* named by a list just now: a read that fails is the API blinking, not a page taken down */
      const live = new Set(names.keys())
      /* the ones already on the board are re-read too, wherever the lists stop */
      for (const a of known.values()) if (a.listed) names.set(a.handle.toLowerCase(), a.handle)

      /* a page date is in the list itself: no read needed to learn it */
      for (const [k, at] of published) {
        const a = known.get(k)
        if (a && a.publishedAt == null) {
          const dated = { ...a, publishedAt: at }
          known.set(k, dated)
          await remember(dated)
        }
      }

      const owed = [...names.values()].filter((h) => {
        const a = known.get(h.toLowerCase())
        return !a || !a.listed || Date.now() - a.at > SEED_EVERY
      })
      const due = onWorkers() ? owed.slice(0, SEED_RUN_ON_WORKERS) : owed
      const rest = owed.length - due.length
      let next = 0
      const worker = async () => {
        while (next < due.length) {
          const handle = due[next++]
          const k = handle.toLowerCase()
          const was = known.get(k)
          const account = await readListed(handle).catch(() => null)
          if (account) {
            await remember({
              /* what X told us on a check (posting, best post) outlives the page re-read */
              ...was,
              ...account,
              perWeek: account.perWeek ?? was?.perWeek ?? null,
              top: account.top ?? was?.top ?? null,
              publishedAt: published.get(k) ?? was?.publishedAt ?? null,
              checkedAt: was?.checkedAt ?? null,
            })
          } else if (!live.has(k) && was?.listed) {
            /* unpublished since: off the creators' side, still on the board if anybody checked it */
            await remember({ ...was, listed: false })
          }
        }
      }
      await Promise.all(Array.from({ length: SEED_AT_ONCE }, worker))
      /* reads left over: ask again in a minute rather than in twelve hours */
      seeding.at = rest > 0 ? Date.now() - SEED_EVERY + 60_000 : Date.now()
    } finally {
      seeding.running = null
    }
  })()
  later(seeding.running)
}
