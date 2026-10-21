import { EventList } from '@/components/host/event-list'
import { getHostLocale } from '@/lib/host-locale'
import { EventListSkeleton } from '@/components/host/skeletons'
import { captureIsOpen, getEventListItems } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { HOST_SECONDARY, HOST_TITLE } from '@/components/host/ui/classes'
import { Plus, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
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
  const en = locale === 'en'
  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16"
      // See the note in `app/(product)/layout.tsx`: `/host` has no locale
      // segment, so the document is the site default and the page marks the
      // language it actually resolved on its own subtree.
      lang={localeTag[locale]}
    >
      {/* The name of the page with the two things a host does from here
          beside it. Both are secondary: the list layout is not designed yet,
          and an empty list carries its own white "create" (7a), which must
          stay the one white action on that screen. Sign-out lives on the
          account screen. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className={HOST_TITLE}>{en ? 'Your events' : 'Eseményeid'}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/host/account?lang=${locale}`}
            className={cn(
              HOST_SECONDARY,
              'h-11 gap-2 rounded-[14px] px-4 text-[14px]',
            )}
          >
            <UserRound className="size-4" aria-hidden="true" />
            {en ? 'Account' : 'Fiók'}
          </Link>
          <Link
            href={`/host/events/new?lang=${locale}`}
            className={cn(
              HOST_SECONDARY,
              'h-11 gap-2 rounded-[14px] px-4 text-[14px]',
            )}
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            {en ? 'New event' : 'Új esemény'}
          </Link>
        </div>
      </div>

      <Suspense fallback={<EventListSkeleton />}>
        <OwnedEventList locale={locale} />
      </Suspense>
    </main>
  )
}

async function OwnedEventList({ locale }: { locale: 'en' | 'hu' }) {
  const events = await getEventListItems()
  // An empty list is `EventList`'s own 7a state.
  return (
    <EventList
      active={events.filter(captureIsOpen)}
      closed={events.filter((e) => !captureIsOpen(e))}
      locale={locale}
    />
  )
}
