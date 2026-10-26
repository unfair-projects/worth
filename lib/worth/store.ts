import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Account } from './read'

/**
 * EVERY ACCOUNT /worth HAS READ — server only, one JSON file.
 *
 * Two jobs: a profile link opened a thousand times after a share must not buy
 * a thousand reads from the vendor, and the board needs the published
 * creators' numbers without reading 1,100 pages per visitor.
 *
 * A file, not a database, because this host has none and the page is a
 * special project: WORTH_DATA_DIR points it at a mounted volume when it should
 * outlive a deploy. Without one it starts empty after each deploy and refills
 * itself — profiles are read again on first open, the board reseeds.
 *
 * The map hangs off globalThis: Next compiles route handlers and pages as
 * separate module graphs, and two copies of the map would each write the file
 * back without the other's accounts.
 */

/* in the image the app runs as `nextjs` and only .next is its own (Dockerfile), so
   that is where the file lives there; locally it is .data, outside the build */
const DIR =
  process.env.WORTH_DATA_DIR ||
  path.join(process.cwd(), process.env.NODE_ENV === 'production' ? path.join('.next', 'cache', 'worth') : '.data')
const FILE = path.join(DIR, 'worth.json')

type Book = { accounts: Map<string, Account>; loading: Promise<void> | null; timer: ReturnType<typeof setTimeout> | null }

const g = globalThis as unknown as { __worthBook?: Book }
const book: Book = (g.__worthBook ??= { accounts: new Map(), loading: null, timer: null })

const key = (handle: string) => handle.toLowerCase()

async function readFileAccounts(): Promise<Account[]> {
  try {
    const raw = JSON.parse(await readFile(FILE, 'utf8')) as { accounts?: Account[] }
    return Array.isArray(raw.accounts) ? raw.accounts : []
  } catch {
    return []
  }
}

function load(): Promise<void> {
  book.loading ??= readFileAccounts().then((saved) => {
    for (const a of saved) {
      const k = key(a.handle)
      const mine = book.accounts.get(k)
      if (!mine || mine.at < a.at) book.accounts.set(k, a)
    }
  })
  return book.loading
}

/** a second after the last change, newest read of each account wins */
function persist() {
  if (book.timer) return
  book.timer = setTimeout(async () => {
    book.timer = null
    try {
      for (const a of await readFileAccounts()) {
        const k = key(a.handle)
        const mine = book.accounts.get(k)
        if (!mine || mine.at < a.at) book.accounts.set(k, a)
      }
      await mkdir(DIR, { recursive: true })
      const tmp = `${FILE}.${process.pid}.tmp`
      await writeFile(tmp, JSON.stringify({ accounts: [...book.accounts.values()] }))
      await rename(tmp, FILE)
    } catch {
      /* a disk that refuses is a cache that forgets: the next open reads again */
    }
  }, 1_000)
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
