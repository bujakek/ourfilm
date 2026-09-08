/**
 * The two doors into the product, named once.
 *
 * They used to be the same door: every "Próbáld ki ingyen" on the marketing
 * site pointed at `/host/login`, so a visitor who wanted to make an event was
 * asked for an account before they had seen one. The create flow is now
 * fillable signed out — but a public route nothing links to is a public route
 * nobody reaches, which is exactly what shipped.
 *
 * Constants rather than six string literals because that is how they drifted
 * apart in the first place, and because `proxy.ts` matches
 * `CREATE_EVENT_PATH` by **exact equality**: a typo here is not a 404, it is a
 * redirect to the login page and the whole feature quietly gone.
 *
 * Neither is locale-prefixed. `/host` sits outside the locale tree on purpose
 * — see the routing section of CLAUDE.md.
 */

/** Start a new event. Open to signed-out visitors; the account is asked for on
 *  the last screen, when there is something to save. */
export const CREATE_EVENT_PATH = '/host/events/new'

/** For a host who already has an account and wants their existing events. */
export const LOGIN_PATH = '/host/login'
