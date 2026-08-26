'use client'

import { Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { submitWithdrawal } from './actions'
import { WITHDRAWAL_COPY } from '@/lib/legal/copy/forms'
import type { Locale } from '@/lib/i18n'
import { legalHref } from '@/lib/legal/routes'

/**
 * Declare, check, confirm.
 *
 * The middle step is not friction for its own sake: this declaration is
 * irrevocable once it lands — it is a legal statement with a timestamp — and
 * the fields it turns on are two identifiers that are easy to mistype. The
 * ÁSZF promises the record is made "azonnal" on confirmation, so the last
 * button is the only one that writes anything.
 */
type Stage = 'form' | 'confirm' | 'done'

type Fields = {
  fullName: string
  orderReference: string
  email: string
  note: string
}

const EMPTY: Fields = { fullName: '', orderReference: '', email: '', note: '' }

export function WithdrawalForm({ locale }: { locale: Locale }) {
  const [stage, setStage] = useState<Stage>('form')
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }))

  if (stage === 'done') {
    return (
      <div className="glass mt-10 rounded-3xl px-6 py-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/20">
          <Check className="size-6 text-accent" strokeWidth={2.2} />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-balance">
          {WITHDRAWAL_COPY.successHeading}
        </h2>
        <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
          {WITHDRAWAL_COPY.successBody}
        </p>
      </div>
    )
  }

  if (stage === 'confirm') {
    return (
      <div className="glass mt-10 rounded-3xl px-6 py-8">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {WITHDRAWAL_COPY.confirmHeading}
        </h2>
        <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
          {WITHDRAWAL_COPY.confirmBody}
        </p>

        <dl className="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <Summary term={WITHDRAWAL_COPY.labels.name} value={fields.fullName} />
          <Summary
            term={WITHDRAWAL_COPY.labels.order}
            value={fields.orderReference}
          />
          <Summary term={WITHDRAWAL_COPY.labels.email} value={fields.email} />
          {fields.note ? (
            <Summary term={WITHDRAWAL_COPY.labels.note} value={fields.note} />
          ) : null}
        </dl>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                const result = await submitWithdrawal({
                  fullName: fields.fullName,
                  orderReference: fields.orderReference,
                  email: fields.email,
                  note: fields.note || undefined,
                })
                if (result.ok) setStage('done')
                else setError(result.error)
              })
            }
            className="btn-shine inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {WITHDRAWAL_COPY.confirmSubmit}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStage('form')}
            className="glass glass-hover inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-medium disabled:opacity-60"
          >
            Vissza
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="mt-10 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        setStage('confirm')
      }}
    >
      <Field
        label={WITHDRAWAL_COPY.labels.name}
        value={fields.fullName}
        onChange={set('fullName')}
        autoComplete="name"
        required
      />
      <Field
        label={WITHDRAWAL_COPY.labels.order}
        value={fields.orderReference}
        onChange={set('orderReference')}
        required
      />
      <Field
        label={WITHDRAWAL_COPY.labels.email}
        value={fields.email}
        onChange={set('email')}
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label={WITHDRAWAL_COPY.labels.note}
        value={fields.note}
        onChange={set('note')}
        multiline
      />

      <p className="text-sm text-muted-foreground">
        {/* The declaration is about a contract, so the document it is made
            under has to be one click away from the form itself. */}
        <Link
          href={legalHref(locale, 'terms')}
          className="underline underline-offset-4"
        >
          Általános Szerződési Feltételek
        </Link>
      </p>

      <button
        type="submit"
        className="btn-shine inline-flex min-h-12 items-center justify-center self-start rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        {WITHDRAWAL_COPY.submit}
      </button>
    </form>
  )
}

function Summary({ term, value }: { term: string; value: string }) {
  return (
    <div className="contents">
      <dt className="font-medium text-foreground">{term}:</dt>
      <dd className="text-pretty text-muted-foreground">{value}</dd>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  multiline = false,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  multiline?: boolean
  autoComplete?: string
}) {
  const shared =
    'glass w-full rounded-2xl px-5 py-3.5 text-base outline-none placeholder:text-muted-foreground/50 focus:border-accent'

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          required={required}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
        />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`${shared} min-h-13`}
        />
      )}
    </label>
  )
}
