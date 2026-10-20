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
