import { CalendarClock } from 'lucide-react'

/**
 * How long this album stays, on the screen where a host would look for it.
 *
 * Static text, not a control: the retention period is a term of the ÁSZF
 * rather than a setting, and the only thing a host can do about it is download
 * their photographs. Which is why the grace-period wording says exactly that
 * and nothing else.
 */
export function RetentionCard({
  heading,
  detail,
  urgent,
}: {
  heading: string
  detail: string
  /** Grace period or past it — the two states where doing nothing loses data. */
  urgent: boolean
}) {
  return (
    <div
      className={`glass rounded-2xl px-5 py-4 ${urgent ? 'border border-accent/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <CalendarClock className="size-5 text-accent" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{heading}</p>
          <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </div>
  )
}
