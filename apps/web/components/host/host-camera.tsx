'use client'

import { Camera } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  hostCommitShotAction,
  hostReleaseShotAction,
  hostReserveShotAction,
} from '@/app/(product)/host/events/[slug]/capture-actions'
import { QrSheetButton } from '@/components/host/qr-sheet'
import { compressForStorage, prepareStoredShot } from '@/lib/image'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import { createUploadQueue, type UploadQueue } from '@/lib/upload-queue'
import { uploadShotRenders } from '@/lib/upload-shot'
import { uploadStore } from '@/lib/upload-store'

/**
 * The host's own camera, on the host's own page.
 *
 * The same row the guest sees — a shutter that fills the width and a 58px
 * square beside it — because a host at their own wedding is holding the same
 * phone as everybody else and should not have to find the guest link to take a
 * picture. What differs is the square: a guest shares the album, and a host
 * shows the QR code that gets guests shooting in the first place.
 *
 * Everything below the shutter is the guest's machinery unchanged
 * (`lib/upload-queue.ts`, `lib/upload-store.ts`, `lib/image.ts`): the file is
 * written to IndexedDB before it is compressed, the queue drains one shot at a
 * time in capture order, and a killed tab replays what it owes. The pieces
 * that are genuinely different are the three server actions — a host is
 * recognised by their session rather than by a cookie — and `scope="host"`,
 * which keeps the two rolls apart on a device that has both.
 *
 * There is no film strip and no counter here. The page's own figure row above
 * already carries the counts, and this is a control rather than a screen: a
 * host is on this page to run the event, and the camera is one thing they can
 * do from it.
 */
export function HostCamera({
  slug,
  eventId,
  eventName,
  eventUrl,
  shots,
  canCapture,
  locale,
}: {
  slug: string
  eventId: string
  eventName: string
  eventUrl: string
  /** The roll length, for the QR sheet's sentence. */
  shots: number
  /** Whether the capture window is open. The shutter is the host's too, and
   *  it closes when everybody else's does. */
  canCapture: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<UploadQueue | null>(null)
  const [outstanding, setOutstanding] = useState(0)
  const [handedOff, setHandedOff] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const queue = (queueRef.current ??= createUploadQueue({
      eventId,
      // Two cameras, one device, one event. See the note on `scope`.
      scope: 'host',
      deps: {
        reserve: (idempotencyKey) =>
          hostReserveShotAction(slug, idempotencyKey),
        compress: compressForStorage,
        prepare: prepareStoredShot,
        upload: uploadShotRenders,
        commit: (args) => hostCommitShotAction({ slug, ...args }),
        release: (photoId) => hostReleaseShotAction(slug, photoId),
        store: uploadStore,
      },
      handlers: {
        onReserved() {},
        onProgress() {},
        onConfirmed() {
          setOutstanding((n) => Math.max(0, n - 1))
          // The grid above is server rendered, so a landed frame only appears
          // once the page re-renders. `revalidatePath` in the action does the
          // cache side; this is what asks for the result.
          router.refresh()
        },
        onDropped(_id, reason) {
          setOutstanding((n) => Math.max(0, n - 1))
          if (reason === 'refused') return
          setError(
            en
              ? 'The photo did not upload. Please try again.'
              : 'A kép nem töltődött fel. Próbáld újra.',
          )
        },
        onRefusal(refusal) {
          setError(refusalMessage(refusal, en))
        },
        onRestored() {
          setOutstanding((n) => n + 1)
        },
      },
    }))

    const reactivate = () => {
      if (document.visibilityState === 'hidden') return
      void queue.resume()
    }

    reactivate()
    document.addEventListener('visibilitychange', reactivate)
    window.addEventListener('pageshow', reactivate)
    window.addEventListener('online', reactivate)
    return () => {
      document.removeEventListener('visibilitychange', reactivate)
      window.removeEventListener('pageshow', reactivate)
      window.removeEventListener('online', reactivate)
      queue.stop()
      if (queueRef.current === queue) queueRef.current = null
    }
  }, [en, eventId, router, slug])

  // The tab was handed to the OS camera and has come back. Nothing fires when
  // the camera is cancelled, which is what this listener is for.
  useEffect(() => {
    if (!handedOff) return
    const back = () => {
      if (document.visibilityState === 'visible') setHandedOff(false)
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('pageshow', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('pageshow', back)
    }
  }, [handedOff])

  const takePhoto = useCallback((file: File) => {
    setError(null)
    setOutstanding((n) => n + 1)
    queueRef.current?.enqueue(crypto.randomUUID(), file, Date.now())
  }, [])

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          onClick={() => {
            setHandedOff(true)
            inputRef.current?.click()
          }}
          disabled={!canCapture}
          initial={false}
          animate={{ opacity: handedOff || !canCapture ? 0.5 : 1 }}
          whileTap={canCapture && !reduceMotion ? { scale: 0.972 } : undefined}
          transition={reduceMotion ? still : { ...T.snap, opacity: T.settle }}
          className="paper btn-shine flex min-h-[58px] flex-1 items-center justify-center gap-2.5 rounded-lg text-[15px] font-semibold disabled:pointer-events-none"
        >
          <Camera
            className="size-[19px]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          {outstanding > 0
            ? en
              ? 'Saving…'
              : 'Mentés…'
            : en
              ? 'Camera'
              : 'Kamera'}
        </motion.button>

        <QrSheetButton
          name={eventName}
          url={eventUrl}
          eventId={eventId}
          shots={shots}
          locale={locale}
        />

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          disabled={!canCapture}
          className="sr-only"
          aria-label={en ? 'Take a photo' : 'Fotó készítése'}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            setHandedOff(false)
            if (file) takePhoto(file)
          }}
        />
      </div>

      {/* Reserved either way, so the grid below does not jump when a shot
          fails. The same rule as the guest screen's line under the shutter. */}
      <p
        aria-live="polite"
        className={`mt-3 min-h-5 text-center text-[13px] leading-[1.45] ${
          error ? 'text-destructive' : 'text-muted-foreground'
        }`}
      >
        {error ??
          (canCapture
            ? ''
            : en
              ? 'The camera is closed.'
              : 'Véget ért a fotózás.')}
      </p>
    </div>
  )
}

function refusalMessage(refusal: string, en: boolean): string {
  switch (refusal) {
    case 'not_started':
      return en ? 'The camera is not open yet.' : 'A kamera még nem nyílt meg.'
    case 'ended':
      return en ? 'Shooting has ended.' : 'Véget ért a fotózás.'
    case 'no_shots':
      return en ? 'Your roll is full.' : 'Megtelt a tekercsed.'
    case 'uploads_disabled':
    case 'storage_limit':
      return en
        ? 'Uploads are temporarily paused.'
        : 'A feltöltés átmenetileg szünetel.'
    default:
      return en
        ? 'The photo did not upload. Please try again.'
        : 'A kép nem töltődött fel. Próbáld újra.'
  }
}
