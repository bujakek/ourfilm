import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The selected Flash Dot without its app-icon tile. On the dark navigation the
 * tile would become a faint second box, so the same geometry is cropped to the
 * glyph and given a small-size stroke correction.
 */
export function MenuMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="38 36 104 118"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M66 68A44 44 0 1 0 130.5 88"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        className="text-brand-cream"
      />
      <circle
        cx="96"
        cy="83"
        r="12.5"
        fill="currentColor"
        className="text-brand-dot"
      />
      <path
        d="M86 61L80.5 51.5M100 58L101.5 44M111 62L123.5 51"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        className="text-brand-flash"
      />
    </svg>
  )
}
