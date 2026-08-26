import { DraftNotice } from '@/components/site/draft-notice'
import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails, LAST_UPDATED } from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Jogsértő tartalom bejelentése — OurFilm',
  description:
    'Elektronikus bejelentési út az OurFilm eseményeiben található jogsértő tartalomhoz.',
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

const reportTemplate = [
  'Esemény linkje:',
  'A kifogásolt kép pontos azonosítása vagy képernyőképe:',
  'Miért jogellenes a tartalom:',
  'Mely jogot vagy jogszabályt sértheti:',
  'Bejelentő neve:',
  'Kapcsolattartási e-mail-cím:',
  '',
  'Kijelentem, hogy jóhiszeműen és pontosnak tartott információk alapján teszem a bejelentést.',
].join('\n')

const reportMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Jogsértő tartalom bejelentése – OurFilm',
)}&body=${encodeURIComponent(reportTemplate)}`

type Props = { params: Promise<{ locale: string }> }

export default async function IllegalContentReportPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="TARTALOMBEJELENTÉS"
      title="Jogsértő tartalom bejelentése"
      lead="Ha egy OurFilm-eseményben jogellenes képet találtál, itt tudod pontosan jelezni."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              Indulás előtt ellenőrizd, hogy a <strong>{CONTACT_EMAIL}</strong>{' '}
              postafiókot rendszeresen figyeli valaki, és a bejelentésekre
              indokolással válaszol.
            </DraftNotice>
          )}

          <div className="mt-12 space-y-5 leading-relaxed text-pretty text-muted-foreground">
            <p>
              A leggyorsabb megoldás általában az esemény házigazdája, aki a
              képet azonnal elrejtheti. Nekünk is bejelentheted, ha úgy
              gondolod, hogy egy kép jogellenes vagy sérti a jogaidat.
            </p>
            <p>A bejelentésben add meg:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>az esemény linkjét;</li>
              <li>a kép pontos azonosítását vagy képernyőképét;</li>
              <li>
                közérthető és kellően alátámasztott indoklást arról, miért
                jogellenes;
              </li>
              <li>a nevedet és a kapcsolattartási e-mail-címedet;</li>
              <li>
                jóhiszemű nyilatkozatot arról, hogy az információid pontosak és
                teljesek.
              </li>
            </ul>

            <a
              href={reportMailto}
              className="btn-shine inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Bejelentés elküldése e-mailben
            </a>

            <p>
              A bejelentés beérkezését visszaigazoljuk, megvizsgáljuk a megadott
              információkat, és a döntésről, valamint annak indokáról a megadott
              e-mail-címen tájékoztatunk. Hiányos bejelentésnél pontosítást
              kérhetünk. A bejelentő adatait csak a bejelentés kezeléséhez és a
              szükséges jogi eljárásokhoz használjuk.
            </p>
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            Utolsó frissítés: {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
