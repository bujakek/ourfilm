import { MenuMark } from '@/components/brand/menu-mark'
import type { ContentDoc } from '@/lib/content/types'
import { formatPostDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Who wrote it and when: the mark and the author, the date on the right. */
export function PostByline({
  doc,
  className,
}: {
  doc: ContentDoc
  className?: string
}) {
  const date = doc.updatedAt ?? doc.publishedAt
  return (
    <span
      className={cn(
        'flex items-center justify-between gap-2.5 text-[14px] leading-[1.5]',
        className,
      )}
    >
      <span className="flex items-center gap-2 font-medium text-white">
        <MenuMark className="h-5 w-[18px]" />
        {doc.author ?? 'OurFilm'}
      </span>
      <time
        dateTime={date}
        className="text-[12px] whitespace-nowrap text-site-kicker tab:text-[13px]"
      >
        {formatPostDate(date, doc.locale as Locale)}
      </time>
    </span>
  )
}
