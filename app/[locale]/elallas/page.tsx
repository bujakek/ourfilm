import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/site/page-shell'
import { isLocale } from '@/lib/i18n'
import { LEGAL_EFFECTIVE_LABEL } from '@/lib/legal/config'
import { WITHDRAWAL_COPY } from '@/lib/legal/copy/forms'

import { WithdrawalForm } from './withdrawal-form'

export const metadata: Metadata = {
  title: `${WITHDRAWAL_COPY.title} — OurFilm`,
  description:
    'Elállási vagy felmondási nyilatkozat online közlése az OurFilm-szerződéssel kapcsolatban.',
  // Transactional, not informational: there is nothing here worth ranking, and
  // the informational half already lives in the ÁSZF's 8. section, which is
  // indexable. The five document pages are the exception, not this.
  robots: { index: false, follow: true },
}

type Props = { params: Promise<{ locale: string }> }

export default async function ElallasPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell locale={locale} eyebrow="ELÁLLÁS" title={WITHDRAWAL_COPY.title}>
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-accent">
            {LEGAL_EFFECTIVE_LABEL}
          </p>

          <div className="mt-6 space-y-3">
            {WITHDRAWAL_COPY.intro.map((paragraph) => (
              <p
                key={paragraph}
                className="leading-relaxed text-pretty text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <WithdrawalForm locale={locale} />
        </div>
      </section>
    </PageShell>
  )
}
