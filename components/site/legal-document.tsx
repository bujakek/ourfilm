import type { LegalBlock, LegalDocument } from '@/lib/legal/document'

/**
 * Renders a `LegalDocument` and adds nothing to it.
 *
 * No numbering, no headings of its own, no summarising lead — the section
 * numbers that appear are part of the approved title strings. That
 * discipline is what makes `tests/unit/legal-copy.test.ts` meaningful: what
 * the test reads out of the data module is exactly what a visitor sees.
 *
 * The table scrolls inside its own container rather than widening the page;
 * the sub-processor table is four columns of Hungarian on a 390px phone.
 */
export function LegalDocumentBody({ document }: { document: LegalDocument }) {
  return (
    <div className="mt-10 space-y-10">
      {document.sections.map((section, i) => (
        <section key={section.title ?? `lead-${i}`}>
          {section.title ? (
            <h2 className="text-xl font-semibold tracking-tight text-balance">
              {section.title}
            </h2>
          ) : null}
          <div className={section.title ? 'mt-3 space-y-3' : 'space-y-3'}>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'paragraph') {
    return (
      <p className="leading-relaxed text-pretty text-muted-foreground">
        {block.text}
      </p>
    )
  }

  if (block.kind === 'list') {
    return (
      <ul className="ml-5 list-disc space-y-2">
        {block.items.map((item) => (
          <li
            key={item}
            className="leading-relaxed text-pretty text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    )
  }

  if (block.kind === 'definitions') {
    return (
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {block.items.map((item) => (
          <div key={item.term} className="contents">
            <dt className="font-medium text-foreground">{item.term}:</dt>
            <dd className="text-pretty text-muted-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        {block.caption ? (
          <caption className="pb-2 text-left text-sm text-muted-foreground">
            {block.caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-border">
            {block.head.map((cell) => (
              <th key={cell} className="py-2 pr-4 font-medium text-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-border/50">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className="py-3 pr-4 align-top leading-relaxed text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
