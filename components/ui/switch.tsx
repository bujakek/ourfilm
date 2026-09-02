import { cn } from '@/lib/utils'

export function SwitchTrack({
  checked,
  disabled = false,
  className,
}: {
  checked: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent/70' : 'bg-foreground/10',
        disabled && 'opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'absolute size-6 rounded-full bg-foreground transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1',
        )}
      />
    </span>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="inline-flex size-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      <SwitchTrack checked={checked} />
    </button>
  )
}
