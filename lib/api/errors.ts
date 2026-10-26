/**
 * One envelope everywhere: {"error": {code, message, request_id}}.
 *
 * The exception is 422, where FastAPI's own validation shape ({"detail": [...]})
 * comes through instead — `parseError` normalizes both into one ApiError.
 */

export interface ErrorEnvelope {
  error: { code: string; message: string; request_id?: string | null }
}

/** Codes we branch on. Anything else is surfaced by message alone. */
export const ErrorCode = {
  /**
   * 409 — somebody else's Clerk subject holds that handle. Never merged and
   * never taken over (HANDOFF §5), so the only way forward is an operator: the
   * rebind route unclaims the page and the creator claims it again, keeping
   * their scan, census, rate card and bio. Which is why this one gets a screen
   * of its own rather than a toast — the copy has somewhere real to send them.
   */
  HandleAlreadyClaimed: 'HandleAlreadyClaimed',
  /** 404 — the typed handle names nobody on X. Theirs to fix, by retyping. */
  HandleNotOnX: 'HandleNotOnX',
  /** 422 — malformed handle. Refused before any spend. */
  InvalidHandle: 'InvalidHandle',
  /** 409 — Publish pressed too early; `incomplete` on the page lists what is missing. */
  CreatorPageIncomplete: 'CreatorPageIncomplete',
  /** 409 — the page is frozen under review. */
  CreatorPageNotEditable: 'CreatorPageNotEditable',
  /** 409 — too many rejected screenshots; the way forward is contacting us. */
  AudienceReadingLocked: 'AudienceReadingLocked',
  /** 422 — not a `linkedin.com/in/…` profile link. Refused before any read is bought. */
  InvalidLinkedInUrl: 'InvalidLinkedInUrl',
  /**
   * 409 — another unfair account holds that LinkedIn profile. Never moved
   * onto this one (spec §3.1), so, like HandleAlreadyClaimed, it gets a screen
   * that points at support rather than a toast.
   */
  LinkedInProfileTaken: 'LinkedInProfileTaken',
  /** Ours, not the backend's: the API host was unreachable. */
  Unreachable: 'Unreachable',
  /**
   * Ours too, from the BFF (app/api/creator/[...path]): a 401 that is NOT
   * "signed out" — Clerk's cookie can be a beat behind a sign-in that has
   * already happened, and there was no token to mint from yet. A caller that
   * reads this as signed-out latches a wall over a good session, so the right
   * answer is to wait and ask again (lib/api/retry `whenSessionReady`).
   */
  SessionNotReady: 'SessionNotReady',
} as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(status: number, code: string, message: string, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }

  /**
   * 404 means "unknown **or** not yours" — the backend refuses to distinguish
   * them so ids can't be enumerated across tenants. Never build UI that tries.
   */
  get isGone() {
    return this.status === 404
  }

  /** 401 covers no token, an invalid one, and a suspended user alike. */
  get isUnauthenticated() {
    return this.status === 401
  }

  /** 503 — Clerk or a provider is unreachable. Worth retrying. */
  get isRetryable() {
    return this.status === 503
  }

  /**
   * NOTHING WAS DECIDED (2026-09-15). The request never reached a verdict: the
   * API host was unreachable or timed out (the BFF's own 503 Unreachable), a
   * gateway answered in its place (502, 504 — a redeploy, a restart), or the
   * browser's fetch threw before anything left. A 500 is NOT one of these: the
   * backend was reached and decided to fail, and repeating it repeats that.
   *
   * What it is for: a write that carries its own name may be repeated safely
   * on one of these (the send's nonce, backend ADR-0169 — a retry after a lost
   * answer is answered with the line already written, never a twin).
   */
  get isBlip() {
    return this.status === 502 || this.status === 503 || this.status === 504
  }
}

/**
 * WHAT TO SAY WHEN A PRESS DID NOT LAND (2026-09-13).
 *
 * The backend's own sentence, and ONLY on 422: that is the one status where it
 * wrote a message for the person rather than for a log — "this line is already
 * handed in", "nothing is available to claim". A 404 today means the route is
 * not built and tomorrow means the booking is gone; a 500 has no body worth
 * reading; and "Not found." in front of a creator who has just handed work in
 * is the app blaming them for our plumbing.
 *
 * So everything else gets the caller's own sentence, whose reassuring half is
 * the part that matters: a press that failed changed nothing. It lives here
 * because both hand-in doors and the claim ask the same question of the same
 * errors (Product components/orders/OrderDeliveryModal failureText).
 */
export function failureWords(error: unknown, fallback: string): string {
  /* a 409 is a refusal with its reason in it too (backend ADR-0195: "the work
     happens once it is paid", "is off this order", "was already judged") —
     read as the generic sentence it told a creator to try again against a
     door that was shut on purpose */
  return error instanceof ApiError &&
    (error.status === 422 || error.status === 409) &&
    error.message
    ? error.message
    : fallback
}

/** Best-effort read of an error body in either shape. */
export function parseError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const envelope = (body as ErrorEnvelope).error
    if (envelope && typeof envelope === 'object') {
      return new ApiError(
        status,
        envelope.code ?? 'Unknown',
        envelope.message ?? 'Something went wrong.',
        envelope.request_id ?? null,
      )
    }
    // FastAPI validation (422), and the bare {"detail": "..."} of an
    // unauthenticated call that never reached the v2 envelope.
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return new ApiError(status, 'ValidationError', detail)
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined
      const where = Array.isArray(first?.loc) ? ` (${first.loc.join('.')})` : ''
      return new ApiError(status, 'ValidationError', `${first?.msg ?? 'Invalid request'}${where}`)
    }
  }
  return new ApiError(status, 'Unknown', `Request failed with status ${status}.`)
}
