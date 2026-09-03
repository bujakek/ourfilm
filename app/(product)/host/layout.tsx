import { PageGrain } from '@/components/site/page-grain'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <PageGrain />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
