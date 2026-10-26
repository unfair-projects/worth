import { edge, later, onWorkers, type KV } from '../cloudflare'
import type { Account } from './read'

/**
 * EVERY ACCOUNT /worth HAS READ — server only, one JSON book.
 *
 * Two jobs: a profile link opened a thousand times after a share must not buy
 * a thousand reads from the vendor, and the board needs the published
 * creators' numbers without reading 1,100 pages per visitor.
 *
 * On Cloudflare Workers the book is one value in the WORTH_KV namespace.
 * Anywhere else (npm run dev, a Node host) it is one JSON file: WORTH_DATA_DIR points it
 * at a mounted volume when it should outlive a deploy, otherwise it is .data
 * in dev and .next/cache/worth in production. A deploy that starts empty
 * refills itself: profiles are read again on first open, the board reseeds.
 *
 * One value rather than a key per account because the board needs everybody at
 * once, and a thousand KV reads per page view would be a thousand
 * subrequests. The cost is that two Workers writing at the same moment can each
 * miss the other's newest account; every write re-reads the book first and
 * keeps the newest read of each account, so what is lost is a few seconds of
 * work that the next open reads again.
 *
 * The map hangs off globalThis: Next compiles route handlers and pages as
 * separate module graphs, and two copies of the map would each write the book
 * back without the other's accounts.
 */

const BOOK = 'worth:book'
/** KV allows one write a second to a key, and an isolate's view of it is a minute old at most */
const KV_WRITE_AFTER = 5_000
const FILE_WRITE_AFTER = 1_000
const KV_STALE = 60_000

type Book = {
  accounts: Map<string, Account>
  loading: Promise<void> | null
  loadedAt: number
  timer: ReturnType<typeof setTimeout> | null
  flushing: boolean
  /** something changed while a write was in flight */
  dirty: boolean
}

const g = globalThis as unknown as { __worthBook?: Book }
const book: Book = (g.__worthBook ??= { accounts: new Map(), loading: null, loadedAt: 0, timer: null, flushing: false, dirty: false })

const key = (handle: string) => handle.toLowerCase()

/* ------------------------------------------------------------- backends */

interface Backend {
  read(): Promise<Account[]>
  write(accounts: Account[]): Promise<void>
}

function kvBackend(kv: KV): Backend {
  return {
    async read() {
      try {
        const raw = JSON.parse((await kv.get(BOOK)) ?? 'null') as { accounts?: Account[] } | null
        return Array.isArray(raw?.accounts) ? raw.accounts : []
      } catch {
        return []
      }
    },
    async write(accounts) {
      await kv.put(BOOK, JSON.stringify({ accounts }))
    },
  }
}

/* in the image the app runs as `nextjs` and only .next is its own, so that is where
   the file lives in production; locally it is .data, outside the build */
async function fileBackend(): Promise<Backend> {
  const [fs, path] = await Promise.all([import('node:fs/promises'), import('node:path')])
  const dir =
    process.env.WORTH_DATA_DIR ||
    path.join(process.cwd(), process.env.NODE_ENV === 'production' ? path.join('.next', 'cache', 'worth') : '.data')
  const file = path.join(dir, 'worth.json')
  return {
    async read() {
      try {
        const raw = JSON.parse(await fs.readFile(file, 'utf8')) as { accounts?: Account[] }
        return Array.isArray(raw.accounts) ? raw.accounts : []
      } catch {
        return []
      }
    },
    async write(accounts) {
      await fs.mkdir(dir, { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      await fs.writeFile(tmp, JSON.stringify({ accounts }))
      await fs.rename(tmp, file)
    },
  }
}

/** the KV namespace on a Worker, the file everywhere else (npm run dev, a Node host); null on a Worker with no namespace bound yet */
async function backend(): Promise<Backend | null> {
  if (onWorkers()) {
    /* a Worker has no disk: until WORTH_KV is bound the book lives in memory, per isolate */
    const kv = edge()?.env.WORTH_KV
    return kv ? kvBackend(kv) : null
  }
  return fileBackend()
}

/** a KV book is shared between isolates and written at most once a second */
const sharedBook = () => onWorkers() && !!edge()?.env.WORTH_KV

/* ----------------------------------------------------------------- book */

function merge(saved: Account[]) {
  for (const a of saved) {
    const k = key(a.handle)
    const mine = book.accounts.get(k)
    if (!mine || mine.at < a.at) book.accounts.set(k, a)
  }
}

function load(): Promise<void> {
  /* a file is read once; a KV namespace is read again once its copy is a minute old */
  if (book.loading && !(book.loadedAt && Date.now() - book.loadedAt > KV_STALE && sharedBook())) return book.loading
  book.loadedAt = Date.now()
  book.loading = backend()
    .then((b) => b?.read())
    .then((saved) => merge(saved ?? []))
    .catch(() => {})
  return book.loading
}

/** a moment after the last change, newest read of each account wins */
function persist() {
  if (book.flushing) {
    book.dirty = true
    return
  }
  if (book.timer) return
  const after = sharedBook() ? KV_WRITE_AFTER : FILE_WRITE_AFTER
  const flush = async () => {
    book.flushing = true
    try {
      const b = await backend()
      if (!b) return
      merge(await b.read())
      await b.write([...book.accounts.values()])
    } catch {
      /* a store that refuses is a cache that forgets: the next open reads again */
    } finally {
      book.flushing = false
      if (book.dirty) {
        book.dirty = false
        persist()
      }
    }
  }
  /* on a Worker the wait must be kept alive by waitUntil, or the response ends it */
  const wait = new Promise<void>((resolve) => {
    book.timer = setTimeout(() => {
      book.timer = null
      resolve()
    }, after)
  })
  const done = wait.then(flush)
  if (onWorkers()) later(done)
  else void done
}

export async function recall(handle: string): Promise<Account | null> {
  await load()
  return book.accounts.get(key(handle)) ?? null
}

export async function remember(account: Account): Promise<void> {
  await load()
  book.accounts.set(key(account.handle), account)
  persist()
}

export async function everyone(): Promise<Account[]> {
  await load()
  return [...book.accounts.values()]
}
