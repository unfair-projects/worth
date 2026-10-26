/**
 * The creator surface, typed (ADR-0109).
 *
 * Two audiences in one file, on purpose — they share every type:
 *
 *   - the CREATOR's own calls (`claim`, `getMyPage`, `setServices`, …) go
 *     browser → /api/creator/* → /v2/creator/*, which attaches the Clerk token.
 *   - the PUBLIC read (`fetchCreatorPage`) is server-side and tokenless: it
 *     talks to the API directly, because app/[handle]/page.tsx renders on the
 *     server and a route handler bouncing through its own proxy is a hop for
 *     nothing. `fetchPublicPageInBrowser` is the client-side twin, through
 *     /api/creators/[handle], for a page that re-reads itself after an edit.
 *
 * Money is a decimal STRING on the wire ("250.00"), the platform's convention —
 * a price that has been through a float can disagree with what gets charged.
 * `priceOf` is the one place it becomes a number, for arithmetic the page does.
 */
import type { Platform } from '../creators/platform'
import { ApiError, parseError } from './errors'

/* ----------------------------- what comes back ---------------------------- */

export type CreatorPageStatus = 'draft' | 'review' | 'published' | 'rejected'

export type FollowPerson = {
  username: string
  display_name: string | null
  avatar_url: string | null
}

export type FollowFactView = {
  /** "yc", or the organisation's @handle — the id it is hidden by */
  key: string
  /** what the bio read called the place: company | school | accelerator | media | other */
  kind: string | null
  handle: string
  /**
   * The organisation's avatar on X, once the census's mark pass has bought it
   * (ADR-0113). Null is normal — never censused, a dead account, or a place
   * outside the top the marks are bought for — and the chip draws an initial.
   */
  mark?: string | null
  /**
   * How many of this audience name that place — present, past, founded or
   * backed alike (ADR-0113). One follower is counted under every place their
   * bio names, so these sum to MORE than the follower count.
   */
  count: number
  /** how many of that count founded or lead THIS place, not founders at large */
  founders: number
  people: FollowPerson[]
  /** behind the faces we show, never a count of them */
  more: number
  hidden: boolean
}

/**
 * What that same audience DOES (ADR-0114) — the other half of the same bio read,
 * and its own list: work facts count a whole audience where a follow fact counts
 * one place, so the two are never ranked against each other.
 */
export type WorkFactView = {
  /** "work:founder:ai" / "work:founder" — hidden through the same list as a handle */
  key: string
  /** already a phrase and already plural: "AI founders", "engineers" */
  label: string
  role: string
  /** null on the unqualified fact — the rest of that role, industry or none */
  field: string | null
  count: number
  people: FollowPerson[]
  more: number
  hidden: boolean
}

export type CreatorServiceView = {
  service_id: string
  name: string
  /** decimal string — "250.00" */
  price_usd: string
  offered: boolean
  weekly: boolean
  custom: boolean
}

export type CreatorCollabView = {
  id: string
  /**
   * One of these two is always set (ADR-0115). A post that links to the brand carries
   * the domain and draws its favicon; a post that only says "#ad — @linear" carries the
   * handle, and its logo is the avatar below.
   */
  domain: string | null
  brand_handle: string | null
  /** the cached X avatar for a handle-named brand; absent draws an initial */
  brand_avatar_url: string | null
  brand_name: string
  post_url: string | null
  posted_at: string | null
  views: number | null
  post_text: string | null
  /** false = the creator typed it in; those survive the next scan */
  found: boolean
}

export type CreatorRecentView = {
  /** creator_page.chart_days complete days, oldest first, gaps carried as zeroes */
  days: { date: string; impressions: number; engagements: number }[]
  /** the window ends yesterday; false = the last scan is older and this is what it reached */
  current: boolean
}

export type CreatorStatsView = {
  /** originals only: reposts and replies count towards neither number */
  posts: number
  median_impressions: number | null
  engagement_pct: number | null
  recent: CreatorRecentView | null
}

export type CreatorPageView = {
  creator_id: string
  x_handle: string
  status: CreatorPageStatus
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  followers_count: number | null
  verified: boolean | null
  niches: string[]
  weeks: number
  stats: CreatorStatsView
  verified_followers: number
  /** false makes every count on the page a floor; null means no census has run */
  census_complete: boolean | null
  census_synced_at: string | null
  /**
   * How far the audience read has got, and whether one is still running behind this
   * answer (ADR-0127). `census_reading` is the OWNER's alone — a brand reads a media
   * kit, not our progress — and while it is true the setup screen polls this view.
   *
   * `census_analysed` is people whose bio has been read; `verified_followers` is how
   * many we have found so far, which climbs first and faster; `census_target` is how
   * many we expect to hold when the pass lands (and simply what we hold once it has,
   * so a finished bar is a full one).
   */
  census_analysed: number
  census_target: number
  census_reading: boolean
  /**
   * When the owner's Update profile may count their verified followers again
   * (`recountMyFollowers`; backend creator_followers.recount_days after the last
   * census of any kind). OWNER-ONLY: null on a brand's read, and on the owner's
   * when no census has ever run — nothing holds them back then. A time already
   * past means the key shows now.
   */
  census_recount_at: string | null
  follows: FollowFactView[]
  work: WorkFactView[]
  services: CreatorServiceView[]
  collabs: CreatorCollabView[]
  ages: Record<string, number> | null
  geo: { country_code: string; pct: number }[] | null
  audience_read_at: string | null
  published_at: string | null
  /**
   * On the Roster — an operator's vouch on a claimed, published page (ADR-0132),
   * on every read. Since ADR-0190 it is the door to campaigns: the board, the
   * brief behind a link and the hand-raise are a listed creator's. `false` is
   * "not vouched yet", never "rejected".
   */
  listed: boolean
  /**
   * Whether whoever holds this page proved they hold the X account (ADR-0117), by
   * DMing us from it. Anyone can type a handle at the door; only its owner can put
   * a message in its own thread.
   */
  handle_verified: boolean
  /**
   * How they work (ADR-0121) — the answers the last setup question collects.
   *
   * `responds_in` is the finished SENTENCE ("usually posts the same day"), never
   * the id behind it: the words live in a backend parameter, so re-wording them
   * never touches this repo. NULL means nobody has been asked, and the page then
   * prints no turnaround line at all — which is the whole point of it. The
   * constant this replaced said "usually posts within 12h" under every creator
   * alive, including the ones who had never chosen anything.
   */
  responds_in: string | null
  /** whose day a booked post lands in — the city as typed, the zone as IANA */
  city: string | null
  timezone: string | null
  /** they will look at an offer with a cut of sales in it; no terms, by design */
  referral_open: boolean
  /** owner-only, and absent (null) on a public read */
  incomplete: string[] | null
  review_note: string | null
  /**
   * Owner-only, and the reason the contact line is: the step that collects it
   * prints "Not shown on your page" (ADR-0121). `post_speed` is the id behind
   * `responds_in`, which the setup needs to show their own answer already picked.
   */
  post_speed?: string | null
  contact_channel?: string | null
  contact_value?: string | null
  /**
   * What the scan read their own posts as being about (ADR-0112). Owner-only, and
   * only ever a record of what we guessed: `niches` above is what the page prints,
   * and the scan seeds it from this ONCE, while the creator has chosen nothing.
   */
  suggested_niches?: string[] | null

  /* ------------- THE PLATFORM HALF (frontend-first, 2026-09-23) -------------
     One account, a tab per platform (lib/creators/platform). Every field below
     is optional because the backend sends none of them yet, and its silence
     is exactly today's X page: no `platform`, no other tab, nothing to read.
     The LinkedIn tab arrives in THIS SAME SHAPE, asked for by name
     (`?platform=linkedin`), so every screen that draws a page draws either. */

  /** which tab this view is; absent = X */
  platform?: Platform
  /**
   * Every tab on the account and where each stands, on every view of every
   * tab — so a screen on one can say where the other is without reading it.
   * Absent = this view is the only tab there is.
   */
  platforms?: PresenceView[]
  /**
   * The unfair address (`unfair.so/@<address>`), the account's and the same
   * on every tab. Absent = `x_handle`, which is what the address has always
   * been. A LinkedIn-first account has an address and no X handle; its views
   * carry the address in `x_handle` too until the backend splits the two,
   * which is the client app's reading of the same wire.
   */
  address?: string
  /** the tab the public page opens on when the link names none (spec §5) */
  primary_platform?: Platform
  /** LinkedIn: the line under their name — a title and an employer */
  headline?: string | null
  /**
   * LinkedIn, owner-only: their About as LinkedIn has it. `bio` falls back to
   * it until they write their own, and the setup has to tell the two apart
   * (spec §3.1.6: imported facts and the creator's own words stay
   * distinguishable) — a bio equal to this is LinkedIn's, not theirs.
   */
  linkedin_about?: string | null
  /** LinkedIn: the profile link they gave us, normalised (`https://www.linkedin.com/in/<slug>`) */
  linkedin_url?: string | null
  /** when their latest ORIGINAL post went up, as far as the last read saw (spec §7.1) */
  last_posted_at?: string | null
  /** the posts the numbers stand on (spec §7.1) */
  sample?: SampleView | null
  /**
   * LinkedIn: the medians of spec §7.2. `stats.median_impressions` and
   * `stats.engagement_pct` are null on every LinkedIn view — LinkedIn shows
   * impressions to the author alone and no public read has them (spec §1.10).
   */
  linkedin_stats?: LinkedInStatsView | null
  /** LinkedIn, owner-only: how far the read behind the link has got */
  read?: { profile: ReadState; posts: ReadState } | null
  /** LinkedIn, owner-only: when they agreed to the public figures (spec §7.5); null = never */
  disclosure_accepted_at?: string | null
  /**
   * LinkedIn, owner-only: the newest analytics export LinkedIn wrote for them
   * and we accepted (the client repo's LINKEDIN_CREATORS_SPEC.md §16.0); null
   * until one has been. The fields this app reads — the client repo types the
   * parse whole (`LinkedInExportView` there).
   */
  export?: LinkedInExportView | null
  /**
   * LinkedIn: the tab's reads WHOLE, on every view of the tab, the owner's too
   * (the client repo's `CreatorPageView.linkedin`): the profile facts with the
   * location and the connections count, the export's audience tables, the
   * sample's nested medians. The profile page draws what a brand sees off it
   * (LinkedInSections). Absent on X.
   */
  linkedin?: LinkedInPageView | null
}

/**
 * A LinkedIn tab's numbers, off the latest original posts the last complete
 * posts read established (spec §7.2, the backend's `creator_linkedin_stats`).
 * Each median counts only the posts that carried that counter — an author can
 * hide one, and a hidden counter is missing, never zero — and says how many
 * did (`_n`). Below five, a median is withheld on every surface (spec §7.4).
 */
export type LinkedInStatsView = {
  median_reactions: number | null
  reactions_n: number
  median_comments: number | null
  comments_n: number
  median_reposts: number | null
  reposts_n: number
  /** reactions + comments + reposts, over the posts that carried all three */
  median_engagements: number | null
  engagements_n: number
  /** median engagements ÷ followers × 1,000 — never X's engagement %, which divides by impressions */
  eng_per_1k_followers: number | null
}

/** how far one half of a LinkedIn read has got (spec §3.1.5) */
export type ReadState = 'waiting' | 'reading' | 'done' | 'failed'

/**
 * Which LinkedIn analytics page an export was made on (Sergei 2026-09-29:
 * "export btn on these two pages"). LinkedIn writes the same .xlsx from both;
 * the setup asks for one of each, and says which one each file is.
 */
export type LinkedInExportSource = 'content' | 'audience'

/**
 * An accepted export: when it came, the window LinkedIn wrote into it, and (on
 * the page's `linkedin.export`) what the file says. The setup reads the first
 * three; the profile page's audience reads the tables.
 */
export type LinkedInExportView = {
  uploaded_at: string
  /** the window, as ISO dates */
  from: string
  to: string
  window_days?: number
  impressions?: number
  members_reached?: number | null
  engagements?: number
  followers_total?: number | null
  new_followers?: number | null
  posts_listed?: number
  posts_complete?: boolean
  /** AUDIENCE DEMOGRAPHICS — everyone who follows them */
  followers?: LinkedInDemographics | null
  /** CONTENT DEMOGRAPHICS — who saw the window's posts (read, not drawn) */
  viewers?: LinkedInDemographics | null
}

/* ------------- the tab's reads, as the client repo types them -------------
   (its lib/api/creator.ts, LINKEDIN_CREATORS_SPEC.md §7, §16). Copied for the
   profile page's sections; the nested sample stats are named apart from the
   flat `LinkedInStatsView` above, which is a different shape of the same read. */

/** one line of an export demographics table: LinkedIn's own name and its share, 0–100 as printed */
export type LinkedInShare = { name: string; pct: number }

/** a metro area, and the country unfair's metro table puts it in (null where it does not know it) */
export type LinkedInPlaceShare = LinkedInShare & { country_code: string | null }

/** the five tables of one export sheet — LinkedIn's TOP VALUES, never summing to 100 */
export type LinkedInDemographics = {
  job_titles: LinkedInShare[]
  seniority: LinkedInShare[]
  industries: LinkedInShare[]
  company_sizes: LinkedInShare[]
  locations: LinkedInPlaceShare[]
}

/** one median over the sample and how many sample posts carried that counter */
export type LinkedInMedianView = {
  /** null = withheld under five posts */
  value: number | null
  n: number
}

/** the sample's figures in the client app's nested shape (`linkedin.stats`) */
export type LinkedInSampleStatsView = {
  sample_size: number
  sample_from: string | null
  sample_to: string | null
  /** false = the read stopped before the sample was established (§7.1) */
  complete: boolean
  reactions: LinkedInMedianView
  comments: LinkedInMedianView
  reposts: LinkedInMedianView
  engagements: LinkedInMedianView
  eng_per_1k_followers: number | null
  /** comments ÷ engagements over the sample, 0–100 */
  comment_share_pct: number | null
  /** commented posts the author replied on, 0–100; null until an engagers read */
  author_reply_pct: number | null
  cadence_per_week: number | null
  /** sample posts with an outside link in the body, 0–100 */
  link_in_text_pct: number | null
}

/** who reacted or commented on the sample posts (§7.3); no read fills it yet */
export type LinkedInEngagersView = {
  posts_covered: number
  people: number
  /** with a headline the classifier could place — the shares' denominator */
  classified: number
  /** LinkedIn's seniority names → share 0–1 */
  seniority: Record<string, number>
  /** LinkedIn's job functions → share 0–1 */
  functions: Record<string, number>
  companies: { name: string; universal_name: string | null; logo_url: string | null; count: number }[]
  decision_maker_pct: number | null
  /** people on half or more of the covered posts, 0–100; high is a pod */
  overlap_pct: number | null
}

/** the whole LinkedIn half of a page read — `CreatorPageView.linkedin` */
export type LinkedInPageView = {
  current_title: string | null
  current_company: string | null
  current_company_url: string | null
  /** "London, England, United Kingdom" as LinkedIn writes it */
  location_text: string | null
  country_code: string | null
  /** LinkedIn's connections count off the last good read; 500 is LinkedIn's "500+" */
  connections_count?: number | null
  badges: { verified: boolean; premium: boolean; influencer: boolean }
  profile_read_at: string | null
  posts_read_at: string | null
  engagers_read_at: string | null
  unreadable_since: string | null
  /** the latest complete sample; null = no posts read has completed yet */
  stats: LinkedInSampleStatsView | null
  /** the newest export; null = none yet */
  export: LinkedInExportView | null
  /** null = the engagers have not been read; the page then draws no engagers card */
  engagers: LinkedInEngagersView | null
}

/**
 * How a LinkedIn tab's reads stand (spec §6). There is no connection to keep
 * alive: unfair reads the public profile through Apify on its own schedule,
 * and the only thing that can go wrong is that a read stops succeeding. X
 * has nothing of the kind, so an X presence carries null here.
 *
 * `ok` reads on schedule; `reading` is the first read behind a new link;
 * `stale` is a failed read with the last good one standing (the page stays
 * up, dated); `unreadable` is a profile that has stopped reading — private,
 * renamed, removed, or every read failing — so the page stays up with its
 * old readings while Discovery and new orders pause until a read succeeds;
 * `off` is a creator who removed LinkedIn — the tab is hidden, nothing is
 * read, and its words and prices wait for the link to be added again.
 */
export type ReadHealth = 'ok' | 'reading' | 'stale' | 'unreadable' | 'off'

/** One tab on the account, as every other tab sees it. */
export type PresenceView = {
  platform: Platform
  /** this tab's own review state — the other tab's never moves it */
  status: CreatorPageStatus
  /** in Discovery for this platform — an operator's call, per platform */
  listed: boolean
  /** X: the handle; LinkedIn: the profile's public identifier */
  handle: string | null
  name: string | null
  avatar_url: string | null
  profile_url: string | null
  /** X: they DMed us from it. LinkedIn: always false — nothing proves who holds a profile (spec §1.7) */
  ownership_verified: boolean
  verified_at: string | null
  health: ReadHealth | null
  /** the last SUCCESSFUL read — a failed one never moves it */
  last_read_at: string | null
  published_at: string | null
}

/**
 * The posts a tab's numbers stand on (spec §7.1): the latest originals, at
 * most twenty, newest first. How many of them carry each counter is on
 * `LinkedInStatsView`, where each median is.
 */
export type SampleView = {
  posts: number
  oldest_at: string | null
  newest_at: string | null
  /** false = the read stopped before the latest-twenty sample was established */
  complete: boolean
}

/** the bootstrap read: the X page and the LinkedIn tab, either of which may be missing */
export type CreatorSession = {
  creator: CreatorPageView | null
  /** absent off a backend from before LinkedIn, which is null */
  linkedin?: CreatorPageView | null
}

export type CreatorClaimView = {
  creator_id: string
  x_handle: string
  status: CreatorPageStatus
  claimed: boolean
  created: boolean
}

/**
 * A row of the rate card as the backend prices it FOR THIS CREATOR (ADR-0116):
 * the band and the suggested number come off their own median impressions and
 * follower count, not off a flat list every creator shares. A creator we have
 * no follower count for gets the flat band we ship, which is the honest answer
 * when there is nothing to price off.
 */
export type ServiceCatalogueRow = {
  id: string
  name: string
  weekly: boolean
  suggested: number
  low: number
  high: number
  /** whether a sheet nobody has saved yet starts with this row switched on —
      false only where we suggest $0, since giving something away is theirs */
  offered: boolean
}

/* ------------------------------ what goes out ----------------------------- */

export type PagePatch = {
  page_bio?: string
  niches?: string[]
  /** the fact keys to keep OFF the page */
  follows_hidden?: string[]
  weeks?: number
  /* --- how they work (ADR-0121). An id we do not ship, a channel we do not
     know or a zone that will not resolve is a 422 with a sentence on it; '' is
     not a bad answer, it puts the field back to never-asked. */
  post_speed?: string
  city?: string
  /** IANA ("Europe/Berlin"), never an abbreviation — a calendar computes with it */
  timezone?: string
  contact_channel?: string
  contact_value?: string
  referral_open?: boolean
  /** the account's, on either tab's PATCH: which tab the page opens on */
  primary_platform?: Platform
}

export type ServiceIn = {
  service_id: string
  /** ignored for the services we ship — their names are the backend's */
  name?: string
  price_usd: number
  offered?: boolean
}

/* -------------------------------- plumbing -------------------------------- */

/** Clerk's token straight from its JS, mirroring lib/api/client.ts's belt and braces. */
async function sessionToken(): Promise<string | null> {
  try {
    const clerk = (globalThis as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk
    return (await clerk?.session?.getToken?.()) ?? null
  } catch {
    return null
  }
}

async function authed(headers?: Record<string, string>): Promise<Record<string, string> | undefined> {
  const token = await sessionToken()
  if (!token) return headers
  return { ...(headers ?? {}), Authorization: `Bearer ${token}` }
}

async function read<T>(res: Response): Promise<T> {
  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    if (res.ok) throw new ApiError(502, 'BadResponse', 'The server returned a malformed response.')
  }
  if (!res.ok) throw parseError(res.status, parsed)
  return parsed as T
}

export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/creator/${path}`, {
      method,
      headers: await authed(body === undefined ? undefined : { 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(503, 'Unreachable', 'Network error. Check your connection and retry.')
  }
  return read<T>(res)
}

/* ------------------------------ the creator's ----------------------------- */

/**
 * Take ownership of the handle typed at the door.
 *
 * Idempotent per person, so it is safe on every post-signin mount — and a
 * second call returns the page already held and IGNORES the handle, which is
 * why the door must not treat a changed handle as a way to move house. 409
 * `HandleAlreadyClaimed` means somebody else got there first.
 *
 * On a LinkedIn-first account (a session holding a LinkedIn tab and no X page)
 * the claim ATTACHES the handle to that same account — one person, one
 * account (spec §3.2) — and never mints a second creator beside it.
 */
export const claimHandle = (xHandle: string) =>
  call<CreatorClaimView>('POST', 'claim', { x_handle: xHandle })

/**
 * Does this session hold a creator page? `creator: null` means no X page —
 * and with no `linkedin` either, nothing claimed yet.
 *
 * The bootstrap read, and deliberately not `getMyPage`: before a claim there is
 * no creator principal to resolve, so `/v2/creator/me` answers 401 "invalid or
 * missing bearer token" — a broken-session message for the most ordinary state
 * there is, signed in with nothing claimed. This route verifies the Clerk token
 * itself and says `null` plainly, which leaves every error it DOES throw worth
 * showing: a rejected token, or Clerk unreachable.
 *
 * A LinkedIn-first account answers `creator: null` beside its `linkedin` tab:
 * the X half is exactly as unclaimed as it is for anybody else, and the X door
 * claims it onto the same account (`claimHandle`).
 */
export const getCreatorSession = async (): Promise<CreatorSession> => {
  const s = await call<CreatorSession>('GET', 'session')
  return { creator: s.creator ?? null, linkedin: s.linkedin ?? null }
}

/**
 * A path on one tab. X sends NO parameter — the wire's silence is X, and every
 * X request stays byte-for-byte what it was — and LinkedIn is always named.
 */
const onTab = (path: string, platform: Platform = 'x') =>
  platform === 'linkedin' ? `${path}?platform=linkedin` : path

export const getMyPage = (platform: Platform = 'x') => call<CreatorPageView>('GET', onTab('me', platform))

/**
 * What the creator chose to hear about (backend ADR-0247;
 * NOTIFICATIONS_LOGIC.md §2). Account-wide, not per tab. Per group, what needs
 * them (`*_actions`) and the updates. All on by default.
 */
export type NotificationChoices = {
  messages: 'each' | 'off'
  campaign_actions: boolean
  new_campaigns: boolean
  campaign_updates: boolean
  task_actions: boolean
  task_updates: boolean
  payout_actions: boolean
  payout_updates: boolean
}

export const getMyNotifications = () => call<NotificationChoices>('GET', 'me/notifications')

/** Send only what changed; the answer is the full merged object. */
export const updateMyNotifications = (change: Partial<NotificationChoices>) =>
  call<NotificationChoices>('PUT', 'me/notifications', change)

/**
 * The creator's WhatsApp (backend ADR-0254) — optional, never a gate. `typed`
 * is a number from the old contact field, offered so verifying it is one press;
 * it is never written to until it is verified. `fallback.since` is ISO.
 */
export type MyWhatsApp = {
  available: boolean
  number: string | null
  notices: 'whatsapp' | 'email'
  fallback: { reason: 'stopped' | 'undelivered'; since: string } | null
  typed: string | null
}

export const getMyWhatsApp = () => call<MyWhatsApp>('GET', 'me/whatsapp')

/** where notices go; WhatsApp needs a verified number (409 WhatsAppNotVerified) */
export const setMyNotices = (notices: 'whatsapp' | 'email') => call<MyWhatsApp>('PUT', 'me/whatsapp', { notices })

/** SPENDS MONEY — one paid WhatsApp message carrying a 6-digit code */
export const sendWhatsAppCode = (number: string) =>
  call<{ resend_after: number }>('POST', 'me/whatsapp/code', { number })

export type WhatsAppVerdict = {
  verified: boolean
  number: string | null
  reason: 'wrong' | 'expired' | 'locked' | null
  left: number | null
}

export const verifyWhatsAppCode = (number: string, code: string) =>
  call<WhatsAppVerdict>('POST', 'me/whatsapp/verify', { number, code })

export const whatsAppDelivery = (number: string) =>
  call<{ delivery: 'sent' | 'delivered' | 'failed' }>('GET', `me/whatsapp/delivery?number=${encodeURIComponent(number)}`)

/**
 * The catalogue for one tab. LinkedIn's rows carry no benchmark band — `low`
 * and `high` are 0 — because X's market is no evidence for a LinkedIn price
 * (spec §5); the owner's sheet then draws one off the creator's own LinkedIn
 * followers (creator-pages linkedInBand).
 */
export const getServiceCatalogue = (platform: Platform = 'x') =>
  call<ServiceCatalogueRow[]>('GET', onTab('services', platform))

/** SPENDS: sorsa requests per page of timeline, plus the collab pass's tokens. */
export const scanMe = () => call<CreatorPageView>('POST', 'me/scan')

/** SPENDS: creator_followers.max_pages requests, plus the bio pass's tokens. */
export const censusMyFollowers = () => call<CreatorPageView>('POST', 'me/followers')

/**
 * The Update profile key's census (backend 2026-10-14): the whole verified-follower
 * list again from the top, up to creator_followers.full_census_pages, waited for —
 * so whoever unfollowed is let go, which the setup's census above never does.
 * 429 `ReadTooSoon` before `census_recount_at`.
 * SPENDS: up to full_census_pages requests, plus the bio pass's tokens for new people.
 */
export const recountMyFollowers = () => call<CreatorPageView>('POST', 'me/followers?full=true')

/** Omitted fields are untouched; an emptied bio falls back to the one X carries. */
export const updateMyPage = (patch: PagePatch, platform: Platform = 'x') =>
  call<CreatorPageView>('PATCH', onTab('me/page', platform), patch)

/** The WHOLE sheet of one tab — rows left out are dropped. */
export const setMyServices = (services: ServiceIn[], platform: Platform = 'x') =>
  call<CreatorPageView>('PUT', onTab('me/services', platform), { services })

export const addMyCollab = (brandUrl: string, postUrl: string, brandName = '', platform: Platform = 'x') =>
  call<CreatorPageView>('POST', onTab('me/collabs', platform), {
    brand_url: brandUrl,
    post_url: postUrl,
    brand_name: brandName,
  })

export const removeMyCollab = (collabId: string, platform: Platform = 'x') =>
  call<CreatorPageView>('DELETE', onTab(`me/collabs/${collabId}`, platform))

/** A file up the seam as multipart, answered with the whole page like every other write. */
async function postFile(path: string, form: FormData): Promise<CreatorPageView> {
  let res: Response
  try {
    res = await fetch(`/api/creator/${path}`, { method: 'POST', body: form, headers: await authed() })
  } catch {
    throw new ApiError(503, 'Unreachable', 'Network error. Check your connection and retry.')
  }
  return read<CreatorPageView>(res)
}

/** SPENDS tokens. 409 AudienceReadingLocked after two unreadable shots. */
export async function submitMyAudienceScreenshot(file: File): Promise<CreatorPageView> {
  const form = new FormData()
  form.append('file', file)
  return postFile('me/audience-screenshot', form)
}

/**
 * One LinkedIn analytics export, the .xlsx as LinkedIn wrote it (spec §16.0),
 * with the page it was exported from. Parsed on the backend, no tokens spent.
 * Answers the LinkedIn tab with `export` set to the newest accepted file. 422
 * with a sentence: `LinkedInExportUnreadable` (not that file),
 * `LinkedInExportOtherProfile` (its posts belong to another profile),
 * `LinkedInExportStale` (its follower total is too far from the profile read).
 */
export async function submitMyLinkedInExport(file: File, source: LinkedInExportSource): Promise<CreatorPageView> {
  const form = new FormData()
  form.append('file', file)
  form.append('source', source)
  return postFile('me/linkedin/export', form)
}

/**
 * Hands one tab in. It does NOT go live here — the handle check below is what
 * puts it at unfair.so/@handle. 409 `CreatorPageIncomplete` carries the list of
 * what is still missing, each line naming the step that fixes it.
 *
 * LinkedIn's first hand-in carries the creator's yes to the public figures
 * (spec §7.4) — without it the backend answers 409 `DisclosureRequired`. X
 * sends no body, exactly as before.
 */
export const publishMyPage = (platform: Platform = 'x', acceptDisclosure = false) =>
  call<CreatorPageView>(
    'POST',
    onTab('me/publish', platform),
    platform === 'linkedin' ? { accept_disclosure: acceptDisclosure } : undefined,
  )

/* ------------------------------ the LinkedIn tab ----------------------------- */

/**
 * The creator's LinkedIn profile link (spec §1.7, §3.1.3; 2026-09-24): no
 * LinkedIn login of any kind — unfair reads the public profile and posts
 * through Apify, the way the X page is read off a typed handle. Answers the
 * tab with `read` running: the profile lands in seconds, the posts after it.
 *
 * Works with no creator yet, like `claim`: it is what makes a LinkedIn-first
 * account. On a tab that is not yet handed in it REPLACES the link — a wrong
 * one is fixed by pasting another before publication (spec §3.1.4). 422
 * `InvalidLinkedInUrl` for anything that is not a `linkedin.com/in/…`
 * profile; 409 `LinkedInProfileTaken` for a profile another unfair account
 * holds, which is never moved onto this one (spec §3.1).
 */
export const setLinkedInProfile = (linkedinUrl: string) =>
  call<CreatorPageView>('PUT', 'me/linkedin', { linkedin_url: linkedinUrl })

/**
 * Read again (spec §6): one profile read and one posts read, throttled —
 * sooner than the backend's `linkedin.reread_min_s` answers 429 with the time
 * left and starts nothing. A read that fails changes nothing on the page.
 */
export const readLinkedInAgain = () => call<CreatorPageView>('POST', 'me/linkedin/read')

/**
 * Remove LinkedIn (spec §6): reads stop and the tab comes off the public page
 * at once; orders and money already in flight stay where they are. Answers
 * the tab as it now stands, `health: 'off'`, its words and prices kept for a
 * link added again.
 */
export const removeLinkedIn = () => call<CreatorPageView>('DELETE', 'me/linkedin')

export type CreatorVerifyView = {
  verified: boolean
  /** true only when THIS call took the page live, so the screen says so once */
  published: boolean
  /**
   * Why nothing was settled. `no_dm` is the ordinary waiting answer — we looked and
   * their message has not arrived. `wrong_words` means they wrote and the phrase was
   * not in it (only reachable where the backend requires the phrase; it does not by
   * default). `too_soon` means the thread was read recently enough that reading it
   * again would buy the same answer twice, so polling faster than the backend's
   * interval costs nothing and tells you nothing.
   * `disabled` means the check is switched off entirely and an operator will look.
   */
  reason: string | null
  /** who to DM — from the inbox that does the reading, never a constant of ours */
  dm_handle: string | null
  dm_user_id: string | null
  /**
   * The words to send, for the same reason the handle rides along: the screen prints
   * what the check looks for, or the day it changes there are two answers to what a
   * creator was asked. Empty string when any message at all will do.
   */
  phrase: string | null
  /**
   * Only on `too_soon` — seconds of rest left on the thread. The press waits exactly
   * this long and asks again, instead of guessing an interval or reporting a message
   * as missing when nothing was actually read.
   */
  retry_after_seconds: number | null
  page: CreatorPageView
}

/**
 * Have they DMed us from the handle they claimed? (ADR-0117)
 *
 * SPENDS MONEY — one DM read per event in their thread, billed to us rather than
 * to them. Safe to poll: the backend rests a thread it just read and answers
 * `too_soon` without buying anything.
 *
 * `manual` is the creator's own "Sent it" press rather than the screen polling
 * behind them. It reads the same thread against a much shorter rest, because a
 * press is the moment the message most likely just landed — and the moment the
 * poll's own rest window is most likely to be sitting inside.
 */
export const verifyMyHandle = (manual = false) =>
  call<CreatorVerifyView>('POST', 'me/verify', { manual })

/* --------------------------- the campaign link ----------------------------- */

/**
 * The brief behind a shared /campaign/<id> address (2026-08-31): what the
 * campaign is, when it happens, the document the team wrote — and where THIS
 * creator stands with it. `notes` is markdown, the same document the operator
 * edits; `my_status` null is what the Apply key renders on. The surface is
 * signed-in only: a 401 here is the registration wall, not an error.
 */
/**
 * Where a seat stands (backend CampaignMemberStatus, minus `picked`, which
 * never reaches a creator — it is the client's private draft of who goes).
 * `expired` is an invitation or application nobody answered before its own
 * deadline, kept apart from `declined` because nobody said no.
 */
export type CampaignSeatStatus =
  | 'applied'
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'removed'
  | 'expired'

/** the brand's number on a seat (ADR-0157) — round by round since ADR-0173, on invitations too */
export type CampaignOfferStatus = 'pending' | 'accepted' | 'declined' | 'expired'

/**
 * What the window said about their proof (backend CampaignDutyVerdict).
 * `unproven` is OURS — the verification walk truncated, so absence is proved
 * of nothing — and every screen words it as "we could not tell", never as the
 * creator's failure. `pulled` is a post we had proved that is gone.
 */
export type CampaignProofVerdict =
  | 'pending'
  | 'done_in_window'
  | 'done_late'
  | 'missed'
  | 'unproven'
  | 'excused'
  | 'pulled'

/** one brief attachment — a public bucket URL; the client's library id stays home */
export type CampaignFileView = { url: string; label: string; media_type: string }

/** A face and a handle — never a price, never a status word. */
export type CampaignParticipant = {
  x_handle: string
  display_name: string | null
  avatar_url: string | null
}

export type CampaignBriefView = {
  campaign_id: string
  name: string
  brand_handle: string
  /** the brand's website, when the team typed one — a line under Promoting */
  brand_website: string | null
  /* ------------------------- WHO THE BRAND IS ---------------------------
     The client's X account as a person reads it — the NAME on top and the
     @handle under it (Sergei 2026-09-11: "here should be the name and the
     tag under it … this is clients twitter account name and tag"). Optional
     because no backend sends either yet: the campaign payload carries the
     handle and the website and nothing more, so today's header prints the
     handle on its top line and the website under it. The day the wire
     carries a name the header fills in and no component changes. */
  /** the display name on the brand's X account — NOT the handle */
  brand_name?: string | null
  /** their X picture, if the backend has captured one */
  brand_avatar_url?: string | null
  /** where the campaign runs — absent is X, the wire's silence (lib/creators/platform platformOf) */
  platform?: Platform
  /** a LinkedIn campaign's window (CampaignLinkedInCard below); absent on X */
  linkedin?: CampaignLinkedInCard
  /* ------------------------------- THE CARD -------------------------------
     The pre-approval half (client repo EVENT_CREATION_PLAN §3; backend
     CreatorCampaignBriefView, 2026-09-09): what a creator decides on BEFORE
     they are in — the angle, who posts, what is promoted, what it is for,
     when it pays. Readable at any seat status; the brief proper is embargoed
     until `accepted` (see `notes`). Optional on the wire because a backend
     older than origin/dev 06f57aa sends none of them, and a card missing a
     line draws nothing rather than a sentence nobody wrote. */
  /** the one-paragraph angle — the FIRST thing an invited creator reads */
  description?: string | null
  /** the handle the promo post comes FROM, when it is not the brand's own; null on LinkedIn, whose campaign is from `linkedin.post_by` */
  post_by_handle?: string | null
  /** the thing being promoted */
  product_url?: string | null
  /** what the campaign is for — 'reach' | 'leads'; the ask and the scorecard read it */
  goal?: string
  /** "when will I get my money?" — the first payout weekday strictly after the moment; on LinkedIn, after the window's last day */
  payout_expected_on?: string | null
  /** an invite-only campaign opened without a seat: name and brand only, nothing to act on */
  invite_only_locked?: boolean
  scheduled_at: string | null
  /**
   * The whole brief, as markdown — EMBARGOED (ADR-0155): null until this
   * creator is accepted, except on a campaign with no `description`, where
   * the brief is all there is to decide from. A null here beside a
   * description is "opens once you are in", never "not written yet".
   */
  notes: string | null
  /** the long brief's address — accepted seats only, same embargo */
  brief_url?: string | null
  /** the brief's attached files — public URLs, under the same embargo */
  files?: CampaignFileView[]
  my_status: CampaignSeatStatus | null
  /** why they cannot apply although they may read it (ApplyBlocked); absent when they can */
  apply_blocked?: ApplyBlocked
  /** the price on their seat — decimal string ("250.00"), null before they apply */
  my_ask_usd: string | null
  /** their own rate card's Sponsored-quote price: the apply field's prefill. On LinkedIn the tab's `li_post` price — the Duty is a post of their own — or null with no such row */
  suggested_usd: string | null
  /** approval locked the number — the team approved THAT price; edits go through them */
  ask_locked: boolean
  /**
   * When an unanswered invitation lapses. Frontend-first: the backend keeps it
   * on the campaign (`answer_deadline_at`) and does not serialize it here yet.
   */
  answer_by?: string | null
  /**
   * When the CLIENT must accept, decline or counter an application. Separate
   * from `answer_by`, which is a creator-owned invitation/offer deadline.
   */
  decision_by?: string | null
  /* ---------------------------- THE COUNTER-OFFER ---------------------------
     The brand's price named ON their seat (ADR-0157): on their application,
     instead of taking the ask or turning it away — or, since ADR-0173
     (2026-09-12), on the invitation itself, the number the lineup was counted
     with. Accept and the seat is in at THIS number, locked. Decline and an
     application stands at their own ask, an invitation is passed on. Decline
     WITH a number of their own and that number is the ask, the brand's offer
     reads `declined`, and the brand answers again — take it, turn it down, or
     name another; rounds are unlimited, one number on the table at a time.
     `my_offer_status` is the effective one — a pending offer past its TTL
     reads `expired` here without anyone pressing; an invitation's number
     stands as long as the invitation does. */
  my_offer_usd?: string | null
  my_offer_status?: CampaignOfferStatus | null
  my_offer_at?: string | null
  /** whose move the seat waits on (ADR-0173): `creator` while a number stands for them or an invitation is unanswered, `client` while their ask waits on the brand, null on a settled seat; undefined off an older backend */
  offer_turn?: 'client' | 'creator' | null
  /* -------------------------------- THE PROOF -------------------------------
     Their pasted link (campaign-proof-design, 2026-09-06) and where it landed.
     The verdict is the window's word off their duty and the compliance the
     judge's; neither moves money by itself — a person in the console does.
     `my_proof_url` replaced the `my_post_url` this app invented before the
     backend built the route (2026-09-08 → 2026-09-09). */
  my_proof_url?: string | null
  my_proof_posted_at?: string | null
  my_proof_verdict?: CampaignProofVerdict | null
  my_proof_compliance?: 'ok' | 'flagged' | null
  my_proof_note?: string | null
  /** this seat already has an earned row — paid at the post check while the campaign runs (backend ADR-0225), at completion, or after the close; false/absent off an older backend */
  my_paid?: boolean
  /* ------------------------------ THE LIVE POST ------------------------------
     AHEAD OF THE WIRE (Sergei 2026-09-10: "when the post is live we need to
     add the link to it so creator can actually quote it … and add a live
     status"). The backend keeps all of it on the campaign (models/campaign.py:
     `post_link` is the live press's FACT stamped at T-0, `promo_post_url` the
     plan typed days ahead that the press prefills from, `moment_status` the
     press's walk) and CreatorCampaignBriefView serializes none of it yet.
     Optional so today's payload type-checks: the seat card draws the post to
     quote where a link arrives, and "live" is read off the clock until the
     flag does (CampaignBrief `live`). */
  /** the brand's post, once the live press stamped it — the post to quote */
  post_link?: string | null
  /** the post's planned address, typed ahead by the team */
  promo_post_url?: string | null
  /** has the post gone up — a second axis beside the campaign's own status; on LinkedIn `waiting` until the window opens, `live` from then */
  moment_status?: CampaignMomentStatus | null
  /** the press's minute; on LinkedIn the instant the window opened */
  went_live_at?: string | null
  /* ------------------------------ THE CHECKLIST ------------------------------
     ON THE WIRE since 2026-09-14 (backend ADR-0182; Sergei 2026-09-10:
     "checkboxes now are not functioning — user needs to mark them all done to
     be able to submit the link"). The client's Create key sends `checklist:
     [{id, text, required}]` and the backend keeps it on the campaign; the
     To-dos draw every line as a box the creator ticks, the ticks live on the
     seat (`my_ticks`, the ticks door below), and the link key waits for the
     last tick — as does the proof door itself, and `taskOfSeat`'s `locked`
     carries the same count into the shared panel. Optional still, for a
     backend deployed before the column. */
  checklist?: CampaignChecklistItem[]
  /** the ids of the team's lines THIS seat has ticked */
  my_ticks?: string[]
  /** accepted + applied seats, accepted first — the avatar row */
  participants: CampaignParticipant[]
}

/** the press's walk (backend CampaignMomentStatus): `waiting` until the team
    presses at the minute; anything after `waiting` but `abandoned` means the
    post is up. A LinkedIn campaign has no press: `waiting` until its window
    opens, `live` from then to the end */
export type CampaignMomentStatus = 'waiting' | 'live' | 'verifying' | 'verified' | 'abandoned'

/**
 * A LINKEDIN CAMPAIGN'S CARD (backend CreatorCampaignLinkedInView, ADR-0250;
 * Rins 2026-10-15: "On time: any day inside the window"). No brand post and
 * no minute: each creator publishes one post of their own on ANY day from
 * `window_start` to `window_end`, wall dates counted in `time_zone`. The
 * three instants are the backend's own, sent so no browser turns a zone into
 * an instant: `opens_at` the first day's midnight (= `scheduled_at`),
 * `closes_at` the midnight after the last day, `completes_at` when the
 * campaign completes and its seats are paid. The link is taken until then and
 * judged by the post's own date. `post_by` is who the campaign is from — a
 * website or a LinkedIn page, '' when none. Absent on X; the brand's audience
 * is not the creator's business and never sent.
 *
 * SINCE ADR-0263 (Rins 2026-10-22): `start_time` is the first day's "HH:MM"
 * the window opens at, in `time_zone` ("00:00" is midnight; `opens_at` is that
 * instant), and `quote_post_url` the brand's own post a creator may quote
 * with words of their own instead of writing one — either counts, a quote
 * only of this post. Both absent from a backend older than them.
 */
export type CampaignLinkedInCard = {
  window_start: string | null
  window_end: string | null
  time_zone: string | null
  start_time?: string | null
  quote_post_url?: string | null
  opens_at: string | null
  closes_at: string | null
  completes_at: string | null
  post_by: string
  /** the placements offered — ['li_post'] in v1 */
  formats: string[]
}

/** one line of the brand's before-launch list, as the client's form sends it */
export type CampaignChecklistItem = {
  id: string
  text: string
  required: boolean
}

/**
 * WHY A CAMPAIGN THEY MAY READ TAKES NO APPLICATION FROM THEM (backend
 * ADR-0261, Rins 2026-10-21: "public campaigns I want for ALL to see"): every
 * creator reads every Public campaign, X and LinkedIn, and the door stays on
 * the hand-raise. `no_page`: nothing of theirs on the campaign's platform.
 * `not_listed`: their page there is not listed by the team yet (or, on
 * LinkedIn, not published). Absent on the wire where they can apply, and on
 * any seat they already hold.
 */
export type ApplyBlocked = 'no_page' | 'not_listed'

export type CampaignDashboardRow = {
  campaign_id: string
  name: string
  brand_handle: string
  /** the campaign's own status — the finished shelf tells cancelled from completed */
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  scheduled_at: string | null
  /** their seat where one exists; board rows carry null or 'invited' */
  my_status: CampaignSeatStatus | null
  my_ask_usd: string | null
  /** ISO date of the first payday strictly after the moment; null = no moment or cancelled. On LinkedIn, after the window's last day */
  payout_expected_on: string | null
  /** where the campaign runs — absent is X (lib/creators/platform platformOf) */
  platform?: Platform
  /** a LinkedIn campaign's window (CampaignLinkedInCard); absent on X */
  linkedin?: CampaignLinkedInCard
  /** a `live` row they cannot apply to, and why (ApplyBlocked); absent when they can */
  apply_blocked?: ApplyBlocked

  /* ------------- THE THREE THE BOARD DOES NOT SEND YET (2026-09-09) -------------
     Sergei asked the card for four things: two lines of the brief, a quote, a
     tag like "Best fit", and a published date. The quote is the creator's own
     rate card and is already in the shell (rateBandOf below). These three are
     the campaign's, and /v2/creator/campaigns returns eight fields with none of
     them among it. They are optional so today's payload still type-checks, and
     the card draws nothing where one is missing rather than a plausible
     sentence nobody wrote. The day the endpoint carries them, the card fills
     in and no component changes. ---------------------------------------- */

  /**
   * THE BRAND AS A PERSON READS IT (backend CreatorDashboardRow, 2026-09-16):
   * the client's name and the account's X picture — what the Orders table
   * draws for a client who never linked X, whose `brand_handle` is then the
   * campaign's Post by handle or empty. Absent off an older backend.
   */
  brand_name?: string | null
  brand_avatar_url?: string | null

  /** ISO moment the brief went on the board — the card's "Published 3 days ago" */
  published_at?: string | null
  /** the opening of the brief, the backend's own trim; the card clamps it to two lines */
  brief_excerpt?: string | null
  /** short labels the board computes for THIS creator — "Best fit", "New", "Closing soon" */
  tags?: string[] | null

  /* ------------- AND TWO MORE THE BRIEF HAS AND THE ROW DOES NOT (2026-09-09) ----
     A pending counter-offer is an answer the creator owes, and an invitation
     has a clock on it; the shelf and the home's Needs you paint both — the
     day the row carries them. Until then a creator learns of an offer by
     opening the brief, which is where it is answered anyway. */

  /** the brand's number on their seat, where one stands — on an application, or on the invitation itself (ADR-0173) */
  my_offer_usd?: string | null
  my_offer_status?: CampaignOfferStatus | null
  /** whose move the seat waits on (ADR-0173): `creator` while a number stands for them or an invitation is unanswered, `client` while their ask waits on the brand, null on a settled seat; undefined off an older backend */
  offer_turn?: 'client' | 'creator' | null
  /** when an unanswered invitation lapses */
  answer_by?: string | null
  /**
   * WHEN THIS SEAT APPEARED ON THE CREATOR'S SHELF (backend CreatorDashboardRow,
   * 2026-09-14): the moment they were invited or applied, the seat's own
   * stamp — what the Orders shelf sorts on (Fedor: "sort by time of
   * appearance"). Optional because a backend from before it sends none, and
   * the shelf then falls back to the brief's `published_at`.
   */
  seated_at?: string | null
  /** when the client must decide an application; null on every other seat */
  decision_by?: string | null
  /**
   * Proof on the compact row. Optional for compatibility with the current
   * backend; once present it lets the home and Orders shelf distinguish a due
   * post from one that was actually handed in.
   */
  my_proof_url?: string | null
  /** paid at the post check while the campaign runs (backend ADR-0225) — or at completion, or after the close: the ledger carries it, so it is never drawn as upcoming too; absent off an older backend */
  my_paid?: boolean
  /** the launch post's own state (backend ADR-0153): a link is owed only once
      it is live, and never after an abandoned moment */
  moment_status?: CampaignMomentStatus | null
}

export type CampaignDashboardView = {
  /** the open casting board: running campaigns with a brief they have not answered */
  live: CampaignDashboardRow[]
  /** their hands in flight — applied or approved, campaign still running */
  applied: CampaignDashboardRow[]
  /** completed/cancelled campaigns they were on */
  finished: CampaignDashboardRow[]
}

export const getCampaignDashboard = () => call<CampaignDashboardView>('GET', 'campaigns')

export const getCampaignBrief = (campaignId: string) =>
  call<CampaignBriefView>('GET', `campaigns/${campaignId}`)

/**
 * Raise a hand, with a price on it. The number is REQUIRED — a hand raised
 * without one cannot be budgeted — and prefilled from their own Sponsored-quote
 * rate, theirs to adjust for what the brief actually asks. A fresh seat lands
 * as `applied`; a creator who was already invited has said yes only at the
 * invitation's own number — at any other, or on an invitation that carried
 * none, it is their own number and the seat comes back `applied` for the brand
 * to agree to (ADR-0173, 2026-09-12). Refusals are sentences, verbatim.
 */
export const applyToCampaign = (campaignId: string, askingPriceUsd: string) =>
  call<CampaignBriefView>('POST', `campaigns/${campaignId}/apply`, {
    asking_price_usd: askingPriceUsd,
  })

/**
 * Change the ask while the seat still stands at `applied` — approval locks the
 * number, and a locked ask answers 422 saying to talk to the team.
 */
export const updateCampaignAsk = (campaignId: string, askingPriceUsd: string) =>
  call<CampaignBriefView>('PATCH', `campaigns/${campaignId}/ask`, {
    asking_price_usd: askingPriceUsd,
  })

/**
 * Tick the team's before-launch list (backend ADR-0182): the WHOLE set of
 * ticked ids each press — an untick is the same door — answered with the
 * brief as it now stands. 422 for an id not on the list.
 */
export const setCampaignTicks = (campaignId: string, ids: string[]) =>
  call<CampaignBriefView>('PUT', `campaigns/${campaignId}/ticks`, { ids })

/**
 * THE PROOF — the link to their post (2026-09-08; on the backend's own route
 * since 2026-09-09, which replaced the `PUT campaigns/:id/post` this app had
 * invented ahead of it). The post id's snowflake proves WHEN they posted
 * against the moment's window — the paste can be late, the posting time
 * cannot — and one read proves it is theirs. `post_url` arrives canonical
 * (`https://x.com/<handle>/status/<id>`); the card has already refused
 * anything that is not a post, or not from the handle on the seat. 422 names
 * what is wrong with the link, 409 a seat that is not accepted or a launch
 * not yet live, 404 while proofs are switched off backend-side — all
 * sentences, printed as they come. Open until the campaign completes: a valid
 * late paste still flips a missed verdict to what the snowflake proves.
 *
 * ON LINKEDIN (backend ADR-0250) the link is their own linkedin.com post
 * (lib/api/orders postUrlOn checks the shape first), up to 2000 characters,
 * or LinkedIn's `lnkd.in` short link, which the backend follows to the post.
 * The post's date, decoded from its id in the campaign's zone, must fall on a
 * day of the window, and then the post itself is read on LinkedIn (ADR-0251):
 * up, public and theirs. A bare repost is refused, one with their own words
 * counts. That read takes seconds, so the proxy gives `proof` its slow
 * allowance. Open from the yes — no launch to wait for — until the campaign
 * completes. 422 names a link of the wrong shape, another profile's post, a
 * post LinkedIn shows nobody, a bare repost, or a day outside the window; 503
 * LinkedIn not answering ("paste it again in a minute"); 409 days not set, the
 * team's not-done, or a post already counted for another campaign. Stored and
 * returned canonical as `my_proof_url`.
 */
export const submitCampaignProof = (campaignId: string, postUrl: string) =>
  call<CampaignBriefView>('POST', `campaigns/${campaignId}/proof`, { post_url: postUrl })

/**
 * Answer the brand's number on their seat (ADR-0157; round by round since
 * ADR-0173, 2026-09-12), three ways. Accept and the seat is in at the OFFERED
 * price, locked. Decline without a number and an application stands at their
 * own ask for the brand to decide again, an invitation is passed on. Decline
 * WITH `askingPriceUsd` and that is their own number back: the brand's offer
 * reads `declined`, the ask is theirs, an invitation becomes an application —
 * and the brand can take it, turn it down, or name another. 422 when no offer
 * stands, it expired, or it was already answered; 409 when the seat itself was
 * answered elsewhere. Sentences, verbatim.
 */
export const answerCampaignOffer = (campaignId: string, accept: boolean, askingPriceUsd?: string) =>
  call<CampaignBriefView>('POST', `campaigns/${campaignId}/offer`, {
    accept,
    ...(askingPriceUsd ? { asking_price_usd: askingPriceUsd } : {}),
  })

/* ------------------------------ the invitations ----------------------------- */

/** a seat a brand is holding for this creator, as the invitations door lists it */
export type CampaignInvitationView = {
  member_id: string
  campaign_id: string
  campaign: string
  brand_handle: string
  /** where the campaign runs — absent is X (lib/creators/platform platformOf) */
  platform?: Platform
  /** a LinkedIn campaign's window (CampaignLinkedInCard); absent on X */
  linkedin?: CampaignLinkedInCard
  /** the seat's status — invited while it is still theirs to answer */
  status: CampaignSeatStatus
  /** what the brand asked of the seat: reply | quote on X, post (one of their own) on LinkedIn */
  default_action: string
  invited_at: string
  /** the campaign's moment, while it is still a plan */
  next_wave_at: string | null
}

export type CampaignInvitationsView = { items: CampaignInvitationView[] }

/** every seat held for this creator that nobody has answered */
export const getMyInvitations = () =>
  call<CampaignInvitationsView>('GET', 'campaign-invitations')

/**
 * Say no to a held seat (backend `creator_respond_campaign_invitation`) — the
 * one control the lifecycle contract said was missing: silence cannot be the
 * only way to turn an invitation down. A yes goes through `applyToCampaign`,
 * which prices the seat; this door carries no price, so it only ever says no.
 */
export const declineInvitation = (memberId: string) =>
  call<CampaignInvitationView>('POST', `campaign-invitations/${memberId}/respond`, {
    accept: false,
  })

/* ------------------------------ the conversations --------------------------- */

/**
 * THE ROOMS (backend ADR-0162): one Conversation per brand and creator, shared
 * by every order and campaign task. They live in the backend's messages store
 * and are dark — the doors answer 404 — until it is configured and enabled.
 *
 * Polling only, no live channel: a room is re-read while it is on screen.
 */
export type ConversationSubject = 'order' | 'campaign' | 'general'

export type MessageView = {
  /** the cursor — pass the last one back as `after` */
  id: number
  /** user:<id> | creator:<id> | system */
  sender: string
  /** which side of the table it came from: client | creator | system */
  side: 'client' | 'creator' | 'system'
  /** text is somebody typing; event is the work itself speaking */
  kind: 'text' | 'event'
  body: string
  /** on an event: its name and a snapshot of the subject at that moment */
  payload: Record<string, unknown> | null
  created_at: string
}

export type ConversationView = {
  id: string
  subject_kind: ConversationSubject
  /** the order id or the campaign id — what ties a room to a board row */
  subject_id: string | null
  subject_name: string | null
  client_id: string | null
  creator_id: string
  creator_handle: string | null
  brand_handle: string | null
  /**
   * NOT the X display name this was documented as (2026-09-15): it carries the
   * client ACCOUNT's own name, which is a company or a website — "My account",
   * "https://getpaus.com", as operator `/v2/clients` lists them. The inbox
   * names a brand off their X profile instead (components/inbox/rooms.ts
   * brandWords, /api/x/user/[handle]).
   */
  brand_name: string | null
  /**
   * THE BRAND'S FACE, as the backend holds it (2026-09-15): the client
   * account's own X avatar, captured at connect or bought once for the handle.
   * Null where they have neither — the room then derives one from the handle
   * (OrdersScreen BrandFace), which is a third party's read of a public
   * profile and answers nothing for a handle X does not know.
   */
  brand_avatar_url?: string | null
  created_at: string
  last_message_at: string | null
  /** messages from the other side since this creator last opened the room; events count */
  unread: number
  preview: string | null
}

export type ConversationPage = { conversation: ConversationView; messages: MessageView[] }

export const listMyConversations = () =>
  call<{ items: ConversationView[] }>('GET', 'conversations')


/** one room and a page of it, oldest first; `after` is the last id already held */
export const getMyConversation = (conversationId: string, after?: number, limit?: number) => {
  const query = new URLSearchParams()
  if (after !== undefined) query.set('after', String(after))
  if (limit !== undefined) query.set('limit', String(limit))
  const tail = query.toString()
  return call<ConversationPage>('GET', `conversations/${conversationId}${tail ? `?${tail}` : ''}`)
}

/** a line of the creator's own; the answer is a PAGE holding just that line
 *  (backend creator_send_message), with the room's row as it now stands — not the
 *  bare message. Merged as if it were one it drew nothing (no `body`), so a send
 *  vanished until the poll brought it back (Sergei 2026-09-16). */
export const sendMessage = (conversationId: string, body: string, nonce?: string) =>
  call<ConversationPage>('POST', `conversations/${conversationId}/messages`, nonce ? { body, nonce } : { body })

/** this creator has read the room up to now — clears their unread count */
export const markConversationRead = (conversationId: string) =>
  call<ConversationView>('POST', `conversations/${conversationId}/read`)

/* -------------------------------- the public ------------------------------- */

const API_BASE = process.env.UNFAIR_API_BASE_URL

/**
 * A published page, read on the SERVER with no credential at all.
 *
 * Returns null for every refusal alike — unknown handle, draft, in review, sent
 * back, API down. The caller 404s on null, which is the same answer the address
 * gave before any of this existed.
 */
export async function fetchCreatorPage(handle: string): Promise<CreatorPageView | null> {
  if (!API_BASE) return null
  const clean = handle.replace(/^@+/, '')
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) return null

  let res: Response
  try {
    res = await fetch(`${API_BASE}/v2/app/creators/${encodeURIComponent(clean)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      /* a creator edits their page and expects to see it; a stale render of
         somebody's rate card is worse than a slower one */
      cache: 'no-store',
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as CreatorPageView | null
}

export type PublishedCreator = { x_handle: string; published_at: string | null }

/**
 * Every live address, newest first — what the sitemap is built from.
 *
 * Returns [] for every failure, deliberately: a sitemap missing a section is a
 * crawl delay, a sitemap that throws is a site with no sitemap at all.
 */
export async function fetchPublishedCreators(): Promise<PublishedCreator[]> {
  if (!API_BASE) return []
  try {
    const res = await fetch(`${API_BASE}/v2/app/creators`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      /* Cached for an hour, unlike the page read below: a page approved today
         should be in tomorrow's crawl rather than next deploy's, and an hour is
         well inside any crawler's own revisit interval. This is what lets the
         sitemap be ISR rather than a fresh API call per crawler hit. */
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    return ((await res.json()) as PublishedCreator[]) ?? []
  } catch {
    return []
  }
}

/** The browser's path to the same read, through the tokenless forward. */
export async function fetchPublicPageInBrowser(handle: string): Promise<CreatorPageView | null> {
  try {
    const res = await fetch(`/api/creators/${encodeURIComponent(handle.replace(/^@+/, ''))}`)
    if (!res.ok) return null
    return (await res.json()) as CreatorPageView | null
  } catch {
    return null
  }
}

/* -------------------------------- readings -------------------------------- */

/** The one place a wire price becomes a number. */
export const priceOf = (row: { price_usd: string }): number => Number(row.price_usd) || 0

/**
 * WHAT THE CREATOR ALREADY CHARGES, as a band — the one honest range the
 * creator's own screens have.
 *
 * They are sent no market figures anywhere: the brief carries `suggested_usd`
 * (their rate card's Sponsored-quote price) and the campaign's budget lives
 * operator-side where a creator never sees it. So the band is their OWN sheet —
 * the cheapest and the dearest of the things they sell one at a time.
 *
 * Weekly placements are left out on purpose: a banner and a bio link are priced
 * by the week (CreatorServiceView.weekly), a campaign is priced by the job, and
 * a band that mixed the two units would be a sentence about nothing. A creator
 * who sells only weekly things gets no band, and the screens fall back to the
 * single number their rate card prefills a field with.
 *
 * Lives here rather than in one screen because two now read it: the brief's
 * price rail (CampaignBrief AskRail) and the quote at the foot of every
 * campaign card (CampaignsScreen CampaignCard).
 */
export function rateBandOf(page: CreatorPageView | null): [number, number] | null {
  if (!page) return null
  const prices = page.services
    .filter((s) => s.offered && !s.weekly)
    .map((s) => Number(s.price_usd))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length === 0) return null
  return [Math.min(...prices), Math.max(...prices)]
}
