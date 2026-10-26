# worth

"How much you can earn with your X account": the /worth page of creators.unfair.so, moved out of
`unfair-so/creators-onboarding` into its own app, served from **https://myaccworth.com** on Cloudflare Workers
through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

Put in an X handle, get what the account can earn a month from brand deals, what a published page on
Unfair would add, a share card (wide, tall and portrait), a leaderboard, and a versus view.

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app works without any of it
npm run dev                  # http://localhost:3000 opens /worth
```

In `npm run dev` the board is kept in `.data/worth.json` and the fonts and pictures are read off disk.

## Try it on the Workers runtime

```bash
npm run preview              # opennextjs-cloudflare build, then wrangler dev (workerd) on http://localhost:8787
```

`preview` runs the real Worker bundle against a local simulation of KV and the static assets, so it is the way
to check the card routes (`/worth/<handle>/card.png`, the `opengraph-image` routes) before a deploy.

## Deploy to Cloudflare

One-time setup:

1. **KV namespace for the board:**
   ```bash
   npx wrangler kv namespace create WORTH_KV
   ```
   Paste the id it prints over `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.jsonc`.
2. **Secrets** (the app works without them, see below):
   ```bash
   npx wrangler secret put X_SCAN_KEY
   npx wrangler secret put UNFAIR_API_BASE_URL
   ```
3. **Domain.** `wrangler.jsonc` routes `myaccworth.com` as a custom domain of the Worker; the domain's zone has to be in the
   same Cloudflare account.

Then:

```bash
npm run deploy               # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## What it needs

| Name | Kind | What for |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | var (`wrangler.jsonc`) and build-time (`.env.production`) | The domain it is served from; share cards and link previews resolve against it. Already `https://myaccworth.com`. |
| `WORTH_KV` | KV binding | Where the board keeps every account it has read (see below). |
| `X_SCAN_KEY` | secret | twitterapi.io: followers and posts of any account. Without it accounts are priced on followers alone (read from fxtwitter). |
| `UNFAIR_API_BASE_URL` | secret | The unfair API: which creators have a published page. Without it the board holds only accounts somebody has checked, and nobody is marked as having a page. |
| `WORTH_DATA_DIR` | env, Node hosts only | Where the file store keeps the board outside a Worker. |

## How it differs from a Node host

- **The board lives in KV.** `lib/worth/store.ts` keeps every account read as one value in `WORTH_KV` on a Worker, and
  in a JSON file (`.data/`, or `WORTH_DATA_DIR`) anywhere else. One value, because the board needs everybody at once and
  a KV read per account would be a subrequest each. KV allows one write a second to a key, so writes are batched five
  seconds apart and kept alive past the response with `waitUntil`. Until `WORTH_KV` is bound the book is in memory, per
  isolate: the app works, it just forgets sooner.
- **Fonts and the card's figures come through the `ASSETS` binding** (`lib/assets.ts`), since a Worker has no disk to
  read `public/` from.
- **The board seeds itself on the first view**, in `waitUntil`, forty pages per run: a Worker has no "server start" and
  a limited number of subrequests. The next run carries on from the book, a minute later, until every creator is in.
- **fxtwitter needs a `User-Agent`.** A Worker sends none and gets a 401, so `lib/worth/read.ts` sets one.

## Layout

- `app/worth`: the page (`WorthPage.tsx`), its parts, the words (`words.ts`), share-card routes.
- `app/api/worth`: the account, board and feed endpoints.
- `lib/worth`: the arithmetic (`model.ts`), reading X (`read.ts`), the board (`board.ts`, `store.ts`), the cards (`card.tsx`, `pixels.ts`).
- `lib/cloudflare.ts`, `lib/assets.ts`: what differs between Workers and Node.
- `public/worth`: the five figures on the card and the skyline strip.
- `wrangler.jsonc`, `open-next.config.ts`: the Worker.

## Things that changed in the move

- Paths stay `/worth/...`; the bare domain redirects to `/worth`.
- Links that pointed at the rest of creators.unfair.so (`/`, `/@handle`) are still relative, so on this domain they land on
  this app. Point them at the main site.
- PostHog is not initialised here, so the `worth_checked` event is not sent until it is.
- Next is 16.4.3 (the OpenNext adapter needs 16.4.1 or newer).
- Clerk, the shared UI submodule and the rest of the creators app are not part of this repo.
