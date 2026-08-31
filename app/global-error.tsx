'use client'

import { useEffect } from 'react'

/**
 * Catches errors thrown by the root layout itself, which `error.tsx` cannot.
 * It replaces the whole document, so it must render its own <html>/<body>.
 *
 * Styled inline on purpose: this renders in the case where the layout failed,
 * and the layout is what loads the stylesheet and the font. Tailwind classes
 * here would be a coin flip.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root layout error', error.digest ?? '', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
          color: '#f7f7f7',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '1rem',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: '1rem', lineHeight: 1.6, color: '#a1a1aa' }}>
            The page could not be loaded. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.875rem 1.75rem',
              borderRadius: '999px',
              border: 'none',
              background: '#f7f7f7',
              color: '#050505',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
