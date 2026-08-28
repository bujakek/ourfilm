import { DraftNotice } from '@/components/site/draft-notice'
import {
  LegalSections,
  type LegalSection,
} from '@/components/site/legal-sections'
import { PageShell } from '@/components/site/page-shell'
import {
  COMPANY,
  REGISTRY,
  VAT_STATUS,
  hasRealCompanyDetails,
  HOSTING_PROVIDER,
  LAST_UPDATED,
  PAYMENT_PROCESSOR,
} from '@/lib/company'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'ÁSZF — OurFilm',
  description:
    'Az OurFilm általános szerződési feltételei házigazdák és vendégek számára.',
  // Indexable as soon as the company details are real; see lib/company.ts.
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

// Built against 45/2014. (II. 26.) Korm. rendelet and the Elker tv. rather
// than a competitor's terms — none of the comparable services are Hungarian.
// The mandatory identifiers come from lib/company.ts; everything else is
// written to match what the product actually does.
const sections: LegalSection[] = [
  {
    title: 'A szolgáltató',
    body: [
      `Név: ${COMPANY.name}. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber}, nyilvántartó hatóság: ${REGISTRY}. Adószám: ${COMPANY.taxNumber}. A szolgáltató egyéni vállalkozó.`,
      `Telefonszám: ${COMPANY.phone}. E-mail: ${CONTACT_EMAIL}. Szakmai kamara: ${COMPANY.chamber}.`,
      `Tárhelyszolgáltató: ${HOSTING_PROVIDER}.`,
    ],
  },
  {
    title: 'Mire jó a szolgáltatás',
    body: [
      'A házigazda létrehoz egy eseményt, és kap hozzá egy QR-kódot és egy linket. A vendégek beolvassák, és a telefonjuk böngészőjéből feltöltik a fotóikat egy közös albumba. A házigazda az albumot megnézheti, moderálhatja, és egyben letöltheti.',
      'A vendégeknek nem kell alkalmazást telepíteniük és nem kell regisztrálniuk. A csatlakozáskor egy nevet adnak meg, amely a feltöltött képeik mellett jelenik meg.',
      'A szolgáltatás böngészőn keresztül érhető el. Nem vállaljuk, hogy minden böngésző minden verziójában működik, de a jelenleg támogatott mobil böngészők legfrissebb változataira tervezzük.',
    ],
  },
  {
    title: 'A szerződés létrejötte',
    body: [
      'A szerződés akkor jön létre, amikor a házigazda a belépési linkkel azonosítja magát és létrehozza az első eseményét. A szerződés magyar nyelven jön létre, nem minősül írásba foglalt szerződésnek, és nem iktatjuk.',
      'Az ÁSZF elfogadása a szolgáltatás használatának feltétele.',
    ],
  },
  {
    title: 'A házigazda felelőssége',
    body: [
      'A házigazda dönti el, kivel osztja meg a QR-kódot és a linket. Aki megkapja, feltölthet és megnézheti az albumot. Az album címe véletlen karaktereket tartalmaz és a keresők elől ki van zárva, de aki a linket megkapta, továbbadhatja.',
      'A házigazda felel azért, hogy a vendégek és a fotókon szereplő személyek tudjanak róla, hogy a képek közös albumba kerülnek. Ehhez a nyomtatható QR-kártya tájékoztató szövege adja a legegyszerűbb eszközt, de a meghívóban is jelezhető.',
      'A házigazda moderálhatja az albumot: bármelyik fotót elrejtheti, és az egész eseményt véglegesen törölheti.',
      'Az esemény fotói tekintetében a házigazda az adatkezelő, a szolgáltató pedig az adatfeldolgozó. A részleteket az Adatkezelési tájékoztató tartalmazza.',
    ],
  },
  {
    title: 'A feltöltött tartalom',
    body: [
      'A fotók szerzői joga a feltöltőt illeti. A feltöltéssel a felhasználó azt a nem kizárólagos engedélyt adja meg, amely a képek tárolásához, az albumban való megjelenítéséhez és a letöltés biztosításához szükséges. Ezen túl semmilyen felhasználási jogot nem szerzünk: a képeket nem használjuk marketingre, nem adjuk tovább és nem értékesítjük.',
      'Tilos olyan tartalmat feltölteni, amely jogszabályt sért, mások jogait sérti, erőszakos, gyűlöletkeltő vagy szexuális tartalmú, illetve amelynek feltöltésére a felhasználónak nincs joga.',
      'A jogsértő tartalmat bejelentés esetén eltávolítjuk, és súlyos vagy ismételt esetben az eseményt felfüggeszthetjük.',
    ],
  },
  {
    title: 'Elérhetőség és korlátozások',
    body: [
      'A szolgáltatás folyamatos elérhetőségére törekszünk, de nem vállalunk üzemidő-garanciát. Karbantartás miatti szünetről lehetőség szerint előre értesítünk.',
      'A feltölthető fájlok mérete és formátuma korlátozott. A rendeltetésszerű használatot jelentősen meghaladó terhelés esetén jogosultak vagyunk a feltöltést átmenetileg korlátozni.',
      'Jogosultak vagyunk a szolgáltatást felfüggeszteni, ha a használat jogszabályt vagy jelen ÁSZF-et sért.',
    ],
  },
  {
    title: 'Díjak és fizetés',
    body: [
      `A mindenkori díjakat az Árak oldal tartalmazza. ${VAT_STATUS.priceNote}`,
      'Az esemény létrehozása, a QR-kód, a közös album és az album letöltése díjmentes legfeljebb az Árak oldalon megadott számú résztvevőig. A díj ezt a résztvevői korlátot oldja fel: kifizetése után az adott eseményhez korlátlan számú vendég csatlakozhat. A díj eseményenként egyszeri, nem előfizetés, és a vendégek soha nem fizetnek semmit.',
      'A díj akkor esedékes, amikor a házigazda a korlát feloldását megrendeli. A feloldás az adott eseményre szól, és nem jár le.',
      `A fizetést a ${PAYMENT_PROCESSOR.name} (${PAYMENT_PROCESSOR.address}) mint fizetési szolgáltató bonyolítja. A fizetés és a számlázási adatok megadása a Stripe saját, biztonságos oldalán történik: a bankkártya adatait nem látjuk, nem kezeljük és nem tároljuk. A Stripe-tól a tranzakció adatai mellett a számla kiállításához szükséges nevet, e-mail-címet, magyar postacímet és céges vásárlásnál az adószámot kapjuk meg.`,
      `A fizetésről számlát állítunk ki, amelyet e-mailben küldünk meg. A számla az ${VAT_STATUS.code} (${VAT_STATUS.label}) jelölést tartalmazza, mert a szolgáltató áfát nem számít fel.`,
      'A már megkezdett esemény díja nem kerül visszatérítésre, kivéve az alábbi elállási jogot és a hibás teljesítés eseteit.',
    ],
  },
  {
    title: 'Elállási jog',
    body: [
      'A fogyasztót a szerződéskötéstől számított 14 napon belül indokolás nélküli elállási jog illeti meg.',
      'A szolgáltatás nem tárgyi adathordozón nyújtott digitális szolgáltatás. Ha a fogyasztó kifejezetten kéri a teljesítés 14 napon belüli megkezdését, és egyidejűleg nyilatkozik arról, hogy tudomásul veszi: a teljesítés megkezdése után az elállási jogát elveszíti, akkor a szolgáltatás igénybevételének megkezdésével az elállási jog megszűnik. A fogyasztó ezt a Stripe fizetési oldalán megjelenő kötelező nyilatkozat elfogadásával kéri és veszi tudomásul.',
      'Elállás esetén a díjat legkésőbb 14 napon belül visszatérítjük, ugyanolyan fizetési módon, ahogyan érkezett.',
      `Az elállást a ${CONTACT_EMAIL} címre küldött nyilatkozattal lehet közölni.`,
    ],
  },
  {
    title: 'Felelősség és adatvesztés',
    body: [
      'A szolgáltatás nem helyettesíti a fotók saját biztonsági mentését. Javasoljuk, hogy a házigazda az esemény után töltse le az albumot, és tárolja saját másolatban.',
      'Nem felelünk a felhasználók által feltöltött tartalomért, sem azért a kárért, amely a link vagy a QR-kód harmadik személynek való továbbadásából ered.',
      'Felelősségünk a szándékosan okozott, valamint az emberi életet, testi épséget vagy egészséget megkárosító szerződésszegésért fennálló felelősség kivételével a szolgáltatásért fizetett díj összegére korlátozódik.',
    ],
  },
  {
    title: 'Panaszkezelés és jogorvoslat',
    body: [
      `Panaszt a ${CONTACT_EMAIL} címen vagy a fenti telefonszámon lehet bejelenteni. A panaszt 30 napon belül kivizsgáljuk és írásban megválaszoljuk.`,
      'Ha a panaszt elutasítjuk, a fogyasztó a lakóhelye szerint illetékes békéltető testülethez fordulhat. A testületek elérhetősége a bekeltetes.hu oldalon található. Kijelentjük, hogy a békéltető testületi eljárásban együttműködünk.',
      'A fogyasztó a fogyasztóvédelmi hatósághoz is fordulhat: a járási hivatalok látják el ezt a feladatot, elérhetőségük a jarasinfo.gov.hu oldalon található.',
      'Online vitarendezésre az Európai Bizottság platformja is igénybe vehető.',
    ],
  },
  {
    title: 'A feltételek módosítása',
    body: [
      'Az ÁSZF módosításáról a hatálybalépés előtt legalább 15 nappal e-mailben értesítjük a házigazdákat. Ha a módosítást nem fogadja el, a szerződést a hatálybalépésig felmondhatja.',
      'A már létrehozott eseményekre a létrehozáskor hatályos feltételek maradnak irányadók.',
    ],
  },
  {
    title: 'Egyéb rendelkezések',
    body: [
      'A jelen ÁSZF-ben nem szabályozott kérdésekben a magyar jog, különösen a Polgári Törvénykönyv, az Elker tv. (2001. évi CVIII. törvény) és a 45/2014. (II. 26.) Korm. rendelet rendelkezései irányadók.',
      'Az adatkezelésre vonatkozó szabályokat az Adatkezelési tájékoztató tartalmazza.',
    ],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function AszfPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ÁSZF"
      title="Általános szerződési feltételek"
      lead="Mit vállalunk, mit vársz el tőlünk, és mi az, amiért a házigazda felel."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Hiányoznak a vállalkozás adatai.
              </strong>{' '}
              A szöveg kész, de a szögletes zárójeles helyek ([NÉV],
              [NYILVÁNTARTÁSI SZÁM], [ADÓSZÁM] és társaik) valódi adatra
              cserélendők a <code>lib/company.ts</code> fájlban. Amíg ez nem
              történik meg, az oldal nem jelenik meg a keresőkben.
            </DraftNotice>
          )}

          <LegalSections sections={sections} />

          <p className="mt-12 text-sm text-muted-foreground">
            Utolsó frissítés: {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
