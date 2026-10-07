import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_LANG_HEADER,
  DOCUMENT_ROUTE_HEADER,
  documentRouteFor,
  markDocumentLocale,
} from '@/lib/document-locale'

function marked(pathname: string, lang: string | null, sent?: HeadersInit) {
  const headers = new Headers(sent)
  markDocumentLocale(headers, pathname, lang)
  return [headers.get(DOCUMENT_ROUTE_HEADER), headers.get(DOCUMENT_LANG_HEADER)]
}

describe('the document language hint', () => {
  it('tells guest, host and auth routes apart, and nothing else', () => {
    expect(documentRouteFor('/e/k3f9x7ab2m')).toBe('guest')
    expect(documentRouteFor('/host')).toBe('host')
    expect(documentRouteFor('/host/events/new')).toBe('host')
    expect(documentRouteFor('/auth/event-complete')).toBe('host')
    expect(documentRouteFor('/hosting')).toBeNull()
    expect(documentRouteFor('/hu')).toBeNull()
    expect(documentRouteFor('/e')).toBeNull()
  })

  it('passes a host page its validated ?lang', () => {
    expect(marked('/host', 'hu')).toEqual(['host', 'hu'])
    expect(marked('/host', 'de')).toEqual(['host', null])
    expect(marked('/host', null)).toEqual(['host', null])
  })

  it('never passes ?lang for a guest, whose language is their own', () => {
    expect(marked('/e/k3f9x7ab2m', 'hu')).toEqual(['guest', null])
  })

  it('drops whatever a browser sent under the same names', () => {
    const spoofed = {
      [DOCUMENT_ROUTE_HEADER]: 'host',
      [DOCUMENT_LANG_HEADER]: 'hu',
    }
    expect(marked('/hu', null, spoofed)).toEqual([null, null])
    expect(marked('/host', null, spoofed)).toEqual(['host', null])
  })
})
