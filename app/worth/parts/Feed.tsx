'use client'

import { useEffect, useState } from 'react'

import type { FeedItem } from '../../../lib/worth/board'

/**
 * What really happened lately (lib/worth/board feed): the checks people ran
 * and the pages creators published, newest first. The faces round the hero
 * are dealt from it, and the board's Live tab takes a real check from it the
 * moment one lands.
 */

export interface FeedData {
  items: FeedItem[]
}

const POLL_MS = 15_000

/** the feed, kept fresh: one poll for every part of the page that draws it */
export function useFeed(initial: FeedData): FeedData {
  const [data, setData] = useState(initial)
  useEffect(() => {
    const t = window.setInterval(async () => {
      try {
        const res = await fetch('/api/worth/feed')
        if (res.ok) setData((await res.json()) as FeedData)
      } catch {
        /* the page keeps what it had */
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [])
  return data
}
