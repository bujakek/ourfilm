import { LoadingStatus } from '@/components/loading-status'

export default function AdminLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <LoadingStatus title="Betöltés…" />
    </div>
  )
}
