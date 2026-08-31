import { BackgroundGlow } from '@/components/site/background-glow'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
