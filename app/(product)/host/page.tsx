import { EventList } from '@/components/host/event-list'
import { EventListSkeleton } from '@/components/host/skeletons'
import { captureIsOpen, getEventListItems } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { CalendarPlus, LogOut, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}): Promise<Metadata> {
  const { lang } = await searchParams
  return {
    title: lang === 'hu' ? 'Áttekintés — OurFilm' : 'Dashboard — OurFilm',
    robots: { index: false, follow: false },
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang } = await searchParams
  const locale = lang === 'hu' ? 'hu' : 'en'
  const en = locale === 'en'
  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16"
      // See the note in `app/(product)/layout.tsx`: `/host` has no locale
      // segment, so the document is the site default and the page marks the
      // language it actually resolved on its own subtree.
      lang={localeTag[locale]}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {en ? 'Your events' : 'Eseményeid'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/host/events/new?lang=${locale}`}
            className={buttonVariants({ size: 'sm' })}
          >
            <Plus className="size-4" strokeWidth={2.2} />
            {en ? 'New event' : 'Új esemény'}
          </Link>
          <form action={`/auth/signout?lang=${locale}`} method="post">
            <Button type="submit" variant="secondary" size="sm">
              <LogOut className="size-4" />
              {en ? 'Sign out' : 'Kilépés'}
            </Button>
          </form>
        </div>
      </div>

      <Suspense fallback={<EventListSkeleton />}>
        <OwnedEventList locale={locale} />
      </Suspense>
    </main>
  )
}

async function OwnedEventList({ locale }: { locale: 'en' | 'hu' }) {
  const en = locale === 'en'
  const events = await getEventListItems()

  if (events.length === 0) {
    return (
      <div className="glass mt-10 flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent/20">
          <CalendarPlus className="size-7 text-accent" strokeWidth={1.8} />
        </span>
        <p className="text-lg font-semibold">
          {en ? 'No events yet' : 'Még nincs eseményed'}
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">
          {en
            ? 'Create your first disposable camera to get a shareable QR code and invite link.'
            : 'Hozd létre az első eldobható kamerát, és máris megkapod a megosztható QR-kódot és meghívólinket.'}
        </p>
        <Link
          href={`/host/events/new?lang=${locale}`}
          className={buttonVariants({ className: 'mt-3' })}
        >
          <Plus className="size-4" strokeWidth={2.2} />
          {en ? 'Create your first event' : 'Első esemény létrehozása'}
        </Link>
      </div>
    )
  }

  return (
    <EventList
      active={events.filter(captureIsOpen)}
      closed={events.filter((e) => !captureIsOpen(e))}
      locale={locale}
    />
  )
}
