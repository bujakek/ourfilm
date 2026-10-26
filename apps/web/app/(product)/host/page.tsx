import { EventList, EventListError } from '@/components/host/event-list'
import { getHostLocale } from '@/lib/host-locale'
import { EventListSkeleton } from '@/components/host/skeletons'
import { captureIsOpen, getEventListItems } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { reportServerIssue } from '@/lib/telemetry-server'
import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}): Promise<Metadata> {
  const { lang } = await searchParams
  return {
    title:
      (await getHostLocale(lang)) === 'hu'
        ? 'Áttekintés — OurFilm'
        : 'Dashboard — OurFilm',
    robots: { index: false, follow: false },
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  // The profile's language; `?lang` only for an account with none yet.
  const locale = await getHostLocale(lang)
  return (
    <main
      className="mx-auto w-full max-w-3xl pt-5 pb-10 sm:pt-12"
      // See the note in `app/(product)/layout.tsx`: `/host` has no locale
      // segment, so the document is the site default and the page marks the
      // language it actually resolved on its own subtree.
      lang={localeTag[locale]}
    >
      {/* The header renders with the list: the empty screen (7a) swaps the
          title for a kicker and drops "Új", whose white would be a second
          primary beside its own "create". */}
      <Suspense fallback={<EventListSkeleton locale={locale} />}>
        <OwnedEventList locale={locale} />
      </Suspense>
    </main>
  )
}

async function OwnedEventList({ locale }: { locale: 'en' | 'hu' }) {
  let events: Awaited<ReturnType<typeof getEventListItems>>
  try {
    events = await getEventListItems()
  } catch (error) {
    // Let Next's own control flow through; everything else is a failed read.
    unstable_rethrow(error)
    console.error('Could not load the host event list', error)
    await reportServerIssue(error, {
      operation: 'host_event_list',
      route: '/host',
      routeType: 'page',
      method: 'GET',
    })
    return <EventListError locale={locale} />
  }
  // An empty list is `EventList`'s own 7a state.
  return (
    <EventList
      active={events.filter(captureIsOpen)}
      closed={events.filter((e) => !captureIsOpen(e))}
      locale={locale}
    />
  )
}
