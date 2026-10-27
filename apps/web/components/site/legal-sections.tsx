/** One numbered section of a legal page. `InfoSections` in
 *  `components/pages/info-page.tsx` renders them. */
export interface LegalSection {
  title: string
  /** Each string renders as its own paragraph. */
  body: string[]
  links?: { href: string; label: string }[]
}
