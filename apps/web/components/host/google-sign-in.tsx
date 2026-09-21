'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SiGoogle } from 'react-icons/si'

import { Button } from '@/components/ui/button'
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
}: {
  locale: Locale
  surface: 'login' | 'onboarding'
  next: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
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
    track('sign_in_started', { method: 'google', surface }, { urgent: true })
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
      track('sign_in_blocked', { method: 'google', surface })
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={signIn}
      >
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
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )
}

/** The line between the two ways in. Everything about Google belongs above
 *  it, everything about the email link below. */
export function AuthDivider({ locale }: { locale: Locale }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {locale === 'en' ? 'or with email' : 'vagy e-maillel'}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
