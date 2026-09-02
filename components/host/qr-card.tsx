'use client'

import { Download, Share2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef, useState } from 'react'

import { Sheet } from '@/components/host/sheet'
import type { Locale } from '@/lib/i18n'

/**
 * The printable ticket, on the page rather than behind a button.
 *
 * It used to open in a sheet, which put one tap between a host standing at a
 * venue and the only thing they need there. It is 260px of paper: cheap to
 * render, and it answers the question without being asked.
 *
 * The sheet survives for the print-size view — tapping the code opens it — and
 * that is also where the large canvas earns its keep. `size={1024}` is the
 * canvas the download reads from; the 132px is only how it is displayed, so a
 * printed sheet is still 1024px of QR rather than an upscaled thumbnail.
 *
 * `.paper` is the shared material now, but the gradient here was the original:
 * this is the thing that gets printed and stood on a table, and a dark card is
 * a dark card's worth of toner.
 */
export function QrCard({
  name,
  url,
  shots,
  locale,
}: {
  name: string
  url: string
  shots: number
  locale: Locale
}) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const inlineRef = useRef<HTMLCanvasElement>(null)
  const sheetRef = useRef<HTMLCanvasElement>(null)

  /**
   * Canvas → PNG → File, then either the share sheet or a download.
   *
   * One mechanism, two entry points. `Megosztás` tries `navigator.share` first
   * because on a phone that is what puts the code into a chat with the venue;
   * `Letöltés` skips straight to the file, because a host who asked to
   * download did not ask to be shown a share sheet.
   */
  async function saveQrCode(share: boolean) {
    const canvas = (open ? sheetRef : inlineRef).current ?? inlineRef.current
    if (!canvas) return

    const safeName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const fileName = `${safeName || 'ourfilm'}-qr-code.png`
    const dataUrl = canvas.toDataURL('image/png')
    const binary = atob(dataUrl.split(',')[1])
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    )
    const blob = new Blob([bytes], { type: 'image/png' })
    const file = new File([blob], fileName, { type: blob.type })

    if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${name} QR code`,
        })
        return
      } catch (error) {
        // Closing the share sheet is a complete, normal outcome; only a real
        // failure falls through to the download.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = fileName
    link.href = objectUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  }

  return (
    <>
      <div className="paper rounded-lg p-5 text-center">
        <p className="font-display text-[19px] leading-[1.1] text-balance">
          {name}
        </p>
        <p className="paper-muted mt-1.5 font-mono text-[8px] font-medium tracking-[0.2em]">
          {en ? 'DISPOSABLE CAMERA' : 'ELDOBHATÓ KAMERA'} · {shots}{' '}
          {en ? 'SHOTS' : 'KÉP'}
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={en ? 'Show print size' : 'Nyomtatási méret'}
          className="mx-auto mt-4 block rounded-xs bg-white p-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]"
        >
          <QRCodeCanvas
            ref={inlineRef}
            value={url}
            size={1024}
            level="M"
            bgColor="#ffffff"
            fgColor="#050505"
            marginSize={4}
            style={{ height: 116, width: 116 }}
          />
        </button>

        {/* Wrapping, not truncating. This is the address a guest types when the
            camera will not scan, so an ellipsis in the middle of it defeats the
            one job the printed ticket has. */}
        <p className="paper-muted mt-3.5 font-mono text-[9px] leading-snug tracking-[0.01em] break-all">
          {url.replace('https://', '')}
        </p>

        <div className="paper-rule mt-4 flex gap-2 border-t pt-3.5">
          <button
            type="button"
            onClick={() => saveQrCode(false)}
            className="flex-1 rounded-[10px] bg-[color:var(--paper-foreground)] py-2.5 text-[11.5px] font-semibold text-[color:var(--paper)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Download className="size-3.5" aria-hidden="true" />
              {en ? 'Download' : 'Letöltés'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => saveQrCode(true)}
            className="flex-1 rounded-[10px] border border-[rgba(20,19,18,.2)] py-2.5 text-[11.5px] font-semibold"
          >
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="size-3.5" aria-hidden="true" />
              {en ? 'Share' : 'Megosztás'}
            </span>
          </button>
        </div>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={en ? 'Close QR code' : 'QR-kód bezárása'}
        title={en ? 'QR code' : 'QR-kód'}
      >
        <div className="paper rounded-2xl p-8 text-center">
          <p className="font-display text-[28px] leading-[1.1] text-balance">
            {name}
          </p>
          <p className="paper-muted mt-1.5 font-mono text-[9px] font-medium tracking-[0.22em]">
            {en ? 'DISPOSABLE CAMERA' : 'ELDOBHATÓ KAMERA'}
          </p>

          <div className="my-7 flex justify-center">
            <div className="rounded-sm bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
              <QRCodeCanvas
                ref={sheetRef}
                value={url}
                size={1024}
                level="M"
                bgColor="#ffffff"
                fgColor="#050505"
                marginSize={4}
                style={{ height: 200, width: 200 }}
              />
            </div>
          </div>

          <p className="paper-muted mx-auto max-w-[15rem] text-sm leading-relaxed">
            {en
              ? `Scan the QR code and take ${shots} photos — no app or account needed.`
              : `Olvasd be a QR-kódot, és ${shots} képet készíthetsz — app és regisztráció nélkül.`}
          </p>
          <div className="paper-rule mt-6 border-t pt-4">
            <p className="paper-muted truncate font-mono text-[10px]">
              {url.replace('https://', '')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => saveQrCode(false)}
          className="hover:border-strong mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-colors"
        >
          <Download className="size-4" aria-hidden="true" />
          {en ? 'Download QR code' : 'QR-kód letöltése'}
        </button>
      </Sheet>
    </>
  )
}
