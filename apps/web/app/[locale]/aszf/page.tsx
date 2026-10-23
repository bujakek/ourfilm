import { DraftNotice } from '@/components/site/draft-notice'
import {
  LegalSections,
  type LegalSection,
} from '@/components/site/legal-sections'
import { PageShell } from '@/components/site/page-shell'
import {
  COMPANY,
  REGISTRY,
  hasRealCompanyDetails,
  HOSTING_PROVIDER,
  TERMS_LAST_UPDATED,
  DIRECT_SALE,
  PAYMENT_PROCESSOR,
} from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { EVENT_PRICE_LABEL, EVENT_PRICE_LABELS } from '@/lib/pricing'
import { CONTACT_EMAIL } from '@/lib/site'
import { localizedPageAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    title: locale === 'en' ? 'Terms of Service · OurFilm' : 'ÁSZF · OurFilm',
    description:
      locale === 'en'
        ? 'Terms governing the use of OurFilm by hosts and guests.'
        : 'Az OurFilm általános szerződési feltételei házigazdák és vendégek számára.',
    alternates: localizedPageAlternates(locale, '/aszf'),
    ...(hasRealCompanyDetails
      ? {}
      : { robots: { index: false, follow: true } }),
  }
}

// Bilingual service terms. Deploy the retention clauses only with the
// enforcement and transition process described in docs/photo-retention.md.
const sections: LegalSection[] = [
  {
    title: 'Szolgáltató és kapcsolat',
    body: [
      `Szolgáltató: ${COMPANY.name}. Székhely: ${COMPANY.seat}. Nyilvántartási szám: ${COMPANY.registryNumber}; nyilvántartó: ${REGISTRY}. Adószám: ${COMPANY.taxNumber}.`,
      `E-mail: ${CONTACT_EMAIL}. Tárhelyszolgáltató: ${HOSTING_PROVIDER}.`,
    ],
  },
  {
    title: 'Az OurFilm szolgáltatás',
    body: [
      'Az OurFilm egy eseményhez használható digitális eldobható fényképezőgép. A házigazda létrehozza az eseményt, beállítja a fotózási időszakot, a vendégenkénti képszámot és a képek felfedésének időpontját, majd QR-kódot vagy linket oszt meg a vendégekkel.',
      'A vendég alkalmazás és fiók nélkül, a mobilböngésző kamerájával készít képeket. Nincs előnézet és újrafotózás. A képek a beállított felfedési szabály szerint válnak láthatóvá. A házigazda az esemény képeit megtekintheti, elrejtheti, letöltheti, az eseményt pedig törölheti.',
      'A fotózási időszak alatt a vendégek közvetlenül a kamerával készíthetnek képeket. Ha a házigazda bekapcsolja az esemény utáni galériás feltöltést, a beállított fotózási időszak végét követő 24 órában a vendégek a telefonjukon már meglévő képeket is hozzáadhatják. Ez ugyanazt a vendégenkénti képkockakeretet használja, nem ad új tekercset, és nem módosítja a fotózási időszakot vagy a felfedés szabályait.',
      'A szolgáltatás használatához megfelelő eszköz, internetkapcsolat, támogatott böngésző és kameraengedély szükséges. Folyamatos, hibamentes elérhetőséget nem garantálunk.',
    ],
  },
  {
    title: 'Szerződéskötés és a használat feltételei',
    body: [
      'A házigazda e-mailben küldött belépési linkkel vagy választhatóan Google-fiókkal hozhat létre fiókot és jelentkezhet be. Azonos, ellenőrzött e-mail-cím esetén a Google-belépés a meglévő OurFilm-fiókhoz kapcsolódhat, így ugyanazok az események maradnak elérhetők. A Google-belépés önmagában nem jelent megrendelést, és nem helyettesíti az esemény létrehozásakor vagy a fizetős megrendeléskor kért feltétel-elfogadást. A belépési adatok kezelését az Adatkezelési tájékoztató ismerteti.',
      `A házigazda a feltételek elfogadásával és az esemény létrehozásával köt szerződést az OurFilmmel a digitális szolgáltatás használatára. A vendégkorlát megszüntetésére vonatkozó megrendelés a Stripe fizetési oldalán történő fizetéssel válik véglegessé. A magyar nyelvű eseményeknél az eladó az OurFilm: mi nyújtjuk a digitális szolgáltatást, mi állítjuk ki a számlát, és mi felelünk a megrendelésért. A szerződés magyar nyelven jön létre, nem minősül írásba foglalt szerződésnek, és külön nem iktatjuk.`,
      'A vendég a csatlakozással elfogadja a rá vonatkozó használati szabályokat, és tudomásul veszi az Adatkezelési tájékoztatót. A vendégtől nem kérünk díjat.',
      'A megrendelés előtt a házigazda a böngésző vissza gombjával vagy az OurFilm felületén módosíthatja a megadott adatokat. Az adatbeviteli hibákat a rendszer a létrehozás előtt jelzi.',
    ],
  },
  {
    title: 'Díj és fizetés',
    body: [
      `Az ingyenes eseményhez legfeljebb 5 vendég csatlakozhat. A teljes esemény magyarországi fogyasztói végösszege ${EVENT_PRICE_LABEL}; ez az adott eseménynél megszünteti a vendégkorlátot. Nem előfizetés, és nem jelent vendégenkénti díjat. Az alábbi feltételek a magyarországi számlázási címmel történő vásárlásra vonatkoznak, a felület nyelvétől függetlenül; Magyarországon kívüli számlázási cím esetén a vásárlás ${EVENT_PRICE_LABELS.en} áron, a ${PAYMENT_PROCESSOR.merchantOfRecord} közreműködésével, az angol nyelvű feltételek szerint történik.`,
      `A szolgáltató ${DIRECT_SALE.vatStatus}, ezért a feltüntetett ${EVENT_PRICE_LABEL} a fizetendő végösszeg. Az ár nem tartalmaz áfát, így abból áfa nem vonható le. A számla az „AAM” (alanyi adómentes) jelölést tartalmazza.`,
      `A fizetést a ${DIRECT_SALE.processorName} (${DIRECT_SALE.processorAddress}) fizetési szolgáltatóként dolgozza fel. A bankkártyaadatokat az OurFilm nem látja és nem tárolja. A számlázási névre és címre azért van szükség, mert a magyar számla kötelező tartalmi eleme.`,
      `A fizetés után a számlát az OurFilm állítja ki elektronikus számlaként, a ${DIRECT_SALE.invoiceProvider} számlázórendszerén keresztül, és a megadott e-mail-címre küldjük meg. A számlaadatokat a NAV Online Számla rendszerébe is továbbítjuk, ahogy azt jogszabály előírja. A vendégkorlátot a Stripe sikeres fizetési visszaigazolása után szüntetjük meg.`,
    ],
  },
  {
    title: 'Elállás és felmondás fogyasztóként',
    body: [
      `A fogyasztó a fizetős szerződés megkötésétől számított 14 napon belül indokolás nélkül gyakorolhatja elállási, illetve a szolgáltatás megkezdése után felmondási jogát. Az „Elállás a szerződéstől” funkció a magyar oldal láblécéből közvetlenül, bejelentkezés nélkül elérhető. A nyilatkozat a ${CONTACT_EMAIL} címen is közölhető.`,
      'Az online űrlap kitöltése után az „Elállás megerősítése” gomb küldi el a nyilatkozatot. A beérkezésről haladéktalanul, tartós adathordozón e-mailes elismervényt küldünk, amely tartalmazza a nyilatkozatot, valamint a megküldés dátumát és időpontját.',
      'A fizetéskor a fogyasztó kifejezetten kérheti, hogy a szolgáltatás a 14 napos időszak vége előtt megkezdődjön. Ha a fizetős szolgáltatást a nyilatkozat közléséig nem vették igénybe, vagyis az eseményhez az ingyenes ötfős kereten felül nem csatlakozott vendég, a teljes díjat visszatérítjük.',
      'Ha a fizetős szolgáltatás használata már megkezdődött, a nyilatkozat közléséig ténylegesen és arányosan teljesített szolgáltatás díja felszámítható. Ennek megállapításakor az esemény használatának körülményeit vizsgáljuk; önmagában egy meghatározott fotószám elérése vagy a képek letöltése, illetve le nem töltése nem automatikus kizáró feltétel.',
      'A 14 napos időszak után nincs általános, indokolás nélküli visszatérítési jog. Ez nem érinti a hibás teljesítésből vagy kötelező fogyasztóvédelmi szabályból eredő jogokat.',
      `A visszajáró összeget a nyilatkozat közlésétől számított legkésőbb 14 napon belül, az eredeti fizetési móddal, a Stripe rendszerén keresztül térítjük vissza, kivéve, ha a fogyasztó más módhoz kifejezetten hozzájárul. Teljes visszatérítés esetén a kiállított számlához sztornó számlát állítunk ki, és azt is megküldjük a megadott e-mail-címre.`,
    ],
  },
  {
    title: 'Elállási/felmondási nyilatkozatminta',
    body: [
      `Címzett: ${COMPANY.name}, ${COMPANY.seat}, ${CONTACT_EMAIL}. Kijelentem, hogy elállok/felmondom az alábbi szolgáltatás nyújtására irányuló szerződést: [esemény neve, linkje vagy fizetési azonosító]. Szerződéskötés időpontja: [dátum]. Fogyasztó neve: [név]. Fogyasztó címe: [cím]. Kelt: [hely, dátum]. Papíron tett nyilatkozat esetén: [aláírás].`,
      'A minta használata nem kötelező; bármely egyértelmű elállási vagy felmondási nyilatkozat elfogadható.',
    ],
  },
  {
    title: 'A házigazda és a vendég felelőssége',
    body: [
      'A házigazda felel azért, hogy a QR-kódot vagy eseménylinket csak a kívánt körrel ossza meg, és az esemény résztvevőit megfelelően tájékoztassa a közös fotózásról. A link birtokosa továbbadhatja azt, ezért az nem helyettesít külön hozzáférés-kezelést.',
      'Csak olyan képet szabad készíteni vagy feltölteni, amelynek elkészítésére és megosztására a felhasználó jogosult. Tilos a jogellenes, más jogát sértő, gyűlöletkeltő, súlyosan erőszakos vagy szexuális tartalom, valamint a szolgáltatás rendeltetésellenes használata.',
      'A felhasználó a kép szerzői vagy egyéb jogait nem ruházza át. A jogosult az OurFilmnek csak a szolgáltatás működtetéséhez szükséges, nem kizárólagos engedélyt adja a kép tárolására, megjelenítésére és letölthetővé tételére.',
    ],
  },
  {
    title: 'Jogsértő tartalom és korlátozás',
    body: [
      'Jogsértőnek vélt kép vagy eltávolítási kérés a Kapcsolat oldalon található űrlapon vagy e-mailben jelenthető. A kellően pontos bejelentést megvizsgáljuk, és ha jogszabály vagy az érintett joga indokolja, a tartalmat elérhetetlenné tesszük vagy eltávolítjuk. Szükség esetén a megadott elektronikus elérhetőségen kérünk pontosítást vagy adunk tájékoztatást.',
      'A házigazda bármely képet elrejthet. Súlyos vagy ismételt jogsértés, biztonsági kockázat vagy a szolgáltatás működését veszélyeztető használat esetén az érintett tartalmat vagy eseményt korlátozhatjuk.',
    ],
  },
  {
    title: 'A képek elérhetősége és megőrzése',
    body: [
      'Az esemény feltöltött képei a házigazda által beállított fotózási időszak végétől számított 12 naptári hónapig érhetők el és tölthetők le. Ez az ingyenes és a fizetős eseményekre is vonatkozik; a megőrzésért ezen időszakon belül nem számítunk fel külön díjat. A vendégek a képeket továbbra is csak a házigazda által engedélyezett hozzáférés és felfedés szerint láthatják.',
      'A 12 hónap elteltével a galéria elérhetősége megszűnik, és az esemény képeit, valamint a kapcsolódó esemény- és vendégadatokat töröljük az aktív szolgáltatásból. Az esemény utáni 24 órás galériás feltöltés és az egyes képek későbbi feltöltése nem indít új megőrzési időszakot.',
      'Ez a megőrzési szabály a jelen ÁSZF szerint létrehozott eseményekre vonatkozik. Korábban létrehozott eseménynél a létrehozáskor, illetve a vásárláskor elfogadott megőrzési feltételek irányadók.',
      'A házigazda az eseményt korábban is véglegesen törölheti. Ez nem érinti az érintettek törléshez való jogát, a jogsértő tartalom eltávolítását vagy az indokolt korlátozásokat. A gyorsítótárakra, biztonsági másolatokra és a jogszabály alapján megőrzendő adatokra az Adatkezelési tájékoztatóban leírt szabályok vonatkoznak.',
      'A házigazdának a megőrzési idő lejárta vagy az esemény korábbi törlése előtt le kell töltenie a megtartani kívánt képeket. Az OurFilm nem vállal korlátlan idejű tárolást; a törölt esemény és képek a szolgáltatásban nem állíthatók vissza.',
    ],
  },
  {
    title: 'Adatok, rendelkezésre állás és felelősség',
    body: [
      'Az OurFilm nem helyettesíti a saját biztonsági mentést. A házigazdának érdemes az esemény után letöltenie a képeket. Az esemény törlése végleges.',
      'A szolgáltató a jogszabályok szerint felel a hibás teljesítésért és az általa okozott károkért. Nem felel az ellenőrzési körén kívüli internet-, eszköz- vagy külső szolgáltatói hibáért, illetve a felhasználó jogellenes tartalmáért. A kötelező fogyasztói jogokat jelen feltételek nem korlátozzák.',
      'A személyes adatok kezelését az Adatkezelési tájékoztató ismerteti.',
    ],
  },
  {
    title: 'Panasz és jogorvoslat',
    body: [
      `Panasz a ${CONTACT_EMAIL} címen, postai úton a székhelyen vagy a fenti telefonszámon tehető. Az írásbeli panaszt 30 napon belül érdemben, írásban megválaszoljuk.`,
      `A magyar nyelvű eseményeknél a fizetéssel, a számlával és a visszatérítéssel kapcsolatos kérdésekért is az OurFilm felel; ezeket a fenti elérhetőségeken lehet jelezni.`,
      'A fogyasztó a lakóhelye vagy tartózkodási helye szerint illetékes békéltető testülethez fordulhat; az elérhetőségek a bekeltetes.hu oldalon találhatók. A szolgáltató a békéltető testületi eljárásban együttműködik. Fogyasztóvédelmi ügyben a fogyasztóvédelmi hatósághoz, jogvita esetén bírósághoz is lehet fordulni.',
    ],
  },
  {
    title: 'Módosítás és irányadó jog',
    body: [
      'A feltételek módosítását ezen az oldalon, az új frissítési dátummal tesszük közzé. A már kifizetett eseményre a megrendeléskor elfogadott változat irányadó, kivéve, ha jogszabály vagy a felhasználó számára kedvezőbb módosítás másként indokolja.',
      'A jelen ÁSZF-ben nem rendezett kérdésekre a magyar jog, különösen a Polgári Törvénykönyv, a 2001. évi CVIII. törvény és a 45/2014. (II. 26.) Korm. rendelet irányadó.',
    ],
  },
]

const englishSections: LegalSection[] = [
  {
    title: 'Provider and contact',
    body: [
      `OurFilm is provided by ${COMPANY.name}, registered office ${COMPANY.seat}, sole trader registration number ${COMPANY.registryNumber} (${REGISTRY}), tax number ${COMPANY.taxNumber}.`,
      `Email: ${CONTACT_EMAIL}. Hosting provider: ${HOSTING_PROVIDER}.`,
    ],
  },
  {
    title: 'The service',
    body: [
      'OurFilm is a browser-based disposable camera for events. A host creates an event, sets its shooting window, number of shots per guest and reveal time, then shares a QR code or link. Guests can take photos without an app or account. The host can view, hide, download and delete event photos.',
      'During the shooting window, guests take photos directly with the camera. If the host enables after-event gallery uploads, guests can also select existing photos from their phone during the 24 hours following the configured end of the shooting window. These uploads use each guest’s remaining frames from the same roll; they do not provide a new roll or change the shooting window or reveal rules.',
      'A compatible device, internet connection, browser and camera permission are required. We do not promise uninterrupted or error-free availability.',
    ],
  },
  {
    title: 'Contract and eligibility',
    body: [
      'Hosts can create an account and sign in using an email sign-in link or, optionally, a Google Account. Google sign-in may be linked to an existing OurFilm account with the same verified email address, preserving access to the same events. Signing in with Google does not itself place an order or replace acceptance of the terms requested when creating an event or placing a paid order. The Privacy Notice explains how sign-in data is handled.',
      `A host enters into a contract with OurFilm by accepting these Terms and creating an event. A paid order becomes final when payment is completed in Stripe Checkout. OurFilm supplies the digital service; ${PAYMENT_PROCESSOR.merchantOfRecord} acts as Merchant of Record for the purchase transaction where the billing address is outside Hungary. The contract is concluded in English for the English flow, is not separately filed, and can be saved or printed from this page.`,
      'Hosts must be at least 18 years old and able to enter into a binding contract. A guest accepts the guest rules and acknowledges the Privacy Notice by joining. Guests are not charged.',
    ],
  },
  {
    title: 'Price and payment',
    body: [
      `Up to 5 distinct guests may join a free event. Unlocking the full event removes this participant cap for that event; it is a one-off purchase, not a subscription or per-guest fee. The final price, currency and applicable taxes are shown in Stripe Checkout before purchase. For a billing address outside Hungary the price is ${EVENT_PRICE_LABELS.en}. With a Hungarian billing address the purchase is made directly from OurFilm for ${EVENT_PRICE_LABEL} under the Hungarian terms (ÁSZF), whichever language the site is shown in.`,
      `For a billing address outside Hungary, ${PAYMENT_PROCESSOR.merchantOfRecord} handles the transaction through ${PAYMENT_PROCESSOR.name}. OurFilm does not receive or store card details. Link sends the transaction confirmation and applicable invoice or receipt.`,
    ],
  },
  {
    title: 'Cancellation and refunds',
    body: [
      `Consumers in the EEA generally have 14 days from entering into a paid service contract to withdraw or, after performance begins, terminate without giving a reason. You can send a clear statement to ${CONTACT_EMAIL}. When requesting immediate access, you expressly ask us to begin before that period ends and may owe a proportionate amount for service supplied before cancellation.`,
      'If the paid unlock has not been used before notice is received—meaning no guest beyond the free five-person allowance has joined—we refund the full price. Mandatory consumer remedies and any stronger rights under the law of your country remain unaffected. Refunds are normally made through Stripe/Link to the original payment method within 14 days.',
    ],
  },
  {
    title: 'Acceptable use and content',
    body: [
      'The host must share the event link only with the intended audience and inform attendees about the shared photography. Users may only create or upload content they are entitled to create and share. Illegal, rights-infringing, hateful, severely violent or sexual content, automated abuse and interference with the service are prohibited.',
      'Users retain their rights in photos and grant OurFilm only the non-exclusive permission needed to store, display and make them downloadable as part of the service. We may hide, remove or restrict content or events where required by law, safety or serious or repeated misuse.',
    ],
  },
  {
    title: 'Photo availability and retention',
    body: [
      'Uploaded event photos are available to view and download for 12 calendar months from the end of the shooting window configured by the host. This applies to free and paid events, with no separate storage fee during that period. Guest access remains subject to the host’s access settings and reveal rules.',
      'At the end of the 12 months, gallery access ends and we delete the event photos and associated event and guest data from the active service. The optional 24-hour after-event upload window and later uploads of individual photos do not restart the retention period.',
      'This retention rule applies to events created under the current Terms. For earlier events, the retention terms accepted at creation or purchase continue to apply.',
      'The host can permanently delete the event earlier. This does not affect data subjects’ erasure rights, removal of unlawful content or justified restrictions. The Privacy Notice explains how caches, backup copies and records required by law are handled.',
      'The host must download any photos they want to keep before the retention period ends or the event is deleted earlier. OurFilm does not provide indefinite storage; deleted events and photos cannot be restored through the service.',
    ],
  },
  {
    title: 'Fair use and availability',
    body: [
      '“Unlimited guests” means that a paid event has no ordinary per-guest product cap. It does not permit bots, scraping, denial-of-service activity, bulk automated uploads or use as general-purpose storage. We may apply proportionate technical limits, temporarily pause uploads, or contact the host where activity threatens security, availability or storage capacity. We will avoid disrupting legitimate event use where reasonably possible.',
      'OurFilm is not a backup service. Hosts should download photos they want to retain. Deleting an event is permanent.',
    ],
  },
  {
    title: 'Liability, complaints and law',
    body: [
      `We remain liable where the law requires, including for defective performance and damage caused by us. We are not responsible for failures outside our reasonable control, user devices or connectivity, or unlawful user content. Complaints may be sent to ${CONTACT_EMAIL}; written complaints are answered in writing within 30 days.`,
      'Hungarian law governs these Terms. This choice does not deprive a consumer of mandatory protections available under the law of their habitual residence. Courts and alternative dispute-resolution bodies remain available as provided by applicable law.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'We publish changes on this page with a new update date. The version accepted at purchase applies to an already paid event unless law or a more favourable change requires otherwise.',
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
      eyebrow={locale === 'en' ? 'TERMS' : 'ÁSZF'}
      title={
        locale === 'en' ? 'Terms of Service' : 'Általános szerződési feltételek'
      }
      lead={
        locale === 'en'
          ? 'The terms for creating and joining an OurFilm event, including payment, cancellation and fair use.'
          : 'Röviden és a mostani termékhez igazítva: mit nyújt az OurFilm, hogyan fizetsz, és miért felelnek a résztvevők.'
      }
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Indulás előtt töltsd ki a szolgáltató adatait.
              </strong>{' '}
              A <code>lib/company.ts</code> TODO értékei még nem valódi adatok,
              ezért ez az oldal jelenleg nincs indexelve.
            </DraftNotice>
          )}

          <LegalSections
            sections={locale === 'en' ? englishSections : sections}
          />

          <p className="mt-12 text-sm text-muted-foreground">
            {locale === 'en' ? 'Last updated' : 'Utolsó frissítés'}:{' '}
            {TERMS_LAST_UPDATED[locale]}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
