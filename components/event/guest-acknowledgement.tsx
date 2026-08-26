'use client'

import { Camera, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { acceptGuestTermsAction } from '@/app/e/[slug]/actions'
import { GUEST_ACK_COPY } from '@/lib/legal/copy/forms'

import { GuestTermsLink, PrivacyNoticeLine } from './legal-links'

/**
 * The one thing a guest is asked before their first shot.
 *
 * Once per event and per legal version, never per shot — the record lives in
 * `legal_acceptances` keyed on the participant, so it survives a refresh, a
 * closed tab and a week later, and it is re-asked only if the document itself
 * is revised.
 *
 * It is a real gate rather than a banner: the camera is not rendered behind
 * it. That matters because the acknowledgement is about what a guest is about
 * to do with other people's faces, and a notice you can shoot straight past is
 * a notice nobody read.
 *
 * The checkbox starts unchecked and the button is disabled until it is ticked.
 * A pre-ticked box is not an acceptance.
 */
export function GuestAcknowledgement({ slug }: { slug: string }) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="glass flex flex-col rounded-3xl px-6 py-8">
      <span className="glass flex size-12 items-center justify-center rounded-2xl">
        <Camera className="size-6 text-accent" strokeWidth={1.6} />
      </span>

      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-balance">
        {GUEST_ACK_COPY.heading}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {GUEST_ACK_COPY.body}
      </p>

      <label className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="text-sm leading-relaxed text-pretty">
          Elolvastam és elfogadom a{' '}
          <GuestTermsLink>Vendégfelhasználási feltételeket</GuestTermsLink>.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!accepted || pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await acceptGuestTermsAction(slug)
            if (!result.ok) setError(result.error)
            // On success the action revalidates this route, so the camera
            // replaces this screen on the server's next render. Nothing is
            // navigated from here: the same reasoning as the join form, where
            // the redirect lives in the action rather than in an effect.
          })
        }
        className="btn-shine mt-7 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : null}
        {GUEST_ACK_COPY.submit}
      </button>

      <div className="mt-4">
        <PrivacyNoticeLine text={GUEST_ACK_COPY.privacy} />
      </div>
    </div>
  )
}
