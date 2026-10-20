'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SiGoogle } from 'react-icons/si'

import { HOST_KICKER_BASE, HOST_SECONDARY } from '@/components/host/ui/classes'
import { signInWithGoogle } from '@/lib/auth-google'
import type { Locale } from '@/lib/i18n'
import { track } from '@/lib/telemetry'

/**
 * Renders the button and its own failure, and nothing around it.
 *
 * The "or with email" rule used to live in here, which read tidily and put
 * every message this component owns *above* the separator while the page's
 * own `?error=oauth` notice landed below it — attached, to anyone looking, to
 * the email form it has nothing to do with. `AuthDivider` is exported
 * separately so the form that owns the layout decides what sits on which side
 * of the line.
 */
export function GoogleSignIn({
  locale,
  surface,
  next,
  disabled,
  onPendingChange,
  creationKey,
  className = `${HOST_SECONDARY} w-full gap-2.5`,
}: {
  locale: Locale
  surface: 'login' | 'onboarding'
  next: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
  creationKey?: string
  /** The button's classes. Both callers are in the host look, so the
   *  default is its secondary button at full width. */
  className?: string
}) {
  const en = locale === 'en'
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  // Back from Google can restore this page from the browser's page cache.
  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return
      started.current = false
      setPending(false)
      onPendingChange(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [onPendingChange])

  async function signIn() {
    if (disabled || started.current) return
    started.current = true
    setError(null)
    setPending(true)
    onPendingChange(true)
    // Urgent: the next thing this tab does is leave for accounts.google.com,
    // and a batched event would go with it. The server's `sign_in_settled` is
    // the other end — a start with no settle is a host who turned back.
    const context = {
      method: 'google' as const,
      surface,
      ...(creationKey ? { creation_key: creationKey } : {}),
    }
    track('sign_in_started', context, { urgent: true })
    const result = await signInWithGoogle({ next, locale })
    if (result.status === 'error') {
      started.current = false
      setPending(false)
      onPendingChange(false)
      setError(result.message)
      // The hand-off never began, so no `sign_in_settled` is coming and the
      // host is still here reading this. Distinguishes "Google refused us"
      // from "the host changed their mind at Google", which the gap alone
      // cannot.
      track('sign_in_blocked', context)
    }
  }

  const label = (
    <>
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <SiGoogle className="size-5" aria-hidden="true" />
      )}
      {pending
        ? en
          ? 'Opening Google…'
          : 'Google megnyitása…'
        : en
          ? 'Continue with Google'
          : 'Folytatás Google-lel'}
    </>
  )

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={signIn}
      >
        {label}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-2.5 text-[14px] leading-[1.5] text-pretty text-host-danger"
        >
          {error}
        </p>
      ) : null}
    </>
  )
}

/** The word between the two ways in. Everything about Google belongs above
 *  it, everything about the email link below. */
export function AuthDivider({ locale }: { locale: Locale }) {
  return (
    <p
      aria-hidden="true"
      className={`${HOST_KICKER_BASE} my-5 text-center text-white/65`}
    >
      {locale === 'en' ? 'or' : 'vagy'}
    </p>
  )
}
