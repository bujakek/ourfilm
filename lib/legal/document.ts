/**
 * The shape a legal page is written in.
 *
 * The six documents are **data**, not JSX, and that is the point: the supplied
 * Hungarian is approved source copy that must be rendered verbatim, so it has
 * to be somewhere a test can read it without a React renderer. Every assertion
 * in `tests/unit/legal-copy.test.ts` — no unresolved `{{TOKEN}}`, the version
 * stamp present, the withdrawn EU ODR link absent, no legacy "korlátlan fotó"
 * claim — runs against these objects.
 *
 * The renderer (`components/site/legal-document.tsx`) adds no numbering and no
 * copy of its own. Section numbers that appear in the approved text are part
 * of the title string.
 */

export type LegalBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  /** Label/value pairs — the impresszum's identifier block. */
  | { kind: 'definitions'; items: { term: string; value: string }[] }
  | { kind: 'table'; caption?: string; head: string[]; rows: string[][] }

export type LegalDocumentSection = {
  /** Null for an untitled lead-in before the first numbered section. */
  title: string | null
  blocks: LegalBlock[]
}

export type LegalDocument = {
  /** `<h1>` and the basis of the page title. */
  title: string
  /** Meta description. Not part of the approved body copy. */
  description: string
  /** Always the shared "Hatályos: …" line. */
  effective: string
  sections: LegalDocumentSection[]
}

/** Every string a document contains, flattened. What the copy tests scan. */
export function documentStrings(doc: LegalDocument): string[] {
  const out = [doc.title, doc.description, doc.effective]
  for (const section of doc.sections) {
    if (section.title) out.push(section.title)
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') out.push(block.text)
      if (block.kind === 'list') out.push(...block.items)
      if (block.kind === 'definitions') {
        for (const item of block.items) out.push(item.term, item.value)
      }
      if (block.kind === 'table') {
        if (block.caption) out.push(block.caption)
        out.push(...block.head, ...block.rows.flat())
      }
    }
  }
  return out
}

/** Shorthands, so a document reads as prose rather than as object literals. */
export const p = (text: string): LegalBlock => ({ kind: 'paragraph', text })
export const ul = (...items: string[]): LegalBlock => ({ kind: 'list', items })
