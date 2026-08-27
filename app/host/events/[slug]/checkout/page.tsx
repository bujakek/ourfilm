import { BillingDetailsForm } from '@/app/host/events/[slug]/checkout/billing-details-form'
import { getEventQuota } from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Számlázási adatok — OurFilm',
  robots: { index: false, follow: false },
}

export default async function BillingCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()

  const quota = await getEventQuota(event.id)
  if (quota.unlimited) redirect(`/host/events/${event.slug}/settings`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Link
        href={`/host/events/${event.slug}/settings`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Vissza
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        Számlázási adatok
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Ezek az adatok kerülnek a Billingo által kiállított elektronikus
        számlára.
      </p>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm">
        <span>OurFilm teljes eseménycsomag</span>
        <span className="font-semibold">{EVENT_PRICE_LABEL}</span>
      </div>

      <BillingDetailsForm slug={event.slug} defaultEmail={user?.email ?? ''} />
    </main>
  )
}
