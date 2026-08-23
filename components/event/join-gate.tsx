'use client'

import {
  GUEST_NAME_MAX_LENGTH,
  hasGuestName,
  readGuestName,
  writeGuestName,
} from '@/lib/guest-name'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

/**
 * Stands between a guest and the album until they give a name.
 *
 * **This is a UX gate, not access control.** A guest who clears site data, or
 * who forges the cookie it reads, walks straight past it. Privacy rests
 * entirely on the slug being unguessable — do not let this component's
 * presence be mistaken for a boundary. If it ever needs to be real it has to
 * move into the database, where the guest RPCs would have to require something
 * a browser cannot fabricate.
 *
 * The decision is now the **server's**, and it is made inside each page rather
 * than in the layout above them. Both details matter. Reading the cookie on
 * the server removed the flash — a guest who had already joined used to see
 * the gate for a beat on every navigation while hydration caught up. Making
 * the call in the page is what actually withholds the album: Next renders a
 * child segment and hands the layout its *result*, so a layout that declines
 * to render `children` still lets the page run and serialise every
 * `thumb_path` and `uploader_name` into the flight payload. Returning this
 * component early, before the query, is the only version that does not.
 *
 * Joining therefore costs one round trip, where the old client-side swap was
 * instant. That is the correct side of the trade — it happens once per device,
 * at the exact moment a guest has just typed something and expects a submit.
 */
export function JoinGate({ eventName }: { eventName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  // Set for the whole window between submitting and the server render landing.
  // `pending` alone goes false the moment the transition commits, which is
  // before the new HTML swaps in — the button would flick back to idle while
  // the gate is still on screen.
  const [joining, setJoining] = useState(false)

  const enter = () => {
    setJoining(true)
    startTransition(() => router.refresh())
  }

  // Guests who joined before the cookie existed have a name in localStorage
  // and nothing the server can read, so they would meet this gate again and be
  // asked to retype a name we already have. Mirror it into the cookie and
  // re-render instead. Runs once, and only for those devices.
  //
  // Deferred into a timeout for the same reason `useGuestState` is: setting
  // state synchronously in an effect body is a cascading render, and the lint
  // rule that catches it is right. The effect body only schedules.
  useEffect(() => {
    if (!hasGuestName()) return
    writeGuestName(readGuestName())
    const id = setTimeout(enter, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  const name = value.trim()

  const join = () => {
    if (!name) return
    writeGuestName(name)
    enter()
  }

  const busy = pending || joining

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10 sm:py-16">
      <div className="text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          KÖZÖS FOTÓALBUM
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {eventName}
        </h1>
        <p className="mx-auto mt-5 max-w-sm leading-relaxed text-pretty text-muted-foreground">
          Írd be a neved, hogy a képeid mellett látható legyen, kitől érkeztek.
          Fiókot nem kell létrehoznod, és e-mail-címet sem kérünk.
        </p>
      </div>

      <div className="mt-8">
        <label htmlFor="join-name" className="sr-only">
          Mi a neved?
        </label>
        <input
          id="join-name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') join()
          }}
          maxLength={GUEST_NAME_MAX_LENGTH}
          autoComplete="name"
          autoFocus
          disabled={busy}
          placeholder="Mi a neved?"
          className="glass min-h-14 w-full rounded-2xl px-5 text-center text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground/60 focus:border-accent disabled:opacity-60"
        />

        <button
          type="button"
          onClick={join}
          disabled={!name || busy}
          className="btn-shine mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : null}
          Csatlakozom
        </button>
      </div>
    </main>
  )
}
