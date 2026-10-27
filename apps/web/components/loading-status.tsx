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
      <div className="flex size-14 items-center justify-center rounded-full bg-host-tile">
        <div className="animate-spin">
          <Loader2 className="size-6 text-white" strokeWidth={2} />
        </div>
      </div>
      <p
        className="text-[16px] leading-[1.5] font-medium text-white"
        role="status"
        aria-live="polite"
      >
        {title}
      </p>
      {description ? (
        <p className="max-w-xs text-[14px] leading-[1.5] text-pretty text-white/65">
          {description}
        </p>
      ) : null}
    </div>
  )
}
