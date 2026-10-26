# worth

"How much you can earn with your X account": the /worth page of creators.unfair.so, moved out of
`unfair-so/creators-onboarding` into its own app so it can have its own domain.

Put in an X handle, get what the account can earn a month from brand deals, what a published page on
Unfair would add, a share card (wide, tall and portrait), a leaderboard, and a versus view.

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you have
npm run dev                  # http://localhost:3000 opens /worth
```

## What it needs

| Variable | What for |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The domain it is served from; share cards and link previews resolve against it. Build-time. |
| `UNFAIR_API_BASE_URL` | The unfair API: which creators have a published page (the board). |
| `X_SCAN_KEY` | twitterapi.io: followers and posts of any account. |
| `WORTH_DATA_DIR` | Optional: where the board keeps the accounts it has read. |

## Layout

- `app/worth`: the page (`WorthPage.tsx`), its parts, the words (`words.ts`), share-card routes.
- `app/api/worth`: the account, board and feed endpoints.
- `lib/worth`: the arithmetic (`model.ts`), reading X (`read.ts`), the board (`board.ts`, `store.ts`), the cards (`card.tsx`, `pixels.ts`).
- `public/worth`: the five figures on the card and the skyline strip.

## Things that changed in the move

- Paths stay `/worth/...`; the bare domain redirects to `/worth`.
- Links that pointed at the rest of creators.unfair.so (`/`, `/@handle`) are still relative, so on a new domain they land on this app. Point them at the main site when the domain is chosen.
- PostHog is not initialised here, so the `worth_checked` event is not sent until it is.
- Clerk, the shared UI submodule and the rest of the creators app are not part of this repo.
