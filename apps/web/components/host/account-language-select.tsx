'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import { updateHostLocale } from '@/app/(product)/host/account/actions'
import { inputClassName } from '@/components/ui/input'
import { type Locale, localeLabel, locales } from '@/lib/i18n'

/**
 * The language of everything OurFilm shows or sends the host: these screens,
 * the event emails and Stripe's page. Guests are unaffected — the guest page
 * follows each guest's own phone.
 *
 * Saved on change, then the page re-renders in the new language.
 */
export function AccountLanguageSelect({ locale }: { locale: Locale }) {
  const id = useId()
  const router = useRouter()
  const en = locale === 'en'
  const [value, setValue] = useState<Locale>(locale)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {en ? 'Language' : 'Nyelv'}
      </label>
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Locale
          const previous = value
          setValue(next)
          setError(false)
          startTransition(async () => {
            try {
              await updateHostLocale(next)
              router.refresh()
            } catch {
              setValue(previous)
              setError(true)
            }
          })
        }}
        className={`${inputClassName} mt-1.5 h-11`}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {localeLabel[option]}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        {error
          ? en
            ? 'Could not save. Try again.'
            : 'Nem sikerült menteni. Próbáld újra.'
          : en
            ? 'Used for these screens and the emails we send you. Guests see OurFilm in their own phone’s language.'
            : 'Ezen a nyelven látod a felületet és kapod tőlünk az e-maileket. A vendégek a saját telefonjuk nyelvén látják az OurFilmet.'}
      </p>
    </div>
  )
}
