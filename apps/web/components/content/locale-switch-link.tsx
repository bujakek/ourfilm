'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

import type { Locale } from '@/lib/i18n'
import { rememberLocalePreference } from '@/lib/locale-preference'

/** A link to another language that also remembers the choice for `/`. */
export function LocaleSwitchLink({
  locale,
  ...props
}: Omit<ComponentProps<typeof Link>, 'hrefLang' | 'onClick'> & {
  locale: Locale
}) {
  return (
    <Link
      {...props}
      hrefLang={locale}
      onClick={() => rememberLocalePreference(locale)}
    />
  )
}
