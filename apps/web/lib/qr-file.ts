import 'client-only'

/**
 * The QR code, out of the page and onto something printable.
 *
 * The canvas is always rendered at `size={1024}` however small it is
 * displayed, so what comes out of here is print resolution rather than an
 * upscaled thumbnail. It lives in `lib/` rather than in its one caller because
 * the printed code is the thing a host actually needs at a venue, and the
 * surface offering it has already moved once.
 */

/** `Anna & Péter esküvője` → `anna-peter-eskuvoje-qr-code.png`. Accents are
 *  folded rather than dropped, so the filename is still recognisably the
 *  event's. */
export function qrFileName(eventName: string): string {
  const safe = eventName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${safe || 'ourfilm'}-qr-code.png`
}

export function downloadQrCanvas(
  canvas: HTMLCanvasElement | null,
  eventName: string,
): void {
  if (!canvas) return

  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const objectUrl = URL.createObjectURL(
    new Blob([bytes], { type: 'image/png' }),
  )

  const link = document.createElement('a')
  link.download = qrFileName(eventName)
  link.href = objectUrl
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
