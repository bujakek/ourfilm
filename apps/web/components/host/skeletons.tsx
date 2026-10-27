import { ListHeader } from '@/components/host/event-list'

/**
 * The event list before its data, in the list's own geometry: the header as it
 * will be, two open cards and two album rows. Flat fills that pulse, no text.
 */
export function EventListSkeleton({ locale }: { locale: 'en' | 'hu' }) {
  return (
    <>
      <ListHeader locale={locale} />
      <div aria-hidden="true">
        <div className="mx-5 mt-7 h-4 w-20 animate-pulse rounded-md bg-white/6" />
        <div className="mt-3 flex gap-3 overflow-hidden px-5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] w-[276px] shrink-0 animate-pulse rounded-[32px] bg-host-panel"
            />
          ))}
        </div>
        <div className="mx-5 mt-10 border-t border-dashed border-white/12 pt-7">
          <div className="h-4 w-24 animate-pulse rounded-md bg-white/6" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="px-5 pt-5 pb-2">
            <div className="flex items-baseline gap-3">
              <div className="h-7 flex-1 animate-pulse rounded-md bg-white/6" />
              <div className="h-4 w-20 animate-pulse rounded-md bg-white/6" />
            </div>
            <div className="flex h-[164px] pt-4">
              {[0, 1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="-mr-3.5 h-[132px] w-24 shrink-0 animate-pulse rounded-[18px] bg-host-tile"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
