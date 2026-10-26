import { defineCloudflareConfig } from '@opennextjs/cloudflare'

/* nothing to cache: every /worth page is rendered per request (force-dynamic), and
   the accounts it has read live in the WORTH_KV namespace (lib/worth/store.ts) */
export default defineCloudflareConfig()
