/**
 * THE PLATFORM a creator sells on — X or LinkedIn (the client repo's
 * LINKEDIN_CREATORS_SPEC.md; the same file, the same names, as the client
 * app's Product/lib/creators/platform.ts, so the two sides of one order agree
 * on every id).
 *
 * ONE PERSON, ONE ACCOUNT, A TAB PER PLATFORM (spec §1.1). The unfair address,
 * the inbox, the orders and the money are the account's; the identity proof,
 * the numbers, the bio and topics, the collabs, the rate card and whether the
 * tab is live are each platform's own. Nothing on one tab is ever filled in
 * from the other (spec §5: "Missing LinkedIn data is not filled with X
 * numbers").
 *
 * ABSENT MEANS X, for a page or a route: one that carries no platform is an
 * X creator's — so an unparameterised read or write keeps meaning X, and
 * `platformOf` is where that default is written down. The LinkedIn tab is
 * always asked for by name (`?platform=linkedin`, lib/api/creator.ts).
 *
 * NEVER ON AN ORDER. An order carries no platform at all and can hold both
 * tabs' lines: each line's network is its id (`isLinkedInLine`, backend
 * ADR-0237), and the order's is `platformOfOrder` (lib/api/orders: LinkedIn
 * only when every line is). platformOf(order) is always X — it is what
 * refused every LinkedIn proof link until 2026-10-14.
 *
 * LINKEDIN IDS WEAR A PREFIX. Both platforms sell a repost, and a stashed
 * draft or a rate card holding `repost` must never be read as LinkedIn's.
 */

export type Platform = 'x' | 'linkedin'

export const isPlatform = (s: unknown): s is Platform => s === 'x' || s === 'linkedin'

/** the wire's silence is X — see the file header */
export const platformOf = (o: { platform?: Platform | null } | null | undefined): Platform =>
  o?.platform ?? 'x'

export const platformLabel = (p: Platform): string => (p === 'linkedin' ? 'LinkedIn' : 'X (Twitter)')

/** `?platform=linkedin` off a query string, or nothing — never a default */
export const platformParam = (raw: string | null | undefined): Platform | null =>
  isPlatform(raw) ? raw : null

export type LinkedInServiceId = 'li_repost' | 'li_quote' | 'li_post' | 'li_carousel' | 'li_document' | 'li_video'

/* Every LinkedIn id the wire carries, in the backend's catalogue order
   (parameters `linkedin.services`) — what tells a LinkedIn row or placement
   from an X one. NOT what the sheet sells: that is data.ts LINKEDIN_SERVICES,
   the post, the quote and the repost since Sergei 2026-10-08. The carousel, the
   document and the video stay here because orders already placed on them are
   still drawn, briefed and delivered. `li_quote` is ahead of the wire: the
   sheet draws the backend's catalogue, so it sells the quote once that lists
   `li_quote` (after `li_post`). */
export const LINKEDIN_SERVICE_IDS: readonly LinkedInServiceId[] = [
  'li_post',
  'li_quote',
  'li_carousel',
  'li_document',
  'li_video',
  'li_repost',
]

export const isLinkedInService = (id: string): id is LinkedInServiceId =>
  (LINKEDIN_SERVICE_IDS as readonly string[]).includes(id)

/**
 * Whether an ORDER LINE goes out on LinkedIn — the backend's own rule
 * (creator_page.on_platform): any id wearing `li_`, the catalogue's six and a
 * creator's own LinkedIn row (`li_custom-N`, proved by a LinkedIn link too)
 * alike. Wider than isLinkedInService on purpose: that one names the
 * catalogue, this one reads the wire.
 */
export const isLinkedInLine = (serviceId: string): boolean => serviceId.startsWith('li_')

/**
 * A TASK'S NAME, WITH ITS NETWORK WHEN THE BOOKING HOLDS BOTH (Sergei
 * 2026-10-14: "make sure we're ready to prod launch"). LinkedIn's catalogue
 * names are X's — 'Sponsored post' is on both rate cards — so a booking of one
 * each read as two identical tasks in Orders and the inbox. The LinkedIn one
 * says so; X lines and single-network bookings keep the bare name they always
 * had. The client app's twin is Product/lib/creators/platform.ts taskNameOn.
 */
export function taskName(
  line: { name: string; service_id: string },
  lines: readonly { service_id: string }[],
): string {
  const mixed = isLinkedInLine(line.service_id) && lines.some((other) => !isLinkedInLine(other.service_id))
  return mixed ? `${line.name} on LinkedIn` : line.name
}

/** Which platform a shipped rate-card id belongs to; null for a creator's own `custom-N` row, which belongs to whichever tab's sheet holds it. */
export function platformOfService(id: string): Platform | null {
  if (isLinkedInService(id)) return 'linkedin'
  return id.startsWith('custom-') ? null : 'x'
}

/**
 * A LinkedIn profile, however it was pasted: `linkedin.com/in/amelia-chen`,
 * `https://www.linkedin.com/in/amelia-chen/`, a country host (`uk.`), a
 * tracking tail. A post, a company or a search is not a person.
 */
const LINKEDIN_PROFILE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?(?:[?#].*)?$/i
const LINKEDIN_SLUG = /^[A-Za-z0-9\-_%]{3,100}$/

/**
 * The profile slug the input names, or null when it names none — the door's
 * LinkedIn side (Sergei 2026-09-23, app/loop/landing/DoorField). `bareWord` also accepts the part
 * after `/in/` on its own, for a field that is already switched to LinkedIn;
 * xUserFromInput's own parameter, for the same reason. Without it only a
 * link reads as LinkedIn, which no X handle can be — so a link pasted on the
 * X side can say which platform it belongs to.
 */
export function linkedInFromInput(raw: string, bareWord = false): string | null {
  const value = raw.trim()
  const profile = value.match(LINKEDIN_PROFILE)
  if (profile) return profile[1]
  return bareWord && LINKEDIN_SLUG.test(value) ? value : null
}

/** The one spelling of a profile link we send and store (spec §17.1): `https://www.linkedin.com/in/<slug>`. */
export const linkedInUrlOf = (slug: string): string => `https://www.linkedin.com/in/${slug}`

/**
 * Where the LinkedIn setup opens on what was typed at a door (Sergei
 * 2026-09-24: "use the link users added in the input before email as a source
 * to scrape"): `/linkedin` with the profile link on the address, which the
 * setup reads once, strips, and reads that profile from. Typing that names no
 * profile is the plain setup, which asks for the link itself.
 */
export function linkedInSetupPath(typed: string): string {
  const slug = linkedInFromInput(typed, true)
  return slug ? `/linkedin?link=${encodeURIComponent(linkedInUrlOf(slug))}` : '/linkedin'
}

/**
 * Where a LinkedIn tab lives once it is handed in: its tab on the dashboard
 * Profile. The LinkedIn setup sends a finished tab there, and so does the key
 * on "Your page is live!" when nothing is offered after it (app/loop/PublishStep).
 */
export const LINKEDIN_HOME = '/dashboard/profile?platform=linkedin'
