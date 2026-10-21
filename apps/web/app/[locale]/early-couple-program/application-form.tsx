'use client'

import { Check, Loader2, Send } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'

import {
  submitEarlyCoupleApplication,
  type EarlyCoupleFormState,
} from './actions'
import { guestCountRanges } from '@/lib/early-couple'
import type { Locale } from '@/lib/i18n'
import { inputClassName, textareaClassName } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Tracking = Partial<
  Record<
    'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmContent' | 'utmTerm',
    string
  >
>

const formCopy = {
  en: {
    name: 'Your name',
    partnerName: "Your partner's name",
    optional: 'Optional',
    email: 'Email address',
    date: 'Wedding date',
    location: 'Wedding location',
    locationPlaceholder: 'City and country',
    guests: 'Estimated number of guests',
    guestsPlaceholder: 'Choose a range',
    why: 'Why would you like to try OurFilm?',
    whyPlaceholder:
      'A few honest sentences are enough. What are you hoping it adds to your wedding?',
    agreement:
      'I understand that, if selected, participation includes two short feedback calls with the founder — one before and one after our wedding. OurFilm may contact me about this application.',
    privacy:
      'We use these details only to review the application, contact you and run the program. No newsletter signup and no public testimonial are required.',
    submit: 'Apply for the program',
    submitting: 'Sending application…',
    success: 'Application received',
  },
  hu: {
    name: 'A neved',
    partnerName: 'A párod neve',
    optional: 'Nem kötelező',
    email: 'E-mail-cím',
    date: 'Az esküvő dátuma',
    location: 'Az esküvő helyszíne',
    locationPlaceholder: 'Város és ország',
    guests: 'Várható vendégszám',
    guestsPlaceholder: 'Válassz egy tartományt',
    why: 'Miért próbálnátok ki az OurFilmet?',
    whyPlaceholder:
      'Néhány őszinte mondat elég. Mit reméltek tőle az esküvőtökön?',
    agreement:
      'Tudomásul veszem, hogy bekerülés esetén a részvétel két rövid, az alapítóval folytatott visszajelző beszélgetést jelent — egyet az esküvő előtt, egyet utána. Az OurFilm kapcsolatba léphet velem a jelentkezés miatt.',
    privacy:
      'Az adatokat kizárólag a jelentkezés elbírálására, a kapcsolattartásra és a program lebonyolítására használjuk. Nem iratkozol fel hírlevélre, és nyilvános véleményt sem kérünk cserébe.',
    submit: 'Jelentkezünk a programba',
    submitting: 'Jelentkezés küldése…',
    success: 'Megérkezett a jelentkezés',
  },
} as const

const initialState: EarlyCoupleFormState = { status: 'idle' }

export function EarlyCoupleApplicationForm({
  locale,
  minDate,
  tracking,
}: {
  locale: Locale
  minDate: string
  tracking: Tracking
}) {
  const copy = formCopy[locale]
  const [state, action, pending] = useActionState(
    submitEarlyCoupleApplication,
    initialState,
  )
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!pending) submittingRef.current = false
  }, [pending])

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="flex min-h-80 flex-col items-center justify-center rounded-[28px] bg-site-surface px-6 py-12 text-center sm:px-10"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-white/8">
          <Check
            className="size-8 text-white"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </span>
        <h2 className="landing-serif mt-6 font-landing-display text-[28px] leading-[1.2] text-balance text-white">
          {copy.success}
        </h2>
        <p className="mt-3 max-w-md text-[16px] leading-[1.6] text-pretty text-site-muted">
          {state.message}
        </p>
      </div>
    )
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (submittingRef.current) event.preventDefault()
        submittingRef.current = true
      }}
      className="rounded-[28px] bg-site-surface p-6 sm:p-9"
    >
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(tracking).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={copy.name}
          name="name"
          autoComplete="name"
          maxLength={120}
        />
        <Field
          label={copy.partnerName}
          hint={copy.optional}
          name="partnerName"
          autoComplete="off"
          maxLength={120}
          required={false}
        />
        <Field
          label={copy.email}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={320}
        />
        <Field label={copy.date} name="weddingDate" type="date" min={minDate} />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field
          label={copy.location}
          name="weddingLocation"
          autoComplete="off"
          placeholder={copy.locationPlaceholder}
          maxLength={160}
        />
        <label className="block text-[14px] font-medium text-white">
          {copy.guests}
          <select
            required
            name="guestCountRange"
            defaultValue=""
            className={cn(inputClassName, 'mt-2 px-4')}
          >
            <option value="" disabled>
              {copy.guestsPlaceholder}
            </option>
            {guestCountRanges.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 block text-[14px] font-medium text-white">
        {copy.why}
        <textarea
          required
          name="whyInterested"
          minLength={10}
          maxLength={2_000}
          rows={5}
          placeholder={copy.whyPlaceholder}
          className={cn(textareaClassName, 'mt-2 px-4 py-3')}
        />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[16px] bg-white/6 p-4 text-[14px] leading-[1.6] text-white/85">
        <input
          required
          type="checkbox"
          name="agreementAccepted"
          value="accepted"
          className="mt-0.5 size-4 shrink-0 accent-white"
        />
        <span>{copy.agreement}</span>
      </label>

      {state.status === 'error' ? (
        <p role="alert" className="mt-5 text-[14px] text-host-danger">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-white px-6 text-[16px] font-medium text-landing-ink transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-5" strokeWidth={1.8} aria-hidden="true" />
        )}
        {pending ? copy.submitting : copy.submit}
      </button>
      <p className="mt-4 text-center text-[13px] leading-[1.6] text-pretty text-site-muted">
        {copy.privacy}
      </p>
    </form>
  )
}

function Field({
  label,
  hint,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  maxLength,
  min,
  required = true,
}: {
  label: string
  hint?: string
  name: string
  type?: string
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  min?: string
  required?: boolean
}) {
  return (
    <label className="block text-[14px] font-medium text-white">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        {hint ? (
          <span className="text-[12px] font-normal text-site-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <input
        required={required}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        className={cn(inputClassName, 'mt-2 px-4')}
      />
    </label>
  )
}
