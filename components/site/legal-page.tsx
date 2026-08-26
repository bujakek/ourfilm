import { DraftNotice } from '@/components/site/draft-notice'
import { LegalDocumentBody } from '@/components/site/legal-document'
import { PageShell } from '@/components/site/page-shell'
import type { Locale } from '@/lib/i18n'
import { hasCompleteLegalConfig } from '@/lib/legal/config'
import type { LegalDocument } from '@/lib/legal/document'

/**
 * The frame all six legal documents sit in.
 *
 * One component rather than six near-copies, because the two things that must
 * be identical across them are exactly the two a copy-paste gets wrong: the
 * "Hatályos" stamp, and the banner that appears while the provider's
 * identifiers are still missing.
 *
 * The banner deliberately does not enumerate what is missing. The blocker list
 * is developer-facing (`legalBlockers()`), and printing "no tax number yet" to
 * a visitor is a different message from "this page is not final".
 */
export function LegalPage({
  locale,
  eyebrow,
  document,
}: {
  locale: Locale
  eyebrow: string
  document: LegalDocument
}) {
  return (
    <PageShell locale={locale} eyebrow={eyebrow} title={document.title}>
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-accent">
            {document.effective}
          </p>

          {hasCompleteLegalConfig() ? null : (
            <div className="mt-6">
              <DraftNotice>
                <strong className="font-semibold text-foreground">
                  Ez a dokumentum még nem véglegesített.
                </strong>{' '}
                A vállalkozás néhány kötelező azonosító adata hiányzik, ezért a
                szövegben <code>HIÁNYZÓ KÖTELEZŐ ADAT</code> jelölés szerepel.
                Amíg ez így van, az oldal nem jelenik meg a keresőkben.
              </DraftNotice>
            </div>
          )}

          <LegalDocumentBody document={document} />
        </div>
      </section>
    </PageShell>
  )
}
