import 'server-only'

import { readFileSync } from 'node:fs'
import { cache } from 'react'

import type { ContentDoc } from './types'

/**
 * The `## Gyakori kérdések` block, read back out of the page it renders on.
 *
 * FAQ structured data is only honest when the same question and the same
 * answer are visible to a reader, so nothing here is authored: the questions
 * and answers are parsed from the MDX body that the page renders. Hand-writing
 * a second copy in a JSON-LD block is how a page ends up promising an answer
 * it does not contain.
 *
 * Conservative on purpose. Only `###` headings inside that one section count,
 * and the answer is the **first paragraph** under the heading — every one of
 * these pages closes with a call to action that sits after the last answer,
 * and swallowing it into the schema would put a pitch where a reader expects
 * an answer. Under-quoting is safe; the text emitted is always verbatim on the
 * page. An answer that opens with a list or a table has no faithful plain-text
 * form at all, so a section containing one produces no FAQ schema.
 */

const FAQ_HEADING = '## Gyakori kérdések'

export interface FaqEntry {
  question: string
  answer: string
}

/** Strips the markdown a paragraph may carry down to the text a reader sees. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/\r/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export const getFaq = cache((doc: ContentDoc): FaqEntry[] => {
  const source = readFileSync(doc.filePath, 'utf8')

  const start = source.indexOf(`\n${FAQ_HEADING}`)
  if (start === -1) {
    const entries = [
      ...source.matchAll(/q:\s*'([^']+)',\s*a:\s*'([^']+)',/g),
    ].map(([, question, answer]) => ({ question, answer }))
    return entries
  }

  // The section runs to the next `##` of any depth-2 kind, or to the end.
  const rest = source.slice(start + FAQ_HEADING.length + 1)
  const nextSection = rest.search(/\n## /)
  const section = nextSection === -1 ? rest : rest.slice(0, nextSection)

  const entries: FaqEntry[] = []

  // Split on `### ` headings; the first chunk is whatever preceded the first
  // question and is dropped.
  const chunks = section.split(/\n### /).slice(1)

  for (const chunk of chunks) {
    const newline = chunk.indexOf('\n')
    if (newline === -1) return []

    const question = toPlainText(chunk.slice(0, newline))
    const rest = chunk.slice(newline + 1).trim()

    // The first paragraph, and only that. A blank line ends it.
    const [first = ''] = rest.split(/\n\s*\n/)

    // A list or a table cannot be flattened into a sentence without changing
    // what it says, so a question answered by one takes the whole section out.
    if (!first || /^\s*[-*|>]|^\s*\d+\./m.test(first)) return []

    const answer = toPlainText(first)
    if (!question || !answer) return []

    entries.push({ question, answer })
  }

  return entries
})
