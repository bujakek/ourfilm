'use client'

import { Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

/**
 * The artefact that ends up on the tables.
 *
 * Rendered as SVG rather than canvas so it prints at the printer's resolution
 * instead of the screen's — a canvas QR looks fine on a laptop and comes out of
 * an inkjet with soft, sometimes unscannable edges.
 *
 * Error correction stays at M: higher levels survive a coffee ring but pack in
 * more modules, and a denser code is harder for an older phone camera to read
 * across a dim room, which is the likelier failure at a wedding.
 */
export function QrCard({
  name,
  url,
  shots,
}: {
  name: string
  url: string
  /** Frames each guest gets. Printed on the card so the rule is visible before
   *  anyone scans. */
  shots: number
}) {
  return (
    <>
      <div className="print-card glass-strong mx-auto w-full max-w-sm rounded-[2rem] p-3">
        <div className="rounded-[1.6rem] bg-gradient-to-b from-white to-[#f2f2f5] p-8 text-center text-black">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            {name}
          </p>
          <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-black/50">
            ELDOBHATÓ KAMERA
          </p>

          <div className="my-7 flex justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
              <QRCodeSVG
                value={url}
                size={168}
                level="M"
                bgColor="#ffffff"
                fgColor="#050505"
              />
            </div>
          </div>

          {/* The shot count is the whole idea, so it belongs on the card that
              sits on the table — a guest decides how to use the camera before
              they ever open it. */}
          <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-black/70">
            Olvasd be a QR-kódot, és {shots} képet készíthetsz — app és
            regisztráció nélkül.
          </p>
          <div className="mt-6 border-t border-black/10 pt-4">
            <p className="truncate text-xs font-medium text-black/50">
              {url.replace('https://', '')}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="glass glass-hover print-hidden mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold"
      >
        <Printer className="size-4" />
        QR-kártya nyomtatása
      </button>
    </>
  )
}
