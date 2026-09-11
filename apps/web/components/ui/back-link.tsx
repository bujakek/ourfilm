import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The one way back, drawn the same everywhere.
 *
 * There were four of these, and they differed in every dimension that is
 * supposed to be a decision: the arrow was 14, 16, 19 and 20 pixels, the text
 * was `xs` or `sm`, the colour was `muted-foreground` or `foreground/55`, and
 * one of them had no minimum height at all — on the event page, which is the
 * screen a host opens mid-party with one thumb in a dim room.
 *
 * **The label is deliberately not standardised.** It names the destination —
 * the event's own name on its settings screen, "Eseményeid" above an event —
 * because "Back" is the one thing a host already knows. Only the shape is
 * fixed here; what it says is the caller's to decide.
 *
 * The onboarding flow keeps its own icon-only square
 * (`onboarding-shell.tsx`) and is not a caller. It goes back through *state*
 * rather than to a URL, it sits in a full-bleed header with a progress
 * counter, and there is no destination it could name.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string
  /** Where this goes, in the host's words. Not "Back". */
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft
        className="size-4 shrink-0"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {children}
    </Link>
  )
}
