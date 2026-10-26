/**
 * WHAT AN X ACCOUNT IS WORTH (creators.unfair.so/worth, 2026-10-20).
 *
 * The page prices an account the way TrustMRR prices a startup: an income,
 * capitalised. The income is brand deals, because that is where the money on
 * X is (X's own revenue share pays cents per thousand views; a sponsored post
 * pays dollars), and the horizon is five years of it.
 *
 *   price per partnership = base price per post × what the account is like
 *   a year               = one partnership a week × 52
 *   worth                = five years of that, growing as the account does
 *
 * Every input is public — followers, views, the account's own posts and bio —
 * so anybody can check anybody, and the answer is the same for whoever asks.
 *
 * Pure arithmetic, shared by the server (the card, the board) and the browser
 * (the count-up, the chart), so a number never differs between the screen and
 * the picture of it.
 */

/** the horizon: five years of brand deals */
export const YEARS = 5
/** one partnership a week, for every account (Fedor 2026-10-20) */
export const PER_WEEK = 1
const WEEKS = 52

/**
 * A sponsored post priced by FOLLOWERS: a power law through the middle of each
 * tier of InfluencerFee's X rate card (2026 — nano 1K–10K $25–150, micro
 * 10K–100K $50–500, mid 100K–500K $300–2,500, macro 500K–2M $1,500–12,000,
 * mega 2M+ $8,000–80,000). Fitted in log space on the tiers' geometric
 * midpoints: 25K followers ≈ $210 a post, 1M ≈ $4.4K.
 */
export const byFollowers = (followers: number): number => 0.04614 * Math.pow(Math.max(followers, 1), 0.8303)

/**
 * The same post priced by REACH: what brands pay per thousand views. $20 is
 * where X rate cards sit (Okara, 2026, over 120+ campaigns), under the $32 the
 * median creator on unfair.so asks (the August roster).
 */
export const CPM = 20
export const byViews = (views: number): number => (views / 1000) * CPM

/**
 * The base price: the geometric mean of both. Followers alone overpay a dead
 * audience; views alone overpay one lucky week. Without views (a protected
 * account, nothing original lately) followers carry it alone.
 */
export function basePrice(followers: number, medianViews: number | null): number {
  const a = byFollowers(followers)
  if (!medianViews || medianViews <= 0) return a
  return Math.sqrt(a * byViews(medianViews))
}

/* ------------------------------------------------------------ multipliers */

/**
 * What the account is like, each a multiplier on the base price, each one
 * something a brand actually pays more (or less) for. Shown one by one, so
 * the number reads as a judgement rather than a lookup.
 */

/** likes, replies, reposts and quotes per view; X's usual is 0.5–3% (InfluencerFee) */
export function engagementX(rate: number | null): number {
  if (rate == null) return 1
  if (rate < 0.005) return 0.9
  if (rate < 0.01) return 1
  if (rate < 0.02) return 1.1
  if (rate < 0.04) return 1.25
  return 1.4
}

/** the account's own posts a week: a brand books the ones who show up */
export function postingX(perWeek: number | null): number {
  if (perWeek == null) return 1
  if (perWeek < 1) return 0.85
  if (perWeek < 3) return 1
  if (perWeek < 7) return 1.1
  return 1.2
}

/**
 * What a reader is worth to an advertiser, by what the account talks about:
 * money and crypto audiences sell dearest, then AI, then tech, marketing,
 * design. Read off the bio (and a creator's own niches); first match wins.
 */
export const NICHES = [
  { label: 'Crypto', x: 1.4, re: /\b(crypto|web3|defi|nfts?|bitcoin|btc|eth|ethereum|solana|onchain|blockchain)\b/i },
  { label: 'Finance', x: 1.35, re: /\b(finance|fintech|investing|investor|stocks?|trading|trader|venture|vc|fund|markets?)\b/i },
  { label: 'AI', x: 1.3, re: /\b(ai|a\.i\.|ml|llms?|gpt|machine learning|agents?|genai|openai|anthropic|deep learning)\b/i },
  {
    label: 'Tech',
    x: 1.2,
    re: /\b(saas|devs?|developers?|engineers?|engineering|software|coding|programmer|tech|startups?|founders?|indie ?hackers?|building|product)\b/i,
  },
  { label: 'Marketing', x: 1.15, re: /\b(marketing|marketer|growth|gtm|seo|sales|b2b|brands?|ads|creators?)\b/i },
  { label: 'Design', x: 1.1, re: /\b(design|designer|ux|ui|figma|creative|art|artist)\b/i },
] as const

export function nicheOf(text: string | null | undefined): { label: string; x: number } | null {
  if (!text) return null
  for (const n of NICHES) if (n.re.test(text)) return { label: n.label, x: n.x }
  return null
}

/**
 * A page on unfair.so: the audience is read and the rates are public, which
 * is what a brand pays the premium for. Without one a brand is buying blind,
 * and the price says so (Fedor 2026-10-20: no page is ×0.7, in red). The one
 * multiplier an account can switch itself, and the page says so.
 */
export const VERIFIED_X = 1.15
export const UNLISTED_X = 0.7

/* ----------------------------------------------------------------- growth */

/**
 * How fast earnings grow if the account keeps posting: the small grow fastest.
 * 30% a year at 1K followers, 6 points less per tenfold, never under 5%.
 */
export function growthOf(followers: number): number {
  const g = 0.3 - 0.06 * Math.log10(Math.max(followers, 1) / 1000)
  return Math.min(0.3, Math.max(0.05, g))
}

/* ----------------------------------------------------------------- value */

export interface Inputs {
  followers: number
  medianViews: number | null
  /** likes + replies + reposts + quotes per view, 0..1 */
  engagement?: number | null
  /** the account's own posts a week */
  perWeek?: number | null
  /** bio and niches, what the niche is read from */
  about?: string | null
  /** has a published page on unfair.so */
  listed?: boolean
}

export interface Valuation {
  followers: number
  medianViews: number | null
  base: number
  x: { engagement: number; niche: number; nicheLabel: string | null; posting: number; verified: number; all: number }
  /** one partnership: the base with every multiplier on */
  perPartnership: number
  /** the first year: a partnership a week */
  perYear: number
  growth: number
  /** each of the five years, the first first */
  years: number[]
  worth: number
  /** 0..1, the share of active accounts on X this one is worth more than */
  beats: number
}

function years(perYear: number, growth: number): number[] {
  return Array.from({ length: YEARS }, (_, k) => perYear * Math.pow(1 + growth, k))
}

export function value(i: Inputs): Valuation {
  const base = basePrice(i.followers, i.medianViews)
  const niche = nicheOf(i.about)
  const x = {
    engagement: engagementX(i.engagement ?? null),
    niche: niche?.x ?? 1,
    nicheLabel: niche?.label ?? null,
    posting: postingX(i.perWeek ?? null),
    verified: i.listed ? VERIFIED_X : UNLISTED_X,
    all: 1,
  }
  x.all = x.engagement * x.niche * x.posting * x.verified
  const perPartnership = base * x.all
  const perYear = perPartnership * PER_WEEK * WEEKS
  const growth = growthOf(i.followers)
  const ys = years(perYear, growth)
  const worth = ys.reduce((s, y) => s + y, 0)
  return {
    followers: i.followers,
    medianViews: i.medianViews,
    base,
    x,
    perPartnership,
    perYear,
    growth,
    years: ys,
    worth,
    beats: beats(worth),
  }
}

/**
 * How brand money moves through a year (Fedor 2026-10-21: seasonality, a dip
 * in January and so on), January first, as the two things a month is made
 * of. POSTS: a deal a week is four a month, five from September, when the
 * launches and the year's last budgets land; 52 a year either way. RATE:
 * what a post goes for against the year's average: soft in January, when
 * budgets reset, and over the summer, highest with Black Friday.
 */
const POSTS = [4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5]
const RATE = [0.84, 0.93, 0.98, 1, 1, 0.95, 0.9, 0.9, 0.96, 1.02, 1.14, 1.04]

/* a page's first months (Fedor 2026-10-21: the chart should grow): brands find
   it over a quarter, one deal, then two, then three, before the season's pace */
const RAMP = [1, 2, 3]

export interface Month {
  /** sponsored posts that month */
  posts: number
  /** what each goes for */
  price: number
  /** the two multiplied: the month's income */
  mrr: number
}

/**
 * The five years as sixty months (Fedor 2026-10-21: the chart and the card
 * speak in MRR, income rather than a price, and a month says how many posts
 * at what price), from the calendar month `from` (0 = January): the price
 * growing at the year's rate and moving with the season, priced so the full
 * pace for five years adds up to the worth; the first three months ramp up
 * to that pace as brands find the page. The first is this month's.
 */
export function mrr(v: Pick<Valuation, 'growth' | 'worth'>, from: number): Month[] {
  const raw = Array.from({ length: YEARS * 12 }, (_, m) => {
    const cal = (from + m) % 12
    return { posts: POSTS[cal], rate: Math.pow(1 + v.growth, m / 12) * RATE[cal] }
  })
  const scale = v.worth / raw.reduce((s, r) => s + r.posts * r.rate, 0)
  return raw.map((r, m) => {
    const posts = m < RAMP.length ? Math.min(RAMP[m], r.posts) : r.posts
    return { posts, price: r.rate * scale, mrr: posts * r.rate * scale }
  })
}

/** the month the card and the chart quote: a year from now, past the ramp, at full pace */
export const MRR_AT = 12

/* -------------------------------------------------------------- standing */

/**
 * Where an account stands among ACTIVE accounts on X, by followers: the share
 * with fewer. Up to 25K it is the only full percentile curve published (Jon
 * Bruner, O'Reilly, a random 400K accounts that posted within 30 days); past
 * it, the census of every account that posted on 20–21 Sep 2022 (Pfeffer et
 * al., ICWSM 2023: 8,635 of 40.2M above 1M followers, 427 above 10M, 6 above
 * 100M). In between, a straight line in log space. Silent accounts are left
 * out on purpose: counting them, two followers would beat half of X.
 */
const STANDING: readonly (readonly [followers: number, below: number])[] = [
  [3, 0.1],
  [19, 0.3],
  [61, 0.5],
  [98, 0.6],
  [246, 0.8],
  [458, 0.9],
  [819, 0.95],
  [1_675, 0.98],
  [2_991, 0.99],
  [24_964, 0.999],
  [1_000_000, 0.99979],
  [10_000_000, 0.999989],
  [100_000_000, 0.9999998],
]

function shareBelow(followers: number): number {
  if (followers <= STANDING[0][0]) return 0
  const lx = Math.log10(followers)
  for (let i = 1; i < STANDING.length; i++) {
    const [f1, p1] = STANDING[i]
    if (followers <= f1) {
      const [f0, p0] = STANDING[i - 1]
      const t = (lx - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0))
      return p0 + t * (p1 - p0)
    }
  }
  return STANDING[STANDING.length - 1][1]
}

/** a typical account: median post reaching a tenth of its followers, every multiplier at one */
const TYPICAL_REACH = 0.1
function typicalWorth(followers: number): number {
  const perYear = basePrice(followers, followers * TYPICAL_REACH) * PER_WEEK * WEEKS
  return years(perYear, growthOf(followers)).reduce((s, y) => s + y, 0)
}

/**
 * "Better than N% of accounts on X", by WORTH rather than followers: the
 * follower count a typical account would need to be worth this much, placed
 * on the follower curve. A small account with big reach outranks a big one
 * nobody reads, which is the whole argument of the page.
 */
export function beats(worth: number): number {
  if (worth <= 0) return 0
  let lo = 0
  let hi = 9.5
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    if (typicalWorth(Math.pow(10, mid)) < worth) lo = mid
    else hi = mid
  }
  return shareBelow(Math.pow(10, lo))
}

/* -------------------------------------------------------------- rate card */

/**
 * The page we would publish for them, priced off one partnership with the
 * door's own ratios (app/loop/data.ts SERVICES: post $200, repost $30, link in
 * bio $25 a week). Rounded the way a creator would type a price.
 */
export function rateCard(perPartnership: number) {
  const round = (n: number) => (n < 20 ? Math.max(5, Math.round(n)) : n < 200 ? Math.round(n / 5) * 5 : Math.round(n / 10) * 10)
  return {
    post: round(perPartnership),
    repost: round(perPartnership * 0.15),
    bio: round(perPartnership * 0.125),
  }
}

/* ----------------------------------------------------------------- handle */

/** '@name', a bare name, or a pasted x.com / twitter.com link: the handle out, by X's own rule */
export function handleFrom(raw: string): string | null {
  const text = raw.trim()
  const fromUrl = text.match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]{1,15})/i)
  const name = (fromUrl ? fromUrl[1] : text.replace(/^@+/, '')).trim()
  return /^[A-Za-z0-9_]{1,15}$/.test(name) ? name : null
}

/* ------------------------------------------------------------------ words */

const us = (n: number) => Math.round(n).toLocaleString('en-US')

/** $194 · $4.2K · $25.2K · $793.4K · $1.2M — the headline's money, one decimal at every size (Fedor 2026-10-21) */
export function money(n: number): string {
  if (n < 999.5) return `$${Math.round(n)}`
  if (n < 999_950) return `$${trim((n / 1_000).toFixed(1))}K`
  if (n < 999_950_000) return `$${trim((n / 1_000_000).toFixed(1))}M`
  return `$${trim((n / 1_000_000_000).toFixed(1))}B`
}

/** a month of the year's brand money, flat (no season): what the account could bring in */
export const perMonth = (v: Pick<Valuation, 'perYear'>): number => v.perYear / 12

/** how many times more a page on unfair earns than the account as it is: 1 for an account already listed */
export const pageLift = (v: Pick<Valuation, 'x'>): number => VERIFIED_X / v.x.verified

/** $19,440 — every dollar */
export const moneyFull = (n: number): string => `$${us(n)}`

/** 812 · 3.5K · 25K · 1.2M — counts in a row of stats */
export function count(n: number): string {
  if (n < 1_000) return us(n)
  if (n < 10_000) return `${trim((n / 1_000).toFixed(1))}K`
  if (n < 1_000_000) return `${Math.round(n / 1_000)}K`
  if (n < 10_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`
  return `${Math.round(n / 1_000_000)}M`
}

/** ×1.15 · ×0.9 · ×1.3 */
export const times = (x: number): string => `×${trim(x.toFixed(2))}`

/** 0.47% · 2.1% */
export const rate = (r: number): string => `${trim((r * 100).toFixed(r < 0.01 ? 2 : 1))}%`

/**
 * 96% · 99.6% · 99.97%: as many decimals as it takes to say something, and
 * never 100 — somebody is always bigger.
 */
export function percent(share: number): string {
  if (share < 0.99) return `${Math.floor(share * 100)}%`
  if (share < 0.999) return `${trim((Math.floor(share * 1000) / 10).toFixed(1))}%`
  return `${trim(Math.min(99.99, Math.floor(share * 10_000) / 100).toFixed(2))}%`
}

const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s)
