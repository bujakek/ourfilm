import 'server-only'

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

export function billingoIsConfigured(): boolean {
  return Boolean(
    process.env[KEYS.apiKey] &&
    positiveInteger(process.env[KEYS.blockId]) &&
    positiveInteger(process.env[KEYS.bankAccountId]),
  )
}

export function billingoEnv(): BillingoEnv {
  const apiKey = process.env[KEYS.apiKey]
  const blockId = positiveInteger(process.env[KEYS.blockId])
  const bankAccountId = positiveInteger(process.env[KEYS.bankAccountId])

  const missing = [
    !apiKey ? KEYS.apiKey : null,
    !blockId ? KEYS.blockId : null,
    !bankAccountId ? KEYS.bankAccountId : null,
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid ${missing.join(', ')}. Use the ids from the same ` +
        'Billingo profile as the API key.',
    )
  }

  if (!apiKey || !blockId || !bankAccountId) {
    throw new Error('Billingo configuration validation failed')
  }

  return {
    apiKey,
    blockId,
    bankAccountId,
    baseUrl: process.env.BILLINGO_API_BASE_URL ?? 'https://api.billingo.hu/v3',
  }
}
