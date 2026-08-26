import {
  LEGAL_EFFECTIVE_LABEL,
  legalConfig,
  legalText,
  type LegalConfig,
} from '@/lib/legal/config'
import { p, ul, type LegalDocument } from '@/lib/legal/document'

/**
 * Vendégfelhasználási feltételek — approved source copy, rendered verbatim.
 *
 * The document a guest acknowledges once per event before their first shot
 * (`components/event/guest-acknowledgement.tsx`). Written in the second person
 * singular throughout, unlike the ÁSZF: the reader is someone who scanned a QR
 * code at a party, not someone entering into a contract.
 */
export function guestTermsDocument(
  config: LegalConfig = legalConfig,
): LegalDocument {
  const email = legalText(config.provider.email)

  return {
    title: 'Vendégfelhasználási feltételek',
    description:
      'Mit tölthetsz fel vendégként egy OurFilm-eseményre, milyen jogok maradnak a tiéd, és hogyan kérheted egy kép eltávolítását.',
    effective: LEGAL_EFFECTIVE_LABEL,
    sections: [
      {
        title: null,
        blocks: [
          p(
            'Az OurFilm segítségével egy rendezvény Házigazdájának meghívására készíthetsz és oszthatsz meg fényképeket. Vendégként nem kell fiókot létrehoznod vagy alkalmazást telepítened.',
          ),
        ],
      },
      {
        title: 'Mielőtt fényképet készítesz',
        blocks: [
          p(
            'A böngésző kameraengedélye szükséges ahhoz, hogy az OurFilm kamerája működjön. Ez technikai eszközengedély, nem adatvédelmi hozzájárulás. A fénykép csak a felület működése szerint, a felvétel elkészítése és feltöltése után kerül az eseményhez.',
          ),
          p(
            'Az esemény Házigazdája határozza meg, hány képet készíthetsz, mikor ér véget a fényképezés, és mikor válnak láthatóvá a képek. A felület a fényképezés előtt megmutatja a rád vonatkozó képlimitet és a felfedés szabályát.',
          ),
        ],
      },
      {
        title: 'Mit tölthetsz fel?',
        blocks: [
          p('Csak olyan fényképet készíts és tölts fel,'),
          ul(
            'amelynek elkészítésére és megosztására jogosult vagy;',
            'amely nem sérti más személy magánéletét, képmáshoz, szerzői vagy más jogát;',
            'amely nem jogellenes, fenyegető, zaklató, gyűlöletkeltő, erőszakos, szexuálisan kizsákmányoló vagy kiskorút veszélyeztető;',
            'amely nem tartalmaz kártékony kódot, és nem veszélyezteti a szolgáltatás működését.',
          ),
          p(
            'Ha egy fényképen más személy felismerhető, tartsd tiszteletben az adott esemény szabályait és az érintett személy jogait. Ne készíts vagy ossz meg megalázó, intim vagy olyan képet, amelynek megosztását az érintett észszerűen ellenezné.',
          ),
        ],
      },
      {
        title: 'A fényképekhez kapcsolódó jogok',
        blocks: [
          p(
            'A fénykép szerzői joga főszabály szerint a készítőt vagy más jogosultat illeti meg; a feltöltéssel nem adod át a szerzői jogodat az OurFilmnek.',
          ),
          p(
            'A feltöltéssel nem kizárólagos és díjmentes engedélyt adsz az OurFilmnek arra, hogy a fényképet a szolgáltatás működtetéséhez szükséges ideig tárolja, technikailag feldolgozza, átméretezze, megjelenítse, valamint a Házigazda és az eseményhez jogszerűen hozzáférő résztvevők számára elérhetővé tegye.',
          ),
          p(
            'Engedélyt adsz a Házigazdának és az eseményhez jogszerűen hozzáférő résztvevőknek arra, hogy a fényképet az eseményhez kapcsolódó magáncélra megtekintsék és letöltsék. Nyilvános, reklám- vagy üzleti felhasználáshoz külön engedélyre vagy más megfelelő jogalapra lehet szükség.',
          ),
        ],
      },
      {
        title: 'Láthatóság és törlés',
        blocks: [
          p(
            'A fényképed a Házigazda által kiválasztott felfedési időpontban válik elérhetővé a Házigazda és az eseményhez hozzáférő személyek számára. Az eseményhivatkozást csak olyan személlyel oszd meg, akinek a hozzáférését a Házigazda engedélyezte.',
          ),
          p(
            `Ha egy általad feltöltött fénykép eltávolítását kéred, vagy egy képen érintettként kifogást emelsz, írj a ${email} címre, vagy használd a jogsértő tartalom bejelentésére szolgáló oldalt. Add meg az esemény azonosításához és a fénykép megtalálásához szükséges adatokat. A kérelmet a jogosultságok és az érintett személyek jogainak figyelembevételével vizsgáljuk meg.`,
          ),
        ],
      },
      {
        title: 'Kiskorúak',
        blocks: [
          p(
            'Ha még nem múltál el 16 éves, az OurFilmet csak szülőd vagy törvényes képviselőd engedélyével és felügyeletével használd. Kiskorúról készült fénykép feltöltésekor különösen ügyelj a gyermek érdekére, biztonságára és magánéletére.',
          ),
        ],
      },
      {
        title: 'Intézkedések',
        blocks: [
          p(
            'Az OurFilm a jogellenes vagy e feltételeket sértő tartalmat eltávolíthatja vagy hozzáférhetetlenné teheti. Súlyos vagy ismételt visszaélés esetén a vendég eseményhez való hozzáférése korlátozható.',
          ),
          p(`Kapcsolat: ${email}`),
        ],
      },
    ],
  }
}
