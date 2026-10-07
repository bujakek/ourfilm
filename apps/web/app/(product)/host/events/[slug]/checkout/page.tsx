import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { BillingCard } from '@/components/host/billing-card'
import { BackLink } from '@/components/ui/back-link'
import { getEventQuota, getSavedBillingCountry } from '@/lib/billing'
import { suggestedBillingCountry } from '@/lib/billing-country'
import { checkoutReadiness } from '@/lib/checkout-readiness'
import { getOwnedEventBySlug } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'OurFilm',
  robots: { index: false, follow: false },
}

export default async function EventCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // The authenticated client's ownership RLS applies before any billing read.
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()
  const locale = event.locale
  const en = locale === 'en'
  const quota = await getEventQuota(event.id)
  if (quota.unlimited) redirect(`/host/events/${slug}?lang=${locale}`)
  const savedCountry = await getSavedBillingCountry()
  const suggested = suggestedBillingCountry(
    (await headers()).get('x-vercel-ip-country'),
  )

  return (
    <main lang={locale} className="mx-auto max-w-lg px-6 py-8 sm:py-12">
      <BackLink href={`/host/events/${slug}?lang=${locale}`}>
        {event.event_name}
      </BackLink>
      <header className="mt-6 mb-6">
        <p className="text-sm text-muted-foreground">
          {en ? 'Your event is saved' : 'Az eseményed elmentve'}
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          {en ? 'Payment' : 'Fizetés'}
        </h1>
      </header>
      <BillingCard
        presentation="checkout"
        locale={locale}
        slug={slug}
        participantLimit={quota.participantLimit}
        participantCount={quota.participantCount}
        unlimited={false}
        planNote={null}
        readiness={checkoutReadiness()}
        savedBillingCountry={savedCountry}
        suggestedBillingCountry={suggested}
        checkout={null}
      />
    </main>
  )
}
