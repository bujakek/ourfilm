import { PencilRuler } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Marks a page whose copy is still scaffolding.
 *
 * Deliberately loud: these pages are reachable from the footer, so a visitor
 * must never mistake illustrative numbers or placeholder legal text for a real
 * commitment. Delete the notice — and the `robots.index: false` on the same
 * page — in the change that lands the final copy.
 */
export function DraftNotice({ children }: { children: ReactNode }) {
  return (
    <div className="glass flex gap-3 rounded-2xl border border-accent/25 px-5 py-4">
      <PencilRuler
        className="mt-0.5 size-5 shrink-0 text-accent"
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {children}
      </p>
    </div>
  )
}
