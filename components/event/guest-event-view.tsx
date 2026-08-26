'use client'

import type { GalleryTile } from '@/lib/photos'
import {
  Camera,
  Clock3,
  Image,
  Loader2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  commitShotAction,
  releaseShotAction,
  reserveShotAction,
} from '@/app/e/[slug]/actions'
import { prepareForUpload } from '@/lib/image'
import { uploadShotRenders } from '@/lib/upload-shot'

import { InviteButton } from './invite-button'
import { PhotoGrid } from './photo-grid'

type GalleryState =
  { open: true } | { open: false; heading: string; detail: string | null }

type Flash = { kind: 'saved' | 'error'; message: string } | null

export function GuestEventView({
  eventId,
  slug,
  eventName,
  eventUrl,
  captureEndAt,
  initialNow,
  initialCanCapture,
  initialShotsRemaining,
  participantCount,
  gallery,
  photos,
}: {
  eventId: string
  slug: string
  eventName: string
  eventUrl: string
  captureEndAt: string
  initialNow: number
  initialCanCapture: boolean
  initialShotsRemaining: number
  participantCount: number
  gallery: GalleryState
  photos: GalleryTile[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [remaining, setRemaining] = useState(initialShotsRemaining)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const [now, setNow] = useState(initialNow)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])

  const captureEnd = new Date(captureEndAt).getTime()
  const captureIsOpen = initialCanCapture && now <= captureEnd
  const canTakePhoto = captureIsOpen && remaining > 0 && !busy

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (busy || remaining <= 0) return

      setBusy(true)
      setFlash(null)
      const idempotencyKey = crypto.randomUUID()
      let photoId: string | null = null

      try {
        const reserved = await reserveShotAction(eventId, idempotencyKey)

        if (!reserved.ok) {
          if (reserved.refusal === 'no_shots') setRemaining(0)
          setFlash({
            kind: 'error',
            message: refusalMessage(reserved.refusal),
          })
          return
        }

        photoId = reserved.photoId
        const prepared = await prepareForUpload(file)
        await uploadShotRenders({ prepared, uploads: reserved.uploads })

        const committed = await commitShotAction({
          slug,
          photoId,
          width: prepared.width,
          height: prepared.height,
          byteSize: prepared.full.size,
          takenAt: prepared.takenAt?.toISOString() ?? null,
        })

        if (!committed.committed) throw new Error('commit refused')

        setRemaining(committed.shotsRemaining)
        setFlash({ kind: 'saved', message: 'Elmentettük a képet.' })
        router.refresh()
      } catch (error) {
        console.error('Native camera upload failed', error)
        if (photoId) await releaseShotAction(photoId)
        setFlash({
          kind: 'error',
          message: 'A kép nem töltődött fel. Próbáld újra.',
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, eventId, remaining, router, slug],
  )

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-10 pb-14 sm:px-6 sm:pt-14">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {eventName}
        </h1>

        <dl className="mt-6 space-y-2 text-sm text-muted-foreground">
          <EventFact icon={Clock3}>
            {formatTimeRemaining(captureEnd, now)}
          </EventFact>
          <EventFact icon={Users}>
            {participantCount === 1
              ? '1 vendég csatlakozott'
              : `${participantCount} vendég csatlakozott`}
          </EventFact>
          <EventFact icon={Image} live>
            {remaining === 1 ? '1 képed maradt' : `${remaining} képed maradt`}
          </EventFact>
        </dl>

        <div className="mt-8 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] gap-3">
          <InviteButton url={eventUrl} />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!canTakePhoto}
            className="btn-shine inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-5" strokeWidth={1.8} aria-hidden="true" />
            )}
            {busy ? 'Mentés…' : 'Kamera'}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            disabled={!canTakePhoto}
            className="sr-only"
            aria-label="Fotó készítése"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void uploadPhoto(file)
            }}
          />
        </div>

        {flash ? (
          <p
            aria-live="polite"
            className={`mt-3 text-center text-sm ${
              flash.kind === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {flash.message}
          </p>
        ) : null}
      </header>

      <div className="mt-10 border-t border-border pt-9">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Közös képek</h2>
          {gallery.open && photos.length > 0 ? (
            <p className="text-sm text-muted-foreground">{photos.length} kép</p>
          ) : null}
        </div>

        {!gallery.open ? (
          <div className="glass mt-5 rounded-3xl px-6 py-9 text-center">
            <h3 className="text-base font-semibold text-balance">
              {gallery.heading}
            </h3>
            {gallery.detail ? (
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {gallery.detail}
              </p>
            ) : null}
          </div>
        ) : photos.length === 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Még nincs kép. Nyisd meg a kamerát, és készítsd el az elsőt.
          </p>
        ) : (
          <div className="mt-5">
            <PhotoGrid photos={photos} />
          </div>
        )}
      </div>
    </main>
  )
}

function EventFact({
  icon: Icon,
  live = false,
  children,
}: {
  icon: LucideIcon
  live?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">Eseményadat</dt>
      <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <dd aria-live={live ? 'polite' : undefined}>{children}</dd>
    </div>
  )
}

function formatTimeRemaining(captureEnd: number, now: number): string {
  const totalMinutes = Math.max(0, Math.ceil((captureEnd - now) / 60_000))
  if (totalMinutes <= 0) return 'A fotózás véget ért'

  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return hours > 0
      ? `${days} nap ${hours} óra van hátra`
      : `${days} nap van hátra`
  }
  if (hours > 0) {
    return minutes > 0
      ? `${hours} óra ${minutes} perc van hátra`
      : `${hours} óra van hátra`
  }
  return `${minutes} perc van hátra`
}

function refusalMessage(refusal: string): string {
  switch (refusal) {
    case 'not_started':
      return 'A kamera még nem nyílt meg.'
    case 'ended':
      return 'Véget ért a fotózás.'
    case 'no_shots':
      return 'Elfogytak a képeid.'
    case 'no_session':
      return 'Lejárt a munkameneted. Frissítsd az oldalt.'
    default:
      return 'A kép nem töltődött fel. Próbáld újra.'
  }
}
