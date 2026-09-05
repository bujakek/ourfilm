import {
  buildAuthVerificationUrl,
  renderAuthEmail,
  resolveAuthEmailLocale,
} from '@/lib/auth-email'
import { reportServerIssue } from '@/lib/telemetry-server'
import { Webhook, WebhookVerificationError } from 'standardwebhooks'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  user: z.object({
    email: z.email(),
    user_metadata: z.record(z.string(), z.unknown()).nullish(),
  }),
  email_data: z.object({
    token_hash: z.string().min(1),
    redirect_to: z.string().optional(),
    email_action_type: z.string().min(1),
  }),
})

function hookSecret(): string | null {
  const configured = process.env.SEND_EMAIL_HOOK_SECRET?.trim()
  if (!configured) return null

  // Supabase displays hook secrets as `v1,whsec_…`; standardwebhooks expects
  // the `whsec_…` part (and strips that prefix itself).
  return configured.replace(/^v1,/, '')
}

export async function POST(request: Request) {
  const secret = hookSecret()
  const resendKey = process.env.RESEND_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!secret || !resendKey || !supabaseUrl) {
    console.error(
      'Auth email hook is missing SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY or NEXT_PUBLIC_SUPABASE_URL',
    )
    return Response.json(
      { error: 'Email service unavailable' },
      { status: 503 },
    )
  }

  const rawPayload = await request.text()
  let verified: unknown

  try {
    verified = new Webhook(secret).verify(
      rawPayload,
      Object.fromEntries(request.headers.entries()),
    )
  } catch (error) {
    if (!(error instanceof WebhookVerificationError)) {
      console.error('Auth email hook verification failed', error)
    }
    return Response.json(
      { error: 'Invalid webhook signature' },
      { status: 401 },
    )
  }

  const parsed = payloadSchema.safeParse(verified)
  if (!parsed.success) {
    console.error('Auth email hook received an invalid payload')
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  const { user, email_data: emailData } = parsed.data
  const locale = resolveAuthEmailLocale(
    emailData.redirect_to,
    user.user_metadata,
  )
  const confirmationUrl = buildAuthVerificationUrl(supabaseUrl, {
    tokenHash: emailData.token_hash,
    redirectTo: emailData.redirect_to,
    action: emailData.email_action_type,
  })
  const email = renderAuthEmail({
    locale,
    action: emailData.email_action_type,
    confirmationUrl,
    redirectTo: emailData.redirect_to,
  })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        // Supabase retries failed hooks. Reusing its webhook ID prevents a
        // successful send followed by a lost response from becoming two mails.
        'Idempotency-Key':
          request.headers.get('webhook-id') ?? crypto.randomUUID(),
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? 'OurFilm <noreply@ourfilm.app>',
        to: [user.email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    })

    if (!response.ok) {
      console.error(
        'Auth email delivery failed',
        response.status,
        await response.text(),
      )
      const deliveryError = new Error('Auth email provider refused request')
      deliveryError.name = `EmailDeliveryHttp${response.status}Error`
      await reportServerIssue(deliveryError, {
        operation: 'auth_email_delivery',
        route: '/api/auth/send-email',
        routeType: 'route',
        method: 'POST',
      })
      return Response.json({ error: 'Email delivery failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('Auth email delivery failed', error)
    await reportServerIssue(error, {
      operation: 'auth_email_delivery',
      route: '/api/auth/send-email',
      routeType: 'route',
      method: 'POST',
    })
    return Response.json({ error: 'Email delivery failed' }, { status: 502 })
  }

  return Response.json({})
}
