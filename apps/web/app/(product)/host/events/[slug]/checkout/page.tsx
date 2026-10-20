import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { BillingCard } from '@/components/host/billing-card'
import { HOST_KICKER, HOST_TITLE } from '@/components/host/ui/classes'
import { BackLink } from '@/components/ui/back-link'
import { getEventQuota, getSavedBillingCountry } from '@/lib/billing'
import { suggestedBillingCountry } from '@/lib/billing-country'
import { checkoutReadiness } from '@/lib/checkout-readiness'
import { getOwnedEventBySlug } from '@/lib/events'
import { getHostLocale } from '@/lib/host-locale'
import { localeTag } from '@/lib/i18n'

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
  // A host screen, so the host's profile language — the same one Stripe's
  // page will be in — and never the event's.
  const locale = await getHostLocale(event.locale)
  const en = locale === 'en'
  const quota = await getEventQuota(event.id)
  if (quota.unlimited) redirect(`/host/events/${slug}?lang=${locale}`)
  const savedCountry = await getSavedBillingCountry()
  const suggested = suggestedBillingCountry(
    (await headers()).get('x-vercel-ip-country'),
  )

  return (
    <main
      lang={localeTag[locale]}
      className="mx-auto w-full max-w-lg px-5 pt-7 pb-11 sm:px-7"
    >
      <BackLink tone="host" href={`/host/events/${slug}?lang=${locale}`}>
        {event.event_name}
      </BackLink>
      <header className="mt-6 mb-7">
        <p className={HOST_KICKER}>{en ? 'Event saved' : 'Esemény elmentve'}</p>
        <h1 className={`mt-3 ${HOST_TITLE}`}>{en ? 'Payment' : 'Fizetés'}</h1>
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
