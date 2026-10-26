'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Keys — every labelled action in the product.
 *
 * A key is a face with a beard (the hard bottom shadow), and it presses: the
 * face slides down by exactly the beard's height and the beard goes. The
 * client app writes that out at every call site — eleven classes, with a beard
 * that has to match its press or the key wobbles on the way down. This is the
 * same eleven classes, written once.
 *
 * The press depths stay literal on purpose. globals.css grows a hit strip
 * under exactly three of them (`active:translate-y-0.5`, `-1`, `-[3px]`) so
 * the click still lands on a key that just moved out from under the cursor; a
 * press written as `translate-y-[var(--x)]` matches none of those selectors and
 * silently loses the strip. Three depths, no fourth.
 */

/** Face and beard travel together — the beard is the face's own shadow. */
const FACES = {
  /** The workhorse: Create, Save, Next. */
  ink: 'bg-k-key-face text-white [--kc:var(--color-k-key-beard)]',
  /** Secondary: Edit, Sync, a filter that carries a label. */
  white: 'border border-k-border bg-k-surface text-k-ink [--kc:var(--color-k-border)]',
  /** The ONE call to action on a view. Never two on the same screen. */
  accent: 'bg-k-accent text-white [--kc:var(--color-k-accent-deep)]',
  /**
   * Money arriving — payouts, a cashed-out balance. The beard is the only
   * value in this file with no token behind it; it is copied from
   * app/loop/ui.tsx rather than invented, and wants a --color-k-money-deep.
   */
  money: 'bg-k-money text-white [--kc:#0f7a42]',
} as const

const SIZES = {
  /** h-8, 2px beard — in a card corner, or a row that is already dense. */
  sm: 'h-8 rounded-[10px] px-3.5 text-[13px] shadow-[0_2px_0_0_var(--kc)] active:translate-y-0.5 disabled:active:translate-y-0 disabled:active:shadow-[0_2px_0_0_var(--kc)]',
  /** h-9, 4px beard — the default, and what a screen's action key wears. */
  md: 'h-9 rounded-[10px] px-[18px] text-[14px] shadow-[0_4px_0_0_var(--kc)] active:translate-y-1 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_0_var(--kc)]',
  /** h-11, 4px beard, rounded-xl — a hero key on a door or an empty state. */
  lg: 'h-11 rounded-xl px-5 text-[15px] shadow-[0_4px_0_0_var(--kc)] active:translate-y-1 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_0_var(--kc)]',
} as const

export type KeyFace = keyof typeof FACES
export type KeySize = keyof typeof SIZES

const KEY_BASE =
  'flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-medium transition-transform duration-100 select-none active:shadow-none disabled:cursor-default disabled:opacity-60'

export function Key({
  children,
  face = 'ink',
  size = 'md',
  href,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode
  face?: KeyFace
  size?: KeySize
  /** Present means it is a link, and it renders as one — same face, same press. */
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  const cls = `${KEY_BASE} ${SIZES[size]} ${FACES[face]} ${className}`
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  )
}

/**
 * The small key that lives inside something else — a card's corner, the right
 * end of a list row. h-[26px] with a 3px beard: the third and last press depth
 * globals.css knows about.
 */
export function MiniKey({
  children,
  face = 'ink',
  href,
  onClick,
  className = '',
}: {
  children: ReactNode
  face?: KeyFace
  href?: string
  onClick?: () => void
  className?: string
}) {
  const cls = `flex h-[26px] shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium transition-transform duration-100 select-none shadow-[0_3px_0_0_var(--kc)] active:translate-y-[3px] active:shadow-none ${FACES[face]} ${className}`
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

/**
 * An icon with nothing written on it, so no beard and no press.
 *
 * The rule the whole kit hangs on: a beard is a promise that something happens
 * when you let go. Icon-only controls and state controls (toggles, tabs, chips)
 * are flat — they change what is true, they do not fire a verb.
 */
export function GhostKey({
  children,
  onClick,
  label,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  /** The accessible name — an icon on its own has none. */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-k-muted transition-colors duration-150 hover:bg-k-hover hover:text-k-ink ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * The way back, under the key that goes forward.
 *
 * No cap and no plate: there is one thing on a step meant to be pressed, and a
 * second cap under it reads as a choice between two doors rather than the way
 * out of one. A word with an arrow, and the only thing it grows on hover is ink.
 */
export function BackKey({ onClick, label = 'Back' }: { onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 px-3 py-1 text-[14px] leading-5 font-medium text-k-muted transition-colors hover:text-k-ink"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
        <path
          d="M9.75 3.25 5 8l4.75 4.75"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  )
}

/** The row a screen's keys stand in — the accent one last, where the thumb is. */
export function KeyBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}
