import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/site/page-shell'
import { isLocale } from '@/lib/i18n'
import { LEGAL_EFFECTIVE_LABEL } from '@/lib/legal/config'
import { REPORT_COPY } from '@/lib/legal/copy/forms'

import { ReportForm } from './report-form'

export const metadata: Metadata = {
  title: `${REPORT_COPY.title} — OurFilm`,
  description:
    'Jogsértő vagy jogellenes tartalom bejelentése egy OurFilm-eseményben.',
  // A complaint intake. Nothing to rank, and the route is reached from the
  // ÁSZF, the guest terms and the footer rather than from a search result.
  robots: { index: false, follow: true },
}

type Props = { params: Promise<{ locale: string }> }

export default async function ReportPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell locale={locale} eyebrow="BEJELENTÉS" title={REPORT_COPY.title}>
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-accent">
            {LEGAL_EFFECTIVE_LABEL}
          </p>

          <p className="mt-6 leading-relaxed text-pretty text-muted-foreground">
            {REPORT_COPY.intro}
          </p>

          <p className="glass mt-4 rounded-2xl px-5 py-4 text-sm leading-relaxed text-pretty text-muted-foreground">
            {REPORT_COPY.helper}
          </p>

          <ReportForm />
        </div>
      </section>
    </PageShell>
  )
}
