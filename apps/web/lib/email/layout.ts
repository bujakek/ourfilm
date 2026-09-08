/**
 * The one email layout, in the app's own type and tokens.
 *
 * Every mail the product sends — the sign-in link, the signup confirmation,
 * the album-ready notice — goes through this so they read as one thing, and
 * as the same thing as the screens: Instrument Serif for the wordmark and the
 * heading, Manrope for sentences, Martian Mono for the eyebrow and the ruled
 * strip of figures, near-black ground, hairline borders, a white pill for the
 * one action, lilac only on the fallback link. The same vocabulary as the
 * host page's header and the join ticket.
 *
 * Email clients are the constraint. Web fonts load in Apple Mail, iOS Mail
 * and Outlook for Mac; Gmail ignores the `<link>` and takes the fallback
 * stacks, which are chosen to keep the shape (a serif heading stays a serif).
 * Every rule that matters is inline, because Gmail's mobile apps strip
 * `<style>`; Outlook on Windows renders with Word and gets a VML pill of its
 * own for the button. Nothing here may be load-bearing only in `<style>`.
 *
 * Pure: no `server-only`, no imports beyond the language, so the static
 * Supabase templates can be rendered from it by a plain node script.
 */

export type EmailLocale = 'en' | 'hu'

export type EmailFigure = { label: string; value: string }

export type EmailLayoutInput = {
  locale: EmailLocale
  /** The line the inbox shows beside the subject. Short. */
  preheader: string
  /** Mono, tracked, uppercase — what kind of mail this is. */
  eyebrow: string
  heading: string
  /** Paragraphs, in order. Plain text; escaped here. */
  intro: string[]
  /** A ruled strip of figures, like the host page's config row. Optional. */
  figures?: EmailFigure[]
  button: { label: string; url: string }
  /** The small centred line under the button (validity, window). */
  underButton?: string
  /** A boxed note — a caveat the reader should not miss. */
  note?: string
  /** Show the URL in full for clients where the button does not work. */
  fallbackUrl?: string
  /** The first footer line ("if you did not request this…"). */
  footer: string
}

const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Manrope:wght@500;600&family=Martian+Mono:wght@400;500&display=swap'

const SANS =
  "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const DISPLAY = "'Instrument Serif',Georgia,'Times New Roman',serif"
const MONO =
  "'Martian Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

/** The app's tokens, flattened to hex: email cannot composite alpha. */
const C = {
  background: '#050505',
  card: '#0b0b0d',
  border: '#1c1c22',
  inset: '#111114',
  foreground: '#f7f7f7',
  muted: '#a1a1aa',
  quiet: '#75757d', // foreground at 45%, the eyebrow and strip labels
  faint: '#52525b',
  accent: '#c3b6ff',
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function figuresStrip(figures: EmailFigure[]): string {
  const cells = figures
    .map(
      (
        f,
        i,
      ) => `<td style="padding:14px ${i === figures.length - 1 ? '0' : '18px'} 14px ${i === 0 ? '0' : '18px'};${i > 0 ? `border-left:1px solid ${C.border};` : ''}vertical-align:top">
              <div style="font-family:${MONO};font-size:9.5px;font-weight:500;letter-spacing:.16em;color:${C.quiet};text-transform:uppercase">${escapeHtml(f.label)}</div>
              <div style="font-family:${MONO};font-size:14px;font-weight:500;letter-spacing:-0.01em;color:${C.foreground};padding-top:6px;white-space:nowrap">${escapeHtml(f.value)}</div>
            </td>`,
    )
    .join('')
  return `<tr><td style="padding:22px 0 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.border};border-bottom:1px solid ${C.border}"><tr>${cells}</tr></table>
          </td></tr>`
}

export function renderEmailLayout(input: EmailLayoutInput): {
  html: string
  text: string
} {
  const url = escapeHtml(input.button.url)
  const intro = input.intro
    .map(
      (p) =>
        `<tr><td style="padding:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.muted}">${escapeHtml(p)}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="${input.locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <link rel="stylesheet" href="${FONT_LINK}">
    <style>
      @media only screen and (max-width: 480px) {
        .card { padding: 30px 22px !important; border-radius: 20px !important; }
        .h1 { font-size: 30px !important; }
        .btn a { display: block !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${C.background};color:${C.foreground};-webkit-font-smoothing:antialiased">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.background}">
      <tr><td align="center" style="padding:40px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px">
          <tr><td style="padding:0 4px 20px;font-family:${DISPLAY};font-size:24px;line-height:1;letter-spacing:-0.01em;color:${C.foreground}">OurFilm</td></tr>
          <tr><td class="card" style="background-color:${C.card};border:1px solid ${C.border};border-radius:24px;padding:36px 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:${C.quiet};padding-bottom:16px">${escapeHtml(input.eyebrow)}</td></tr>
              <tr><td class="h1" style="font-family:${DISPLAY};font-size:36px;line-height:1.05;letter-spacing:-0.012em;font-weight:400;color:${C.foreground}">${escapeHtml(input.heading)}</td></tr>
              ${intro}
              ${input.figures?.length ? figuresStrip(input.figures) : ''}
              <tr><td class="btn" align="center" style="padding:28px 0 16px">
                <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:400px;" arcsize="50%" stroke="f" fillcolor="${C.foreground}">
                    <w:anchorlock/>
                    <center style="color:${C.background};font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;">${escapeHtml(input.button.label)}</center>
                  </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${url}" style="display:inline-block;background-color:${C.foreground};color:${C.background};font-family:${SANS};font-size:15px;font-weight:600;line-height:50px;text-align:center;text-decoration:none;padding:0 30px;border-radius:999px">${escapeHtml(input.button.label)}</a>
                <!--<![endif]-->
              </td></tr>
              ${input.underButton ? `<tr><td align="center" style="font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.quiet};padding:0 12px 8px">${escapeHtml(input.underButton)}</td></tr>` : ''}
              ${input.note ? `<tr><td style="padding-top:22px"><div style="background-color:${C.inset};border:1px solid ${C.border};border-radius:16px;padding:14px 16px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">${escapeHtml(input.note)}</div></td></tr>` : ''}
              ${
                input.fallbackUrl
                  ? `<tr><td style="padding:24px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.quiet}">${escapeHtml(input.locale === 'en' ? 'If the button does not work, copy this address into your browser:' : 'Ha a gomb nem működik, másold be ezt a címet a böngésződbe:')}</td></tr>
              <tr><td style="padding-top:8px"><a href="${escapeHtml(input.fallbackUrl)}" style="font-family:${MONO};font-size:11px;line-height:1.6;color:${C.accent};text-decoration:none;word-break:break-all">${escapeHtml(input.fallbackUrl)}</a></td></tr>`
                  : ''
              }
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 8px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.quiet}">${escapeHtml(input.footer)}</td></tr>
          <tr><td align="center" style="padding-top:10px;font-family:${MONO};font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.faint}">OurFilm · ourfilm.app</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const figuresText = input.figures?.length
    ? [input.figures.map((f) => `${f.label}: ${f.value}`).join(' · '), '']
    : []
  const text = [
    `OurFilm — ${input.heading}`,
    '',
    ...input.intro,
    '',
    ...figuresText,
    `${input.button.label}: ${input.button.url}`,
    ...(input.underButton ? ['', input.underButton] : []),
    ...(input.note ? ['', input.note] : []),
    '',
    input.footer,
  ].join('\n')

  return { html, text }
}
