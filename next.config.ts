import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

/* `npm run dev` gets the Workers bindings (WORTH_KV, ASSETS) from wrangler.jsonc, simulated locally */
initOpenNextCloudflareForDev()

const nextConfig: NextConfig = {
  /* the page lives at /worth, as it did inside creators-onboarding: the bare domain opens it */
  async redirects() {
    return [{ source: '/', destination: '/worth', permanent: false }]
  },
}

export default nextConfig
