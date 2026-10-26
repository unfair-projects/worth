/**
 * Every word /worth says, in one place (Fedor 2026-10-20: few words, nothing
 * that reads like a machine wrote it — no long dashes, no "not this, that";
 * and later the same day, fewer still: the folded "Why X", the totals line,
 * the board's subtitle and the formula in the footer all came out).
 */

export const WORTH = {
  title: ['How much $$$ you can earn', 'with your X account'],

  /* under the field, before anyone has asked (Ilya 2026-10-21) */
  intro: {
    title: 'Influencers are dead. Long live the influencers.',
    /* two paragraphs: the first has the link in it, split around its text */
    body: [
      [
        'The rumors of the influencer market’s death are greatly exaggerated. The old model is fading. As ',
        'Dan Koe argues',
        ', people increasingly follow creators for their experience, not just their follower count. On X, that shift is already becoming a real economic opportunity.',
      ],
      ['With Unfair creators can turn the value they have built into income, and with this calculation you can see how much you could earn with your own X account.'],
    ],
    link: 'https://letters.thedankoe.com/p/the-influencer-is-dead-the-age-of',
  },


  /* the opening screen's way in, for whoever came to be a creator, not to count */
  join: (n: number) => `Join ${n.toLocaleString('en-US')} creators on unfair.so`,
  become: 'Become a creator',
  forBrands: 'For brands',

  placeholder: 'Enter your X handle',
  go: 'Calculate',

  /* what the wait says while X answers, one line after another */
  reading: (handle: string) => [`Reading @${handle}`, 'Counting views', 'Pricing your posts'],
  /* the reading, in the order it adds up */
  rows: {
    followers: 'Followers',
    views: 'Median views',
    base: 'Price per post',
    x: 'What your account is like',
    year: 'A brand deal a week',
    growth: 'If you keep posting',
  },
  x: {
    engagement: 'Engagement',
    posting: 'Posting',
    verified: 'Page on unfair',
    unverified: 'No page on unfair',
  },
  perYear: (m: string) => `${m} a year`,
  growth: (pct: string) => `+${pct} a year`,
  total: 'Worth',
  totalSub: 'five years of brand deals',

  /* the result */
  share: 'Post on X',
  download: 'Download',
  copy: 'Copy link',
  copied: 'Copied',
  tweet: (money: string) => `With my X account I can earn up to ${money} a month. How much can you earn?`,

  /* the push: the page we would publish for them, already priced */
  page: {
    /* what the page adds to the worth, said as money: "A page on unfair adds $510K" (Fedor 2026-10-21) */
    title: 'Earn more with Unfair',
    sub: (money: string) => `A published page on Unfair can add up to ${money} a month to my account`,
    post: 'Post',
    repost: 'Repost',
    bio: 'Link in bio',
    week: '/wk',
    note: 'Brands book you straight from it. We take 0%.',
    publish: 'Publish my page',
    live: 'Your page is live on unfair.so',
    rank: (place: number, of: number) => `#${place.toLocaleString('en-US')} of ${of.toLocaleString('en-US')} on the board`,
    open: 'Open my page',
  },

  /* the next five years as income, month by month (Fedor 2026-10-21: a potential MRR, not a price) */
  chart: {
    title: 'Potential MRR',
    /* what the chart quotes until somebody points: the month a year on */
    later: 'A year from now',
    mo: '/mo',
    /* the first months, while brands find the page */
    ramp: ['Your page goes live', 'Brands find you', 'Brands find you'],
    /* the month under the pointer, made of (Fedor 2026-10-21: how many posts, at what price) */
    posts: (n: number, price: string) => `${n} posts × ${price}`,
    /* what the season is doing to it, by calendar month (0 = January) */
    season: ['Budgets reset', '', '', '', '', '', 'Summer lull', 'Summer lull', 'Launch season', 'Q4 campaigns', 'Black Friday', 'Holidays'],
  },
  /* the arithmetic, a block of its own (Fedor 2026-10-21: "Methodology", serious but clear, the detail folded away) */
  formula: {
    title: 'Methodology',
    open: 'Show the math',
    close: 'Hide the math',
    /* the one line the block shows folded: each figure, and what it is */
    terms: { post: 'a post', account: 'your account', deals: 'deals a year', years: 'multiplier', worth: 'worth' },
    /* the math, unfolded: each figure, how it is made, and from what */
    base: 'Price per post',
    baseHow: (byFollowers: string, byViews: string) => `√(${byFollowers} by followers × ${byViews} by views)`,
    baseAlone: (byFollowers: string) => `${byFollowers} by followers; no recent views to read`,
    baseFrom: (followers: string, views: string | null, cpm: number) =>
      views ? `${followers} followers at InfluencerFee's 2026 rates; ${views} median views at a $${cpm} CPM` : `${followers} followers at InfluencerFee's 2026 rates`,
    x: 'Account',
    perWeek: (n: number) => `${n}/wk`,
    deals: 'Deals a year',
    dealsHow: 'One sponsored post a week',
    years: 'Multiplier',
    yearsHow: (sum: string, pct: string) => `${sum}, growing ${pct} a year`,
    sources: "Sources: InfluencerFee's 2026 X rates, a $20 CPM (Okara, 120+ X campaigns), and the account's own public numbers on X.",
  },
  best: {
    title: 'Your most valuable post',
    sub: (views: string) => `${views} views`,
    /* said under the price, where the eye lands (Fedor 2026-10-21) */
    note: 'if it were a sponsored post',
  },

  /* a friend, side by side */
  versus: {
    placeholder: "Friend's X handle",
    go: 'Compare',
    close: 'Back to sharing',
    self: 'That is the same account.',
    verdict: (handle: string, ratio: number) => `@${handle}'s X account is worth ${ratio.toFixed(1)}× more`,
    tie: 'Neck and neck',
    foot: 'How much is yours? creators.unfair.so/worth',
    tweet: (mine: string, friend: string, theirs: string) => `My X account is worth ${mine}. @${friend}'s is worth ${theirs}. How much is yours?`,
    claim: 'Is this you? Claim your page',
  },

  /* the board: everybody, the creators verified and the rest unclaimed; live first */
  board: 'Leaderboard',
  /* the first tab says what it is, not that it is live (Fedor 2026-10-21) */
  tabs: { live: 'Just checked', top: 'Top' },
  cols: { creator: 'Account', followers: 'Followers', views: 'Median views', year: 'A year', worth: 'Worth' },
  unclaimed: 'Unclaimed',
  more: 'Show more',
  /* the page asks again by itself while it fills (WorthPage), so nobody is told to refresh */
  filling: 'The board is filling up. One moment.',

  /* the payouts: a figure that keeps climbing (Ilya 2026-10-26) */
  paid: {
    title: 'Unfair has already paid its creators',
    sub: 'and counting',
  },

  /* brands, second: the managed plan from unfair.so/pricing, with one door: a call (Ilya 2026-10-26) */
  launch: {
    question: 'Planning a launch?',
    title: 'Launchmaxxing',
    badge: 'Managed',
    lead: 'We run it.',
    sub: 'Your GTM manager, paid on views.',
    price: '$990',
    per: '/mo',
    fee: '+ $2,000 per 100K views on each launch.',
    cap: 'Max $10K view fee per launch.',
    includes: 'Everything in Very Unfair, with no platform fee, plus:',
    items: [
      'Your GTM manager on your launch from day one',
      'We run the launch: lineup, briefs, launch windows, the quote wave',
      'We pay the creators for you',
      'Up to 2 managed launches a week',
      'Priority Slack channel',
    ],
    note: 'Creator budget on top. Min $2,000 a launch. No platform fee on Launchmaxxing. We earn the plan and the view fee.',
    cta: 'Book a demo',
  },

  /* the card */
  card: {
    worth: 'My X account is worth',
    earn: 'With it I can earn up to',
    month: 'a month',
    /* the badge on the foot line, the percentage set bold between the two halves */
    beats: (pct: string) => ['better than', pct, 'of accounts on X'] as const,
  },

  errors: {
    handle: 'That does not look like an X handle.',
  },
} as const
