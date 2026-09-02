'use client'

import { Download, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef, useState } from 'react'

import { Sheet } from '@/components/host/sheet'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'

/**
 * Keeps the downloadable QR available without making it the whole event page.
 *
 * Drawn in the shared `Sheet` like every other host-area interruption. It used
 * to be its own `<dialog>` with its own close button, its own backdrop-click
 * handler and its own `glass-strong` panel — three copies of the same three
 * decisions, and the panel was the see-through one on iOS.
 *
 * The sheet's heading is "QR-kód" rather than the event's name, because the
 * ticket below already says the name in the size it will be printed at. */
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
  const qrRef = useRef<HTMLCanvasElement>(null)

  async function downloadQrCode() {
    const canvas = qrRef.current
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

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${name} QR code`,
        })
        return
      } catch (error) {
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
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="lg"
        className="w-full px-4"
      >
        <QrCode className="size-5" strokeWidth={1.8} aria-hidden="true" />
        {en ? 'QR code' : 'QR-kód'}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={en ? 'Close QR code' : 'QR-kód bezárása'}
        title={en ? 'QR code' : 'QR-kód'}
      >
        {/* The one deliberately light surface in the product: this is the
              thing that gets printed and stood on a table, and a dark card is
              a dark card's worth of toner. */}
        <div className="rounded-[1.6rem] bg-gradient-to-b from-white to-[#f2f2f5] p-8 text-center text-black">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            {name}
          </p>
          <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-black/50">
            {en ? 'DISPOSABLE CAMERA' : 'ELDOBHATÓ KAMERA'}
          </p>

          <div className="my-7 flex justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
              <QRCodeCanvas
                ref={qrRef}
                value={url}
                size={1024}
                level="M"
                bgColor="#ffffff"
                fgColor="#050505"
                marginSize={4}
                style={{ height: 168, width: 168 }}
              />
            </div>
          </div>

          <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-black/70">
            {en
              ? `Scan the QR code and take ${shots} photos — no app or account needed.`
              : `Olvasd be a QR-kódot, és ${shots} képet készíthetsz — app és regisztráció nélkül.`}
          </p>
          <div className="mt-6 border-t border-black/10 pt-4">
            <p className="truncate text-xs font-medium text-black/50">
              {url.replace('https://', '')}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={downloadQrCode}
          variant="secondary"
          className="mt-3 w-full"
        >
          <Download className="size-4" aria-hidden="true" />
          {en ? 'Download QR code' : 'QR-kód letöltése'}
        </Button>
      </Sheet>
    </>
  )
}
