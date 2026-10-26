import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const newPixel = localFont({ src: '../public/fonts/ThatThatNewPixelVariable-Regular.woff2', variable: '--font-new-pixel' })

/* share cards resolve against this origin; set it to the domain /worth lives on */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://creators.unfair.so'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'unfair.so', template: '%s' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newPixel.variable}`}>
      <body>{children}</body>
    </html>
  )
}
