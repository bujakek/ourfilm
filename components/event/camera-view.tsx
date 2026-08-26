'use client'

import { Camera, Images, Loader2, SwitchCamera } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  commitShotAction,
  releaseShotAction,
  reserveShotAction,
} from '@/app/e/[slug]/actions'
import { prepareForUpload, prepareFromBitmap } from '@/lib/image'
import { CAMERA_COPY } from '@/lib/legal/copy/forms'
import { uploadShotRenders } from '@/lib/upload-shot'

/**
 * The camera.
 *
 * Deliberately not a file picker. The old upload queue offered two inputs side
 * by side — "Fotózás" and "Képek" — and the comment next to them explained why
 * the gallery picker had to stay. This reverses that: a disposable camera that
 * accepts last summer's holiday photos is not a disposable camera, and the
 * whole product promise is that what comes out is what happened in the room.
 *
 * The web cannot enforce that, and the UI does not pretend otherwise — the
 * fallback below is a file input with `capture`, which on a phone opens the
 * camera and on a desktop opens a file dialog. What the UI does is make the
 * live camera the obvious path and never advertise the other one.
 *
 * There is no preview and no retake. That is the point of the format: you press
 * the shutter, you hear it, you find out later what you got.
 */

type Status =
  | { kind: 'starting' }
  | { kind: 'live' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }

type Flash = { kind: 'saved' | 'error'; message: string } | null

/** How long the "Elmentettük." confirmation stays up. Long enough to read
 *  while lowering the phone, short enough not to sit over the next shot. */
const FLASH_MS = 1800

export function CameraView({
  eventId,
  slug,
  initialShotsRemaining,
  shotsPerParticipant,
  canViewGallery,
  revealLine,
}: {
  eventId: string
  slug: string
  initialShotsRemaining: number
  /** The host's chosen roll length. Named in the empty state, because "you are
   *  out" is only useful next to "out of how many". */
  shotsPerParticipant: number
  canViewGallery: boolean
  /** The reveal rule as one sentence, resolved on the server so the camera and
   *  the gallery cannot disagree about when the album opens. */
  revealLine: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'starting' })
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [remaining, setRemaining] = useState(initialShotsRemaining)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)

  const outOfShots = remaining <= 0

  // Start, restart on a camera switch, and always stop on the way out. A stream
  // left running keeps the phone's camera light on after the guest has
  // navigated away, which reads as the app spying on them.
  useEffect(() => {
    if (outOfShots) return

    let cancelled = false

    async function start() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatus({ kind: 'unavailable' })
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            // A request, not a guarantee: the browser picks the closest mode it
            // has. Asking high keeps the master render worth printing.
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // iOS Safari refuses to autoplay unless both of these are set on the
          // element itself, and a video that never plays looks like a camera
          // that never opened.
          await videoRef.current.play().catch(() => {})
        }
        setStatus({ kind: 'live' })

        // Only ask after permission is granted: before that, labels are empty
        // and some browsers report a single generic device.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          if (!cancelled) {
            setHasMultipleCameras(
              devices.filter((d) => d.kind === 'videoinput').length > 1,
            )
          }
        } catch {
          // Not knowing means not offering the switch, which is the safe way
          // to be wrong.
        }
      } catch (e) {
        if (cancelled) return
        const name = e instanceof Error ? e.name : ''
        setStatus(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? { kind: 'denied' }
            : { kind: 'unavailable' },
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facing, outOfShots])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])

  /**
   * The shutter.
   *
   * Reserve first, then encode, then upload, then commit. Reserving before the
   * expensive part means a guest who is out of film finds out immediately
   * instead of after a two-second encode, and it is the step that makes the
   * limit atomic — everything after it is working on a frame the database has
   * already agreed to.
   */
  const capture = useCallback(
    async (
      prepare: () => Promise<Awaited<ReturnType<typeof prepareForUpload>>>,
    ) => {
      // The double-tap guard. A boolean rather than a timer: the button is
      // disabled for exactly as long as the work takes and not one frame
      // longer, so a fast connection stays fast.
      if (busy || outOfShots) return
      setBusy(true)
      setFlash(null)

      // One key per shutter press, reused if this same press is retried. It is
      // what makes a retry re-claim the same frame rather than spend another.
      const idempotencyKey = crypto.randomUUID()
      let photoId: string | null = null

      try {
        const reserved = await reserveShotAction(eventId, idempotencyKey)

        if (!reserved.ok) {
          setRemaining(0)
          setFlash({ kind: 'error', message: refusalMessage(reserved.refusal) })
          return
        }

        photoId = reserved.photoId

        const prepared = await prepare()
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

        // The server's number, never a local decrement. A client-side counter
        // is a display; this is the count.
        setRemaining(committed.shotsRemaining)
        setFlash({ kind: 'saved', message: 'Elmentettük.' })
      } catch (e) {
        console.error('Capture failed', e)
        // Hand the frame back so the failure costs nothing. The reservation
        // would expire on its own within ten minutes anyway; this makes the
        // retry immediate.
        if (photoId) await releaseShotAction(photoId)
        setFlash({
          kind: 'error',
          message: 'A kép nem töltődött fel. Próbáld újra.',
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, eventId, outOfShots, slug],
  )

  const shootLive = useCallback(() => {
    void capture(async () => {
      const video = videoRef.current
      if (!video || !video.videoWidth) throw new Error('camera not ready')

      // Straight from the video element to a bitmap: a live frame is already
      // decoded pixels, so encoding it to a JPEG just to decode it again would
      // be a wasted round trip on the shutter path.
      const bitmap = await createImageBitmap(video)
      return prepareFromBitmap(bitmap, new Date())
    })
  }, [capture])

  const shootFile = useCallback(
    (file: File) => {
      void capture(() => prepareForUpload(file))
    },
    [capture],
  )

  if (outOfShots) {
    return (
      <OutOfShots
        slug={slug}
        shotsPerParticipant={shotsPerParticipant}
        canViewGallery={canViewGallery}
        revealLine={revealLine}
      />
    )
  }

  const showFallback = status.kind === 'denied' || status.kind === 'unavailable'

  return (
    <div className="flex min-h-[70vh] flex-col">
      <p
        // Announced, because the count is the whole tension of the format and a
        // guest using a screen reader should feel it too.
        aria-live="polite"
        className="text-center text-sm font-medium text-muted-foreground"
      >
        {CAMERA_COPY.remaining(remaining)}
      </p>

      {/* The reveal rule sits under the counter and stays there while
          shooting. A guest deciding what to point the camera at is deciding
          under an assumption about who will see it, and finding that out only
          after the roll runs out is finding it out too late. */}
      <p className="mt-1 text-center text-xs text-pretty text-muted-foreground">
        {revealLine}
      </p>

      <div className="relative mt-4 flex-1 overflow-hidden rounded-3xl bg-background-secondary">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Kameranézet"
          className={`size-full object-cover ${status.kind === 'live' ? '' : 'opacity-0'}`}
        />

        {status.kind === 'starting' ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Kamera indítása…
          </p>
        ) : null}

        {showFallback ? (
          <CameraFallback denied={status.kind === 'denied'} />
        ) : null}

        {flash ? (
          <p
            aria-live="polite"
            className={`glass-strong absolute inset-x-4 bottom-4 rounded-2xl px-4 py-3 text-center text-sm font-medium ${
              flash.kind === 'error' ? 'text-destructive' : 'text-foreground'
            }`}
          >
            {flash.message}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        {/* Placeholder keeps the shutter centred whether or not the switch is
            offered — a button that jumps sideways once the camera list loads
            is a button people miss. */}
        <span className="size-12">
          {hasMultipleCameras && status.kind === 'live' ? (
            <button
              type="button"
              onClick={() =>
                setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
              }
              disabled={busy}
              aria-label="Kamera váltása"
              className="glass glass-hover flex size-12 items-center justify-center rounded-full disabled:opacity-40"
            >
              <SwitchCamera className="size-5 text-accent" strokeWidth={1.8} />
            </button>
          ) : null}
        </span>

        {showFallback ? (
          <FallbackShutter busy={busy} onFile={shootFile} />
        ) : (
          <button
            type="button"
            onClick={shootLive}
            disabled={busy || status.kind !== 'live'}
            aria-label="Fotó készítése"
            className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-white/20 transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <Camera className="size-7" strokeWidth={1.8} />
            )}
          </button>
        )}

        <span className="size-12" />
      </div>

      {canViewGallery ? (
        <Link
          href={`/e/${slug}/gallery`}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 self-center rounded-full px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Images className="size-4" />
          Eddigi képek
        </Link>
      ) : null}
    </div>
  )
}

/** Maps the database's refusal to something a guest can act on. */
function refusalMessage(refusal: string): string {
  switch (refusal) {
    case 'not_started':
      return 'A kamera még nem nyílt meg.'
    case 'ended':
      return `${CAMERA_COPY.closedHeading}.`
    case 'no_shots':
      return `${CAMERA_COPY.emptyHeading}.`
    case 'no_session':
      return 'Lejárt a munkameneted. Frissítsd az oldalt.'
    default:
      return 'A kép nem töltődött fel. Próbáld újra.'
  }
}

function CameraFallback({ denied }: { denied: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <span className="glass flex size-12 items-center justify-center rounded-2xl">
        <Camera className="size-6 text-accent" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-base font-semibold text-balance">
        {denied ? 'Nincs hozzáférésünk a kamerához' : 'A kamera nem elérhető'}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        {denied
          ? 'Engedélyezd a kamerát a böngésző beállításaiban, vagy készítsd el a képet a gombbal.'
          : 'Ebben a böngészőben nem tudjuk élőben megnyitni a kamerát. A gombbal így is tudsz fotózni.'}
      </p>
    </div>
  )
}

/**
 * The fallback shutter: a file input with `capture`, which opens the camera app
 * on a phone. Styled as the same shutter button so the flow reads identically —
 * the guest presses a round button and a photo goes in.
 *
 * No `multiple`, and no "válassz a galériából" anywhere: this exists so a guest
 * on a browser that will not give us `getUserMedia` can still take part, not so
 * anyone can bulk-upload an album.
 */
function FallbackShutter({
  busy,
  onFile,
}: {
  busy: boolean
  onFile: (file: File) => void
}) {
  return (
    <label
      className={`flex size-20 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-white/20 transition-transform active:scale-95 ${
        busy ? 'opacity-60' : ''
      }`}
    >
      <span className="sr-only">Fotó készítése</span>
      {busy ? (
        <Loader2 className="size-7 animate-spin" />
      ) : (
        <Camera className="size-7" strokeWidth={1.8} />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        capture="environment"
        disabled={busy}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset first: picking the same file twice in a row fires no change
          // event otherwise, and a guest retrying the same shot would see
          // nothing happen.
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}

function OutOfShots({
  slug,
  shotsPerParticipant,
  canViewGallery,
  revealLine,
}: {
  slug: string
  shotsPerParticipant: number
  canViewGallery: boolean
  revealLine: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
      <span className="glass flex size-14 items-center justify-center rounded-2xl">
        <Camera className="size-6 text-accent" strokeWidth={1.6} />
      </span>

      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
        {CAMERA_COPY.emptyHeading}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {CAMERA_COPY.emptyBody(shotsPerParticipant)}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        {canViewGallery
          ? 'Megnézheted az eddig elkészült képeket.'
          : revealLine}
      </p>

      {canViewGallery ? (
        <Link
          href={`/e/${slug}/gallery`}
          className="btn-shine mt-7 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground"
        >
          <Images className="size-5" strokeWidth={1.8} />
          Képek megtekintése
        </Link>
      ) : null}
    </div>
  )
}
