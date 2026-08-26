'use client'

import { Check, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { submitReport } from './actions'
import { REPORT_COPY } from '@/lib/legal/copy/forms'

/**
 * A single-step form, unlike the withdrawal declaration.
 *
 * The asymmetry is deliberate. A withdrawal is a legal act with a timestamp
 * that cannot be taken back, so it gets a confirmation step. A report starts a
 * review that a human reads — an imprecise one costs a follow-up email, not a
 * right — and putting an extra screen in front of someone reporting a photo
 * they find distressing is the wrong trade.
 */
type Fields = {
  reporterName: string
  reporterEmail: string
  eventReference: string
  contentReference: string
  reason: string
  legalBasis: string
}

const EMPTY: Fields = {
  reporterName: '',
  reporterEmail: '',
  eventReference: '',
  contentReference: '',
  reason: '',
  legalBasis: '',
}

export function ReportForm() {
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [goodFaith, setGoodFaith] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }))

  if (done) {
    return (
      <div className="glass mt-10 rounded-3xl px-6 py-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/20">
          <Check className="size-6 text-accent" strokeWidth={2.2} />
        </span>
        <p className="mt-5 leading-relaxed text-pretty text-muted-foreground">
          {REPORT_COPY.successBody}
        </p>
      </div>
    )
  }

  return (
    <form
      className="mt-10 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await submitReport({ ...fields, goodFaith })
          if (result.ok) setDone(true)
          else setError(result.error)
        })
      }}
    >
      <Field
        label={REPORT_COPY.labels.name}
        value={fields.reporterName}
        onChange={set('reporterName')}
        autoComplete="name"
      />
      <Field
        label={REPORT_COPY.labels.email}
        value={fields.reporterEmail}
        onChange={set('reporterEmail')}
        type="email"
        autoComplete="email"
      />
      <Field
        label={REPORT_COPY.labels.event}
        value={fields.eventReference}
        onChange={set('eventReference')}
      />
      <Field
        label={REPORT_COPY.labels.content}
        value={fields.contentReference}
        onChange={set('contentReference')}
        multiline
      />
      <Field
        label={REPORT_COPY.labels.reason}
        value={fields.reason}
        onChange={set('reason')}
        multiline
      />
      <Field
        label={REPORT_COPY.labels.basis}
        value={fields.legalBasis}
        onChange={set('legalBasis')}
        multiline
      />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={goodFaith}
          required
          onChange={(e) => setGoodFaith(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="text-sm leading-relaxed text-pretty">
          {REPORT_COPY.goodFaith}
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-shine inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {REPORT_COPY.submit}
      </button>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  multiline?: boolean
  autoComplete?: string
}) {
  const shared =
    'glass w-full rounded-2xl px-5 py-3.5 text-base outline-none placeholder:text-muted-foreground/50 focus:border-accent'

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          required
          rows={4}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
        />
      ) : (
        <input
          type={type}
          value={value}
          required
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`${shared} min-h-13`}
        />
      )}
    </label>
  )
}
