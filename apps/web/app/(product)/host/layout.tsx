import { HostToastProvider } from '@/components/host/ui/toast'
import { PageGrain } from '@/components/site/page-grain'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh]">
      <PageGrain />
      <HostToastProvider>
        <div className="relative z-10">{children}</div>
      </HostToastProvider>
    </div>
  )
}
