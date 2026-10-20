/**
 * The one email layout, in the app's own type and tokens.
 *
 * Every mail the product sends — the sign-in link, the signup confirmation,
 * the album-ready notice, the host's event mail — goes through this so they
 * read as one thing, and as the same thing as the screens: the landing look
 * the host app wears. Roboto Serif for the wordmark and the heading, Inter
 * for sentences and the kicker, Crimson Text italic for figures, the `#0d0d0d`
 * ground, a panel and tiles with no borders, and one white button.
 *
 * Email clients are the constraint. Web fonts load in Apple Mail, iOS Mail
 * and Outlook for Mac; Gmail ignores the `<link>` and takes the fallback
 * stacks, which are chosen to keep the shape (a serif heading stays a serif).
 * The panel and tile washes are flattened to hex over the ground, because
 * email cannot composite alpha.
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
  /** A kicker: tracked capitals, one to three words — what kind of mail. */
  eyebrow: string
  heading: string
  /** Paragraphs, in order. Plain text; escaped here. */
  intro: string[]
  /** Figure tiles, like the host event page's. Optional. */
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
  'https://fonts.googleapis.com/css2?family=Roboto+Serif:opsz,wdth,wght@8..144,125,300&family=Inter:wght@400;500&family=Crimson+Text:ital,wght@1,600&display=swap'

const SANS =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
/** Roboto Serif opened to the landing's width. Clients that ignore the
 *  variation setting draw it at normal width, which is still the face. */
const DISPLAY = "'Roboto Serif',Georgia,'Times New Roman',serif"
const DISPLAY_STYLE = `font-family:${DISPLAY};font-weight:300;font-variation-settings:'wdth' 125`
const FIGURE = "'Crimson Text',Georgia,'Times New Roman',serif"

/** The landing's tokens, flattened to hex: email cannot composite alpha. */
const C = {
  ground: '#0d0d0d', // --landing
  panel: '#171717', // white 4% over the ground: --host-panel
  tile: '#232323', // white 6% over the panel: --host-tile
  white: '#ffffff',
  ink: '#101010', // --landing-ink, on the white button
  read: '#b0b0b0', // white 65% over the panel: body copy and kickers
  quiet: '#929292', // white 55% over the ground: the footer
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** A kicker's inline style: Inter 500, tracked capitals. */
const KICKER = `font-family:${SANS};font-size:11px;line-height:1.3;font-weight:500;letter-spacing:.24em;text-transform:uppercase`

function figureTiles(figures: EmailFigure[]): string {
  const cells = figures
    .map(
      (
        f,
        i,
      ) => `<td style="${i > 0 ? 'padding-left:8px;' : ''}vertical-align:top" width="${Math.floor(100 / figures.length)}%">
              <div style="background-color:${C.tile};border-radius:20px;padding:14px 14px 12px">
                <div style="font-family:${FIGURE};font-style:italic;font-weight:600;font-size:26px;line-height:1.05;color:${C.white};white-space:nowrap">${escapeHtml(f.value)}</div>
                <div style="${KICKER};font-size:10px;letter-spacing:.16em;color:${C.read};padding-top:6px">${escapeHtml(f.label)}</div>
              </div>
            </td>`,
    )
    .join('')
  return `<tr><td style="padding:22px 0 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells}</tr></table>
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
        `<tr><td style="padding:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.read}">${escapeHtml(p)}</td></tr>`,
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
        .card { padding: 30px 22px !important; border-radius: 24px !important; }
        .h1 { font-size: 30px !important; }
        .btn a { display: block !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${C.ground};color:${C.white};-webkit-font-smoothing:antialiased">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.ground}">
      <tr><td align="center" style="padding:40px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px">
          <tr><td style="padding:0 4px 20px;${DISPLAY_STYLE};font-size:24px;line-height:1;letter-spacing:-0.01em;color:${C.white}">OurFilm</td></tr>
          <tr><td class="card" style="background-color:${C.panel};border-radius:32px;padding:36px 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="${KICKER};color:${C.read};padding-bottom:16px">${escapeHtml(input.eyebrow)}</td></tr>
              <tr><td class="h1" style="${DISPLAY_STYLE};font-size:34px;line-height:1.15;letter-spacing:-0.01em;color:${C.white}">${escapeHtml(input.heading)}</td></tr>
              ${intro}
              ${input.figures?.length ? figureTiles(input.figures) : ''}
              <tr><td class="btn" align="center" style="padding:28px 0 16px">
                <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:56px;v-text-anchor:middle;width:400px;" arcsize="29%" stroke="f" fillcolor="${C.white}">
                    <w:anchorlock/>
                    <center style="color:${C.ink};font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(input.button.label)}</center>
                  </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${url}" style="display:inline-block;background-color:${C.white};color:${C.ink};font-family:${SANS};font-size:16px;font-weight:500;line-height:56px;text-align:center;text-decoration:none;padding:0 30px;border-radius:16px">${escapeHtml(input.button.label)}</a>
                <!--<![endif]-->
              </td></tr>
              ${input.underButton ? `<tr><td align="center" style="font-family:${SANS};font-size:13px;line-height:1.6;color:${C.read};padding:0 12px 8px">${escapeHtml(input.underButton)}</td></tr>` : ''}
              ${input.note ? `<tr><td style="padding-top:22px"><div style="background-color:${C.tile};border-radius:20px;padding:16px 18px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.read}">${escapeHtml(input.note)}</div></td></tr>` : ''}
              ${
                input.fallbackUrl
                  ? `<tr><td style="padding:24px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.read}">${escapeHtml(input.locale === 'en' ? 'If the button does not work, copy this address into your browser:' : 'Ha a gomb nem működik, másold be ezt a címet a böngésződbe:')}</td></tr>
              <tr><td style="padding-top:8px"><a href="${escapeHtml(input.fallbackUrl)}" style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.white};text-decoration:underline;word-break:break-all">${escapeHtml(input.fallbackUrl)}</a></td></tr>`
                  : ''
              }
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 8px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.quiet}">${escapeHtml(input.footer)}</td></tr>
          <tr><td align="center" style="padding-top:10px;${KICKER};font-size:10px;color:${C.quiet}">OurFilm · ourfilm.app</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const figuresText = input.figures?.length
    ? [input.figures.map((f) => `${f.label}: ${f.value}`).join(' · '), '']
    : []
  const text = [
    'OurFilm',
    input.heading,
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
