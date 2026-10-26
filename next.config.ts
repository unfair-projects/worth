import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* self-contained server bundle for the Docker image */
  output: 'standalone',

  /* the page lives at /worth, as it did inside creators-onboarding: the bare domain opens it */
  async redirects() {
    return [{ source: '/', destination: '/worth', permanent: false }]
  },
}

export default nextConfig
