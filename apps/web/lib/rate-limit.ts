import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function requestFingerprint() {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return digest(forwarded || h.get('x-real-ip') || 'unknown')
}

export async function consumeRateLimit({
  scope,
  identifier,
  limit,
  windowSeconds,
}: {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_key: `${scope}:${digest(identifier)}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('Rate limit check failed', { scope, error })
    return false
  }
  return data === true
}
