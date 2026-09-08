export interface LegalSection {
  title: string
  /** Each string renders as its own paragraph. */
  body: string[]
}

/**
 * Numbered body for the legal scaffolds (/adatvedelem, /aszf). Shared so the
 * two pages cannot drift apart in structure while their copy is still being
 * written.
 */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="mt-12 space-y-10">
      {sections.map((section, i) => (
        <li key={section.title}>
          <h2 className="flex gap-3 text-xl font-semibold tracking-tight text-balance">
            <span className="text-accent tabular-nums" aria-hidden="true">
              {i + 1}.
            </span>
            {section.title}
          </h2>
          <div className="mt-3 space-y-3 pl-8">
            {section.body.map((paragraph) => (
              <p
                key={paragraph}
                className="leading-relaxed text-pretty text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}
