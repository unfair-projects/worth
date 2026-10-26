/**
 * The one booking link this app knows.
 *
 * In the customer repo this constant lives in `lib/data/pricing.ts`, beside the
 * plans and the ladder — none of which exist here. It is copied rather than
 * imported for the same reason the whole app is: this deployment does not share
 * a build with the customer surface.
 */
export const CAL_URL = 'https://cal.com/team/unfair/demo'
