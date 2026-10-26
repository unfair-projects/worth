'use client'

/**
 * The calendar, everywhere — one recipe.
 *
 * Every door in the product that books time used to be an `<a href>` into
 * cal.com, which takes the visitor OFF the thing they were reading to a page
 * that then has to sell them back. The landing stopped doing that first (Fedor
 * 2026-08-06: "можно ли интегрировать cal.com прямо в сайт — просто виджет
 * всплывающий"), and this is that same recipe lifted out of it so the rest of
 * the product can wear it too (Fedor 2026-08-10: "сделай так чтобы cal.com
 * везде открывался embed").
 *
 * Two parts, and both are needed:
 *   1. `useCalEmbed()` anywhere on the page — it loads Cal's snippet, which
 *      then claims every `[data-cal-link]` element in the document.
 *   2. `data-cal-link={calSlug(url)}` on the thing being pressed.
 *
 * The element must be a BUTTON, not a link: the embed opens its modal in
 * place, and an `href` underneath races it into a new tab (Fedor 2026-08-06:
 * "новую вкладку не должен открывать"). Which means there is no no-JS
 * fallback — accepted, because the app behind these doors is React anyway.
 */

import { useEffect } from 'react'
import { getCalApi } from '@calcom/embed-react'

import { CAL_URL } from './data/cal-url'

/** cal.com/team/unfair/gtm → team/unfair/gtm — the embed wants the slug */
export function calSlug(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?cal\.com\//, '')
}

/**
 * The product's own booking page — the landing's two CTA keys, the pricing
 * footer, the top-of-the-ladder panel on Upgrade, the collabs banners. The
 * creators demo books a different event (its own CAL_LINK, off
 * LAUNCH_CARD.call), which is the only reason this is not the only slug.
 */
export const CAL_SLUG = calSlug(CAL_URL)

/**
 * Boot the embed once — idempotent, every component on the page may call it.
 *
 * DEFAULT namespace, no layout config (Fedor 2026-08-06: "до этого он уже
 * загружался") — the namespaced month_view round regressed a working modal, so
 * the boot is exactly the plain recipe again. NB: while debugging this,
 * app.cal.com/…/embed itself answered 504 — if the spinner returns with this
 * plain config, it is Cal's weather, not ours.
 */
export function useCalEmbed() {
  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', { hideEventTypeDetails: false })
    })
  }, [])
}
