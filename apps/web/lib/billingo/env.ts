import 'server-only'

/**
 * Billingo's REST API v3 configuration.
 *
 * There is no npm package — Billingo publishes an OpenAPI spec and generated
 * SDKs for other languages, so this app talks to it over `fetch`. Read the
 * two ids from the *same* Billingo profile as the key (`GET /document-blocks`
 * and `GET /bank-accounts`); ids from another profile fail at document
 * creation with a validation error that names neither of them.
 *
 * There is no separate sandbox host. A test profile's API key against the same
 * base URL is what "test mode" means here.
 */
export type BillingoEnv = {
  apiKey: string
  blockId: number
  bankAccountId: number
  baseUrl: string
}

const KEYS = {
  apiKey: 'BILLINGO_API_KEY',
  blockId: 'BILLINGO_BLOCK_ID',
  bankAccountId: 'BILLINGO_BANK_ACCOUNT_ID',
} as const

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Whether invoicing can run at all.
 *
 * Read through `lib/checkout-readiness.ts` rather than directly: it is only
 * the *Hungarian* checkout that this gates, and an English deployment without
 * Billingo keys is a correctly configured deployment.
 */
export function billingoIsConfigured(): boolean {
  return Boolean(
    process.env[KEYS.apiKey] &&
    positiveInteger(process.env[KEYS.blockId]) &&
    positiveInteger(process.env[KEYS.bankAccountId]),
  )
}

export function billingoEnv(): BillingoEnv {
  const apiKey = process.env[KEYS.apiKey]?.trim()
  const blockId = positiveInteger(process.env[KEYS.blockId])
  const bankAccountId = positiveInteger(process.env[KEYS.bankAccountId])

  const missing = [
    !apiKey ? KEYS.apiKey : null,
    !blockId ? KEYS.blockId : null,
    !bankAccountId ? KEYS.bankAccountId : null,
  ].filter(Boolean)

  if (missing.length > 0 || !apiKey || !blockId || !bankAccountId) {
    throw new Error(
      `Missing or invalid ${missing.join(', ')}. Use the ids from the same ` +
        'Billingo profile as the API key.',
    )
  }

  return {
    apiKey,
    blockId,
    bankAccountId,
    baseUrl: process.env.BILLINGO_API_BASE_URL ?? 'https://api.billingo.hu/v3',
  }
}
