import { Loader2 } from 'lucide-react'

/**
 * Centered status while a route is exchanging a session or waiting on data.
 * The title is live for screen readers so a blank tab is never silent.
 */
export function LoadingStatus({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent/20">
        <div className="animate-spin">
          <Loader2 className="size-7 text-accent" strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-lg font-semibold" role="status" aria-live="polite">
        {title}
      </p>
      {description ? (
        <p className="max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
