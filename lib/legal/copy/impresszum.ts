import {
  LEGAL_EFFECTIVE_LABEL,
  legalConfig,
  legalText,
  MISSING,
  type LegalConfig,
} from '@/lib/legal/config'
import { p, type LegalDocument } from '@/lib/legal/document'

/**
 * Impresszum — approved source copy, rendered verbatim.
 *
 * Every identifier is a token resolved from `legalConfig`; unresolved ones
 * render as HIÁNYZÓ KÖTELEZŐ ADAT rather than as an invented value.
 */
export function imprintDocument(
  config: LegalConfig = legalConfig,
): LegalDocument {
  const email = legalText(config.provider.email)

  return {
    title: 'Impresszum',
    description:
      'Az OurFilm szolgáltatót üzemeltető vállalkozás azonosító adatai, a tárhelyszolgáltató és a panaszkezelés elérhetősége.',
    effective: LEGAL_EFFECTIVE_LABEL,
    sections: [
      {
        title: 'A szolgáltató adatai',
        blocks: [
          {
            kind: 'definitions',
            items: [
              {
                term: 'Szolgáltató neve',
                value: legalText(config.provider.legalName),
              },
              {
                term: 'Jogi forma',
                value: legalText(config.provider.legalForm),
              },
              {
                term: 'Székhely',
                value: legalText(config.provider.registeredSeat),
              },
              {
                term: 'Levelezési cím',
                value: legalText(config.provider.mailingAddress),
              },
              {
                term: 'Nyilvántartási szám',
                value: legalText(config.provider.registrationNumber),
              },
              {
                term: 'Nyilvántartó hatóság',
                value: legalText(config.provider.registryAuthority),
              },
              { term: 'Adószám', value: legalText(config.provider.taxNumber) },
              { term: 'E-mail-cím', value: email },
              {
                // Mandatory under 45/2014. (II. 26.) Korm. rendelet 11. §, so an
                // absent number is a gap to shout about rather than a field to
                // quietly leave out.
                term: 'Telefonszám',
                value: legalText(config.provider.phone ?? MISSING),
              },
            ],
          },
          p(
            'A szolgáltató alanyi adómentes. Az árak forintban értendők, és a fizetendő végösszeget tartalmazzák.',
          ),
        ],
      },
      {
        title: 'Tárhelyszolgáltató',
        blocks: [
          {
            kind: 'definitions',
            items: [
              { term: 'Név', value: legalText(config.hostingProvider.name) },
              {
                term: 'Székhely',
                value: legalText(config.hostingProvider.registeredSeat),
              },
              {
                term: 'E-mail-cím',
                value: legalText(config.hostingProvider.email),
              },
            ],
          },
        ],
      },
      {
        title: 'Kapcsolat és panaszkezelés',
        blocks: [
          p(
            `Az OurFilm szolgáltatással, számlázással vagy panasszal kapcsolatos megkereséseket a ${email} címen fogadjuk. A panaszokat a vonatkozó jogszabályok szerint kivizsgáljuk és megválaszoljuk.`,
          ),
        ],
      },
    ],
  }
}
