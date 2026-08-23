import { JoinGate } from '@/components/event/join-gate'
import { UploadQueue } from '@/components/event/upload-queue'
import { getEventQuotaOrNull } from '@/lib/billing'
import { getEventBySlug, uploadsAreOpen } from '@/lib/events'
import { formatDeadline, formatEventDate } from '@/lib/format'
import { guestHasJoined } from '@/lib/guest-name-server'
import { Images, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// A guest who has just uploaded returns here expecting their photo to count.
// Nothing on this screen is worth serving stale.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return {}
  // Deliberately plain: this title can surface in a shared link preview or a
  // phone's tab list, and the event name is enough. No description, no image.
  return { title: `${event.event_name} — közös fotóalbum` }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params

  // Both settle together — `guestHasJoined` only reads a cookie, so it adds no
  // round trip, and putting it here rather than in the layout is what lets the
  // gate return before anything else is fetched.
  const [event, joined] = await Promise.all([
    getEventBySlug(slug),
    guestHasJoined(),
  ])
  if (!event) notFound()

  // Returning the gate *instead of* the page is the point: the quota read
  // below never happens, and nothing about the album reaches a visitor who has
  // not joined. Still not access control — a cookie is forged as easily as it
  // is read — but it no longer hands the album over in the flight payload.
  if (!joined) return <JoinGate eventName={event.event_name} />

  const canUpload = uploadsAreOpen(event)
  // While uploads are open the deadline is the more useful of the two facts a
  // guest could be told, and the only one that changes what they do next. The
  // event date is the fallback for albums created before the deadline was
  // asked for; once uploads close, the paragraph below says so and this line
  // would only repeat it.
  const subline =
    canUpload && event.uploads_close_at
      ? `Feltöltés ${formatDeadline(event.uploads_close_at)}-ig`
      : formatEventDate(event.event_date)

  // The counts arrive with the event row now, aggregated in Postgres. This
  // used to fetch every photo in the album to count them in JavaScript, which
  // meant a six-hundred-photo wedding serialised the whole table over the wire
  // to render "600 kép". They read zero while the gallery is hidden, so the
  // guard is about telling the guest why rather than about the number.
  const summary = event.gallery_private ? null : event

  // Read here rather than inside the queue: the guest arrives on a server
  // render and the number has to be right in the first paint, otherwise the
  // pickers appear and then vanish under them on a full album.
  //
  // Not folded into the event RPC on purpose. `event_upload_quota` lives
  // behind a migration that is not pushed yet, and `getEventQuotaOrNull`
  // exists so the guest page still renders when it is missing; combining them
  // would trade that fallback for a page that fails outright.
  const quota = canUpload ? await getEventQuotaOrNull(event.id) : null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10 sm:py-16">
      {/* `my-auto` rather than `justify-center` on the parent: the upload
          queue grows as files are added, and a centred flex column clips the
          overflow above the fold where it cannot be scrolled to. */}
      <div className="my-auto w-full">
        <header className="text-center">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            KÖZÖS FOTÓALBUM
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {event.event_name}
          </h1>
          {subline ? (
            <p className="mt-3 text-sm text-muted-foreground">{subline}</p>
          ) : null}
          {/* Not "hogy mindenki lássa": the host can close the gallery to
              guests at any time, so the promise this line can keep is that the
              people whose event it is will see the photo. */}
          <p className="mx-auto mt-5 max-w-sm leading-relaxed text-pretty text-muted-foreground">
            {canUpload
              ? 'Töltsd fel a képeidet, hogy az ünnepeltek azokat a pillanatokat is lássák, amelyeket te örökítettél meg. App és regisztráció nélkül.'
              : 'A feltöltés lezárult, de a közös album megmarad — nézd meg, mi gyűlt össze.'}
          </p>
        </header>

        {/* Social proof, and a signal that the album is alive. Hidden at zero:
          "0 kép" reads as broken rather than as an empty album waiting for
          you. The contributor count is suppressed until at least one guest
          has given a name — see GuestEvent for why it is a floor.

          "közreműködő", not "vendég": this counts the guests who have
          uploaded something, not the guests at the event, and the two numbers
          are wildly different at a wedding. */}
        {summary && summary.photo_count > 0 ? (
          <div className="glass mt-6 flex items-stretch justify-center divide-x divide-border rounded-2xl py-3">
            <div className="px-7 text-center">
              <p className="text-xl font-semibold tracking-tight">
                {summary.photo_count}
              </p>
              <p className="text-xs text-muted-foreground">kép</p>
            </div>
            {summary.has_named_contributors ? (
              <div className="px-7 text-center">
                <p className="text-xl font-semibold tracking-tight">
                  {summary.contributor_count}
                </p>
                <p className="text-xs text-muted-foreground">közreműködő</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* The upload queue lives here rather than behind a navigation. Picking
          files was a three-screen trip — landing, a page whose only content
          was two buttons, then the queue — for what the OS already presents
          as a single sheet. */}
        <div className="mt-10 flex flex-col gap-3">
          {canUpload ? (
            <UploadQueue
              eventId={event.id}
              slug={event.slug}
              galleryPrivate={event.gallery_private}
              remaining={quota?.remaining ?? null}
            />
          ) : (
            <p className="glass flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-center text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" strokeWidth={1.8} />A feltöltési
              határidő lejárt
            </p>
          )}

          {event.gallery_private ? (
            // Say why. An empty gallery reads as "nobody bothered", which is a
            // miserable thing to tell a guest who just uploaded.
            <p className="glass rounded-2xl px-6 py-4 text-center text-sm leading-relaxed text-muted-foreground">
              A közös albumot a házigazda egyelőre elrejtette. A képeid
              megérkeztek — akkor lesznek láthatók, amikor újra megnyitja.
            </p>
          ) : (
            <Link
              href={`/e/${event.slug}/gallery`}
              className="glass glass-hover inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-foreground"
            >
              <Images className="size-5" strokeWidth={1.8} />
              Közös album megnyitása
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
