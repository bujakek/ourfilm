import { EventList } from '@/components/host/event-list'
import { EventListSkeleton } from '@/components/host/skeletons'
import { captureIsOpen, getEventListItems } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { CalendarPlus, LogOut, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'

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
      {/* The name of the page on a rule, with the two things a host does from
          here beside it. `Új kamera` is `.paper` because it is the one action
          that makes something; signing out is an outline because it is not. */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4.5">
        <h1 className="font-display text-[40px] leading-none tracking-[-0.01em]">
          {en ? 'Your events' : 'Eseményeid'}
        </h1>
        <div className="flex items-center gap-2.5">
          <form action={`/auth/signout?lang=${locale}`} method="post">
            <button
              type="submit"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/14 px-4 text-[12px] font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {en ? 'Sign out' : 'Kilépés'}
            </button>
          </form>
          <Link
            href={`/host/events/new?lang=${locale}`}
            className="paper btn-shine inline-flex min-h-10 items-center gap-2 rounded-full px-4.5 text-[12.5px] font-semibold"
          >
            <Plus className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            {en ? 'New camera' : 'Új kamera'}
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
  const en = locale === 'en'
  const events = await getEventListItems()

  if (events.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-white/6">
          <CalendarPlus
            className="size-7 text-muted-foreground"
            strokeWidth={1.8}
          />
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
