export function EventListSkeleton() {
  return (
    <div className="mt-8 flex flex-col gap-3" aria-hidden="true">
      <div className="mb-1 h-3 w-16 animate-pulse rounded-md bg-muted-foreground/20" />
      <div className="skeleton h-28 animate-pulse rounded-2xl" />
      <div className="skeleton h-28 animate-pulse rounded-2xl" />
      <div className="skeleton h-28 animate-pulse rounded-2xl" />
    </div>
  )
}

export function ModerationGridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li
          key={i}
          className="skeleton aspect-square animate-pulse rounded-2xl"
        />
      ))}
    </ul>
  )
}
